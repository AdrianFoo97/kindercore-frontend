import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSackDollar,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTeacherPoints, fetchEarningRules } from '../api/points.js';
import { resolveRuleIcon } from '../constants/pointsMeta.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';

// ─────────────────────────────────────────────────────────────────────────────
// Standalone "How to earn" page reached from the rewards page CTA.
// Mirrors the catalog page's structure so the two surfaces feel like
// a pair — one tells you how to gain points, the other how to spend
// them. Keeps the main rewards page focused on what the teacher
// already owns + recent activity.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  divider: '#eef0f3',
  text: '#0f172a',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

const POINTS_C = {
  accent: '#7c3aed',
  soft: '#f5f3ff',
  border: '#ddd6fe',
  deep: '#5b21b6',
};

export default function TeacherEarnPointsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: tp } = useQuery({
    queryKey: ['points-teacher', id], queryFn: () => fetchTeacherPoints(id!), enabled: !!id,
  });
  const { data: allRules } = useQuery({ queryKey: ['points-rules'], queryFn: fetchEarningRules });
  const balance = tp?.balance?.current ?? 0;

  // Show only active rules — admins use the settings page to enable /
  // disable. Sort by highest reward first so the most motivating
  // earning paths sit at the top.
  const rules = (allRules ?? [])
    .filter(r => r.active)
    .slice()
    .sort((a, b) => b.amount - a.amount);

  return (
    <div style={s.page}>
      <style>{`
        .tep-item { transition: border-color 140ms ease, box-shadow 140ms ease; }
        .tep-item:hover { border-color: ${POINTS_C.border}; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 6px 18px rgba(15,23,42,0.05); }
      `}</style>

      <div style={s.inner}>
        <div style={s.header}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={s.eyebrow}>Points & Rewards</div>
            <h1 style={s.heading}>How to earn points</h1>
            <p style={s.subheading}>
              Every activity below grows your points balance. Sorted by reward size so the biggest wins are at the top.
            </p>
          </div>
          <div style={s.balanceChip}>
            <FontAwesomeIcon icon={faSackDollar} style={{ fontSize: 13, color: POINTS_C.accent }} />
            <span style={{
              fontSize: 18, fontWeight: 800, color: POINTS_C.deep,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em',
            }}>
              {balance.toLocaleString('en-MY')}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.02em' }}>
              pts
            </span>
          </div>
        </div>

        {rules.length === 0 ? (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            background: C.card, border: `1px solid ${C.cardBorder}`,
            borderRadius: 14,
            color: C.muted, fontSize: 13,
          }}>
            No earning rules configured yet. Check back later.
          </div>
        ) : (
          <ul style={s.list}>
            {rules.map(rule => (
              <li key={rule.id} className="tep-item" style={s.row}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: POINTS_C.soft, color: POINTS_C.accent,
                  border: `1px solid ${POINTS_C.border}`,
                  fontSize: 17, flexShrink: 0,
                }}>
                  <FontAwesomeIcon icon={resolveRuleIcon(rule.icon)} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: C.text,
                    letterSpacing: '-0.008em',
                  }}>
                    {rule.label}
                  </div>
                  {rule.description && (
                    <div style={{
                      marginTop: 3, fontSize: 13, fontWeight: 500, color: C.muted,
                      lineHeight: 1.5, maxWidth: 600,
                    }}>
                      {rule.description}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 800, color: POINTS_C.deep,
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  letterSpacing: '-0.018em',
                }}>
                  +{rule.amount.toLocaleString('en-MY')}
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: C.muted, marginLeft: 4,
                  }}>pts</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    paddingTop: TEACHER_CONTENT_TOP,
    paddingRight: SP.xxxl,
    paddingBottom: SP.xxxl + SP.lg,
    paddingLeft: SP.xxxl,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: C.bg, minHeight: '100vh', color: C.text,
  },
  inner: { maxWidth: 960, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: SP.sm, fontSize: 12, flexWrap: 'wrap', rowGap: 4, minWidth: 0 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: SP.md,
    marginTop: SP.xl, marginBottom: SP.lg,
  },
  eyebrow: {
    fontSize: 10, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.1em',
  },
  heading: {
    margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: C.text,
    letterSpacing: '-0.025em', lineHeight: 1.15,
  },
  subheading: {
    margin: '6px 0 0', fontSize: 13, fontWeight: 500, color: C.muted,
    lineHeight: 1.55, maxWidth: 640,
  },
  balanceChip: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '8px 14px', borderRadius: 999,
    background: '#fff', border: `1px solid ${POINTS_C.border}`,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    flexShrink: 0,
  },
  list: {
    margin: 0, padding: 0, listStyle: 'none',
    display: 'flex', flexDirection: 'column' as const, gap: SP.sm,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: SP.lg,
    padding: '16px 18px',
    background: C.card, border: `1px solid ${C.cardBorder}`,
    borderRadius: 12, boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
  },
};
