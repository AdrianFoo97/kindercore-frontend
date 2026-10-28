// Same cutoff as useIsMobile's MOBILE breakpoint.
const MOBILE_MAX = 768;

/** WhatsApp "send" URL for an already-normalised phone (digits only, with
 *  country code, e.g. "60123456789").
 *
 *  - Phone-sized screens → api.whatsapp.com/send, which hands off to the
 *    installed WhatsApp app (WhatsApp Web is useless on a phone).
 *  - Laptop and wider → web.whatsapp.com/send, straight into WhatsApp Web
 *    without the "open the desktop app?" interstitial wa.me shows.
 *
 *  Both hosts share the `?phone=…&text=…` shape, so a caller may append
 *  `&text=…` itself. Decided at call time (click / render), from the
 *  current window width. */
export function whatsappSendUrl(phone: string, text?: string): string {
  const mobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_MAX;
  const host = mobile ? 'https://api.whatsapp.com/send' : 'https://web.whatsapp.com/send';
  const msg = text?.trim();
  return `${host}?phone=${phone}${msg ? `&text=${encodeURIComponent(msg)}` : ''}`;
}
