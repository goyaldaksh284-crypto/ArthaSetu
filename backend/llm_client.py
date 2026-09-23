"""
Lightweight LLM client -- Gemini primary, Groq fallback -- with no AutoGen
dependency. Used by:
- autogen_runtime.py's run_autogen_mcp_task (agents not yet migrated to
  deterministic Python logic)
- agents/finance_helpers.py's generate_narrative (deterministic agents that
  only need the LLM to phrase already-computed real numbers as text)

Kept dependency-light (just `requests`) on purpose: the deterministic agents
should be runnable/testable without installing the full autogen-agentchat/
autogen-ext stack.
"""

import asyncio
import logging
import os
import time
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# Rate limiting - shared across providers so a Gemini->Groq fallback within
# one call doesn't burst past either provider's free-tier quota. Real free
# tiers (checked directly): Gemini 2.5 Flash allows 10 requests/minute,
# Groq's llama-3.3-70b-versatile allows 30/minute. 7s keeps every call under
# the tighter (Gemini) limit with margin, instead of the previous 60s, which
# was ~6-10x more conservative than needed and made a 9-agent analysis run
# (each agent makes one narrative call) take close to 8 minutes wall-clock
# for no quota-safety reason.
last_call_time = 0
RATE_LIMIT_DELAY = 7


class OpenAICompatibleClient:
    """
    Minimal REST client for any provider exposing an OpenAI-compatible
    /chat/completions endpoint. Gemini and Groq both do, so one class covers
    both -- only base_url/api_key/model differ per provider.
    """

    def __init__(self, provider: str, api_key: str, base_url: str, model: str):
        self.provider = provider
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.model = model
        # Kept for AutoGen compatibility (autogen_runtime.py still passes
        # this client into AssistantAgent(), though its tool-loop is unused).
        self.model_info = {
            "function_calling": True,
            "structured_output": True,
            "json_output": True,
            "vision": False,
            "family": "openai"
        }

    async def create(self, messages, **kwargs):
        """Create chat completion, returning an object with .choices[0].message.content."""
        global last_call_time
        current_time = time.time()
        if current_time - last_call_time < RATE_LIMIT_DELAY:
            wait_time = RATE_LIMIT_DELAY - (current_time - last_call_time)
            logger.info(f"[{self.provider}] Rate limiting: waiting {wait_time:.1f} seconds...")
            await asyncio.sleep(wait_time)

        last_call_time = time.time()

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        openai_messages = []
        for msg in messages:
            if isinstance(msg, dict):
                openai_messages.append(msg)
            elif hasattr(msg, 'content'):
                openai_messages.append({
                    "role": "user" if not hasattr(msg, 'source') or msg.source == "user" else "assistant",
                    "content": msg.content
                })
            else:
                openai_messages.append({"role": "user", "content": str(msg)})

        if not openai_messages:
            openai_messages = [{"role": "user", "content": "Please analyze the data."}]

        data = {
            "model": self.model,
            "messages": openai_messages,
            "max_tokens": kwargs.get('max_tokens', 8192),
            "temperature": kwargs.get('temperature', 0.7)
        }
        if self.provider == "Gemini":
            # Without this, Gemini 2.5's "thinking" mode consumes the
            # max_tokens budget internally before writing any visible
            # answer -- confirmed empirically to return empty/truncated
            # content at narrative-sized token budgets (~200) without it.
            data["reasoning_effort"] = "none"

        response = requests.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json=data,
            timeout=60,
        )

        if response.status_code != 200:
            raise RuntimeError(f"{self.provider} API error: {response.status_code} - {response.text}")

        result = response.json()

        try:
            from autogen_ext.models.openai._openai_client import ChatCompletion
        except ImportError:
            class ChatCompletion:
                def __init__(self, choices, created, id, model, object, usage):
                    self.choices = choices
                    self.created = created
                    self.id = id
                    self.model = model
                    self.object = object
                    self.usage = usage

        choice = result.get('choices', [{}])[0]
        message = choice.get('message', {})
        content = message.get('content', '')

        return ChatCompletion(
            choices=[choice] if content else [{"message": {"content": "No response generated", "role": "assistant"}}],
            created=result.get('created'),
            id=result.get('id'),
            model=result.get('model'),
            object=result.get('object'),
            usage=result.get('usage', {})
        )

    async def close(self):
        pass


def create_gemini_model_client(model: Optional[str] = None) -> OpenAICompatibleClient:
    """Create a Gemini client via its OpenAI-compatible endpoint."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY environment variable must be set")

    return OpenAICompatibleClient(
        provider="Gemini",
        api_key=api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
        model=model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    )


def create_openrouter_model_client(model: Optional[str] = None) -> OpenAICompatibleClient:
    """Create an OpenRouter client using OpenAI or Google models."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY environment variable must be set")

    return OpenAICompatibleClient(
        provider="OpenRouter",
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        model=model or os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
    )


def create_groq_model_client(model: Optional[str] = None) -> OpenAICompatibleClient:
    """Create a Groq client via its OpenAI-compatible endpoint (legacy fallback)."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY environment variable must be set")

    return OpenAICompatibleClient(
        provider="Groq",
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
        model=model or os.getenv("GROQ_MODEL", "allam-2-7b"),
    )


async def generate_narrative(system_prompt: str, user_prompt: str, max_tokens: int = 400) -> str:
    """
    Ask the LLM for a short narrative/explanation string grounded in
    already-computed real numbers (passed in user_prompt).
    Strictly uses Google and OpenAI models:
    1. Google Gemini (gemini-3.6-flash) primary
    2. OpenRouter OpenAI (openai/gpt-4o-mini) fallback
    3. OpenRouter Google (google/gemini-2.5-flash) fallback
    Returns plain text, never raises -- on total failure returns a generic
    fallback string so a narrative-only outage never blocks a deterministic agent.
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    factories = [
        lambda: create_gemini_model_client(),
        lambda: create_openrouter_model_client(os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")),
        lambda: create_openrouter_model_client(os.getenv("OPENROUTER_GOOGLE_MODEL", "google/gemini-2.5-flash")),
    ]

    for factory in factories:
        try:
            client = factory()
            result = await client.create(messages, max_tokens=max_tokens)
            content = result.choices[0]["message"]["content"] if isinstance(result.choices[0], dict) else result.choices[0].message.content
            if content:
                return content.strip()
        except Exception as e:
            logger.warning(f"[generate_narrative] Provider failed: {e}")
            continue

    return "Analysis based on your recent transaction history."

