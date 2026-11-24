import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { bulkUpdateMissions, type MissionDifficulty } from '../../../api/career-missions.js';
import { useDeleteDialog } from '../../../components/common/DeleteDialog.js';
import { useToast } from '../../../components/common/Toast.js';

// Career missions → several selected: change the same details on all of them,
// or archive them. Each field starts at "Keep" (unchanged); Apply waits until
// at least one is set.

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', primary: '#5a67d8', primarySoft: '#eef2ff', danger: '#b91c1c' };
const KEEP = '';
type YesNo = '' | 'yes' | 'no';
const yesNo = (v: YesNo) => (v === KEEP ? undefined : v === 'yes');

export function BulkMissionBar({ ids, categories, onDone, onClear }: {
  ids: string[];
  categories: { code: string; label: string }[];
  /** After a change: refresh and clear the selection. */
  onDone: () => void;
  onClear: () => void;
}) {
  const { confirm } = useDeleteDialog();
  const { showToast } = useToast();
  const [difficulty, setDifficulty] = useState<'' | MissionDifficulty>(KEEP);
  const [required, setRequired] = useState<YesNo>(KEEP);
  const [priority, setPriority] = useState<YesNo>(KEEP);
  const [category, setCategory] = useState(KEEP);
  const [busy, setBusy] = useState(false);
  const n = ids.length;
  const label = `${n} mission${n === 1 ? '' : 's'}`;
  const changes = {
    ...(difficulty ? { difficulty } : {}),
    ...(required ? { required: yesNo(required) } : {}),
    ...(priority ? { highPriority: yesNo(priority) } : {}),
    ...(category ? { category } : {}),
  };
  const hasChanges = Object.keys(changes).length > 0;

  const apply = async () => {
    setBusy(true);
    try {
      await bulkUpdateMissions(ids, { set: changes });
      showToast(`Updated ${label}`);
      setDifficulty(KEEP); setRequired(KEEP); setPriority(KEEP); setCategory(KEEP);
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t update them', 'error');
    } finally {
      setBusy(false);
    }
  };

  const archive = () => confirm({
    entityType: 'Missions',
    entityName: label,
    consequence: 'They will be archived. Existing teacher progress on them stays in their history (read-only).',
    actionLabel: 'Archive',
    onConfirm: async () => {
      await bulkUpdateMissions(ids, { delete: true });
      showToast(`Archived ${label}`);
      onDone();
    },
  });

  return (
    <div role="region" aria-label="Selected missions" style={s.bar}>
      <strong style={{ fontSize: 14, color: C.text, whiteSpace: 'nowrap' }}>{n} selected</strong>
      <Pick label="Difficulty" value={difficulty} onChange={v => setDifficulty(v as '' | MissionDifficulty)}
        options={[['BASIC', 'Basic'], ['INTERMEDIATE', 'Intermediate'], ['ADVANCED', 'Advanced']]} />
      <Pick label="Required" value={required} onChange={v => setRequired(v as YesNo)} options={[['yes', 'Required'], ['no', 'Optional']]} />
      <Pick label="Priority" value={priority} onChange={v => setPriority(v as YesNo)} options={[['yes', 'High priority'], ['no', 'Normal']]} />
      <Pick label="Category" value={category} onChange={setCategory} options={categories.map(c => [c.code, c.label])} />
      <button type="button" onClick={() => void apply()} disabled={!hasChanges || busy} title={hasChanges ? undefined : 'Choose what to change first'}
        style={{ ...s.primary, opacity: hasChanges && !busy ? 1 : 0.6, cursor: hasChanges && !busy ? 'pointer' : 'default' }}>
        {busy ? 'Saving…' : 'Apply'}
      </button>
      <span style={{ flex: 1 }} />
      <button type="button" onClick={() => void archive()} style={s.danger}><FontAwesomeIcon icon={faTrash} /> Archive</button>
      <button type="button" onClick={onClear} style={s.ghost} aria-label="Clear selection" title="Clear selection"><FontAwesomeIcon icon={faXmark} /></button>
    </div>
  );
}

/** One "change this" dropdown; "Keep" leaves it as it is. */
function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.sub }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)} style={s.select}>
        <option value={KEEP}>Keep</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

const s: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 12,
    background: C.primarySoft, border: `1px solid ${C.primary}33`, borderRadius: 10, position: 'sticky', top: 8, zIndex: 2,
  },
  select: { minHeight: 32, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit', color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff' },
  primary: { minHeight: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
  danger: { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.danger}55`, background: '#fff', color: C.danger, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
  ghost: { width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer' },
};
