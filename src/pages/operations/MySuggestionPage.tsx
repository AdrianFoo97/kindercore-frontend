import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchRevision, type ProposedStep } from '../../api/sop-revisions.js';
import { fetchSteps } from '../../api/sop-steps.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import StepCompareTable from './StepCompareTable.js';
import { compareSteps } from './sopStepCompare.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { STATUS_TEXT, feedbackHeading, fmtDate, kindLabel, outcomeLine, resubmitPath } from './mySuggestions.js';
import SentBackNote from './SentBackNote.js';
import { commentsOffTable } from './reviewComments.js';
import { C, TONE, card, pageStyle, sectionLabel, theme } from './mySuggestionsTheme.js';

/** One suggestion the person sent: where it stands, the reviewer's note, why, and what it changes. */
export default function MySuggestionPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const teacher = params.get('app') === 'teacher';
  const { isMobile } = useIsMobile();
  const t = theme(teacher);
  const suffix = teacher ? '?app=teacher' : '';

  const { data: r, isLoading, isError } = useQuery({ queryKey: ['sop-revision', id], queryFn: () => fetchRevision(id) });
  // The live guide, to show what an improvement changes — only while it's still a proposal.
  // While it's a proposal. On trial the comparison is done — the page shows the version being tried.
  const compare = !!r?.sopTemplateId && r.status !== 'APPROVED' && r.status !== 'TRIAL';
  const { data: liveSteps } = useQuery({
    queryKey: ['sop-steps', r?.sopTemplateId], queryFn: () => fetchSteps(r!.sopTemplateId!), enabled: compare,
  });

  if (isLoading) return <div style={pageStyle(teacher, isMobile)}><p style={{ color: C.muted, fontSize: 14 }}>Loading…</p></div>;
  if (isError || !r) {
    return (
      <div style={pageStyle(teacher, isMobile)}>
        <p role="alert" style={{ color: C.no, fontSize: 14 }}>This guide idea isn’t available.</p>
        <Link to={`/operations/sops/my-suggestions${suffix}`} style={{ color: t.accent, fontWeight: 700, fontSize: 14 }}>Back to My guide ideas</Link>
      </div>
    );
  }

  const status = STATUS_TEXT[r.status as keyof typeof STATUS_TEXT];
  const tone = TONE[status?.tone ?? 'review'];
  const reasons = r.improvementReasonsJson ?? [];
  // The steps beside the current guide; each supervisor comment sits under its step there.
  const compareRows = compare && liveSteps ? compareSteps([...liveSteps].sort((a, b) => a.displayOrder - b.displayOrder), r.stepsJson) : null;

  return (
    <div style={pageStyle(teacher, isMobile)}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 16 }}>
        <header>
          <div style={{ fontSize: 13, color: C.muted }}>{kindLabel(r)} · sent {fmtDate(r.createdAt)}</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 8px', overflowWrap: 'anywhere' }}>{r.title}</h1>
          {status && (
            <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: tone.fg, background: tone.bg }}>
              {status.label}
            </span>
          )}
          <p style={{ fontSize: 14, color: C.body, margin: '10px 0 0', lineHeight: 1.5 }}>{outcomeLine(r, fmtDate)}</p>
        </header>

        {/* Sent back (or resent after one): the overall note + every step comment. */}
        {(r.status === 'CHANGES_REQUESTED' || r.status === 'PENDING') && (
          <SentBackNote note={r.reviewNote} comments={compareRows ? commentsOffTable(r.reviewCommentsJson, compareRows) : r.reviewCommentsJson} reviewer={r.reviewedByName} status={r.status} />
        )}

        {/* A decision's note only matters when it wasn't approved (it says why). On trial or approved,
            the earlier send-back feedback is done with. */}
        {r.status === 'REJECTED' && r.reviewNote && (
          <section style={{ ...card, borderLeft: `3px solid ${tone.fg}` }}>
            <h2 style={sectionLabel}>{feedbackHeading(r.status, r.reviewedByName)}</h2>
            <p style={{ margin: 0, fontSize: 14, color: C.body, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{r.reviewNote}</p>
          </section>
        )}

        {/* Sent back: the teacher's next move, right under the feedback. */}
        {r.status === 'CHANGES_REQUESTED' && (
          <Link to={resubmitPath(r, teacher)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: 12,
            borderRadius: 12, background: t.accent, color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none',
          }}>
            <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: 13 }} /> Make changes
          </Link>
        )}

        {reasons.length > 0 && (
          <section style={card}>
            <h2 style={sectionLabel}>Why it needs improving</h2>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: C.body, lineHeight: 1.6 }}>
              {reasons.map((reason, i) => <li key={i}>{reason}</li>)}
            </ol>
          </section>
        )}

        {compareRows && (
          <section style={card}>
            <h2 style={sectionLabel}>What you changed</h2>
            <StepCompareTable
              rows={compareRows}
              notes={r.reviewCommentsJson}
              notesLabel={r.status === 'CHANGES_REQUESTED' ? 'To change' : 'Earlier comment'}
              afterLabel="Your version"
              isMobile={isMobile}
            />
          </section>
        )}

        {(!r.sopTemplateId || r.status === 'TRIAL') && (
          <section style={card}>
            <h2 style={sectionLabel}>{r.status === 'TRIAL' ? 'The version being tried' : 'The guide you suggested'}</h2>
            {r.goal && <p style={{ margin: '0 0 12px', fontSize: 14, color: C.body, lineHeight: 1.5 }}>{r.goal}</p>}
            <StepsBySection steps={r.stepsJson} />
          </section>
        )}

        {r.sopTemplateId && (
          <Link to={`/operations/sops/${r.sopTemplateId}${suffix}`} style={{ color: t.accent, fontWeight: 700, fontSize: 14, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
            Open the guide
          </Link>
        )}
      </div>
    </div>
  );
}

/** The suggested steps, grouped under their sections in order. */
function StepsBySection({ steps }: { steps: ProposedStep[] }) {
  const sections: { name: string; steps: ProposedStep[] }[] = [];
  for (const st of steps) {
    const last = sections[sections.length - 1];
    if (last && last.name === st.section) last.steps.push(st); else sections.push({ name: st.section, steps: [st] });
  }
  let n = 0;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {sections.map((sec, i) => (
        <div key={`${sec.name}-${i}`}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 }}>{sec.name}</div>
          <ol start={n + 1} style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: C.body, lineHeight: 1.6 }}>
            {sec.steps.map((st, j) => { n += 1; return <li key={j}><span style={{ fontWeight: 600, color: C.text }}>{st.title}</span>{st.detail ? ` — ${st.detail}` : ''}</li>; })}
          </ol>
        </div>
      ))}
    </div>
  );
}
