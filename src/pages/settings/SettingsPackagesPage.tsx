import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxesStacked, faChildren, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';
import ProgrammesSettingsPage from '../ProgrammesSettingsPage.js';
import AgeGroupsSettingsPage from '../AgeGroupsSettingsPage.js';
import PackagesPage from '../PackagesPage.js';

const C = {
  primary: '#5a67d8', primaryLight: '#eef0fa', text: '#1e293b', muted: '#94a3b8', border: '#e2e8f0',
};

type TabKey = 'programmes' | 'ageGroups' | 'pricing';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'programmes', label: 'Programmes', icon: faBoxesStacked },
  { key: 'ageGroups', label: 'Age Groups', icon: faChildren },
  { key: 'pricing', label: 'Pricing', icon: faMoneyBillWave },
];

export default function SettingsPackagesPage() {
  const [tab, setTab] = useState<TabKey>('programmes');
  const active = TABS.find(t => t.key === tab)!;

  return (
    <div style={s.page}>
      <style>{`.pkg-settings-tab:hover { color: ${C.text} !important; background: #f1f5f9 !important; }`}</style>
      <div style={s.inner}>
        <h1 style={s.heading}>{active.label}</h1>

        <div style={s.tabStrip}>
          {TABS.map(t => (
            <button
              key={t.key}
              className="pkg-settings-tab"
              onClick={() => setTab(t.key)}
              style={{ ...s.tabBtn, ...(tab === t.key ? s.tabBtnActive : {}) }}
            >
              <FontAwesomeIcon icon={t.icon} style={{ fontSize: 12, width: 14 }} />
              {t.label}
            </button>
          ))}
        </div>

        <div style={s.content}>
          {tab === 'programmes' && <ProgrammesSettingsPage embedded />}
          {tab === 'ageGroups' && <AgeGroupsSettingsPage embedded />}
          {tab === 'pricing' && <PackagesPage embedded />}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text },
  inner: { maxWidth: 960, margin: '0 auto' },
  heading: { fontSize: 22, fontWeight: 800, color: C.text, margin: '4px 0 20px' },

  tabStrip: { display: 'flex', flexWrap: 'wrap' as const, gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 24 },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500,
    color: C.muted, background: 'none', border: 'none', borderBottom: '2px solid transparent', borderRadius: '8px 8px 0 0',
    cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: 'inherit', transition: 'all 0.1s', marginBottom: -1,
  },
  tabBtnActive: { color: C.primary, fontWeight: 600, borderBottom: `2px solid ${C.primary}` },
  content: { minWidth: 0 },
};
