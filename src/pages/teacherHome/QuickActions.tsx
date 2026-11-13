import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCartShopping, faClipboardCheck, faScrewdriverWrench, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

// Teacher Home → quick actions: one-tap shortcuts to the things a teacher
// does that aren't already on the bottom nav (Career / Pay / Rewards /
// Leaderboard / Guides). One row across on a phone.

interface QuickAction { label: string; icon: IconDefinition; to: string; color: string; bg: string }

function actionsFor(teacherId: string): QuickAction[] {
  return [
    // One entry for incidents — the log lists your reports and has the "Report an Incident" button (same shape as Facilities).
    { label: 'Incident Log', icon: faTriangleExclamation, to: `/teachers/${teacherId}/incidents`, color: '#dc2626', bg: '#fef2f2' },
    { label: 'Report a problem', icon: faScrewdriverWrench, to: `/teachers/${teacherId}/facilities`, color: '#0369a1', bg: '#f0f9ff' },
    { label: 'Request an item', icon: faCartShopping, to: `/teachers/${teacherId}/purchases`, color: '#047857', bg: '#ecfdf5' },
    { label: 'My appraisal', icon: faClipboardCheck, to: `/teachers/${teacherId}/my-compensation/appraisal`, color: '#7c3aed', bg: '#f5f3ff' },
  ];
}

export function QuickActions({ teacherId }: { teacherId: string }) {
  const navigate = useNavigate();
  const actions = actionsFor(teacherId);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))`, gap: 8, marginBottom: 26 }}>
      {actions.map(a => (
        <button
          key={a.label}
          type="button"
          onClick={() => navigate(a.to)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '14px 4px 12px', borderRadius: 16, cursor: 'pointer', font: 'inherit',
            background: '#ffffff', border: '1px solid #eceef2', boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{
            width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: a.bg, color: a.color, fontSize: 16,
          }}>
            <FontAwesomeIcon icon={a.icon} />
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', textAlign: 'center', lineHeight: 1.25 }}>{a.label}</span>
        </button>
      ))}
    </div>
  );
}
