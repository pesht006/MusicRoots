import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptStarted = false;

// Renders a Cloudflare Turnstile widget and reports the token via onToken.
// If no sitekey is provided, renders nothing (forms then submit with an empty
// token; the Worker skips verification when its secret is unset).
export default function Turnstile({
  sitekey,
  onToken,
}: {
  sitekey: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!sitekey) return;
    let cancelled = false;

    const tryRender = () => {
      if (cancelled || !ref.current || widgetId.current) return false;
      if (window.turnstile) {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey,
          callback: (t: string) => onToken(t),
          "error-callback": () => onToken(""),
          "expired-callback": () => onToken(""),
        });
        return true;
      }
      return false;
    };

    if (!scriptStarted) {
      scriptStarted = true;
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
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
  }, [sitekey, onToken]);

  if (!sitekey) return null;
  return <div ref={ref} className="turnstile" style={{ marginTop: 12 }} />;
}
