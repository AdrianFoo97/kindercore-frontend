import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark, faPhone, faLocationDot, faRoute, faCakeCandles,
  faGraduationCap, faSackDollar, faCalendarDay, faClock,
  faNoteSticky, faChalkboardUser, faUserCheck, faUserXmark,
  faCircleNotch, faPenToSquare,
  faFileLines, faDownload,
} from '@fortawesome/free-solid-svg-icons';
import { fetchCandidate, downloadCandidateResume } from '../../api/candidates.js';
import { Candidate, CandidateStatus, CommuteTime } from '../../types/index.js';

const COMMUTE_LABEL: Record<CommuteTime, string> = {
  UNDER_15:  'Less than 15 minutes',
  MIN_15_30: '15 – 30 minutes',
  MIN_30_45: '30 – 45 minutes',
  MIN_45_60: '45 – 60 minutes',
  OVER_60:   'More than 1 hour',
  WILL_MOVE: 'Plans to move closer if hired',
};
// Read-only quick-view modal — surfaces everything the admin submitted
// about the candidate across four narrow tabs (Contact / Role /
// Screening / Interview). All stage-transition actions (Contact, Hire,
// Reject, Delete) live on the row itself; this modal is intentionally
// zero-action so an accidental click can't mutate state.

const C = {
  surface: '#ffffff',
  text: '#0f172a',
  textSub: '#3f4b5c',
  muted: '#64748b',
  border: '#e2e8f0',
  borderSoft: '#eef0f3',
  bg: '#f8fafc',
  primary: '#5a67d8',
  primaryDeep: '#3c339a',
  primarySoft: '#eef2ff',
  success: '#059669',
  successSoft: '#ecfdf5',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  info: '#0284c7',
  infoSoft: '#f0f9ff',
};

const STATUS_META: Record<CandidateStatus, { label: string; bg: string; fg: string }> = {
  NEW:              { label: 'New',          bg: C.infoSoft,    fg: C.info },
  CONTACTED:        { label: 'Contacted',    bg: C.primarySoft, fg: C.primaryDeep },
  INTERVIEWING:     { label: 'Interviewing', bg: C.warningSoft, fg: C.warning },
  PENDING_DECISION: { label: 'Deciding',     bg: '#f5f3ff',     fg: '#6d28d9' },
  OFFER_SENT:       { label: 'Offer sent',   bg: '#fef3c7',     fg: '#a16207' },
  HIRED:            { label: 'Hired',        bg: C.successSoft, fg: C.success },
  REJECTED:         { label: 'Rejected',     bg: C.dangerSoft,  fg: C.danger },
};

interface Props {
  id: string;
  onClose: () => void;
}

type Tab = 'contact' | 'role' | 'screening' | 'interview';

const TABS: { id: Tab; label: string }[] = [
  { id: 'contact',   label: 'Contact' },
  { id: 'role',      label: 'Role' },
  { id: 'screening', label: 'Screening' },
  { id: 'interview', label: 'Interview' },
];

export function CandidateQuickViewModal(props: Props) {
  const [tab, setTab] = useState<Tab>('contact');

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate', props.id],
    queryFn: () => fetchCandidate(props.id),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);

  const body = (
    <div style={S.backdrop} onClick={e => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div style={S.modal} role="dialog" aria-modal="true">
        <button style={S.closeBtn} onClick={props.onClose} aria-label="Close">
          <FontAwesomeIcon icon={faXmark} />
        </button>

        {isLoading || !candidate ? (
          <div style={S.loading}>
            <FontAwesomeIcon icon={faCircleNotch} spin /> Loading…
          </div>
        ) : (
          <>
            <header style={S.header}>
              <h2 style={S.name}>{candidate.fullName}</h2>
              <div style={S.headerMeta}>
                <span style={S.statusPill(STATUS_META[candidate.status].bg, STATUS_META[candidate.status].fg)}>
                  {STATUS_META[candidate.status].label}
                </span>
                <span style={S.submitted}>Applied {fmtDate(candidate.submittedAt)}</span>
              </div>
            </header>

            {/* Tab bar — groups the sections so the modal fits on a
                single laptop screen. Overview holds the identity + role
                data an admin scans first; Screening isolates the long
                free-text answers; Interview & outcome keeps the
                lifecycle info together. */}
            <div style={S.tabBar} role="tablist">
              {TABS.map(t => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  style={S.tabBtn(tab === t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={S.tabPanel} role="tabpanel">
              {tab === 'contact' && (
                <>
                  <Section title="Contact">
                    <InfoRow icon={faPhone} label="Phone" value={candidate.phone}
                      href={`https://wa.me/${candidate.phone.replace(/\D/g, '')}`} />
                    {candidate.addressLocation && (
                      <InfoRow icon={faLocationDot} label="Will stay at"
                        value={candidate.addressLocation} />
                    )}
                    {candidate.commuteTime && (
                      <InfoRow icon={faRoute} label="Commute to school"
                        value={COMMUTE_LABEL[candidate.commuteTime]} />
                    )}
                    {candidate.dob && (
                      <InfoRow icon={faCakeCandles} label="DOB" value={fmtDate(candidate.dob)} />
                    )}
                  </Section>

                  {candidate.howDidYouKnow && (
                    <Section title="Source">
                      <InfoRow icon={faNoteSticky} label="How they heard about us"
                        value={candidate.howDidYouKnow} />
                    </Section>
                  )}
                </>
              )}

              {tab === 'role' && (
                <Section title="Role & experience">
                  <InfoRow icon={faChalkboardUser} label="Applying for"
                    value={candidate.desiredPosition ?? 'Not specified'} />
                  {candidate.expectedSalary != null && (
                    <InfoRow icon={faSackDollar} label="Expected salary"
                      value={`RM ${candidate.expectedSalary.toLocaleString()}`} />
                  )}
                  {candidate.salaryJustification && (
                    <InfoRow icon={faSackDollar} label="Justification"
                      value={candidate.salaryJustification} multiline />
                  )}
                  {candidate.availableFrom && (
                    <InfoRow icon={faCalendarDay} label="Earliest start"
                      value={fmtDate(candidate.availableFrom)} />
                  )}
                  {candidate.preferredStartDate && (
                    <InfoRow icon={faCalendarDay} label="Preferred start"
                      value={fmtDate(candidate.preferredStartDate)} />
                  )}
                  {candidate.experienceRange && (
                    <InfoRow icon={faClock} label="Experience" value={candidate.experienceRange} />
                  )}
                  {candidate.qualification && (
                    <InfoRow icon={faGraduationCap} label="Highest qualification"
                      value={
                        candidate.qualification.toLowerCase() === 'others' && candidate.qualificationOther
                          ? `Others — ${candidate.qualificationOther}`
                          : candidate.qualification
                      } />
                  )}
                  {(candidate.resumeUrl || candidate.resumePath) && (
                    <ResumeRow
                      candidateId={candidate.id}
                      fileName={candidate.resumeOriginalName ?? 'resume'}
                      externalUrl={candidate.resumeUrl}
                    />
                  )}
                </Section>
              )}

              {tab === 'screening' && (
                <>
                  {(candidate.careerGoals || candidate.whyKindergartenTeacher || candidate.notes) ? (
                    <Section title="Screening answers">
                      {candidate.careerGoals && (
                        <div>
                          <div style={S.infoLabel}>3 – 5 year goals</div>
                          <p style={S.valueBlock}>{candidate.careerGoals}</p>
                        </div>
                      )}
                      {candidate.whyKindergartenTeacher && (
                        <div>
                          <div style={S.infoLabel}>Why kindergarten teacher?</div>
                          <p style={S.valueBlock}>{candidate.whyKindergartenTeacher}</p>
                        </div>
                      )}
                      {candidate.notes && (
                        <div>
                          <div style={S.infoLabel}>Anything else you'd like us to know?</div>
                          <p style={S.valueBlock}>{candidate.notes}</p>
                        </div>
                      )}
                    </Section>
                  ) : (
                    <EmptyTabState message="No screening answers on file." />
                  )}
                  {candidate.adminNotes && (
                    <Section title="Admin notes">
                      <InfoRow icon={faPenToSquare} label="Internal (not visible to candidate)"
                        value={candidate.adminNotes} multiline />
                    </Section>
                  )}
                </>
              )}

              {tab === 'interview' && (
                <>
                  {(candidate.interviewStart || candidate.interviewLocation || candidate.interviewNotes) ? (
                    <Section title="Interview">
                      {candidate.interviewStart && (
                        <InfoRow icon={faCalendarDay} label="When"
                          value={`${fmtDateTime(candidate.interviewStart)}${candidate.interviewEnd ? ` – ${fmtTime(candidate.interviewEnd)}` : ''}`} />
                      )}
                      {candidate.interviewLocation && (
                        <InfoRow icon={faLocationDot} label="Where"
                          value={candidate.interviewLocation} />
                      )}
                      {candidate.interviewNotes && (
                        <InfoRow icon={faNoteSticky} label="Notes"
                          value={candidate.interviewNotes} multiline />
                      )}
                    </Section>
                  ) : (
                    <EmptyTabState message="No interview scheduled yet." />
                  )}

                  {candidate.status === 'HIRED' && candidate.hiredAt && (
                    <Section title="Outcome">
                      <InfoRow icon={faUserCheck} label="Hired on" value={fmtDate(candidate.hiredAt)} />
                    </Section>
                  )}
                  {candidate.status === 'REJECTED' && candidate.rejectionReason && (
                    <Section title="Outcome">
                      <InfoRow icon={faUserXmark} label="Rejection reason"
                        value={candidate.rejectionReason} multiline />
                    </Section>
                  )}
                </>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function EmptyTabState(props: { message: string }) {
  return (
    <div style={{
      padding: '32px 16px', textAlign: 'center', color: C.muted,
      fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 10,
      background: C.bg,
    }}>
      {props.message}
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section style={S.section}>
      <h3 style={S.sectionTitle}>{props.title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {props.children}
      </div>
    </section>
  );
}

function InfoRow(props: {
  icon: any;
  label: string;
  value: string;
  href?: string;
  multiline?: boolean;
}) {
  const valueNode = props.href ? (
    <a href={props.href} target="_blank" rel="noreferrer" style={S.linkVal}>{props.value}</a>
  ) : (
    <span style={props.multiline ? S.valueBlock : S.value}>{props.value}</span>
  );
  return (
    <div style={S.infoRow}>
      <FontAwesomeIcon icon={props.icon} style={{
        color: C.muted, fontSize: 14, marginTop: 3, width: 16, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.infoLabel}>{props.label}</div>
        {valueNode}
      </div>
    </div>
  );
}

function PanelField(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={S.panelLabel}>{props.label}</span>
      {props.children}
    </label>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
}

// ── Styles ──────────────────────────────────────────────────────────────────

const S = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    padding: '24px 16px', zIndex: 1000,
  } as React.CSSProperties,
  modal: {
    position: 'relative', width: '100%', maxWidth: 640,
    // Fixed height so the modal doesn't jump when the user switches
    // between Contact / Role / Screening / Interview tabs (each tab
    // has different amounts of content). Body scrolls internally.
    height: 'min(85vh, 720px)',
    background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
    padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: 12,
    color: C.text, boxShadow: '0 12px 40px rgba(15,23,42,0.18)',
    overflow: 'hidden',
  } as React.CSSProperties,
  closeBtn: {
    position: 'absolute', top: 12, right: 12, width: 32, height: 32,
    border: 'none', background: 'transparent', borderRadius: 8, fontSize: 16,
    cursor: 'pointer', color: C.muted,
  } as React.CSSProperties,
  loading: { padding: '40px 20px', textAlign: 'center', color: C.muted } as React.CSSProperties,
  header: { paddingRight: 32, marginBottom: 4 } as React.CSSProperties,
  name: { fontSize: 22, fontWeight: 700, margin: 0, color: C.text } as React.CSSProperties,
  headerMeta: {
    display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap',
  } as React.CSSProperties,
  statusPill: (bg: string, fg: string): React.CSSProperties => ({
    background: bg, color: fg, padding: '4px 12px',
    borderRadius: 999, fontSize: 12, fontWeight: 600,
  }),
  submitted: { fontSize: 12, color: C.muted } as React.CSSProperties,
  actionsRow: {
    display: 'flex', gap: 8, flexWrap: 'wrap',
    paddingBottom: 12, borderBottom: `1px solid ${C.borderSoft}`,
  } as React.CSSProperties,
  // ── Tab bar ────────────────────────────────────────────────────────
  tabBar: {
    display: 'flex', gap: 2,
    borderBottom: `1px solid ${C.borderSoft}`,
    marginTop: 4,
  } as React.CSSProperties,
  tabBtn: (active: boolean): React.CSSProperties => ({
    padding: '10px 14px', fontSize: 13, fontWeight: 600,
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: active ? C.primaryDeep : C.muted,
    borderBottom: `2px solid ${active ? C.primary : 'transparent'}`,
    marginBottom: -1,
    transition: 'color 0.12s ease, border-color 0.12s ease',
  }),
  tabPanel: {
    display: 'flex', flexDirection: 'column' as const, gap: 12,
    paddingTop: 12,
    // Fill remaining vertical space and scroll internally so the modal
    // height stays fixed as the user switches tabs.
    flex: 1, minHeight: 0, overflowY: 'auto' as const,
    // Trim right padding so the scrollbar isn't flush against the edge.
    paddingRight: 4,
  } as React.CSSProperties,
  actionBtnBase: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  } as React.CSSProperties,
  panel: {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
  } as React.CSSProperties,
  panelTitle: { fontSize: 14, fontWeight: 700, color: C.text } as React.CSSProperties,
  panelLabel: { fontSize: 12, fontWeight: 600, color: C.muted } as React.CSSProperties,
  panelRow2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } as React.CSSProperties,
  panelFooter: {
    display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4,
  } as React.CSSProperties,
  input: {
    border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px',
    fontSize: 13, background: '#fff', color: C.text, outline: 'none',
  } as React.CSSProperties,
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: `1px solid ${C.border}`, background: '#fff', color: C.textSub,
    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: C.primary, color: '#fff', border: 'none',
    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  } as React.CSSProperties,
  btnDanger: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: C.danger, color: '#fff', border: 'none',
    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  } as React.CSSProperties,
  section: {
    paddingTop: 8,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
    letterSpacing: 0.5, margin: '0 0 8px',
  } as React.CSSProperties,
  infoRow: { display: 'flex', alignItems: 'flex-start', gap: 10 } as React.CSSProperties,
  infoIcon: { color: C.muted, fontSize: 14, marginTop: 3, width: 16, flexShrink: 0 } as React.CSSProperties,
  infoLabel: { fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 } as React.CSSProperties,
  value: { fontSize: 14, color: C.text } as React.CSSProperties,
  valueBlock: { fontSize: 14, color: C.text, whiteSpace: 'pre-wrap' } as React.CSSProperties,
  linkVal: { fontSize: 14, color: C.primary, textDecoration: 'none' } as React.CSSProperties,
  footer: {
    display: 'flex', justifyContent: 'flex-end',
    paddingTop: 12, marginTop: 4, borderTop: `1px solid ${C.borderSoft}`,
  } as React.CSSProperties,
  dangerBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'transparent', color: C.danger, border: 'none',
    padding: '6px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 6,
  } as React.CSSProperties,
};

// Resume download row — fetches the auth-gated endpoint, builds a blob URL
// and triggers a download. The actual file never goes through a static
// route so the admin must be logged in to retrieve it. When the row has
// an externalUrl (Google Drive from the Apps Script bridge), that URL
// wins and we skip the internal fetch entirely.
function ResumeRow(props: { candidateId: string; fileName: string; externalUrl: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={S.infoRow}>
      <FontAwesomeIcon icon={faFileLines} style={{
        color: C.muted, fontSize: 14, marginTop: 3, width: 16, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.infoLabel}>Resume</div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (props.externalUrl) {
              window.open(props.externalUrl, '_blank', 'noopener,noreferrer');
              return;
            }
            // 'noopener' would force window.open to return null, breaking
            // the handoff to downloadCandidateResume.
            const win = window.open('', '_blank');
            setBusy(true);
            downloadCandidateResume(props.candidateId, win)
              .catch((e: any) => alert(e?.message ?? 'Could not open resume.'))
              .finally(() => setBusy(false));
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', padding: 0,
            color: C.primary, fontSize: 14, fontWeight: 600,
            cursor: busy ? 'default' : 'pointer', textDecoration: 'underline',
          }}
        >
          <FontAwesomeIcon icon={faDownload} />
          {busy ? 'Downloading…' : props.fileName}
        </button>
      </div>
    </div>
  );
}
