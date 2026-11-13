import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faLightbulb, faPlus } from '@fortawesome/free-solid-svg-icons';
import TeacherFab, { TEACHER_FAB_CLEARANCE } from '../../components/common/TeacherFab.js';
import { fetchRevisions, type SopTemplateRevision } from '../../api/sop-revisions.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { STATUS_TEXT, fmtDate, kindLabel, parseSuggestionTab, sentSuggestions, suggestionsOn, type SuggestionTab } from './mySuggestions.js';
import SegmentedControl from '../../components/common/SegmentedControl.js';
import { C, TONE, card, pageStyle, theme } from './mySuggestionsTheme.js';
import { feedbackSummary } from './reviewComments.js';

const SUGGEST_NEW_PATH = '/operations/sops/propose';

/** /operations/sops/my-suggestions — every How-To Guide suggestion this person sent, and where it stands. */
export default function MySuggestionsPage() {
  const [params, setParams] = useSearchParams();
  const teacher = params.get('app') === 'teacher';
  const { isMobile } = useIsMobile();
  const t = theme(teacher);
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['sop-revisions', 'mine'],
    queryFn: () => fetchRevisions(),
  });
  const mine = sentSuggestions(data);
  // The tab lives in the URL (?tab=done) so Back returns to it.
  const tab = parseSuggestionTab(params.get('tab'));
  const setTab = (next: SuggestionTab) => setParams(prev => {
    const p = new URLSearchParams(prev);
    if (next === 'progress') p.delete('tab'); else p.set('tab', next);
    return p;
  }, { replace: true });
  const inProgress = suggestionsOn(mine, 'progress');
  const done = suggestionsOn(mine, 'done');
  const shown = tab === 'progress' ? inProgress : done;
  const suffix = teacher ? '?app=teacher' : '';
  const navigate = useNavigate();

  return (
    // Extra room at the bottom on a phone so the floating "+" never covers the last suggestion.
    <div style={{ ...pageStyle(teacher, isMobile), ...(isMobile ? { paddingBottom: 32 + TEACHER_FAB_CLEARANCE } : {}) }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontSize: isMobile ? 26 : 24, fontWeight: 700, margin: '0 0 16px' }}>My guide ideas</h1>

        {/* Suggesting a new guide lives here, with its follow-up — the floating "+" on a phone
            (same as Incident Log / Facilities / Requests), a full-width button on wider screens. */}
        {isMobile ? (
          <TeacherFab label="Suggest a new guide" onClick={() => navigate(`${SUGGEST_NEW_PATH}${suffix}`)} />
        ) : (
          <button type="button" onClick={() => navigate(`${SUGGEST_NEW_PATH}${suffix}`)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 44, padding: 12,
            border: 'none', borderRadius: 12, background: t.accent, color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', marginBottom: 16,
          }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 13 }} /> Suggest a new guide
          </button>
        )}

        {isLoading && <p style={{ color: C.muted, fontSize: 14 }}>Loading…</p>}
        {isError && (
          <p role="alert" style={{ color: C.no, fontSize: 14 }}>
            Couldn’t load your guide ideas.{' '}
            <button type="button" onClick={() => refetch()} style={{ border: 'none', background: 'none', padding: 0, color: t.accent, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>Try again</button>
          </p>
        )}

        {!isLoading && !isError && mine.length === 0 && (
          <div style={{ ...card, textAlign: 'center', padding: '32px 16px' }}>
            <FontAwesomeIcon icon={faLightbulb} style={{ fontSize: 24, color: t.accent }} />
            <p style={{ fontSize: 15, fontWeight: 700, margin: '12px 0 4px' }}>No guide ideas yet</p>
            <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.5 }}>
              {`Open a guide and tap Suggest an Edit to improve it, or ${isMobile ? 'tap +' : 'use the button above'} to suggest a new guide.`}
            </p>
          </div>
        )}

        {/* Two tabs — In progress (what's sent back to you sits at the top) and Done.
            Each card still shows its exact status. */}
        {!isLoading && !isError && mine.length > 0 && (
          <>
            <div style={{ marginBottom: 16 }}>
              <SegmentedControl<SuggestionTab> ariaLabel="Show guide ideas" accent={t.accent} value={tab} onChange={setTab}
                segments={[
                  { key: 'progress', label: 'In progress', count: inProgress.length },
                  { key: 'done', label: 'Done', count: done.length },
                ]} />
            </div>
            {shown.length === 0 ? (
              <p style={{ ...card, margin: 0, textAlign: 'center', padding: '24px 16px', fontSize: 14, color: C.muted }}>
                {tab === 'progress' ? 'Nothing in progress — every idea you sent has been decided.' : 'Nothing decided yet.'}
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
                {shown.map(r => <SuggestionRow key={r.id} r={r} to={`/operations/sops/my-suggestions/${r.id}${suffix}`} />)}
              </ul>
            )}
          </>
        )}
      </div>    </div>
  );
}

function SuggestionRow({ r, to }: { r: SopTemplateRevision; to: string }) {
  const status = STATUS_TEXT[r.status as keyof typeof STATUS_TEXT];
  const tone = TONE[status?.tone ?? 'review'];
  // The overall note, or "2 step comments" when the feedback is all on steps.
  const summary = feedbackSummary(r.reviewNote, r.reviewCommentsJson);
  return (
    <li>
      <Link to={to} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', minHeight: 44 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, overflowWrap: 'anywhere' }}>{r.title}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{kindLabel(r)} · sent {fmtDate(r.createdAt)}</div>
          {/* The supervisor's feedback, when it's sent back or not approved. */}
          {(r.status === 'REJECTED' || r.status === 'CHANGES_REQUESTED') && summary && (
            <div style={{ fontSize: 13, color: C.body, marginTop: 6, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.reviewNote ? `“${summary}”` : summary}
            </div>
          )}
          {status && (
            <span style={{ display: 'inline-block', marginTop: 8, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: tone.fg, background: tone.bg }}>
              {status.label}
            </span>
          )}
        </div>
        <FontAwesomeIcon icon={faChevronRight} aria-hidden style={{ color: '#94a3b8', fontSize: 13 }} />
      </Link>
    </li>
  );
}
