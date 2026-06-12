import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { CAPTCHA_PROVIDER, CAPTCHA_SITEKEY } from "../config";

type WidgetApi = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: WidgetApi;
    hcaptcha?: WidgetApi;
  }
}

export interface CaptchaHandle {
  reset: () => void;
}

const SCRIPTS: Record<string, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit",
};
const scriptStarted: Record<string, boolean> = {};

function apiOf(): WidgetApi | undefined {
  return CAPTCHA_PROVIDER === "hcaptcha" ? window.hcaptcha : window.turnstile;
}

// Captcha with a correct widget lifecycle:
//  - renders exactly once per mount (empty effect deps; latest onToken via ref),
//  - stores the widgetId returned by render(),
//  - remove()s the widget on unmount (prevents orphaned widgets and the
//    "Cannot find Widget" / postMessage-origin errors),
//  - exposes reset() so the form can refresh the single-use token WITHOUT
//    remounting the component.
const Captcha = forwardRef<CaptchaHandle, { onToken: (token: string) => void }>(
  function Captcha({ onToken }, ref) {
    const container = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          const api = apiOf();
          if (api && widgetId.current != null) {
            try {
              api.reset(widgetId.current);
            } catch {
              /* widget may be gone; ignore */
            }
          }
          onTokenRef.current("");
        },
      }),
      []
    );

    useEffect(() => {
      if (CAPTCHA_PROVIDER === "none" || !CAPTCHA_SITEKEY) return;
      const provider = CAPTCHA_PROVIDER;
      let cancelled = false;
      let iv: number | undefined;

      const tryRender = () => {
        if (cancelled || widgetId.current != null || !container.current) return false;
        const api = apiOf();
        if (!api || typeof api.render !== "function") return false;
        try {
          widgetId.current = api.render(container.current, {
            sitekey: CAPTCHA_SITEKEY,
            callback: (token: string) => onTokenRef.current(token),
            "error-callback": () => onTokenRef.current(""),
            "expired-callback": () => onTokenRef.current(""),
            "timeout-callback": () => onTokenRef.current(""),
          });
        } catch {
          return false;
        }
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
        iv = window.setInterval(() => {
          if (tryRender() && iv) window.clearInterval(iv);
        }, 200);
      }

      return () => {
        cancelled = true;
        if (iv) window.clearInterval(iv);
        const api = apiOf();
        if (api && widgetId.current != null) {
          try {
            api.remove(widgetId.current);
          } catch {
            /* ignore */
          }
        }
        widgetId.current = null;
      };
    }, []);

    if (CAPTCHA_PROVIDER === "none") return null;
    return <div ref={container} className="captcha" style={{ marginTop: 12 }} />;
  }
);

export default Captcha;
