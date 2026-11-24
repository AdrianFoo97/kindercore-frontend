import { useEffect, useMemo, useRef, useState } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faFileLines, faUserPen, faClock, faPlus, faCopy, faMagnifyingGlass, faFileImport, faFileArrowDown } from '@fortawesome/free-solid-svg-icons';
import { fetchRevisions } from '../../api/sop-revisions.js';
import { fetchTemplates } from '../../api/sop-templates.js';
import { resolveSopIcon } from '../../utils/sopTemplateIcons.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import FormModal from '../../components/common/FormModal.js';
import { useSopImport } from './sop-import/useSopImport.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  text: '#0f172a',
  muted: '#64748b',
  mutedSoft: '#64748b',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
};
const RADIUS = 14;
/** The page's content width — fills a 13-inch laptop screen, centred beyond that. */
const AUTHOR_PAGE_MAX_WIDTH = 1360;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// The entry point for all supervisor authoring — not just a list of drafts.
// "Start a new guide" and "Improve an existing guide" used to have no home
// of their own (the first was a bare link, the second was buried in a
// single guide's "⋯" menu on SopTemplateStepsPage.tsx); both now live here
// alongside the drafts-in-progress list, since all three are the same
// activity from the supervisor's point of view — authoring, not reviewing.
// ─────────────────────────────────────────────────────────────────────────────
export default function SopAuthorPage() {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const sopImport = useSopImport();

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['sop-revisions', 'DRAFT'],
    queryFn: () => fetchRevisions({ status: 'DRAFT' }),
  });
  const { data: templates = [] } = useQuery({ queryKey: ['sop-templates'], queryFn: () => fetchTemplates() });
  const templateById = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? templates.filter(t => t.title.toLowerCase().includes(q)) : templates;
  }, [templates, search]);

  // A native scrollbar alone doesn't reliably signal "there's more below" —
  // OS/browser scrollbar rendering varies (thin overlay bars that only
  // appear mid-scroll, hidden entirely on some setups). This fade is a
  // guaranteed-visible cue instead, shown only while the list is actually
  // taller than its capped box.
  const pickerListRef = useRef<HTMLDivElement>(null);
  const [pickerOverflows, setPickerOverflows] = useState(false);
  useEffect(() => {
    const el = pickerListRef.current;
    if (el) setPickerOverflows(el.scrollHeight > el.clientHeight);
  }, [filteredTemplates, pickerOpen]);

  return (
    <div className="m-pad" style={s.page}>
      <style>{`
        .sop-draft-row:hover { border-color: ${C.primary}55 !important; }
        .sop-draft-row:focus-visible, .sop-author-main:focus-visible, .sop-author-link:focus-visible { outline: 2px solid ${C.primary}; outline-offset: 2px; }
        .sop-author-link:hover { text-decoration: underline; }
        .sop-author-action:hover { border-color: ${C.primary}55 !important; }
        .sop-picker-row:hover { background: ${C.primarySoft} !important; }
        .sop-picker-list::-webkit-scrollbar { width: 6px; }
        .sop-picker-list::-webkit-scrollbar-track { background: transparent; }
        .sop-picker-list::-webkit-scrollbar-thumb { background: ${C.cardBorder}; border-radius: 3px; }
        .sop-picker-list::-webkit-scrollbar-thumb:hover { background: ${C.mutedSoft}; }
      `}</style>
      <div style={s.inner}>
        <h1 style={s.heading}>Author Guides</h1>

        {/* Three ways to start a guide — equal choices, each saying what it does. */}
        <div style={s.actionGrid}>
          <ActionCard icon={faPlus} title="Start a new guide" text="Write it step by step in the editor."
            onClick={() => navigate('/operations/sops/propose')} />
          <ActionCard icon={faCopy} title="Improve an existing guide" text="Copy a published guide and change it."
            onClick={() => { setSearch(''); setPickerOpen(true); }} />
          <ActionCard icon={faFileImport} title="Import from a spreadsheet" text="Fill in the template, then import it as a draft."
            onClick={sopImport.chooseFile} busyLabel={sopImport.busy === 'import' ? 'Importing…' : undefined} disabled={!!sopImport.busy}>
            <button type="button" className="sop-author-link" onClick={sopImport.downloadTemplate} disabled={!!sopImport.busy} style={s.cardLink}>
              <FontAwesomeIcon icon={faFileArrowDown} style={{ fontSize: 12 }} />
              {sopImport.busy === 'template' ? 'Preparing template…' : 'Download template'}
            </button>
          </ActionCard>
        </div>
        {sopImport.ui}

        {pickerOpen && (
          <FormModal title="Improve an existing guide" onClose={() => setPickerOpen(false)}>
            <div style={s.searchWrap}>
              <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 12, color: C.mutedSoft }} />
              <input
                autoFocus
                aria-label="Search guides"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search guides…"
                style={s.searchInput}
              />
            </div>
            <div style={{ position: 'relative' as const }}>
              <div ref={pickerListRef} className="sop-picker-list" style={{ marginTop: 10, maxHeight: 'min(50vh, 360px)', overflowY: 'auto' as const }}>
                {filteredTemplates.length === 0 ? (
                  <p style={{ margin: '12px 4px', fontSize: 13, color: C.muted }}>{search.trim() ? 'No guides match.' : 'No guides yet.'}</p>
                ) : (
                  filteredTemplates.map(t => (
                    <button
                      type="button"
                      key={t.id}
                      className="sop-picker-row"
                      onClick={() => navigate(`/operations/sops/propose?duplicateFrom=${t.id}`)}
                      style={s.pickerRow}
                    >
                      <FontAwesomeIcon icon={resolveSopIcon(t.icon)} style={{ fontSize: 13, color: C.primary, width: 16 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text, flex: 1 }}>{t.title}</span>
                      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 11, color: C.mutedSoft }} />
                    </button>
                  ))
                )}
              </div>
              {pickerOverflows && <div style={s.scrollFade} />}
            </div>
          </FormModal>
        )}

        <h2 style={s.sectionHeading}>
          Drafts in progress
          {drafts.length > 0 && <span style={s.count}>{drafts.length}</span>}
        </h2>

        {isLoading ? (
          <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}><LoadingSpinner /></p>
        ) : drafts.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '48px 20px' }}>
            <FontAwesomeIcon icon={faFileLines} style={{ fontSize: 22, color: C.mutedSoft, marginBottom: 10 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>No drafts in progress.</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>Guides you save without publishing appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {drafts.map(rev => {
              const target = rev.sopTemplateId ? templateById.get(rev.sopTemplateId) : null;
              const sections = [...new Set(rev.stepsJson.map(st => st.section))];

              return (
                <button
                  type="button"
                  key={rev.id}
                  className="sop-draft-row"
                  onClick={() => navigate(`/operations/sops/propose?fromRevision=${rev.id}`)}
                  style={{ ...s.card, width: '100%', textAlign: 'left', font: 'inherit', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, cursor: 'pointer', transition: 'border-color 120ms ease' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                      <span style={rev.sopTemplateId ? s.badgeEdit : s.badgeNew}>
                        {rev.sopTemplateId ? `Edit${target ? ` · v${target.currentVersion} → v${target.currentVersion + 1}` : ''}` : 'New How-To Guide'}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{rev.title}</span>
                    </div>
                    {rev.sopTemplateId && target && rev.title !== target.title && (
                      <div style={{ fontSize: 12, color: C.mutedSoft, marginBottom: 4 }}>Currently: "{target.title}"</div>
                    )}
                    <div style={s.metaRow}>
                      <span style={s.metaItem}><FontAwesomeIcon icon={faUserPen} style={{ fontSize: 10.5 }} />{rev.proposedByName}</span>
                      <span style={s.metaDot} />
                      <span style={s.metaItem}><FontAwesomeIcon icon={faClock} style={{ fontSize: 10.5 }} />Last saved {fmtDate(rev.updatedAt)}</span>
                      <span style={s.metaDot} />
                      <span style={s.metaItem}>{rev.stepsJson.length} step{rev.stepsJson.length === 1 ? '' : 's'} · {sections.length} section{sections.length === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.mutedSoft, flexShrink: 0, marginTop: 4 }} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  // Wide enough to fill a 13-inch laptop (~1280–1440px) and still centred on bigger screens.
  inner: { maxWidth: AUTHOR_PAGE_MAX_WIDTH, margin: '0 auto' },
  heading: { margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  sectionHeading: { display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: C.text },
  count: { fontSize: 12, fontWeight: 700, color: C.muted, background: C.cardBorder, borderRadius: 999, padding: '1px 8px' },
  actionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 },
  actionCard: {
    display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 16px', background: C.card,
    border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS, boxShadow: SHADOW, transition: 'border-color 120ms ease',
  },
  actionMain: {
    display: 'flex', alignItems: 'center', gap: 12, padding: 0, border: 'none', background: 'none',
    font: 'inherit', textAlign: 'left', cursor: 'pointer', flex: 1,
  },
  actionIcon: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8,
    background: C.primarySoft, color: C.primary, fontSize: 14,
  },
  cardLink: {
    // marginLeft lines it up with the card's text, past the icon.
    alignSelf: 'flex-start', marginLeft: 44, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, padding: '2px 0', border: 'none',
    background: 'none', font: 'inherit', fontSize: 13, fontWeight: 600, color: C.primary, cursor: 'pointer',
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.bg,
    border: `1px solid ${C.cardBorder}`, borderRadius: 10,
  },
  searchInput: { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: C.text },
  pickerRow: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 40, padding: '8px', border: 'none', background: 'none',
    borderRadius: 8, font: 'inherit', textAlign: 'left', cursor: 'pointer',
  },
  scrollFade: {
    position: 'absolute' as const, left: 0, right: 6, bottom: 0, height: 28,
    background: `linear-gradient(to bottom, transparent, ${C.card})`, pointerEvents: 'none' as const,
  },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '18px 22px', boxShadow: SHADOW,
  },
  badgeNew: {
    display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    background: C.primarySoft, color: C.primary, textTransform: 'uppercase' as const, letterSpacing: '0.03em',
  },
  badgeEdit: {
    display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    background: '#fff7ed', color: '#b45309', textTransform: 'uppercase' as const, letterSpacing: '0.03em',
  },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' as const },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.mutedSoft, fontWeight: 500 },
  metaDot: { width: 3, height: 3, borderRadius: '50%', background: C.mutedSoft, flexShrink: 0 },
};

/** One way to start a guide: icon, name, one line on what it does; extra actions (children) sit underneath. */
function ActionCard({ icon, title, text, onClick, disabled, busyLabel, children }: {
  icon: IconDefinition; title: string; text: string; onClick: () => void;
  disabled?: boolean; busyLabel?: string; children?: React.ReactNode;
}) {
  return (
    <div className="sop-author-action" style={s.actionCard}>
      <button type="button" className="sop-author-main" onClick={onClick} disabled={disabled}
        style={{ ...s.actionMain, cursor: disabled ? 'default' : 'pointer' }}>
        <span style={{ ...s.actionIcon, flexShrink: 0 }}><FontAwesomeIcon icon={icon} /></span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{busyLabel ?? title}</span>
          <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.35 }}>{text}</span>
        </span>
      </button>
      {children}
    </div>
  );
}
