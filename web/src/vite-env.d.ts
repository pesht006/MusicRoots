/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIC?: string;
  readonly VITE_BASE?: string;
  readonly VITE_SUBMIT_URL?: string;
  readonly VITE_TURNSTILE_SITEKEY?: string;
  readonly VITE_HCAPTCHA_SITEKEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
