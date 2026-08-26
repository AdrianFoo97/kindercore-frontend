import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faTimes, faMagnifyingGlass, faClipboardCheck, faCheck, faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTeachers } from '../api/planner.js';
import { fetchPositions } from '../api/salary.js';
import { fetchTemplates } from '../api/sop-templates.js';
import { fetchCategories } from '../api/sop-categories.js';
import { createObservation } from '../api/sop-observations.js';
import { useToast } from '../components/common/Toast.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  divider: '#f1f5f9',
  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function PersonPickRow({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="sop-obs-pick-row" style={s.pickRow}>
      <span style={s.avatar}>{initials(name)}</span>
      <span>{name}</span>
    </button>
  );
}

export default function SopObservationNewPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const { data: teachers = [] } = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });
  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [sopTemplateId, setSopTemplateId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [trainerSearch, setTrainerSearch] = useState('');
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const activeTeachers = teachers.filter((t: any) => !t.resignedAt);
  const filteredTeachers = search.trim()
    ? activeTeachers.filter((t: any) => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : activeTeachers;

  const selectedTeacher = teachers.find((t: any) => t.id === teacherId) ?? null;
  const positionName = selectedTeacher?.positionId
    ? positions.find(p => p.positionId === selectedTeacher.positionId)?.name ?? null
    : null;

  // A teacher can't train themselves.
  const trainerCandidates = activeTeachers.filter((t: any) => t.id !== teacherId);
  const filteredTrainers = trainerSearch.trim()
    ? trainerCandidates.filter((t: any) => t.name.toLowerCase().includes(trainerSearch.trim().toLowerCase()))
    : trainerCandidates;
  const selectedTrainer = teachers.find((t: any) => t.id === trainerId) ?? null;

  // The How-To Guides library is a flat, org-wide list — not scoped to the
  // selected teacher's position (many guides apply to everyone).
  const { data: templates = [] } = useQuery({ queryKey: ['sop-templates'], queryFn: () => fetchTemplates() });
  const { data: categories = [] } = useQuery({ queryKey: ['sop-categories'], queryFn: () => fetchCategories() });
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const selectedCategory = categories.find(c => c.id === categoryFilter);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const categoryFilterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!categoryFilterOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(e.target as Node)) {
        setCategoryFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [categoryFilterOpen]);
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !templateSearch.trim() || t.title.toLowerCase().includes(templateSearch.trim().toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || (t.categories ?? []).some(c => c.id === categoryFilter);
    return matchesSearch && matchesCategory;
  });

  const backTo = () => navigate('/hr/sop-observations');

  const submit = async () => {
    if (!teacherId || !sopTemplateId || !trainerId) return;
    setCreating(true);
    try {
      const obs = await createObservation({ teacherId, sopTemplateId, trainerId });
      qc.invalidateQueries({ queryKey: ['sop-observations'] });
      navigate(`/hr/sop-observations/${obs.id}`);
    } catch (e: any) {
      showToast(e?.message ?? 'Could not start observation', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={s.page}>
      <style>{`
        .sop-obs-pick-row:hover { background: ${C.primarySoft} !important; border-color: ${C.primaryBorder} !important; }
        .sop-obs-picklist::-webkit-scrollbar { width: 6px; }
        .sop-obs-picklist::-webkit-scrollbar-track { background: transparent; }
        .sop-obs-picklist::-webkit-scrollbar-thumb { background: ${C.cardBorder}; border-radius: 3px; }
        .sop-obs-picklist::-webkit-scrollbar-thumb:hover { background: ${C.mutedSoft}; }
        .sop-obs-catfilter-trigger:hover { border-color: ${C.primaryBorder} !important; background: ${C.primarySoft} !important; }
        .sop-obs-catfilter-item:hover { background: ${C.divider} !important; }
      `}</style>
      <div style={s.inner}>
        <button onClick={backTo} style={s.backBtn}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6, fontSize: 11 }} />
          Practice Observations
        </button>

        <div style={{ marginBottom: 20 }}>
          <h1 style={s.heading}>New Observation</h1>
          <p style={s.subheading}>Pick who's being observed, on which How-To Guide, and who's running it.</p>
        </div>

        <div style={s.card}>
          <div style={s.stepper}>
            {(['Teacher', 'How-To Guide', 'Trainer'] as const).map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3;
              const done = n < step;
              const active = n === step;
              return (
                <React.Fragment key={label}>
                  {i > 0 && <div style={{ ...s.stepLine, background: done || active ? C.primary : C.cardBorder }} />}
                  <div style={s.stepItem}>
                    <div style={{
                      ...s.stepDot,
                      background: done ? C.primary : active ? C.primarySoft : '#fff',
                      color: done ? '#fff' : active ? C.primary : C.mutedSoft,
                      border: `1.5px solid ${done || active ? C.primary : C.cardBorder}`,
                    }}>
                      {done ? <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} /> : n}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: active ? C.text : C.mutedSoft }}>{label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div style={s.stepBody}>
            {step === 1 && (
              <div>
                {!teacherId ? (
                  <>
                    <div style={{ position: 'relative' }}>
                      <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: 12, fontSize: 12, color: C.mutedSoft }} />
                      <input
                        autoFocus
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name…"
                        style={{ ...s.input, paddingLeft: 32 }}
                      />
                    </div>
                    <div className="sop-obs-picklist" style={s.pickList}>
                      {filteredTeachers.slice(0, 8).map((t: any) => (
                        <PersonPickRow
                          key={t.id}
                          name={t.name}
                          onClick={() => { setTeacherId(t.id); setSopTemplateId(null); setTrainerId(null); setStep(2); }}
                        />
                      ))}
                      {filteredTeachers.length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: C.mutedSoft }}>No teachers match.</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={s.selectedChip}>
                    <span>{selectedTeacher?.name}{positionName ? ` · ${positionName}` : ''}</span>
                    <button type="button" onClick={() => { setTeacherId(null); setSopTemplateId(null); setTrainerId(null); }} style={s.chipClear}>
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                {templates.length === 0 ? (
                  <p style={{ fontSize: 12, color: C.mutedSoft, margin: 0 }}>No How-To Guides configured yet.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: 12, fontSize: 12, color: C.mutedSoft }} />
                        <input
                          autoFocus
                          type="text"
                          value={templateSearch}
                          onChange={e => setTemplateSearch(e.target.value)}
                          placeholder="Search by title…"
                          style={{ ...s.input, paddingLeft: 32 }}
                        />
                      </div>
                      {categories.length > 0 && (
                        <div style={{ position: 'relative' }} ref={categoryFilterRef}>
                          <button
                            type="button"
                            className="sop-obs-catfilter-trigger"
                            onClick={() => setCategoryFilterOpen(o => !o)}
                            style={s.categoryFilterTrigger}
                          >
                            {selectedCategory ? (
                              <>
                                <span style={{ ...s.categoryFilterDot, background: selectedCategory.color }} />
                                {selectedCategory.name}
                              </>
                            ) : 'All labels'}
                            <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 9, color: C.mutedSoft, marginLeft: 'auto', paddingLeft: 10 }} />
                          </button>
                          {categoryFilterOpen && (
                            <div style={s.categoryFilterMenu}>
                              <button
                                type="button"
                                className="sop-obs-catfilter-item"
                                onClick={() => { setCategoryFilter('ALL'); setCategoryFilterOpen(false); }}
                                style={s.categoryFilterItem}
                              >
                                <span style={{ width: 14 }}>{categoryFilter === 'ALL' && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: C.primary }} />}</span>
                                All labels
                              </button>
                              {categories.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="sop-obs-catfilter-item"
                                  onClick={() => { setCategoryFilter(c.id); setCategoryFilterOpen(false); }}
                                  style={s.categoryFilterItem}
                                >
                                  <span style={{ width: 14 }}>{categoryFilter === c.id && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: C.primary }} />}</span>
                                  <span style={{ ...s.categoryFilterDot, background: c.color }} />
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="sop-obs-picklist" style={{ ...s.pickList, maxHeight: 320 }}>
                      {filteredTemplates.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { setSopTemplateId(t.id); setStep(3); }}
                          className="sop-obs-pick-row"
                          style={{
                            ...s.pickRow,
                            alignItems: 'flex-start',
                            border: `1px solid ${sopTemplateId === t.id ? C.primary : C.cardBorder}`,
                            background: sopTemplateId === t.id ? C.primarySoft : '#fff',
                            color: sopTemplateId === t.id ? C.primary : C.text,
                            fontWeight: sopTemplateId === t.id ? 700 : 500,
                          }}
                        >
                          <FontAwesomeIcon icon={faClipboardCheck} style={{ fontSize: 12, marginTop: 2, color: sopTemplateId === t.id ? C.primary : C.mutedSoft, flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block' }}>{t.title}</span>
                            {(t.categories ?? []).length > 0 && (
                              <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginTop: 5 }}>
                                {t.categories!.map(c => (
                                  <span key={c.id} style={{ ...s.categoryChip, background: `${c.color}1a`, color: c.color }}>{c.name}</span>
                                ))}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                      {filteredTemplates.length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: C.mutedSoft }}>No How-To Guides match.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: C.mutedSoft }}>Who's running this observation.</p>
                {!trainerId ? (
                  <>
                    <div style={{ position: 'relative' }}>
                      <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: 12, fontSize: 12, color: C.mutedSoft }} />
                      <input
                        autoFocus
                        type="text"
                        value={trainerSearch}
                        onChange={e => setTrainerSearch(e.target.value)}
                        placeholder="Search by name…"
                        style={{ ...s.input, paddingLeft: 32 }}
                      />
                    </div>
                    <div className="sop-obs-picklist" style={s.pickList}>
                      {filteredTrainers.slice(0, 8).map((t: any) => (
                        <PersonPickRow key={t.id} name={t.name} onClick={() => setTrainerId(t.id)} />
                      ))}
                      {filteredTrainers.length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: C.mutedSoft }}>No teachers match.</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={s.selectedChip}>
                    <span>{selectedTrainer?.name}</span>
                    <button type="button" onClick={() => setTrainerId(null)} style={s.chipClear}>
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={s.footer}>
          {step === 1 ? (
            <button onClick={backTo} style={s.cancelBtn}>Cancel</button>
          ) : (
            <button onClick={() => setStep(prev => (prev - 1) as 1 | 2)} style={s.cancelBtn}>Back</button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(prev => (prev + 1) as 2 | 3)}
              disabled={step === 1 ? !teacherId : !sopTemplateId}
              style={{ ...s.saveBtn, opacity: (step === 1 ? !teacherId : !sopTemplateId) ? 0.5 : 1 }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!teacherId || !sopTemplateId || !trainerId || creating}
              style={{ ...s.saveBtn, opacity: (!teacherId || !sopTemplateId || !trainerId || creating) ? 0.5 : 1 }}
            >
              {creating ? 'Starting…' : 'Start Observation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 640, margin: '0 auto' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', padding: '6px 10px', marginBottom: 14,
    border: 'none', background: 'transparent', color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  heading: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 12.5, color: C.muted },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    boxShadow: SHADOW, overflow: 'hidden',
  },
  stepper: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '20px 26px 0',
  },
  stepItem: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  stepDot: {
    width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  stepLine: { flex: 1, height: 1.5, borderRadius: 1 },
  stepBody: { padding: '20px 26px 26px' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6, letterSpacing: '0.01em' },
  input: {
    width: '100%', padding: '10px 12px', fontSize: 13,
    border: `1px solid ${C.cardBorder}`, borderRadius: 8,
    outline: 'none', color: C.text, boxSizing: 'border-box',
  },
  pickList: {
    marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6,
    maxHeight: 320, overflowY: 'auto', paddingRight: 4,
  },
  pickRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    textAlign: 'left' as const, padding: '9px 12px', borderRadius: 9,
    border: `1px solid ${C.cardBorder}`, background: '#fff', color: C.text,
    fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 100ms ease, border-color 100ms ease',
  },
  avatar: {
    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: C.primarySoft, color: C.primary, fontSize: 10.5, fontWeight: 700,
  },
  categoryFilterTrigger: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 10, background: '#fff',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.textSub,
    minWidth: 150, transition: 'border-color 120ms ease, background 120ms ease',
  },
  categoryFilterDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  categoryFilterMenu: {
    position: 'absolute' as const, top: '100%', right: 0, marginTop: 6, width: 220,
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 25, overflow: 'hidden',
    maxHeight: 260, overflowY: 'auto' as const, padding: 6,
  },
  categoryFilterItem: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 8px',
    border: 'none', background: 'transparent', borderRadius: 7, cursor: 'pointer',
    fontSize: 13, color: C.text, textAlign: 'left' as const,
  },
  categoryChip: {
    display: 'inline-flex', alignItems: 'center', padding: '1px 7px',
    borderRadius: 999, fontSize: 10, fontWeight: 700,
  },
  selectedChip: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.primaryBorder}`,
    background: C.primarySoft, color: C.primary, fontSize: 13, fontWeight: 600,
  },
  chipClear: {
    border: 'none', background: 'transparent', color: C.primary, cursor: 'pointer', fontSize: 12,
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16,
  },
  cancelBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};
