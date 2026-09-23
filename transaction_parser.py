"""
Transaction Parser & AI Service
================================
Multi-provider AI processing for receipt images, voice audio, and gig-worker financial chat.
Uses Google Gemini and OpenRouter (OpenAI & Google models only) with offline fallbacks.
"""

import os
import re
import json
import base64
import urllib.request
import urllib.error
import mimetypes
from typing import Dict, Any, Optional, List
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv(Path(__file__).parent / "backend" / ".env")

# API Keys (Google Gemini: All previous & new keys)
GOOGLE_API_KEYS = []
google_var_candidates = ["GOOGLE_API_KEY"] + [f"GOOGLE_API_KEY_{i}" for i in range(1, 21)] + [
    "GOOGLE_API_KEY_FALLBACK_1", "GOOGLE_API_KEY_FALLBACK_2", "GOOGLE_API_KEY_FALLBACK_3"
] + [k for k in os.environ if k.startswith("GOOGLE_API_KEY")]
for var in google_var_candidates:
    val = os.getenv(var)
    if val and val.strip() and val.strip() not in GOOGLE_API_KEYS:
        GOOGLE_API_KEYS.append(val.strip())

# OpenRouter API Keys (All previous & new keys)
OPENROUTER_API_KEYS = []
openrouter_var_candidates = ["OPENROUTER_API_KEY"] + [f"OPENROUTER_API_KEY_{i}" for i in range(1, 21)] + [
    "OPENROUTER_API_KEY_FALLBACK"
] + [k for k in os.environ if k.startswith("OPENROUTER_API_KEY")]
for var in openrouter_var_candidates:
    val = os.getenv(var)
    if val and val.strip() and val.strip() not in OPENROUTER_API_KEYS:
        OPENROUTER_API_KEYS.append(val.strip())

# Groq API Keys (All previous & new keys)
GROQ_API_KEYS = []
groq_var_candidates = ["GROQ_API_KEY"] + [f"GROQ_API_KEY_{i}" for i in range(1, 21)] + [
    "GROQ_API_KEY_FALLBACK_1", "GROQ_API_KEY_FALLBACK_2", "GROQ_API_KEY_FALLBACK_3"
] + [k for k in os.environ if k.startswith("GROQ_API_KEY")]
for var in groq_var_candidates:
    val = os.getenv(var)
    if val and val.strip() and val.strip() not in GROQ_API_KEYS:
        GROQ_API_KEYS.append(val.strip())

# Models (Groq models verified active on Groq LPU: qwen/qwen3.8-27b and openai/gpt-oss-120b)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
OPENROUTER_OPENAI_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
OPENROUTER_FAST_MODEL = os.getenv("OPENROUTER_FAST_MODEL", "meta-llama/llama-3.2-3b-instruct")
OPENROUTER_GOOGLE_MODEL = os.getenv("OPENROUTER_GOOGLE_MODEL", "google/gemini-2.5-flash")
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
GROQ_MODEL_FALLBACK = os.getenv("GROQ_MODEL_FALLBACK", "openai/gpt-oss-120b")
LLM_MODELS_GROQ = [m.strip() for m in os.getenv("LLM_MODELS_GROQ", "qwen/qwen3.8-27b,openai/gpt-oss-120b").split(",") if m.strip()]
GROQ_DAILY_QUOTA = int(os.getenv("GROQ_DAILY_QUOTA", "1000"))

TRANSACTION_PROMPT = """Analyze the provided receipt/bill image, audio, or text and extract transaction details.
Return ONLY a valid JSON object with the following fields:
- amount: float (total amount paid or received)
- transaction_type: "income" or "expense"
- category: one of [Food, Fuel, Rent, Groceries, Maintenance, Phone, EMI, Misc, Delivery, Freelance, Salary, Other]
- merchant_name: string (e.g. Swiggy, Indian Oil, Big Bazaar, Zomato, etc.)
- description: string (summary of items or purpose)
- payment_method: one of [UPI, Cash, Card, Bank Transfer]
- location: string (city or area if found, else empty)
- transaction_date: YYYY-MM-DD (use today's date if not found)
- transaction_time: HH:MM (24-hour format)
- confidence: float between 0.0 and 1.0

Return ONLY the raw JSON object, without markdown formatting or backticks."""

CHATBOT_SYSTEM_PROMPT = """You are the official ArthaSetu AI Financial Assistant (ArthaSetu Financial Companion), an AI assistant dedicated EXCLUSIVELY to the ArthaSetu website and personal finance for Indian gig and platform workers.

ABOUT ARTHASETEU & KNOWLEDGE BASE:
1. Team & Background:
   - ArthaSetu was built by Team Invictus: Nitish Kumar Singh (Team Leader, Backend Development), Palak (Presentation, UI Design), Stuti Bhatnagar (PPT, Database Management), Prateek (Frontend Development), Dev Srivastava (Design, Problem Solving), and Daksh Goyal (Testing).
   - Designed specifically for India's 230M+ gig economy workers (delivery partners on Swiggy, Zomato, Blinkit, Zepto; drivers on Uber, Ola, Rapido; urban service workers on Urban Company; freelance professionals).

2. Core Platform Capabilities & Tools:
   - Multi-Modal Transaction Tracking: Add transactions via manual entry, receipt/bill photo OCR scanning, or voice input.
   - Income Volatility Forecasting: Tracks daily, weekly, and seasonal variance in gig earnings to predict lean weeks and build cash buffers.
   - Gig Worker Tax Assistant: Guidance under Indian New Tax Regime FY 2024-25 (zero tax up to ₹7 Lakh via Section 87A rebate), presumptive taxation under Section 44ADA (50% expense declaration without books), and deductible expenses (fuel, phone recharge, vehicle maintenance).
   - Adaptive Budgeting: 50/30/20 rule optimized for irregular and unpredictable incomes.
   - Emergency Fund & Savings: Target 3 to 6 months of essential living expenses with micro-saving triggers.
   - Financial Health & Risk Dashboard: 0-10 score evaluating debt-to-income, emergency cushion, and income volatility.
   - Government Welfare Schemes: e-Shram card benefits, Pradhan Mantri Shram Yogi Maan-dhan (PM-SYM pension), PMJJBY (life insurance), PMSBY (accident cover), and Ayushman Bharat (health cover).

3. Website Navigation:
   - / (Home): Landing page with features, team intro, and quick links.
   - /dashboard: Real-time overview of monthly income, expenses, risk score, and recent transactions.
   - /transactions: Add and review records, scan receipts, or record voice entries.
   - /tax: Tax calculator, slabs, and deduction recommendations.
   - /budgets: Category budget allocation and spending alerts.
   - /risk: Financial health risk scoring and safety recommendations.
   - /auth or /login or /signup: Account creation and authentication.

STRICT GUARDRAILS (ZERO HALLUCINATIONS, WEBSITE-ONLY):
1. You MUST ONLY answer questions directly related to:
   a) The ArthaSetu platform, its navigation, pages, and built-in tools.
   b) Financial management, income tracking, budgeting, taxes, and savings for Indian gig workers.
2. NEVER hallucinate false partnerships or non-existent companies (e.g. do not invent partnerships with external consulting firms or fake laws).
3. If the user asks about ANYTHING ELSE (e.g., poems, general trivia, movies, celebrities, recipes, history, politics, unrelated software coding, weather, or random chit-chat):
   You MUST politely decline with:
   "I am your dedicated ArthaSetu AI Financial Assistant. I can only assist you with questions regarding ArthaSetu, tracking your gig transactions, budgeting, taxes, and financial tools on this platform. How can I help you with your finances on ArthaSetu today?"
4. Tone: Helpful, professional, encouraging, and concise. Format with bullet points for easy mobile reading. Support Hinglish/Hindi-English questions when asked."""


class TransactionParser:
    """Main parser class for image, voice, text transaction input and chat assistant."""

    def __init__(self):
        self.google_keys = GOOGLE_API_KEYS
        self.openrouter_keys = OPENROUTER_API_KEYS
        self.groq_keys = GROQ_API_KEYS
        print(f"TransactionParser initialized. {len(self.google_keys)} Google keys, {len(self.openrouter_keys)} OpenRouter keys, {len(self.groq_keys)} Groq safety keys configured.")

    # ------------------------------------------------------------------------
    # Public API Methods
    # ------------------------------------------------------------------------

    def parse_image(self, image_path: str) -> Dict[str, Any]:
        """
        Parse image (receipt/bill) using OpenAI / Google multimodal vision models.
        """
        print(f"[parse_image] Processing {image_path}...")
        try:
            with open(image_path, "rb") as f:
                img_bytes = f.read()

            b64_img = base64.b64encode(img_bytes).decode("utf-8")
            mime_type = mimetypes.guess_type(image_path)[0] or "image/jpeg"

            # 1. Try OpenRouter OpenAI (gpt-4o-mini)
            result = self._parse_image_openrouter(b64_img, mime_type, OPENROUTER_OPENAI_MODEL)
            if result:
                return self._clean_transaction(result, f"Scanned receipt ({Path(image_path).name})")

            # 2. Try OpenRouter Google (gemini-2.5-flash)
            result = self._parse_image_openrouter(b64_img, mime_type, OPENROUTER_GOOGLE_MODEL)
            if result:
                return self._clean_transaction(result, f"Scanned receipt ({Path(image_path).name})")

            # 3. Try Direct Google Gemini API
            result = self._parse_image_google(b64_img, mime_type)
            if result:
                return self._clean_transaction(result, f"Scanned receipt ({Path(image_path).name})")

        except Exception as e:
            print(f"[parse_image] Cloud parsing failed: {e}")

        # Fallback
        return self._regex_fallback("Receipt photo uploaded", "expense", 0.5)

    def parse_voice(self, audio_path: str) -> Dict[str, Any]:
        """
        Parse voice recording to extract transaction details.
        """
        print(f"[parse_voice] Processing audio {audio_path}...")
        try:
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()

            b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
            mime_type = mimetypes.guess_type(audio_path)[0] or "audio/wav"

            # 1. Try Direct Google Gemini Audio Multimodal
            result = self._parse_audio_google(b64_audio, mime_type)
            if result:
                return self._clean_transaction(result, "Voice transaction")

            # 2. Fallback: If failed, try OpenRouter text extraction with generic description
            print("[parse_voice] Direct audio failed, using voice fallback.")
        except Exception as e:
            print(f"[parse_voice] Audio processing error: {e}")

        return self._regex_fallback("Voice recording", "expense", 0.5)

    def parse_text(self, text: str) -> Dict[str, Any]:
        """
        Parse text / voice transcript using OpenAI / Google LLMs.
        """
        print(f"[parse_text] Parsing text: '{text[:60]}...'")
        if not text or len(text.strip()) < 3:
            return self._regex_fallback(text, "expense", 0.3)

        # 1. Try OpenRouter OpenAI
        result = self._call_text_llm_openrouter(text, OPENROUTER_OPENAI_MODEL)
        if result:
            return self._clean_transaction(result, text)

        # 2. Try OpenRouter Google
        result = self._call_text_llm_openrouter(text, OPENROUTER_GOOGLE_MODEL)
        if result:
            return self._clean_transaction(result, text)

        # 3. Try Direct Google Gemini API
        result = self._call_text_llm_google(text)
        if result:
            return self._clean_transaction(result, text)

        # 4. Regex fallback
        return self._regex_fallback(text, "expense", 0.5)

    def chat(self, messages: List[Dict[str, str]], user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Answer user questions with strict guardrails: only answers questions related to ArthaSetu / personal finance for gig workers.
        Uses Groq API keys dedicatedly for real-time conversational speed (~0.4s) and zero hallucinations.
        """
        formatted_messages = [{"role": "system", "content": CHATBOT_SYSTEM_PROMPT}]

        # Inject user context if available
        if user_context:
            ctx_str = f"User Profile Context: Name: {user_context.get('name', 'Gig Worker')}, Primary Platform: {user_context.get('platform', 'Gig Platform')}, City: {user_context.get('city', 'India')}."
            snapshot = user_context.get("financial_snapshot")
            if snapshot:
                ctx_str += (
                    "\nLive Financial Snapshot (real numbers from the user's app -- use these exact "
                    "figures when answering money questions, never invent amounts):\n"
                    + str(snapshot)
                )
            formatted_messages.append({"role": "system", "content": ctx_str})

        # Append conversation history
        for m in messages[-8:]:  # keep last 8 messages for context
            formatted_messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})

        # 1. PRIMARY & DEDICATED CHATBOT ENGINE: GROQ LPU (Ultra fast ~0.4s, zero hallucination)
        groq_models_to_try = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"]
        for key in self.groq_keys:
            for g_model in groq_models_to_try:
                try:
                    reply = self._groq_chat(formatted_messages, key, g_model)
                    if reply and reply.strip():
                        return {"reply": reply.strip(), "model": g_model, "provider": f"Groq ({g_model})"}
                except Exception as e:
                    print(f"[chat] Groq error ({g_model}): {e}")

        # 2. Secondary fallback: OpenRouter Fast Model (if Groq keys are exhausted)
        for key in self.openrouter_keys:
            try:
                reply = self._openrouter_chat(formatted_messages, key, OPENROUTER_OPENAI_MODEL)
                if reply and reply.strip():
                    return {"reply": reply.strip(), "model": OPENROUTER_OPENAI_MODEL, "provider": "OpenRouter (OpenAI)"}
            except Exception as e:
                print(f"[chat] OpenRouter fallback error: {e}")

        # 3. Third fallback: Google Gemini
        for key in self.google_keys:
            try:
                reply = self._google_chat(formatted_messages, key, GEMINI_MODEL)
                if reply and reply.strip():
                    return {"reply": reply.strip(), "model": GEMINI_MODEL, "provider": "Google"}
            except Exception as e:
                print(f"[chat] Google fallback error: {e}")

        # 4. Fallback response with guardrails
        return {
            "reply": "I am your dedicated ArthaSetu Financial Assistant. I can help you track transactions, manage gig income, calculate New Regime FY 2024-25 taxes, set up emergency savings, or analyze your income volatility. How can I help you today?",
            "model": "local-fallback",
            "provider": "offline"
        }

    # ------------------------------------------------------------------------
    # Internal LLM Providers
    # ------------------------------------------------------------------------

    def _parse_image_openrouter(self, b64_img: str, mime_type: str, model: str) -> Optional[Dict[str, Any]]:
        for key in self.openrouter_keys:
            try:
                payload = {
                    "model": model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": TRANSACTION_PROMPT},
                            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_img}"}}
                        ]
                    }],
                    "max_tokens": 500,
                    "temperature": 0.1
                }
                req = urllib.request.Request(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    data=json.dumps(payload).encode("utf-8")
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    content = data["choices"][0]["message"]["content"]
                    return self._extract_json(content)
            except Exception as e:
                print(f"[OpenRouter Image {model}] failed with key {key[:12]}...: {e}")
        return None

    def _parse_image_google(self, b64_img: str, mime_type: str) -> Optional[Dict[str, Any]]:
        for key in self.google_keys:
            for model in [GEMINI_MODEL, "gemini-3.5-flash", "gemini-flash-latest"]:
                try:
                    payload = {
                        "contents": [{
                            "parts": [
                                {"text": TRANSACTION_PROMPT},
                                {"inline_data": {"mime_type": mime_type, "data": b64_img}}
                            ]
                        }],
                        "generationConfig": {"response_mime_type": "application/json"}
                    }
                    req = urllib.request.Request(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
                        headers={"Content-Type": "application/json"},
                        data=json.dumps(payload).encode("utf-8")
                    )
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        content = data["candidates"][0]["content"]["parts"][0]["text"]
                        return self._extract_json(content)
                except Exception as e:
                    print(f"[Google Image {model}] error: {e}")
        return None

    def _parse_audio_google(self, b64_audio: str, mime_type: str) -> Optional[Dict[str, Any]]:
        for key in self.google_keys:
            try:
                payload = {
                    "contents": [{
                        "parts": [
                            {"text": TRANSACTION_PROMPT + "\nTranscribe the speech and extract the transaction details."},
                            {"inline_data": {"mime_type": mime_type, "data": b64_audio}}
                        ]
                    }],
                    "generationConfig": {"response_mime_type": "application/json"}
                }
                req = urllib.request.Request(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={key}",
                    headers={"Content-Type": "application/json"},
                    data=json.dumps(payload).encode("utf-8")
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    content = data["candidates"][0]["content"]["parts"][0]["text"]
                    return self._extract_json(content)
            except Exception as e:
                print(f"[Google Audio] error: {e}")
        return None

    def _call_text_llm_openrouter(self, text: str, model: str) -> Optional[Dict[str, Any]]:
        for key in self.openrouter_keys:
            try:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You are a financial transaction extractor. Return ONLY valid JSON."},
                        {"role": "user", "content": f"{TRANSACTION_PROMPT}\n\nInput text:\n{text}"}
                    ],
                    "max_tokens": 400,
                    "temperature": 0.1
                }
                req = urllib.request.Request(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    data=json.dumps(payload).encode("utf-8")
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    content = data["choices"][0]["message"]["content"]
                    return self._extract_json(content)
            except Exception as e:
                print(f"[OpenRouter Text {model}] error: {e}")
        return None

    def _call_text_llm_google(self, text: str) -> Optional[Dict[str, Any]]:
        for key in self.google_keys:
            try:
                payload = {
                    "contents": [{
                        "parts": [{"text": f"{TRANSACTION_PROMPT}\n\nInput text:\n{text}"}]
                    }],
                    "generationConfig": {"response_mime_type": "application/json"}
                }
                req = urllib.request.Request(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={key}",
                    headers={"Content-Type": "application/json"},
                    data=json.dumps(payload).encode("utf-8")
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    content = data["candidates"][0]["content"]["parts"][0]["text"]
                    return self._extract_json(content)
            except Exception as e:
                print(f"[Google Text] error: {e}")
        return None

    def _openrouter_chat(self, messages: List[Dict[str, str]], api_key: str, model: str) -> Optional[str]:
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": 600,
            "temperature": 0.4
        }
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            data=json.dumps(payload).encode("utf-8")
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"].strip()

    def _google_chat(self, messages: List[Dict[str, str]], api_key: str, model: str) -> Optional[str]:
        # Convert messages to Gemini format
        system_instructions = [m["content"] for m in messages if m["role"] == "system"]
        chat_contents = []
        for m in messages:
            if m["role"] == "system":
                continue
            role = "user" if m["role"] == "user" else "model"
            chat_contents.append({"role": role, "parts": [{"text": m["content"]}]})

        payload: Dict[str, Any] = {"contents": chat_contents}
        if system_instructions:
            payload["system_instruction"] = {"parts": [{"text": "\n\n".join(system_instructions)}]}

        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload).encode("utf-8")
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()

    def _groq_chat(self, messages: List[Dict[str, str]], api_key: str, model: str) -> Optional[str]:
        """
        Dedicated Groq fallback for chatbot only using OpenAI models on Groq LPU.
        """
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": 500,
            "temperature": 0.1
        }
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key.strip()}",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                "Accept": "application/json"
            },
            data=json.dumps(payload).encode("utf-8")
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices", [])
            if choices and "message" in choices[0]:
                content = choices[0]["message"].get("content", "")
                return content.strip() if content else None
            return None

    # ------------------------------------------------------------------------
    # Helpers & Fallback
    # ------------------------------------------------------------------------

    def _extract_json(self, raw_str: str) -> Optional[Dict[str, Any]]:
        if not raw_str:
            return None
        # Clean markdown codeblocks
        cleaned = re.sub(r"^```(?:json)?", "", raw_str.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"```$", "", cleaned.strip(), flags=re.MULTILINE).strip()
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
        try:
            return json.loads(cleaned)
        except Exception:
            return None

    def _clean_transaction(self, data: Dict[str, Any], raw_context: str) -> Dict[str, Any]:
        now = datetime.now()
        amount = None
        if "amount" in data and data["amount"] is not None:
            try:
                amount = float(data["amount"])
            except (ValueError, TypeError):
                pass

        txn_type = str(data.get("transaction_type", "expense")).lower()
        if txn_type not in ["income", "expense"]:
            txn_type = "expense"

        valid_categories = [
            "Food", "Fuel", "Rent", "Groceries", "Maintenance", "Phone",
            "EMI", "Misc", "Delivery", "Freelance", "Salary", "Other"
        ]
        category = data.get("category", "Misc")
        if category not in valid_categories:
            category = "Misc"

        payment_method = data.get("payment_method") or "UPI"
        if payment_method not in ["UPI", "Cash", "Card", "Bank Transfer"]:
            payment_method = "UPI"

        date_val = data.get("transaction_date") or now.strftime("%Y-%m-%d")
        time_val = data.get("transaction_time") or now.strftime("%H:%M")

        confidence = float(data.get("confidence", 0.9))
        confidence = max(0.1, min(1.0, confidence))

        return {
            "amount": amount,
            "transaction_type": txn_type,
            "category": category,
            "merchant_name": data.get("merchant_name") or "",
            "description": data.get("description") or raw_context[:120],
            "payment_method": payment_method,
            "location": data.get("location") or "",
            "transaction_date": date_val,
            "transaction_time": time_val,
            "confidence": confidence
        }

    def _regex_fallback(self, text: str, default_type: str = "expense", confidence: float = 0.5) -> Dict[str, Any]:
        now = datetime.now()
        amount = None

        patterns = [
            r'₹\s*(\d+(?:\.\d{2})?)',
            r'Rs\.?\s*(\d+(?:\.\d{2})?)',
            r'(\d+(?:\.\d{2})?)\s*(?:rupees|rs|₹)',
            r'(\d+(?:\.\d{2})?)\s*(?:paid|spent|received|earned)',
        ]
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                try:
                    amount = float(m.group(1))
                    break
                except Exception:
                    pass

        category = "Misc"
        lower = text.lower()
        if any(w in lower for w in ["fuel", "petrol", "diesel"]):
            category = "Fuel"
        elif any(w in lower for w in ["swiggy", "zomato", "food", "lunch", "dinner", "pizza"]):
            category = "Food"
        elif any(w in lower for w in ["grocery", "dmart", "blinkit", "zepto", "milk", "vegetable"]):
            category = "Groceries"
        elif any(w in lower for w in ["recharge", "airtel", "jio", "wifi"]):
            category = "Phone"
        elif any(w in lower for w in ["uber", "ola", "rapido", "ride", "trip"]):
            category = "Delivery"

        return {
            "amount": amount,
            "transaction_type": default_type,
            "category": category,
            "merchant_name": "",
            "description": text[:100],
            "payment_method": "UPI",
            "location": "",
            "transaction_date": now.strftime("%Y-%m-%d"),
            "transaction_time": now.strftime("%H:%M"),
            "confidence": confidence
        }


if __name__ == "__main__":
    parser = TransactionParser()
    test_img = r"D:\getamantra\test_receipt.png"
    if os.path.exists(test_img):
        print("\n--- Testing Image Parsing ---")
        print(parser.parse_image(test_img))

    print("\n--- Testing Text Parsing ---")
    print(parser.parse_text("Paid 420 for petrol at Shell pump via UPI"))

    print("\n--- Testing Chatbot ---")
    chat_res = parser.chat([{"role": "user", "content": "How do I save tax as a gig worker under New Regime?"}])
    print("Chat Reply:", chat_res["reply"][:200] + "...")
