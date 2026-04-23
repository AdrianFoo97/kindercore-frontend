import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark, faPhone, faLocationDot, faBullhorn, faNoteSticky, faTag,
  faFire, faSun, faSnowflake,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { Lead } from '../../types/index.js';
import { getChannelColor } from '../../utils/chartColors.js';

// ── Shared read-only lead detail modal ──────────────────────────────────
// Used by both Marketing Analysis and Sales Analysis leads-detail tables.
// The `pill` prop lets each caller pass its own classification label so
// the header badge matches whatever pill the table row displayed.

export interface LeadQuickViewPill {
  label: string;
  bg: string;
  color: string;
}

function normalizeWaPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned.replace(/\D/g, '');
  if (cleaned.startsWith('0')) return '60' + cleaned.slice(1);
  if (/^(60|65|62|66|63|91|44|1)\d+$/.test(cleaned)) return cleaned;
  return '60' + cleaned;
}

// Lead temperature derived from ctaSource — mirrors LeadsPage.getLeadHeat.
// Returns null when no signal is present (older leads, imports).
function leadHeatFromCta(ctaSource: string | null | undefined): { label: string; color: string; bg: string; icon: any } | null {
  const sourceOrder: Record<string, number> = { hero: 1, story: 2, methods: 3, courses: 4, final: 5 };
  const score = sourceOrder[ctaSource || ''] || 0;
  if (score >= 4) return { label: 'Hot',  color: '#ef4444', bg: '#fef2f2', icon: faFire };
  if (score >= 2) return { label: 'Warm', color: '#f59e0b', bg: '#fffbeb', icon: faSun };
  if (score >= 1) return { label: 'Cold', color: '#60a5fa', bg: '#eff6ff', icon: faSnowflake };
  return null;
}

export default function LeadQuickViewModal({ lead, pill, onClose }: { lead: Lead; pill: LeadQuickViewPill; onClose: () => void }) {
  const heat = leadHeatFromCta(lead.ctaSource);
  const reasonLabel = lead.status === 'REJECTED' ? 'Reject Reason' : lead.status === 'LOST' ? 'Lost Reason' : null;
  const reason = reasonLabel ? lead.lostReason : null;
  // Hide Notes when the text duplicates the reason — common in legacy data
  // where users typed the same string into both fields.
  const notes = lead.notes && lead.notes.trim() !== (lead.lostReason ?? '').trim() ? lead.notes : null;
  const waLink = `https://wa.me/${normalizeWaPhone(lead.parentPhone)}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420,
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.2)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>{lead.childName}</h3>
            <span style={{
              display: 'inline-block', padding: '3px 10px', fontSize: 10, fontWeight: 700,
              borderRadius: 999, background: pill.bg, color: pill.color,
              textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
            }}>{pill.label}</span>
            {heat && (
              <span
                title={`${heat.label} lead`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', fontSize: 10, fontWeight: 700,
                  borderRadius: 999, background: heat.bg, color: heat.color,
                  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                }}
              >
                <FontAwesomeIcon icon={heat.icon} style={{ fontSize: 10 }} />
                {heat.label}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1 }}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Body — grouped by category so the reader's eye can jump to the
            section they care about. Outcome only renders for terminal
            statuses; everything else is always present. */}
        <div style={{ padding: '6px 22px 18px', display: 'flex', flexDirection: 'column' }}>
          <QuickSection title="Contact">
            <QuickRow icon={faPhone} label="Phone" value={lead.parentPhone} />
          </QuickSection>
          <QuickSection title="Attribution" last={!(reason || notes)}>
            <QuickRow icon={faLocationDot} label="Address" value={lead.addressLocation ?? null} />
            <QuickRow
              icon={faBullhorn}
              label="Marketing channel"
              value={lead.howDidYouKnow ?? null}
              valueColor={lead.howDidYouKnow ? getChannelColor(lead.howDidYouKnow, 0) : undefined}
            />
          </QuickSection>
          {(reason || notes) && (
            <QuickSection title="Outcome" last>
              {reason && <QuickRow icon={faTag} label={reasonLabel!} value={reason} />}
              {notes && <QuickRow icon={faNoteSticky} label="Notes" value={notes} multiline />}
            </QuickSection>
          )}
        </div>

        {/* Footer — WhatsApp */}
        <div style={{ padding: '12px 22px 18px', borderTop: '1px solid #f1f5f9' }}>
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '10px 16px', borderRadius: 10,
              background: '#25d366', color: '#fff', fontWeight: 700, fontSize: 13,
              textDecoration: 'none', letterSpacing: '0.01em',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.1)',
            }}
          >
            <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: 16 }} />
            Open in WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function QuickSection({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      paddingTop: 14,
      paddingBottom: last ? 0 : 14,
      borderBottom: last ? 'none' : '1px dashed #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function QuickRow({ icon, label, value, multiline, valueColor }: { icon: any; label: string; value: string | null; multiline?: boolean; valueColor?: string }) {
  const empty = !value;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{
        flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: '#f1f5f9',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11,
      }}>
        <FontAwesomeIcon icon={icon} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
        <div style={{
          fontSize: 13, fontWeight: valueColor ? 600 : 500, color: empty ? '#cbd5e1' : (valueColor ?? '#0f172a'),
          whiteSpace: multiline ? 'pre-wrap' : 'normal', lineHeight: 1.45,
          wordBreak: 'break-word' as const,
        }}>
          {empty ? '—' : value}
        </div>
      </div>
    </div>
  );
}
