import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCopy, faCheck, faPen, faFileLines, faSearch, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { fetchSettings } from '../../api/settings.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';

// Tools → Messaging → Message Templates. Read-only quick-copy of every
// WhatsApp template, for pasting outside the system (personal WhatsApp,
// Facebook replies, email…). Editing stays in Settings → Message Templates
// (admin-only) — this is the "use a template" side of that split, the same
// way earning rules are defined in Settings but granted from HR.
//
// Two-pane picker rather than a stacked list: with many templates, a list
// of full previews meant scrolling past every body to find one. Here the
// left pane is one compact row per template (searchable, ↑/↓ + Enter to
// copy, a hover-free copy icon per row) and the right pane previews only
// the selected one.
//
// Built-in keys mirror WhatsAppTemplatesPage's SYSTEM_TEMPLATES — a new
// built-in template must be added in both places. Custom templates come
// from the same `whatsapp_custom_templates` setting.

type Lang = 'en' | 'zh';
interface Tpl { id: string; group: string; name: string; en: string; zh: string }

const BUILT_IN: { group: string; items: { id: string; name: string; en: string; zh: string }[] }[] = [
  { group: 'Leads', items: [
    { id: 'enquiry',             name: 'Enquiry',             en: 'whatsapp_template',              zh: 'whatsapp_template_zh' },
    { id: 'follow_up',           name: 'Follow Up',           en: 'whatsapp_followup_template',     zh: 'whatsapp_followup_template_zh' },
    { id: 'confirm_appointment', name: 'Confirm Appointment', en: 'whatsapp_confirm_appt_template', zh: 'whatsapp_confirm_appt_template_zh' },
  ] },
  { group: 'Recruitment', items: [
    { id: 'interview_invite',  name: 'Interview Invitation',   en: 'interview_wa_template',         zh: 'interview_wa_template_zh' },
    { id: 'interview_confirm', name: 'Interview Confirmation', en: 'interview_confirm_wa_template', zh: 'interview_confirm_wa_template_zh' },
    { id: 'offer_letter',      name: 'Offer Letter',           en: 'offer_wa_template',             zh: 'offer_wa_template_zh' },
  ] },
];

const textOf = (t: Tpl, lang: Lang) => (lang === 'en' ? t.en : t.zh);

export default function MessageTemplatesModal({ onClose, canEdit }: { onClose: () => void; canEdit: boolean }) {
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const [lang, setLang] = useState<Lang>('zh');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mobile only: list → detail drill-in.
  const [mobileDetail, setMobileDetail] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const all: Tpl[] = useMemo(() => {
    const str = (k: string) => String(settings?.[k] ?? '').trim();
    const out: Tpl[] = BUILT_IN.flatMap(g => g.items.map(t => ({ id: t.id, group: g.group, name: t.name, en: str(t.en), zh: str(t.zh) })));
    if (Array.isArray(settings?.whatsapp_custom_templates)) {
      for (const t of settings!.whatsapp_custom_templates as { id: string; name: string; content_en?: string; content_zh?: string }[]) {
        out.push({ id: `custom:${t.id}`, group: 'Custom', name: t.name, en: (t.content_en ?? '').trim(), zh: (t.content_zh ?? '').trim() });
      }
    }
    return out;
  }, [settings]);

  // Matches name, group or body (either language) — so "offer" or a
  // phrase you remember from the message both find it.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(t => [t.name, t.group, t.en, t.zh].some(s => s.toLowerCase().includes(q)));
  }, [all, query]);

  const selected = filtered.find(t => t.id === selectedId) ?? filtered[0] ?? null;

  const copy = async (t: Tpl) => {
    const text = textOf(t, lang);
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setCopiedId(t.id); } catch { /* clipboard blocked */ }
  };

  useEffect(() => {
    if (!copiedId) return;
    const h = setTimeout(() => setCopiedId(null), 1600);
    return () => clearTimeout(h);
  }, [copiedId]);
  useEffect(() => { setCopiedId(null); }, [lang]);
  useEffect(() => { if (!isMobile) searchRef.current?.focus(); }, [isMobile]);

  // Esc closes; ↑/↓ moves the selection; Enter copies it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!filtered.length) return;
      const idx = selected ? filtered.findIndex(t => t.id === selected.id) : -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = e.key === 'ArrowDown' ? Math.min(filtered.length - 1, idx + 1) : Math.max(0, idx - 1);
        setSelectedId(filtered[next].id);
        document.getElementById(`tpl-row-${filtered[next].id}`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && selected) {
        e.preventDefault();
        copy(selected);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const showList = !isMobile || !mobileDetail;
  const showDetail = !isMobile || mobileDetail;
  const groups = ['Leads', 'Recruitment', 'Custom'].filter(g => filtered.some(t => t.group === g));

  return ReactDOM.createPortal(
    <div style={st.overlay} onClick={onClose}>
      <div style={st.dialog(isMobile)} onClick={e => e.stopPropagation()} role="dialog" aria-label="Message templates">
        <div style={st.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={st.headerIcon}><FontAwesomeIcon icon={faFileLines} /></div>
            <div style={{ minWidth: 0 }}>
              <h2 style={st.title}>Message templates</h2>
              <div style={st.subtitle}>{all.length} templates · copy and paste anywhere</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={st.langSwitch} role="group" aria-label="Language">
              {(['en', 'zh'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)} style={st.langBtn(lang === l)}>{l === 'en' ? 'EN' : '中文'}</button>
              ))}
            </div>
            <button onClick={onClose} style={st.closeBtn} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
          </div>
        </div>

        <div style={st.panes(isMobile)}>
          {showList && (
            <div style={st.listPane(isMobile)}>
              <div style={st.searchWrap}>
                <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 24, top: '50%', marginTop: 2, transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8' }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search name or message…"
                  style={st.search}
                />
              </div>
              <div style={st.list}>
                {isLoading ? (
                  <p style={st.hint}>Loading…</p>
                ) : filtered.length === 0 ? (
                  <p style={st.hint}>No templates match “{query}”.</p>
                ) : groups.map(g => (
                  <Fragment key={g}>
                    <div style={st.groupLabel}>{g}</div>
                    {filtered.filter(t => t.group === g).map(t => (
                      <TemplateRow
                        key={t.id}
                        tpl={t}
                        active={!isMobile && selected?.id === t.id}
                        hasText={!!textOf(t, lang)}
                        copied={copiedId === t.id}
                        onSelect={() => { setSelectedId(t.id); if (isMobile) setMobileDetail(true); }}
                        onCopy={() => copy(t)}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          )}

          {showDetail && (
            <div style={st.detailPane}>
              {selected ? (
                <>
                  <div style={st.detailHead}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {isMobile && (
                        <button onClick={() => setMobileDetail(false)} style={st.backBtn} aria-label="Back to list">
                          <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={st.detailGroup}>{selected.group}</div>
                        <div style={st.detailName}>{selected.name}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => copy(selected)}
                      disabled={!textOf(selected, lang)}
                      style={st.copyBtn(copiedId === selected.id, !textOf(selected, lang))}
                    >
                      <FontAwesomeIcon icon={copiedId === selected.id ? faCheck : faCopy} style={{ fontSize: 12 }} />
                      {copiedId === selected.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {textOf(selected, lang) ? (
                    <div style={st.preview}><Highlighted text={textOf(selected, lang)} /></div>
                  ) : (
                    <div style={st.empty}>No {lang === 'en' ? 'English' : '中文'} version yet — switch language above{canEdit ? ', or add one in Settings' : ''}.</div>
                  )}
                  {/\{\{[^}]+\}\}/.test(textOf(selected, lang)) && (
                    <div style={st.fillHint}>Highlighted <span style={st.varChip}>{'{{…}}'}</span> parts are placeholders — replace them after pasting.</div>
                  )}
                </>
              ) : (
                <p style={st.hint}>Select a template.</p>
              )}
            </div>
          )}
        </div>

        <div style={st.footer}>
          {!isMobile && <span style={st.keys}>↑ ↓ to browse · Enter to copy · Esc to close</span>}
          {canEdit && (
            <button onClick={() => { onClose(); navigate('/settings/whatsapp-templates'); }} style={st.editLink}>
              <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} /> Edit templates in Settings
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TemplateRow({ tpl, active, hasText, copied, onSelect, onCopy }: {
  tpl: Tpl; active: boolean; hasText: boolean; copied: boolean;
  onSelect: () => void; onCopy: () => void;
}) {
  return (
    <div id={`tpl-row-${tpl.id}`} style={st.row(active)} onClick={onSelect}>
      <span style={st.rowName(active, hasText)}>{tpl.name}</span>
      <button
        onClick={e => { e.stopPropagation(); onCopy(); }}
        disabled={!hasText}
        title={hasText ? 'Copy' : 'No version in this language'}
        aria-label={`Copy ${tpl.name}`}
        style={st.rowCopy(copied, !hasText)}
      >
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
      </button>
    </div>
  );
}

// {{placeholders}} tinted so it's obvious what needs filling in after paste.
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {parts.map((p, i) => /^\{\{[^}]+\}\}$/.test(p)
        ? <span key={i} style={st.varChip}>{p}</span>
        : <Fragment key={i}>{p}</Fragment>)}
    </>
  );
}

const st = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  } as React.CSSProperties,
  dialog: (mobile: boolean): React.CSSProperties => ({
    background: '#fff', borderRadius: 14, width: '100%', maxWidth: 880,
    // Fixed height so the panes don't jump as you move between templates.
    height: mobile ? 'calc(100vh - 32px)' : 'min(620px, calc(100vh - 32px))',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)', fontFamily: 'system-ui, sans-serif',
  }),
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '16px 20px 14px', borderBottom: '1px solid #f0f0f0', flexShrink: 0,
  } as React.CSSProperties,
  headerIcon: {
    width: 34, height: 34, borderRadius: 9, background: '#eef0fa', color: '#5a67d8',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
  } as React.CSSProperties,
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' } as React.CSSProperties,
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 } as React.CSSProperties,
  langSwitch: { display: 'inline-flex', borderRadius: 7, background: '#f1f5f9', padding: 2 } as React.CSSProperties,
  langBtn: (on: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    background: on ? '#fff' : 'transparent', color: on ? '#1e293b' : '#94a3b8',
    boxShadow: on ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
  }),
  closeBtn: {
    width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent',
    color: '#94a3b8', cursor: 'pointer', fontSize: 15,
  } as React.CSSProperties,
  panes: (mobile: boolean): React.CSSProperties => ({
    flex: 1, minHeight: 0, display: 'grid',
    gridTemplateColumns: mobile ? '1fr' : '280px 1fr',
  }),
  listPane: (mobile: boolean): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', minHeight: 0,
    borderRight: mobile ? 'none' : '1px solid #f0f0f0', background: '#fbfcfd',
  }),
  searchWrap: { position: 'relative', padding: '12px 12px 8px', flexShrink: 0 } as React.CSSProperties,
  search: {
    width: '100%', boxSizing: 'border-box', height: 36, padding: '0 10px 0 32px',
    border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none',
    background: '#fff', color: '#0f172a', fontFamily: 'inherit',
  } as React.CSSProperties,
  list: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 8px 10px' } as React.CSSProperties,
  groupLabel: {
    fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em',
    textTransform: 'uppercase', padding: '10px 8px 4px',
  } as React.CSSProperties,
  row: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 10px',
    borderRadius: 7, cursor: 'pointer',
    background: active ? '#eef0fa' : 'transparent',
  }),
  rowName: (active: boolean, hasText: boolean): React.CSSProperties => ({
    flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    fontSize: 13, fontWeight: active ? 600 : 500,
    color: active ? '#3c339a' : hasText ? '#374151' : '#94a3b8',
  }),
  rowCopy: (copied: boolean, disabled: boolean): React.CSSProperties => ({
    width: 26, height: 26, borderRadius: 6, border: 'none', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
    background: copied ? '#dcfce7' : 'transparent',
    color: disabled ? '#d1d5db' : copied ? '#15803d' : '#94a3b8',
    cursor: disabled ? 'default' : 'pointer',
  }),
  detailPane: { display: 'flex', flexDirection: 'column', minHeight: 0, padding: '16px 20px', gap: 12 } as React.CSSProperties,
  detailHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 } as React.CSSProperties,
  detailGroup: { fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase' } as React.CSSProperties,
  detailName: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 2 } as React.CSSProperties,
  backBtn: {
    width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff',
    color: '#64748b', cursor: 'pointer', flexShrink: 0,
  } as React.CSSProperties,
  copyBtn: (copied: boolean, disabled: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
    border: 'none',
    background: disabled ? '#f1f5f9' : copied ? '#16a34a' : '#5a67d8',
    color: disabled ? '#94a3b8' : '#fff',
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background 0.12s',
  }),
  preview: {
    flex: 1, minHeight: 0, overflowY: 'auto',
    fontSize: 14, lineHeight: 1.6, color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    background: '#f8fafc', border: '1px solid #eef0f4', borderRadius: 10, padding: '14px 16px',
  } as React.CSSProperties,
  varChip: { background: '#eef0fa', color: '#4c51bf', borderRadius: 4, padding: '0 3px', fontWeight: 600 } as React.CSSProperties,
  fillHint: { fontSize: 12, color: '#64748b', flexShrink: 0 } as React.CSSProperties,
  empty: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    fontSize: 13, color: '#94a3b8', background: '#f8fafc', borderRadius: 10, padding: 20,
  } as React.CSSProperties,
  hint: { fontSize: 13, color: '#94a3b8', padding: '8px 10px', margin: 0 } as React.CSSProperties,
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '10px 20px', borderTop: '1px solid #f0f0f0', flexShrink: 0,
  } as React.CSSProperties,
  keys: { fontSize: 11, color: '#94a3b8' } as React.CSSProperties,
  editLink: {
    display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'none', marginLeft: 'auto',
    color: '#5a67d8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px',
  } as React.CSSProperties,
};
