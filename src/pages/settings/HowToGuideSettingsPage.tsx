import { useState } from 'react';
import SopCategoriesPage from './SopCategoriesPage.js';
import SopSectionsPage from './SopSectionsPage.js';

// Settings → Operations → How-to guides (/settings/how-to-guides): how guides
// are organised — the categories they're filed under and the sections inside one.

type Tab = 'categories' | 'sections';
const TABS: { key: Tab; label: string; about: string }[] = [
  { key: 'categories', label: 'Categories', about: 'What guides are filed under in the library.' },
  { key: 'sections', label: 'Sections', about: 'The parts a guide’s steps are grouped into.' },
];
const C = { text: '#1a1f36', sub: '#475569', muted: '#64748b', border: '#e2e8f0', accent: '#4f5bd5' };

export default function HowToGuideSettingsPage() {
  const [tab, setTab] = useState<Tab>('categories');
  const active = TABS.find(t => t.key === tab)!;
  return (
    <div className="m-pad">
      <h1>How-to guides</h1>
      <div role="tablist" aria-label="How-to guide settings" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}` }}>
        {TABS.map(t => {
          const on = t.key === tab;
          return (
            <button key={t.key} role="tab" aria-selected={on} onClick={() => setTab(t.key)} style={{
              minHeight: 44, padding: '0 12px', marginBottom: -1, border: 'none', background: 'none',
              borderBottom: `2px solid ${on ? C.accent : 'transparent'}`, color: on ? C.accent : C.sub,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{t.label}</button>
          );
        })}
      </div>
      <p style={{ margin: '12px 0 16px', fontSize: 13, color: C.muted }}>{active.about}</p>
      <div role="tabpanel" aria-label={active.label}>
        {tab === 'categories' ? <SopCategoriesPage embedded /> : <SopSectionsPage embedded />}
      </div>
    </div>
  );
}
