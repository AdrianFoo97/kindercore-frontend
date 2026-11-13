import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCartShopping, faUser } from '@fortawesome/free-solid-svg-icons';
import type { PurchaseBuyer } from '../../api/purchaseRequests.js';
import type { PurchaseDraft } from './purchaseDisplay.js';

// The "request an item" fields — used by the teacher app's request page and
// the Shopping List's "Add item" pop-up, each with its own colours.

export interface PurchaseFieldsTheme {
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentSoft: string;
}

export const TEACHER_PURCHASE_THEME: PurchaseFieldsTheme = { text: '#334155', muted: '#64748b', border: '#e2e8f0', accent: '#7c3aed', accentSoft: '#f5f3ff' };
export const ADMIN_PURCHASE_THEME: PurchaseFieldsTheme = { text: '#0f172a', muted: '#64748b', border: '#e2e8f0', accent: '#5a67d8', accentSoft: '#eef2ff' };

const BUYER_OPTIONS: { key: PurchaseBuyer; label: string; hint: string; icon: IconDefinition }[] = [
  { key: 'SUPERVISOR', label: 'Help me buy it', hint: 'Goes on the shopping list', icon: faCartShopping },
  { key: 'SELF', label: 'I’ll buy it myself', hint: 'After approval — keep the receipt', icon: faUser },
];

interface Props {
  value: PurchaseDraft;
  onChange: (d: PurchaseDraft) => void;
  theme: PurchaseFieldsTheme;
  disabled?: boolean;
}

export default function PurchaseRequestFields({ value, onChange, theme: t, disabled }: Props) {
  const set = <K extends keyof PurchaseDraft>(key: K, v: PurchaseDraft[K]) => onChange({ ...value, [key]: v });
  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6 };
  const optional = <span style={{ fontWeight: 500, color: t.muted }}>(optional)</span>;
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '11px 12px', fontSize: 15, borderRadius: 10,
    border: `1px solid ${t.border}`, background: '#fff', color: t.text, fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <span style={label}>Who’s buying it?</span>
        <div role="radiogroup" aria-label="Who’s buying it?" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {BUYER_OPTIONS.map(o => {
            const on = value.buyer === o.key;
            return (
              <button key={o.key} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => set('buyer', o.key)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, textAlign: 'left', fontFamily: 'inherit',
                border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.accentSoft : '#fff', color: on ? t.accent : t.text,
                cursor: disabled ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent',
              }}>
                <FontAwesomeIcon icon={o.icon} style={{ fontSize: 14, width: 16, color: on ? t.accent : t.muted }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{o.label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: t.muted, marginTop: 1 }}>{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* What + how many share a row; "what for" gets the full width below — it's the part people explain. */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 200px' }}>
          <label style={label} htmlFor="pr-item">What needs to be bought?</label>
          <input id="pr-item" style={input} value={value.item} disabled={disabled} maxLength={191}
            placeholder="e.g. Glue sticks" onChange={e => set('item', e.target.value)} />
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <label style={label} htmlFor="pr-qty">How many?</label>
          <input id="pr-qty" style={input} value={value.quantity} disabled={disabled} maxLength={50}
            placeholder="e.g. 2 boxes" onChange={e => set('quantity', e.target.value)} />
        </div>
      </div>
      <div>
        <label style={label} htmlFor="pr-purpose">For which class / what for?</label>
        <textarea id="pr-purpose" style={{ ...input, minHeight: 84, resize: 'vertical' }} value={value.purpose} disabled={disabled}
          maxLength={191} placeholder="e.g. Sunflower class — art project on Friday, we ran out last week"
          onChange={e => set('purpose', e.target.value)} />
      </div>
      <div>
        <label style={label} htmlFor="pr-link">Shop link {optional}</label>
        <input id="pr-link" style={input} value={value.link} disabled={disabled} maxLength={500} inputMode="url"
          placeholder="https://… so the right one gets bought" onChange={e => set('link', e.target.value)} />
      </div>
      <div>
        <label style={label} htmlFor="pr-note">Notes {optional}</label>
        <textarea id="pr-note" style={{ ...input, minHeight: 74, resize: 'vertical' }} value={value.note} disabled={disabled}
          maxLength={2000} placeholder="Brand, colour, size, needed by…" onChange={e => set('note', e.target.value)} />
      </div>
    </div>
  );
}
