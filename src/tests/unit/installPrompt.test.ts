import { describe, it, expect } from 'vitest';
import { shouldOfferInstall } from '../../utils/installPrompt';

// Install as an app — offered on Android phones only, when Chrome says it can be installed.

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('Install the app (Android)', () => {
  it('offers installing on an Android phone when Chrome says it can be installed', () => {
    expect(shouldOfferInstall({ userAgent: ANDROID, hasPrompt: true, installed: false })).toBe(true);
  });

  it('does not offer it on iPhone or a computer, before Chrome is ready, or inside the installed app', () => {
    expect(shouldOfferInstall({ userAgent: IPHONE, hasPrompt: true, installed: false })).toBe(false);
    expect(shouldOfferInstall({ userAgent: WINDOWS, hasPrompt: true, installed: false })).toBe(false);
    expect(shouldOfferInstall({ userAgent: ANDROID, hasPrompt: false, installed: false })).toBe(false);
    expect(shouldOfferInstall({ userAgent: ANDROID, hasPrompt: true, installed: true })).toBe(false);
  });
});