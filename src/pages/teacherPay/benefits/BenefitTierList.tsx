import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faCircleCheck, faCircle, faClock, faLock } from '@fortawesome/free-solid-svg-icons';
import type { BenefitItem, BenefitTier } from './benefitsCatalog.js';
import { C } from './benefitsTheme.js';

/**
 * One tier as a simple list. The tier says once whether it's unlocked; each
 * row is just the benefit, what it's worth, and its own extra condition (if
 * any). Tap a row for the full description and conditions.
 */
export default function BenefitTierList({ tier }: { tier: BenefitTier }) {
  const [open, setOpen] = useState<string | null>(null);
  const tone = tier.key === 'high' ? { fg: C.gold, bg: C.goldSoft } : { fg: C.accent, bg: C.accentSoft };
  return (
    <section aria-labelledby={`tier-${tier.key}`} style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 4px 10px' }}>
        <h2 id={`tier-${tier.key}`} style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>
          {tier.title}
        </h2>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '4px 10px', borderRadius: 999,
          fontSize: 13, fontWeight: 700, color: tier.unlocked ? C.good : C.muted, background: tier.unlocked ? C.goodSoft : C.divider,
        }}>
          <FontAwesomeIcon icon={tier.unlocked ? faCircleCheck : faLock} style={{ fontSize: 12 }} />
          {tier.unlocked ? 'Unlocked' : `From score ${tier.threshold}`}
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {tier.items.map((item, i) => (
          <BenefitRow key={item.key} item={item} tone={tone} first={i === 0}
            open={open === item.key} onToggle={() => setOpen(o => (o === item.key ? null : item.key))} />
        ))}
      </ul>
    </section>
  );
}

function BenefitRow({ item, tone, first, open, onToggle }: {
  item: BenefitItem; tone: { fg: string; bg: string }; first: boolean; open: boolean; onToggle: () => void;
}) {
  const locked = item.status === 'locked';
  const detailsId = `benefit-${item.key}`;
  return (
    <li style={{ borderTop: first ? 'none' : `1px solid ${C.divider}` }}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={detailsId} style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 64, padding: '12px 16px',
        background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', color: 'inherit',
      }}>
        <span aria-hidden style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: locked ? C.divider : tone.bg, color: locked ? C.muted : tone.fg, fontSize: 16,
        }}>
          <FontAwesomeIcon icon={item.icon} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: C.text }}>{item.title}</span>
          <span style={{ display: 'block', fontSize: 13.5, color: C.body, marginTop: 2, lineHeight: 1.35 }}>{item.value}</span>
          {item.extraGate && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 12.5, fontWeight: 600,
              color: item.status === 'in-progress' ? C.wait : C.muted }}>
              <FontAwesomeIcon icon={item.status === 'available' ? faCircleCheck : faClock} style={{ fontSize: 11, color: item.status === 'available' ? C.good : undefined }} />
              {item.extraGate}
            </span>
          )}
        </span>
        <FontAwesomeIcon icon={faChevronDown} aria-hidden style={{ fontSize: 12, color: C.muted, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div id={detailsId} style={{ padding: '0 16px 16px 68px' }}>
          <p style={{ margin: 0, fontSize: 14, color: C.body, lineHeight: 1.5 }}>{item.description}</p>
          {item.requirements.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 8 }}>
              {item.requirements.map(r => (
                <li key={r.label} style={{ fontSize: 13.5, color: C.body, lineHeight: 1.4 }}>
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <FontAwesomeIcon icon={r.met ? faCircleCheck : faCircle} aria-hidden
                      style={{ fontSize: r.met ? 13 : 6, marginTop: r.met ? 2 : 7, color: r.met ? C.good : C.muted, width: 13, flexShrink: 0 }} />
                    <span>
                      {r.label}{r.optional ? ' (when you claim)' : ''}
                      {r.met !== undefined && !r.optional && <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{r.met ? ' — done' : ' — not yet'}</span>}
                    </span>
                  </span>
                  {r.progress !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginLeft: 21 }}>
                      <span style={{ flex: 1, height: 6, borderRadius: 999, background: C.track, overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${r.progress}%`, background: r.met ? C.good : C.accent, borderRadius: 999 }} />
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.current}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {item.note && <p style={{ margin: '10px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.45 }}>{item.note}</p>}
        </div>
      )}
    </li>
  );
}