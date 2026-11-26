import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen } from '@fortawesome/free-solid-svg-icons';
import { saveMyDisplayName } from '../../api/profilePhoto.js';
import { useToast } from '../../components/common/Toast.js';
import { shownName, updateSignedInUser, type SignedInUser } from '../../utils/signedInUser.js';

// My Profile → the name: shown as their display name (by default their full
// name), with a pencil to change it. Records (requested by, signed off by…)
// always keep the full name; blank goes back to it.

/** Same limit as the server (profilePhoto.controller MAX_DISPLAY_NAME). */
const MAX_DISPLAY_NAME = 60;

export default function DisplayNameEditor({ user, accent, textColor }: { user: SignedInUser; accent: string; textColor: string }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const shown = shownName(user);

  const save = async () => {
    setSaving(true);
    try {
      const { displayName } = await saveMyDisplayName(draft.trim() || null);
      updateSignedInUser({ displayName });
      showToast('Name updated');
      setEditing(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t save your name.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: textColor, letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shown || 'Account'}
        </span>
        <button type="button" onClick={() => { setDraft(shown); setEditing(true); }} aria-label="Change the name the app shows you by" title="Change your display name"
          style={{ flexShrink: 0, width: 36, height: 36, border: 'none', background: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', borderRadius: 8 }}>
          <FontAwesomeIcon icon={faPen} />
        </button>
      </div>
    );
  }

  const unchanged = draft.trim() === shown;
  return (
    <div style={{ minWidth: 0 }}>
      <label htmlFor="display-name" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Display name</label>
      <input id="display-name" value={draft} maxLength={MAX_DISPLAY_NAME} autoFocus autoComplete="nickname" placeholder={user.name}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !unchanged && !saving) void save(); if (e.key === 'Escape') setEditing(false); }}
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '8px 12px', fontSize: 16, fontFamily: 'inherit', color: textColor, border: '1px solid #e2e8f0', borderRadius: 10 }} />
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
        Shown around the app. Records keep your full name ({user.name}). Leave blank to use it.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={() => setEditing(false)} disabled={saving}
          style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          Cancel
        </button>
        <button type="button" onClick={() => void save()} disabled={unchanged || saving}
          style={{ minHeight: 40, padding: '0 16px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: unchanged || saving ? 'default' : 'pointer', opacity: unchanged || saving ? 0.55 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
