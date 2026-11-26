import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchSettings, patchSetting } from '../../api/settings.js';
import { ENROLMENT_NEWS_SETTING } from '../../api/schoolNews.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import SettingsNote from './SettingsNote.js';

// Settings → Students → School news: whether a new enrolment is posted on
// every staff member's Home (and they're told). On unless switched off.

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', accent: '#5a67d8', red: '#b91c1c' };

const isOn = (v: unknown) => v !== false && v !== 'false';

export default function SchoolNewsSettingsPage() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const on = isOn((data as Record<string, unknown> | undefined)?.[ENROLMENT_NEWS_SETTING]);
  const save = useMutation({
    mutationFn: (next: boolean) => patchSetting(ENROLMENT_NEWS_SETTING, next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (isPending) return <div className="m-pad"><h1>School news</h1><LoadingSpinner /></div>;
  return (
    <div className="m-pad">
      <h1>School news</h1>
      <SettingsNote>Posts share only the class and start date — never the child’s name. Children whose start date is more than a month past (e.g. an import of past students) aren’t posted.</SettingsNote>
      <label style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>Share new enrolments</span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: C.muted }}>When a child is given a package, everyone on the staff sees it on Home and gets a notification.</span>
        </span>
        <input type="checkbox" role="switch" checked={on} disabled={save.isPending} aria-label="Share new enrolments"
          onChange={e => save.mutate(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.accent, cursor: save.isPending ? 'default' : 'pointer' }} />
        <span style={{ width: 28, fontSize: 13, fontWeight: 700, color: on ? C.accent : C.muted }}>{on ? 'On' : 'Off'}</span>
      </label>
      {save.error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: C.red }}>{(save.error as Error).message}</p>}
    </div>
  );
}
