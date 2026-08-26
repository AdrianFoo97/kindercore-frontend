import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCheck, faPlus, faChevronRight, faVideo } from '@fortawesome/free-solid-svg-icons';
import { createTemplate, setTemplateCategories } from '../../api/sop-templates.js';
import { fetchCategories } from '../../api/sop-categories.js';
import { useToast } from '../../components/common/Toast.js';
import { ALLOWED_SOP_ICONS, resolveSopIcon } from '../../utils/sopTemplateIcons.js';
import { usePermissions } from '../../hooks/usePermissions.js';

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
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

// Creation only — editing an existing SOP's title/purpose happens inline
// on SopTemplateStepsPage (click the text, it becomes an input in place),
// not through this form. A full-page form still makes sense for starting a
// brand new SOP from scratch, but not for a two-field correction to one
// that already exists.
export default function SopTemplateFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();

  // This form creates directly — admin, or anyone whose AuthRole grants
  // OPERATION_SOP_APPROVE (the "Supervisor" tier). A teacher landing here
  // (direct URL, bookmark, back-button) belongs on the propose form
  // instead; the backend would 403 the actual create anyway, but bouncing
  // them here avoids a form they can fill out but never submit.
  const rawUser = localStorage.getItem('user');
  const currentUser = rawUser ? (JSON.parse(rawUser) as { role?: string }) : null;
  const { hasView, loading: permLoading } = usePermissions();
  const baseIsAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERADMIN';
  const isAdmin = baseIsAdmin || hasView('OPERATION_SOP_APPROVE');
  useEffect(() => {
    // Wait for permissions to resolve before bouncing a non-admin away —
    // otherwise a legitimate Supervisor gets redirected during the brief
    // window before their OPERATION_SOP_APPROVE grant has loaded.
    if (baseIsAdmin || permLoading) return;
    if (!isAdmin) navigate('/operations/sops/propose', { replace: true });
  }, [baseIsAdmin, isAdmin, permLoading, navigate]);

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [icon, setIcon] = useState<string>(ALLOWED_SOP_ICONS[0]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: allCategories = [] } = useQuery({ queryKey: ['sop-categories'], queryFn: () => fetchCategories() });
  const toggleCategory = (id: string) => {
    setCategoryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!categoryMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setCategoryMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [categoryMenuOpen]);

  const backTo = () => navigate('/operations/sops');

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const created = await createTemplate({ title: title.trim(), goal: goal.trim() || null, videoUrl: videoUrl.trim() || null, icon });
      if (categoryIds.length > 0) await setTemplateCategories(created.id, categoryIds);
      showToast('How-To Guide added');
      qc.invalidateQueries({ queryKey: ['sop-templates'] });
      backTo();
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div style={s.page}>
      <style>{`
        .sop-form-cat-add:hover { border-color: ${C.primary} !important; color: ${C.primary} !important; }
        .sop-form-cat-item:hover { background: ${C.divider} !important; }
      `}</style>
      <div style={s.inner}>
        <button onClick={backTo} style={s.backBtn}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6, fontSize: 11 }} />
          How-To Guides
        </button>

        <div style={{ marginBottom: 20 }}>
          <h1 style={s.heading}>New How-To Guide</h1>
          <p style={s.subheading}>Start with a title and purpose; you'll add steps next.</p>
        </div>

        <div style={s.card}>
          <div style={s.field}>
            <label style={s.label}>Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Picking"
              style={s.input}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALLOWED_SOP_ICONS.map(name => {
                const ic = resolveSopIcon(name);
                const active = icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    style={{
                      width: 40, height: 40, borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: active ? C.primarySoft : '#fff',
                      border: `2px solid ${active ? C.primary : C.cardBorder}`,
                      color: active ? C.primary : C.muted,
                      fontSize: 16, cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <FontAwesomeIcon icon={ic} />
                  </button>
                );
              })}
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>
              Goal
              <span style={s.labelHint}>What does this procedure exist to ensure?</span>
            </label>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Confirm inbound QR info, physical QR info, and item batch/quantity/quality all match before completing picking."
              style={{ ...s.input, minHeight: 160, resize: 'vertical' }}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>
              <FontAwesomeIcon icon={faVideo} style={{ marginRight: 5, fontSize: 11 }} />
              Video
              <span style={s.labelHint}>Optional — a link to a training video (YouTube, Vimeo, Drive, etc.).</span>
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              style={s.input}
            />
          </div>

          <div style={{ ...s.field, marginBottom: 0 }} ref={categoryMenuRef}>
            <label style={s.label}>
              Categories
              <span style={s.labelHint}>Optional — can also be set later from the guide's own page.</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', gap: 7 }}>
              {allCategories.filter(c => categoryIds.includes(c.id)).map(c => (
                <span key={c.id} style={{ ...s.categoryChip, background: `${c.color}1a`, color: c.color, border: `1px solid ${c.color}40` }}>
                  {c.name}
                </span>
              ))}
              <button
                type="button"
                className="sop-form-cat-add"
                onClick={() => setCategoryMenuOpen(o => !o)}
                style={s.categoryAddChip}
                aria-label="Add label"
                title="Add label"
              >
                <FontAwesomeIcon icon={faPlus} style={{ fontSize: 9, marginRight: 5 }} />
                Label
              </button>

              {categoryMenuOpen && (
                <div style={s.categoryMenu}>
                  <div style={s.categoryMenuList}>
                    {allCategories.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 12, color: C.mutedSoft }}>No categories yet.</div>
                    ) : (
                      allCategories.map(c => {
                        const active = categoryIds.includes(c.id);
                        return (
                          <button key={c.id} type="button" className="sop-form-cat-item" onClick={() => toggleCategory(c.id)} style={s.categoryMenuItem}>
                            <span style={{ ...s.categoryCheckbox, ...(active ? { background: c.color, borderColor: c.color } : {}) }}>
                              {active && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 8, color: '#fff' }} />}
                            </span>
                            <span style={{ ...s.categoryDot, background: c.color }} />
                            <span style={{ flex: 1, textAlign: 'left' as const }}>{c.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <Link to="/settings/sop-categories" style={s.categoryManageLink} onClick={() => setCategoryMenuOpen(false)}>
                    Manage categories
                    <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, marginLeft: 6 }} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={s.footer}>
          <button onClick={backTo} style={s.cancelBtn}>Cancel</button>
          <button
            onClick={submit}
            disabled={!title.trim() || saving}
            style={{ ...s.saveBtn, opacity: !title.trim() || saving ? 0.5 : 1 }}
          >
            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
            {saving ? 'Saving…' : 'Create How-To Guide'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 720, margin: '0 auto' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', padding: '6px 10px', marginBottom: 14,
    border: 'none', background: 'transparent', color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  heading: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 12.5, color: C.muted },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '24px 26px', boxShadow: SHADOW,
  },
  field: { marginBottom: 20 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6, letterSpacing: '0.01em' },
  labelHint: { display: 'block', fontSize: 11, fontWeight: 400, color: C.mutedSoft, marginTop: 2 },
  input: {
    width: '100%', padding: '10px 12px', fontSize: 13,
    border: `1px solid ${C.cardBorder}`, borderRadius: 8,
    outline: 'none', color: C.text, boxSizing: 'border-box',
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
  categoryChip: {
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
    borderRadius: 999, fontSize: 11.5, fontWeight: 700, lineHeight: 1.5,
  },
  categoryAddChip: {
    display: 'inline-flex', alignItems: 'center', padding: '3px 11px 3px 9px',
    border: `1.5px dashed ${C.cardBorder}`, borderRadius: 999, background: 'transparent',
    color: C.mutedSoft, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    transition: 'border-color 120ms ease, color 120ms ease',
  },
  categoryMenu: {
    position: 'absolute' as const, top: '100%', left: 0, marginTop: 6, width: 260,
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 25, overflow: 'hidden',
  },
  categoryMenuList: { maxHeight: 220, overflowY: 'auto' as const, padding: 6 },
  categoryMenuItem: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px',
    border: 'none', background: 'transparent', borderRadius: 7, cursor: 'pointer',
    fontSize: 13, color: C.text, textAlign: 'left' as const,
  },
  categoryCheckbox: {
    width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${C.cardBorder}`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  categoryDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  categoryManageLink: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '9px 8px', borderTop: `1px solid ${C.divider}`, background: C.bg,
    fontSize: 12, fontWeight: 600, color: C.primary, textDecoration: 'none',
  },
};
