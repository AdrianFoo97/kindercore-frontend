import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport, faCircleExclamation, faRobot, faFileArrowDown } from '@fortawesome/free-solid-svg-icons';
import { fetchPositions } from '../../../api/salary.js';
import { fetchMissionCategories } from '../../../api/mission-categories.js';
import { AI_FAILED, FROM_TEMPLATE, applyMissionImport, downloadMissionTemplate, readMissionFile, type MissionImportPreview, type PreviewMission } from '../../../api/missionImport.js';
import { ApiError } from '../../../api/client.js';
import type { MissionDifficulty } from '../../../api/career-missions.js';
import { useToast } from '../../../components/common/Toast.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import { useGoBack } from '../../../hooks/useGoBack.js';
import { applyBody, blockReason, counts, initialReview, newCategories, usableCategoryCodes, type MissionChoice, type ReviewState } from './missionImportPlan.js';

// Settings → Career missions → Import with AI. Choose an Excel or PDF list,
// the AI reads it, the person checks every mission and category (keep / change
// / leave out), and only then are they created.

const C = {
  text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', soft: '#f8fafc',
  primary: '#5a67d8', primarySoft: '#eef2ff', amber: '#b45309', amberSoft: '#fffbeb', red: '#b91c1c',
};
const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = { BASIC: 'Basic', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' };
const ACCEPT = '.xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function MissionImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const goBack = useGoBack('/settings/career-missions');
  const fileInput = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** A template's rows that need fixing (nothing was read). */
  const [rowProblems, setRowProblems] = useState<string[]>([]);
  const [preview, setPreview] = useState<MissionImportPreview | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const { data: categories = [] } = useQuery({ queryKey: ['mission-categories'], queryFn: fetchMissionCategories });
  const existingCodes = useMemo(() => categories.map(c => c.code), [categories]);

  const read = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setRowProblems([]);
    setReading(true);
    try {
      const p = await readMissionFile(file);
      setPreview(p);
      setReview(initialReview(p));
    } catch (e) {
      const rows = e instanceof ApiError && Array.isArray(e.body?.problems) ? (e.body!.problems as string[]) : [];
      setRowProblems(rows);
      setProblem(e instanceof ApiError && e.code === AI_FAILED
        ? `${e.message} Try again, or fill in the template — it’s read without AI.`
        : e instanceof Error ? e.message : 'Couldn’t read that file.');
    } finally {
      setReading(false);
    }
  };

  const startOver = () => { setPreview(null); setReview(null); setProblem(null); setRowProblems([]); };

  const getTemplate = async () => {
    try { await downloadMissionTemplate(); }
    catch (e) { showToast(e instanceof Error ? e.message : 'Couldn’t get the template', 'error'); }
  };

  const create = async () => {
    if (!preview || !review) return;
    setSaving(true);
    try {
      const done = await applyMissionImport(applyBody(preview, review));
      qc.invalidateQueries({ queryKey: ['career-missions'] });
      qc.invalidateQueries({ queryKey: ['mission-categories'] });
      showToast(`Created ${done.missions} mission${done.missions === 1 ? '' : 's'}`);
      navigate('/settings/career-missions', { replace: true });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t create them', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1>Import career missions</h1>
      {preview && review ? (
        <Review
          preview={preview} review={review} setReview={setReview} positions={positions} categories={categories}
          existingCodes={existingCodes} saving={saving} onCreate={create} onStartOver={startOver} onCancel={goBack}
        />
      ) : reading ? (
        <div style={{ ...s.drop, cursor: 'default' }} role="status">
          <LoadingSpinner />
          <div style={{ fontSize: 14, color: C.sub, marginTop: 12 }}>Reading the file — with AI this can take a minute…</div>
        </div>
      ) : (
        <>
          <div
            role="button" tabIndex={0} aria-label="Choose an Excel or PDF file of career missions"
            onClick={() => fileInput.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); } }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); void read(e.dataTransfer.files[0]); }}
            style={s.drop}>
            <FontAwesomeIcon icon={faFileImport} style={{ fontSize: 28, color: C.primary }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 12 }}>Drop an Excel or PDF list of missions here, or click to choose it</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              <FontAwesomeIcon icon={faRobot} style={{ marginRight: 6 }} />Any layout is read by AI; our template is read directly, without AI. You check everything before anything is created.
            </div>
          </div>
          <button type="button" onClick={() => void getTemplate()} style={s.link}>
            <FontAwesomeIcon icon={faFileArrowDown} /> Download the template (no AI needed)
          </button>
          <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} />
          {problem && <p role="alert" style={{ marginTop: 16, fontSize: 14, color: C.red }}>{problem}</p>}
          {rowProblems.length > 0 && (
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
              {rowProblems.map(p => (
                <li key={p} style={{ display: 'flex', gap: 8, fontSize: 14, color: C.text }}>
                  <FontAwesomeIcon icon={faCircleExclamation} style={{ color: C.amber, marginTop: 3 }} />{p}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

interface ReviewProps {
  preview: MissionImportPreview;
  review: ReviewState;
  setReview: (s: ReviewState) => void;
  positions: { positionId: string; name: string }[];
  categories: { code: string; name: string }[];
  existingCodes: string[];
  saving: boolean;
  onCreate: () => void;
  onStartOver: () => void;
  onCancel: () => void;
}

/** Step 2: check every new category and mission, then create. */
function Review({ preview, review, setReview, positions, categories, existingCodes, saving, onCreate, onStartOver, onCancel }: ReviewProps) {
  const blocked = blockReason(preview, review, existingCodes);
  const n = counts(review);
  const usable = usableCategoryCodes(preview, review, existingCodes);
  const categoryOptions = [
    ...categories.map(c => ({ code: c.code, name: c.name })),
    ...newCategories(preview).filter(c => review.categories[c.key]?.include).map(c => ({ code: c.code, name: `${review.categories[c.key].name || c.name} (new)` })),
  ];
  const setMission = (key: string, patch: Partial<MissionChoice>) => setReview({ ...review, missions: { ...review.missions, [key]: { ...review.missions[key], ...patch } } });
  const fresh = newCategories(preview);
  const createLabel = `Create ${n.missions} mission${n.missions === 1 ? '' : 's'}${n.categories ? ` and ${n.categories} categor${n.categories === 1 ? 'y' : 'ies'}` : ''}`;

  return (
    <>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: C.sub }}>
        Read from <strong>{preview.fileName}</strong>{preview.model === FROM_TEMPLATE ? ' (the template — no AI)' : ' by AI'}. Untick anything you don’t want, fix anything that’s wrong, then create.
      </p>

      {fresh.length > 0 && (
        <section style={s.card} aria-label="New categories">
          <h2 style={s.h2}>New categories</h2>
          {fresh.map(c => {
            const choice = review.categories[c.key];
            const set = (patch: Partial<typeof choice>) => setReview({ ...review, categories: { ...review.categories, [c.key]: { ...choice, ...patch } } });
            return (
              <div key={c.key} style={{ ...s.row, opacity: choice.include ? 1 : 0.55 }}>
                <input type="checkbox" checked={choice.include} onChange={e => set({ include: e.target.checked })} aria-label={`Create the ${c.name} category`} style={s.check} />
                <label style={s.field}><span style={s.label}>Name</span>
                  <input value={choice.name} onChange={e => set({ name: e.target.value })} disabled={!choice.include} style={s.input} /></label>
                <label style={s.field}><span style={s.label}>Achievement name</span>
                  <input value={choice.achievementName} onChange={e => set({ achievementName: e.target.value })} disabled={!choice.include} style={s.input} /></label>
              </div>
            );
          })}
        </section>
      )}

      <section style={s.card} aria-label="Missions">
        <h2 style={s.h2}>Missions <span style={s.count}>{preview.missions.length}</span></h2>
        {preview.missions.map(m => (
          <MissionRow key={m.key} mission={m} choice={review.missions[m.key]} onChange={patch => setMission(m.key, patch)}
            positions={positions} categoryOptions={categoryOptions} categoryUsable={usable.has(review.missions[m.key].categoryCode)} />
        ))}
      </section>

      <div style={s.actions}>
        <button type="button" onClick={onCancel} style={s.secondary}>Cancel</button>
        <button type="button" onClick={onStartOver} style={s.secondary}>Choose another file</button>
        <span style={{ flex: 1 }} />
        {blocked && <span role="status" style={{ fontSize: 13, color: C.amber }}><FontAwesomeIcon icon={faCircleExclamation} style={{ marginRight: 6 }} />{blocked}</span>}
        <button type="button" onClick={onCreate} disabled={!!blocked || saving}
          style={{ ...s.primary, opacity: blocked || saving ? 0.6 : 1, cursor: blocked || saving ? 'default' : 'pointer' }}>
          {saving ? 'Creating…' : createLabel}
        </button>
      </div>
    </>
  );
}

/** One mission from the file: keep it or not, and fix its title, position, category, difficulty and whether it's required. */
function MissionRow({ mission: m, choice, onChange, positions, categoryOptions, categoryUsable }: {
  mission: PreviewMission; choice: MissionChoice; onChange: (patch: Partial<MissionChoice>) => void;
  positions: { positionId: string; name: string }[]; categoryOptions: { code: string; name: string }[]; categoryUsable: boolean;
}) {
  const off = !choice.include;
  return (
    <div style={{ ...s.row, alignItems: 'flex-start', opacity: off ? 0.55 : 1 }}>
      <input type="checkbox" checked={choice.include} onChange={e => onChange({ include: e.target.checked })} aria-label={`Create “${m.title}”`} style={{ ...s.check, marginTop: 30 }} />
      <div style={{ flex: '2 1 260px', minWidth: 0 }}>
        <label style={s.field}><span style={s.label}>Mission</span>
          <input value={choice.title} onChange={e => onChange({ title: e.target.value })} disabled={off} style={s.input} /></label>
        {m.duplicate && <span style={s.badge}>Already exists for this position</span>}
        {m.description && <div style={s.note}>{m.description}</div>}
      </div>
      <label style={{ ...s.field, flex: '1 1 160px' }}><span style={s.label}>Position</span>
        <select value={choice.positionId} onChange={e => onChange({ positionId: e.target.value })} disabled={off}
          style={{ ...s.input, ...(choice.include && !choice.positionId ? s.missing : null) }}>
          <option value="">Pick a position…</option>
          {positions.map(p => <option key={p.positionId} value={p.positionId}>{p.name}</option>)}
        </select>
        {m.positionText && !choice.positionId && <span style={s.note}>The file says “{m.positionText}”</span>}
      </label>
      <label style={{ ...s.field, flex: '1 1 160px' }}><span style={s.label}>Category</span>
        <select value={categoryUsable ? choice.categoryCode : ''} onChange={e => onChange({ categoryCode: e.target.value })} disabled={off}
          style={{ ...s.input, ...(choice.include && !categoryUsable ? s.missing : null) }}>
          <option value="">Pick a category…</option>
          {categoryOptions.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </label>
      <label style={{ ...s.field, flex: '0 1 130px' }}><span style={s.label}>Difficulty</span>
        <select value={choice.difficulty} onChange={e => onChange({ difficulty: e.target.value as MissionDifficulty })} disabled={off} style={s.input}>
          {(Object.keys(DIFFICULTY_LABEL) as MissionDifficulty[]).map(d => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
        </select>
      </label>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 30, fontSize: 13, color: C.sub, whiteSpace: 'nowrap' }}>
        <input type="checkbox" checked={choice.required} onChange={e => onChange({ required: e.target.checked })} disabled={off} /> Required
      </label>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  drop: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    minHeight: 220, padding: 32, borderRadius: 12, border: `1px dashed ${C.border}`, background: '#fff', cursor: 'pointer',
  },
  card: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 },
  h2: { display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: C.text },
  count: { fontSize: 12, fontWeight: 700, color: C.muted, background: C.soft, border: `1px solid ${C.border}`, borderRadius: 999, padding: '0 8px' },
  row: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', padding: '12px 0', borderTop: `1px solid ${C.border}` },
  check: { width: 18, height: 18, flexShrink: 0, accentColor: C.primary },
  field: { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px', minWidth: 0 },
  label: { fontSize: 12, fontWeight: 600, color: C.muted },
  input: { minHeight: 36, padding: '6px 10px', fontSize: 14, fontFamily: 'inherit', color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', width: '100%', boxSizing: 'border-box' },
  missing: { borderColor: C.amber, background: C.amberSoft },
  note: { marginTop: 4, fontSize: 12, color: C.muted, lineHeight: 1.4 },
  badge: { display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 600, color: C.amber, background: C.amberSoft, borderRadius: 6, padding: '2px 8px' },
  actions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  link: { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, minHeight: 32, padding: 0, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: C.primary, cursor: 'pointer' },
  primary: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
  secondary: { minHeight: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.sub, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
};
