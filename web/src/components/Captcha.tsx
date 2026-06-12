import { useEffect, useRef } from "react";
import { CAPTCHA_PROVIDER, CAPTCHA_SITEKEY } from "../config";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string };
    hcaptcha?: { render: (el: HTMLElement, o: Record<string, unknown>) => string };
  }
}

const SCRIPTS: Record<string, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit",
};
const scriptStarted: Record<string, boolean> = {};

// Renders the configured captcha (hCaptcha shows an image/"mosaic" challenge;
// Turnstile is the lightweight Cloudflare widget) and reports the token.
// Remount the component (change its `key`) to get a fresh, single-use token.
export default function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    const provider = CAPTCHA_PROVIDER;
    if (provider === "none" || !CAPTCHA_SITEKEY) return;
    let cancelled = false;
    const apiOf = () => (provider === "hcaptcha" ? window.hcaptcha : window.turnstile);

    const tryRender = () => {
      if (cancelled || rendered.current || !ref.current) return false;
      const api = apiOf();
      if (!api) return false;
      api.render(ref.current, {
        sitekey: CAPTCHA_SITEKEY,
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
      rendered.current = true;
      return true;
    };

    if (!scriptStarted[provider]) {
      scriptStarted[provider] = true;
      const s = document.createElement("script");
      s.src = SCRIPTS[provider];
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }

    if (!tryRender()) {
      const iv = setInterval(() => {
        if (tryRender()) clearInterval(iv);
      }, 200);
      return () => {
        cancelled = true;
        clearInterval(iv);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [onToken]);

  if (CAPTCHA_PROVIDER === "none") return null;
  return <div ref={ref} className="captcha" style={{ marginTop: 12 }} />;
}
