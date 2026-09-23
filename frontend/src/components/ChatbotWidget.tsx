import { useState, useRef, useEffect } from "react";
import { 
  Bot, 
  X, 
  Send, 
  Mic, 
  MicOff, 
  RotateCw, 
  ThumbsUp, 
  ThumbsDown, 
  Copy, 
  Check, 
  Sparkles, 
  Wallet,
  ArrowRight
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { answerLocally, buildFinancialSnapshot } from "@/lib/chatAssistant";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  feedback?: "up" | "down";
}

const DEFAULT_SUGGESTIONS = [
  "How much did I spend this month?",
  "Estimate my tax",
  "How are my goals doing?",
  "How do I scan a receipt?",
  "Explain my income volatility"
];

const INITIAL_MESSAGE: ChatMessage = {
  id: "init-1",
  role: "assistant",
  content: "Hello! 👋 I'm your ArthaSetu Financial Assistant. I can help you track transactions, manage gig income, check tax slabs, budget, or understand your financial risk score. How can I help you today?",
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
};

export default function ChatbotWidget() {
  const { user, isAuthenticated } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Speech Recognition Setup
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.lang = "en-IN";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("Listening... speak your financial question");
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech error", event);
        setIsListening(false);
        if (event.error !== "no-speech") {
          const messages: Record<string, string> = {
            "not-allowed": "Microphone permission denied. Allow mic access and try again.",
            "service-not-allowed": "Voice input isn't available in this browser — please type your question.",
            network: "Voice input needs an internet connection. Please type your question instead.",
            "audio-capture": "No microphone found. Please connect one and try again.",
          };
          toast.error(messages[event.error] || `Voice input error (${event.error}). Please type instead.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
      toast.error("Microphone access failed.");
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = (id: string, type: "up" | "down") => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, feedback: type } : m));
    toast.success(type === "up" ? "Thanks for the feedback!" : "Feedback noted, we'll improve.");
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const parserUrl = import.meta.env.VITE_PARSER_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
      const userContext = {
        name: user?.name || (isAuthenticated ? "Gig Worker" : "Guest"),
        platform: user?.occupation || "Gig Platform",
        balance: user?.balance
      };

      // Call Chatbot API (AI server on port 8001). Fails instantly when it
      // isn't running — then the offline assistant answers from the user's
      // real app data instead.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const financialSnapshot = await buildFinancialSnapshot();
      const response = await fetch(`${parserUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          user_context: { ...userContext, financial_snapshot: financialSnapshot }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      const replyText = (data.reply || "").trim();
      if (!replyText) {
        throw new Error("Empty reply");
      }
      const assistantMessage: ChatMessage = {
        id: "a-" + Date.now(),
        role: "assistant",
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.warn("AI server unavailable, using offline assistant:", error);
      // Offline assistant: answers from the user's real transactions,
      // budgets, goals and saved analysis — no server needed.
      const fallbackText = await answerLocally(query);

      const assistantMessage: ChatMessage = {
        id: "a-" + Date.now(),
        role: "assistant",
        content: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button (When Closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-16 h-16 rounded-full bg-slate-900/10 dark:bg-slate-700/30 backdrop-blur-xs transition-all duration-300 hover:scale-105 active:scale-95 group focus:outline-none shadow-xl"
          aria-label="Open ArthaSetu AI Assistant"
        >
          <div className="w-12 h-12 rounded-full bg-black group-hover:bg-slate-950 flex items-center justify-center shadow-lg transition-colors p-1.5 border border-slate-700/50">
            <img src="/arthasetu-logo.png" alt="ArthaSetu AI" className="w-full h-full object-contain" />
          </div>
        </button>
      )}

      {/* Floating Assistant Widget (When Open) */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[95vw] sm:w-[410px] h-[580px] max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="bg-[#0b1329] px-4 py-3.5 flex items-center justify-between border-b border-slate-800 text-white select-none">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-black border border-slate-700/80 p-1 shadow-inner flex-shrink-0">
                <img src="/arthasetu-logo.png" alt="ArthaSetu" className="w-full h-full object-contain" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0b1329]" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                  ArthaSetu AI Assistant
                </h3>
                <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">● 24/7</span>
                  <span className="text-slate-500">·</span>
                  <span>User: <strong className="text-slate-200 font-medium">{user?.name || (isAuthenticated ? "Gig Worker" : "Guest")}</strong></span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              aria-label="Close Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/40">
            {messages.map((m) => {
              const isAssistant = m.role === "assistant";
              return (
                <div key={m.id} className={cn("flex flex-col gap-1.5", isAssistant ? "items-start" : "items-end")}>
                  {/* Assistant Header inside feed */}
                  {isAssistant && (
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center p-0.5 border border-slate-700 shadow-sm flex-shrink-0">
                        <img src="/arthasetu-logo.png" alt="ArthaSetu" className="w-full h-full object-contain" />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        ArthaSetu AI
                      </span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={cn(
                      "max-w-[88%] text-sm rounded-2xl p-3.5 shadow-sm leading-relaxed whitespace-pre-wrap",
                      isAssistant
                        ? "bg-slate-100/90 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm border border-slate-200/60 dark:border-slate-700/60"
                        : "bg-slate-900 dark:bg-blue-600 text-white rounded-tr-sm"
                    )}
                  >
                    {m.content}
                  </div>

                  {/* Assistant Message Actions Bar */}
                  {isAssistant && (
                    <div className="flex items-center gap-2 px-1 text-slate-400 text-xs">
                      <button
                        onClick={() => handleSend(messages[messages.length - 2]?.content || "Help with my gig finances")}
                        title="Retry"
                        className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(m.id, "up")}
                        title="Helpful"
                        className={cn("hover:text-emerald-500 transition-colors", m.feedback === "up" && "text-emerald-500")}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(m.id, "down")}
                        title="Not helpful"
                        className={cn("hover:text-rose-500 transition-colors", m.feedback === "down" && "text-rose-500")}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleCopy(m.id, m.content)}
                        title="Copy text"
                        className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <span className="text-[10px] text-slate-400 ml-1">{m.timestamp}</span>
                    </div>
                  )}

                  {!isAssistant && (
                    <span className="text-[10px] text-slate-400 px-1">{m.timestamp}</span>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center p-0.5 border border-slate-700 shadow-sm flex-shrink-0">
                    <img src="/arthasetu-logo.png" alt="ArthaSetu" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">ArthaSetu AI</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm p-3.5 flex items-center gap-1.5 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-3 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {DEFAULT_SUGGESTIONS.map((pill, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(pill)}
                disabled={isLoading}
                className="whitespace-nowrap rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 transition-colors shadow-2xs font-normal"
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Input Form with Blue Border Ring */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/70 dark:border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 p-1.5 rounded-2xl border-2 border-blue-600/90 dark:border-blue-500 bg-white dark:bg-slate-950 focus-within:ring-2 focus-within:ring-blue-400/30 transition-all shadow-sm"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isListening ? "Listening to your voice..." : "Ask about transactions, taxes, savings..."}
                disabled={isLoading}
                className="flex-1 bg-transparent px-2.5 py-1 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />

              {/* Voice Mic Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  "p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all",
                  isListening && "text-rose-500 bg-rose-50 dark:bg-rose-950/40 animate-pulse"
                )}
                title={isListening ? "Stop listening" : "Speak with voice"}
              >
                {isListening ? <MicOff className="w-4 h-4 text-rose-500" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-40 disabled:hover:bg-slate-900 transition-all flex items-center justify-center"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      )}
    </>
  );
}
