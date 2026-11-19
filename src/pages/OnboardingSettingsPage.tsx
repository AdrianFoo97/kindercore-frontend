import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings } from '../api/settings.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import ChecklistEditor from './ChecklistEditor.js';
import { parseChecklistTemplate } from './checklistItems.js';

/** One checklist template on the page — e.g. HR's list and the new joiner's own list. */
export interface ChecklistSection {
  settingKey: string;
  /** Shown above the editor when the page has more than one list. */
  label?: string;
  help?: string;
}

const STUDENT_SECTIONS: ChecklistSection[] = [{ settingKey: 'onboarding_tasks' }];

/** The same checklist editor serves students (default) and staff (Settings → Staff onboarding). */
export default function OnboardingSettingsPage({
  sections = STUDENT_SECTIONS,
  title = 'Student Onboarding',
}: { sections?: ChecklistSection[]; title?: string }) {
  const queryClient = useQueryClient();
  // Several lists (staff onboarding: HR's + the joiner's own) → one tab each.
  const [tab, setTab] = useState(sections[0]?.settingKey);
  const tabbed = sections.length > 1;
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { role: string }) : null;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  if (isLoading) return <div className="m-pad"><LoadingSpinner /></div>;
  if (isError) {
    return (
      <div className="m-pad">
        <p style={{ fontSize: 14, color: '#b91c1c' }}>Couldn’t load the checklist.</p>
        <button type="button" onClick={() => refetch()} style={{ minHeight: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="m-pad">
      <h1>{title}</h1>
      {!isAdmin && <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Only admins can change these checklists.</p>}
      {tabbed && (
        <div role="tablist" aria-label="Checklists" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid #e2e8f0' }}>
          {sections.map(sec => {
            const on = sec.settingKey === tab;
            return (
              <button key={sec.settingKey} role="tab" aria-selected={on} onClick={() => setTab(sec.settingKey)} style={{
                minHeight: 44, padding: '0 12px', marginBottom: -1, border: 'none', background: 'none', whiteSpace: 'nowrap',
                borderBottom: `2px solid ${on ? '#4f5bd5' : 'transparent'}`, color: on ? '#4f5bd5' : '#475569',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{sec.label}</button>
            );
          })}
        </div>
      )}
      {sections.map(section => (
        // Every list stays mounted (just hidden), so switching tabs keeps unsaved changes.
        <section key={section.settingKey} role={tabbed ? 'tabpanel' : undefined} aria-label={section.label}
          hidden={tabbed && section.settingKey !== tab}>
          {!tabbed && section.label && <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{section.label}</h2>}
          {section.help && <p style={{ fontSize: 13, color: '#64748b', margin: tabbed ? '12px 0 16px' : '0 0 12px' }}>{section.help}</p>}
          <ChecklistEditor
            key={section.settingKey}
            settingKey={section.settingKey}
            initialItems={parseChecklistTemplate(data?.[section.settingKey])}
            isAdmin={isAdmin}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ['settings'] })}
          />
        </section>
      ))}
    </div>
  );
}
