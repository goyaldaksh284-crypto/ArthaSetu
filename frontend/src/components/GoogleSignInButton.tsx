import React from "react";
import { Loader2 } from "lucide-react";

interface GoogleSignInButtonProps {
  onClick?: () => void;
  isLoading?: boolean;
  text?: string;
  className?: string;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onClick,
  isLoading = false,
  text = "Sign In with Google",
  className = "",
  disabled = false,
}) => {
  return (
    <div
      className={`group relative p-1 rounded-full border border-slate-300/80 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition-all duration-200 ${
        disabled || isLoading ? "opacity-75 pointer-events-none" : ""
      } ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        aria-label={text}
        className="w-full flex items-center justify-center gap-3 px-6 py-2.5 sm:py-3 rounded-full bg-white hover:bg-slate-50/90 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)] active:scale-[0.99] transition-all duration-150 cursor-pointer text-slate-800 font-medium text-[15px] select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
        ) : (
          <svg
            className="w-5 h-5 flex-shrink-0"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
        )}
        <span className="text-slate-800 font-medium tracking-tight">
          {isLoading ? "Signing in with Google..." : text}
        </span>
      </button>
    </div>
  );
};

export default GoogleSignInButton;
