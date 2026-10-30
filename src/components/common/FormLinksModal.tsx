import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faXmark, faCopy, faCircleCheck, faQrcode, faNewspaper, faLink, faArrowUpRightFromSquare, faUserPlus, faChildReaching,
} from '@fortawesome/free-solid-svg-icons';
import { faFacebook, faInstagram, faGoogle, faWhatsapp } from '@fortawesome/free-brands-svg-icons';

// Tools → Forms → Form Links. Shareable, source-tracked links for the two
// public forms, one tab each:
//   • Enquiry form (/enquiry)          — a fixed set of marketing channels
//   • Job application (/apply)         — the admin-curated recruitment
//     referral sources (Settings → Recruitment), same list the apply form
//     and Candidates page use.
// Each link carries ?utm_source=… so a submission records where it came from.
// Brand icons only for the platforms themselves (as faWhatsapp elsewhere).

export type FormTab = 'enquiry' | 'apply';

interface LinkItem { key: string; label: string; desc: string; icon: IconDefinition; url: string }

/** "Facebook Ads" → "facebook_ads"; CJK kept as-is. Matches the apply form's utm handling. */
export function toApplyUtmSlug(label: string): string {
  return String(label ?? '').trim().toLowerCase().replace(/[^\w一-鿿]+/g, '_').replace(/^_+|_+$/g, '');
}

function enquiryLinks(base: string): LinkItem[] {
  const u = (utm: string) => (utm ? `${base}/enquiry?utm_source=${utm}` : `${base}/enquiry`);
  return [
    { key: 'door-qr', label: 'QR School Door', desc: 'Parents walking past', icon: faQrcode, url: u('door-qr') },
    { key: 'flyer-qr', label: 'QR Flyer / Banner', desc: 'Printed materials', icon: faNewspaper, url: u('flyer-qr') },
    { key: 'facebook', label: 'Facebook', desc: 'Facebook posts & ads', icon: faFacebook, url: u('facebook') },
    { key: 'instagram', label: 'Instagram', desc: 'Instagram bio & stories', icon: faInstagram, url: u('instagram') },
    { key: 'google', label: 'Google', desc: 'Google Ads', icon: faGoogle, url: u('google') },
    { key: 'xiaohongshu', label: '小红书 Xiaohongshu', desc: 'REDnote posts', icon: faLink, url: u('xiaohongshu') },
    { key: 'whatsapp', label: 'WhatsApp', desc: 'Shared via WhatsApp', icon: faWhatsapp, url: u('whatsapp') },
    { key: '_direct', label: 'Direct Link', desc: 'No tracking', icon: faLink, url: u('') },
  ];
}

function applyLinks(base: string, sources: string[]): LinkItem[] {
  return [
    { key: '_direct', label: 'Direct Link', desc: 'No tracking', icon: faLink, url: `${base}/apply` },
    ...sources.map(label => {
      const utm = toApplyUtmSlug(label);
      return { key: utm, label, desc: 'Tracked to this source', icon: faLink, url: `${base}/apply?utm_source=${encodeURIComponent(utm)}` };
    }),
  ];
}

const TABS: { key: FormTab; label: string; icon: IconDefinition; path: string }[] = [
  { key: 'enquiry', label: 'Enquiry form', icon: faChildReaching, path: '/enquiry' },
  { key: 'apply', label: 'Job application', icon: faUserPlus, path: '/apply' },
];

export default function FormLinksModal({ initialTab = 'enquiry', applySources, onClose }: {
  initialTab?: FormTab;
  /** Recruitment referral sources (without "Other"). */
  applySources: string[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<FormTab>(initialTab);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(''), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  useEffect(() => { setCopied(''); }, [tab]);

  const base = window.location.origin;
  const items = tab === 'enquiry' ? enquiryLinks(base) : applyLinks(base, applySources);
  const current = TABS.find(t => t.key === tab)!;

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.dialog} onClick={e => e.stopPropagation()} role="dialog" aria-label="Form links">
        <div style={st.header}>
          <div>
            <h3 style={st.title}>Form Links</h3>
            <div style={st.subtitle}>Click a link to copy it. Use for QR codes, ads, or social posts — each one tracks where the submission came from.</div>
          </div>
          <button onClick={onClose} style={st.closeBtn} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        <div style={st.tabRow}>
          <div style={st.segment} role="tablist" aria-label="Which form">
            {TABS.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} style={st.segBtn(tab === t.key)}>
                <FontAwesomeIcon icon={t.icon} style={{ fontSize: 11 }} /> {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => window.open(current.path, '_blank')} style={st.openBtn} title={`Open the ${current.label.toLowerCase()} in a new tab`}>
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 11 }} /> Open form
          </button>
        </div>

        <div style={st.list} role="tabpanel">
          {items.map(item => {
            const isCopied = copied === item.key;
            return (
              <button key={item.key} className={isCopied ? undefined : 'kc-form-link'}
                onClick={() => { navigator.clipboard.writeText(item.url); setCopied(item.key); }}
                style={st.row(isCopied)}>
                <span style={st.iconBox}><FontAwesomeIcon icon={item.icon} style={{ fontSize: 14, color: '#64748b' }} /></span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: '#94a3b8' }}>{item.desc}</span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 11, color: isCopied ? '#16a34a' : '#cbd5e1', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isCopied ? <><FontAwesomeIcon icon={faCircleCheck} /> Copied</> : <FontAwesomeIcon icon={faCopy} />}
                </span>
              </button>
            );
          })}
          {tab === 'apply' && applySources.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 11, color: '#94a3b8' }}>
              Add sources in Settings → Recruitment to get tracked links per channel.
            </div>
          )}
        </div>
      </div>
      <style>{'.kc-form-link:hover{background:#f8fafc !important}'}</style>
    </div>
  );
}

const st = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  } as React.CSSProperties,
  dialog: {
    background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, maxHeight: 'calc(100vh - 32px)',
    display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.16)', overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
  } as React.CSSProperties,
  header: {
    padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
  } as React.CSSProperties,
  title: { margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' } as React.CSSProperties,
  subtitle: { fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.5 } as React.CSSProperties,
  closeBtn: { background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', color: '#cbd5e1', padding: '4px 2px', lineHeight: 1 } as React.CSSProperties,
  tabRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
    padding: '0 20px 12px', borderBottom: '1px solid #f1f5f9',
  } as React.CSSProperties,
  segment: { display: 'inline-flex', gap: 2, padding: 3, background: '#f1f5f9', borderRadius: 9 } as React.CSSProperties,
  segBtn: (on: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
    background: on ? '#fff' : 'transparent', color: on ? '#0f172a' : '#64748b',
    boxShadow: on ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
  }),
  openBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7,
    border: '1px solid #e2e8f0', background: '#fff', color: '#5a67d8', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  } as React.CSSProperties,
  list: { padding: '8px 10px', overflowY: 'auto', flex: 1 } as React.CSSProperties,
  row: (copied: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px', borderRadius: 10, cursor: 'pointer',
    fontFamily: 'inherit', background: copied ? '#f0fdf4' : 'transparent',
    border: copied ? '1px solid #bbf7d0' : '1px solid transparent', transition: 'background 0.12s',
  }),
  iconBox: {
    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f8fafc', borderRadius: 8, flexShrink: 0,
  } as React.CSSProperties,
};
