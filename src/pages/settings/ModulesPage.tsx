import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faChevronRight, faBullhorn, faGraduationCap, faUsers,
  faMoneyBillTrendUp, faGears, faChartLine, faScrewdriverWrench,
} from '@fortawesome/free-solid-svg-icons';
import { fetchAuthViews } from '../../api/auth-views.js';
import { ALL_MODULE_KEYS, MODULE_LABELS, ModuleKey } from '../../constants/authModules.js';

// Same icon set as the top nav (Navbar.tsx) so a module reads the same
// wherever it shows up.
const MODULE_ICONS: Record<ModuleKey, IconDefinition> = {
  LEADS: faBullhorn,
  STUDENTS: faGraduationCap,
  HR: faUsers,
  FINANCE: faMoneyBillTrendUp,
  OPERATION: faGears,
  ANALYSIS: faChartLine,
  TOOLS: faScrewdriverWrench,
};

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

export default function ModulesPage() {
  const navigate = useNavigate();

  const { data: views = [], isLoading } = useQuery({
    queryKey: ['auth-views'],
    queryFn: fetchAuthViews,
  });

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={s.heading}>Modules</h1>
          <p style={s.subheading}>
            The fixed top-level nav sections. Click into one to see — and manage — which Views live under it.
            Views and what gets granted still live under Views and Access Roles; this is just the module-first way
            to browse the same data.
          </p>
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Modules</h3>
              <div style={s.cardSub}>{ALL_MODULE_KEYS.length} modules</div>
            </div>
          </div>

          {isLoading ? (
            <p style={{ padding: 24, color: C.mutedSoft, fontSize: 13 }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ALL_MODULE_KEYS.map(m => {
                const count = views.filter(v => v.modules.includes(m)).length;
                return (
                  <button key={m} type="button" onClick={() => navigate(`/settings/modules/${m}`)} style={s.row}>
                    <div style={s.iconSwatch}>
                      <FontAwesomeIcon icon={MODULE_ICONS[m]} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                        {MODULE_LABELS[m]}
                      </div>
                      <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>
                        {count === 0 ? 'No views yet' : `${count} view${count === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12, color: C.mutedSoft }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 1100, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5, maxWidth: 720 },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '22px 26px', boxShadow: SHADOW, marginBottom: 20,
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' },
  cardSub: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  row: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', width: '100%',
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: '#fff', cursor: 'pointer',
    font: 'inherit', color: 'inherit',
  },
  iconSwatch: {
    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: C.primarySoft, color: C.primary, fontSize: 16,
  },
};
