import { useSyncExternalStore } from 'react';
import { hasInstallPrompt, isRunningInstalled, promptInstall, shouldOfferInstall, subscribeInstall } from '../utils/installPrompt.js';

/** Android only: can this phone install the app, and the action that does it. */
export function useInstallApp(): { canInstall: boolean; install: () => Promise<boolean> } {
  const hasPrompt = useSyncExternalStore(subscribeInstall, hasInstallPrompt, () => false);
  const canInstall = shouldOfferInstall({ userAgent: navigator.userAgent, hasPrompt, installed: isRunningInstalled() });
  return { canInstall, install: promptInstall };
}