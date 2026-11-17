import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMyTraining, trainingKey } from '../../api/sop-observations.js';
import { trainingToGive } from './myTraining.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBookMedical, faCartShopping, faChalkboardUser, faClipboardCheck, faLightbulb, faWrench } from '@fortawesome/free-solid-svg-icons';

// Teacher Home → quick actions: one-tap shortcuts to the things a teacher
// does that aren't already on the bottom nav (Career / Pay / Rewards /
// Leaderboard / Guides). At most three per row, so each tile has room for
// its label on a phone; more shortcuts wrap onto a new row.

const PER_ROW = 3;

interface QuickAction { label: string; icon: IconDefinition; to: string; color: string; bg: string; /** Things waiting for them here (a count badge). */ waiting?: number }

function actionsFor(teacherId: string, toTrain: number): QuickAction[] {
  return [
    // One entry for incidents — the log lists your reports and has the "Report an Incident" button (same shape as Facilities).
    { label: 'Incident Log', icon: faBookMedical, to: `/teachers/${teacherId}/incidents`, color: '#dc2626', bg: '#fef2f2' },
    // Named after the place it opens — "Report a problem" read as anything at all.
    { label: 'Facilities', icon: faWrench, to: `/teachers/${teacherId}/facilities`, color: '#0369a1', bg: '#f0f9ff' },
    { label: 'Request an item', icon: faCartShopping, to: `/teachers/${teacherId}/purchases`, color: '#047857', bg: '#ecfdf5' },
    { label: 'My appraisal', icon: faClipboardCheck, to: `/teachers/${teacherId}/my-compensation/appraisal`, color: '#7c3aed', bg: '#f5f3ff' },
    // Their How-To Guide suggestions (new guides + improvements) and where each stands.
    { label: 'My guide ideas', icon: faLightbulb, to: '/operations/sops/my-suggestions?app=teacher', color: '#b45309', bg: '#fffbeb' },
    // SOP training — as trainee (what they're learning) and as trainer (who they're training).
    { label: 'My training', icon: faChalkboardUser, to: `/teachers/${teacherId}/my-training${toTrain ? '?tab=trainer' : ''}`, color: '#0f766e', bg: '#f0fdfa', waiting: toTrain },
  ];
}

export function QuickActions({ teacherId }: { teacherId: string }) {
  const navigate = useNavigate();
  // Training they've been asked to give shows as a count, so a trainer knows someone is waiting.
  const training = useQuery({ queryKey: trainingKey(teacherId), queryFn: () => fetchMyTraining(teacherId), retry: false });
  const actions = actionsFor(teacherId, training.data ? trainingToGive(training.data) : 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(PER_ROW, actions.length)}, minmax(0, 1fr))`, gap: 8, marginBottom: 26 }}>
      {actions.map(a => (
        <button
          key={a.label}
          type="button"
          onClick={() => navigate(a.to)}
          aria-label={a.waiting ? `${a.label}, ${a.waiting} waiting for you` : undefined}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '14px 4px 12px', borderRadius: 16, cursor: 'pointer', font: 'inherit',
            background: '#ffffff', border: '1px solid #eceef2', boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{
            position: 'relative', width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: a.bg, color: a.color, fontSize: 16,
          }}>
            <FontAwesomeIcon icon={a.icon} />
            {!!a.waiting && (
              <span aria-hidden style={{
                position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 999,
                background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
              }}>{a.waiting}</span>
            )}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', textAlign: 'center', lineHeight: 1.25 }}>{a.label}</span>
        </button>
      ))}
    </div>
  );
}
