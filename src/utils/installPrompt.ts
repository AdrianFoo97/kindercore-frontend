// Install as an app (PWA) — offered on Android only. Chrome on Android fires
// `beforeinstallprompt` once, early, when the site is installable; we keep it
// so an "Install app" button can show Chrome's install dialog later.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

/** Call once at start-up (main.tsx), before the event can fire. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); // our own "Install app" button shows the dialog instead
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

export const subscribeInstall = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const hasInstallPrompt = () => deferred !== null;

/** Show Chrome's install dialog; true if they installed. Each prompt can be used once. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  notify();
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}

/** Opened from the home-screen icon already (no need to offer installing). */
export function isRunningInstalled(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
}

/** Offer "Install app" only on Android, when Chrome says it's installable, and not inside the installed app. */
export function shouldOfferInstall({ userAgent, hasPrompt, installed }: { userAgent: string; hasPrompt: boolean; installed: boolean }): boolean {
  return /Android/i.test(userAgent) && hasPrompt && !installed;
}