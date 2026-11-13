import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog.js';
import { signOut } from '../../utils/signOut.js';
import { saveLoginNotice } from '../../utils/loginReturn.js';
import {
  ACTIVITY_WRITE_EVERY_MS, ADMIN_IDLE_MS, IDLE_SIGNED_OUT_NOTICE, LAST_ACTIVITY_KEY, idleStatus, latestActivity,
} from '../../utils/idleTimeout.js';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const TICK_MS = 1_000;

const readStored = () => { try { return localStorage.getItem(LAST_ACTIVITY_KEY); } catch { return null; } };
const writeStored = (at: number) => { try { localStorage.setItem(LAST_ACTIVITY_KEY, String(at)); } catch { /* storage blocked */ } };

/**
 * Signs the admin screens out after ADMIN_IDLE_MS without a click, tap, key
 * or scroll in ANY open tab, with a "Still there?" warning for the last
 * minute. Renders nothing until the warning. Mount once, on admin screens.
 */
export default function IdleSignOut({ limitMs = ADMIN_IDLE_MS }: { limitMs?: number }) {
  const lastActivity = useRef(Date.now());
  const lastWrite = useRef(0);
  const signingOut = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const recordActivity = useCallback((force = false) => {
    const now = Date.now();
    lastActivity.current = now;
    if (force || now - lastWrite.current >= ACTIVITY_WRITE_EVERY_MS) {
      lastWrite.current = now;
      writeStored(now);
    }
  }, []);

  useEffect(() => {
    recordActivity(true);
    const onActivity = () => recordActivity();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true, capture: true }));

    const check = () => {
      if (signingOut.current) return;
      const { state, secondsLeft: left } = idleStatus(latestActivity(lastActivity.current, readStored()), Date.now(), limitMs);
      if (state === 'expired') {
        signingOut.current = true;
        saveLoginNotice(IDLE_SIGNED_OUT_NOTICE);
        void signOut();
        return;
      }
      setSecondsLeft(state === 'warning' ? left : null);
    };
    const timer = window.setInterval(check, TICK_MS);
    // A laptop waking from sleep should sign out straight away, not a tick later.
    document.addEventListener('visibilitychange', check);
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity, { capture: true }));
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [limitMs, recordActivity]);

  if (secondsLeft === null) return null;
  const stay = () => { recordActivity(true); setSecondsLeft(null); };
  return (
    <ConfirmDialog
      title="Still there?"
      message={`For privacy, you’ll be signed out in ${secondsLeft} ${secondsLeft === 1 ? 'second' : 'seconds'}.`}
      confirmLabel="Stay signed in"
      hideCancel
      onConfirm={stay}
      onCancel={stay}
    />
  );
}
