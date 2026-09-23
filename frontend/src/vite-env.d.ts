/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Base URL of the live agent-analysis backend (backend/main.py, port 8000) */
  readonly VITE_API_BASE_URL?: string
  /** Optional URL of the Python transaction-parser server (simple_api_server.py, port 8001).
   *  Image/voice input works fully client-side without it. */
  readonly VITE_PARSER_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
