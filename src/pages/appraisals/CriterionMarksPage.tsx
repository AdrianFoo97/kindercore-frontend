import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { fetchAppraisalRun, runKey } from '../../api/appraisal-runs.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { TEACHER_CONTENT_TOP } from '../../components/common/TeacherTopBar.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useGoBack } from '../../hooks/useGoBack.js';
import { criterionItems, inputGroups, notesFrom, periodLabel, valuesFrom } from './appraisalRun.js';
import { isSopCheck, sopProgress } from './sopCheck.js';
import { groupScore } from './liveScore.js';
import { criterionScore } from './liveScore.js';
import { useScoreBand } from './useScoreBand.js';
import { CriterionItems } from './MarksCriterionRow.js';
import { ADMIN, TEACHER, button, card } from './runTheme.js';

const PAGE_MAX_WIDTH = 720;

/**
 * One criterion of an appraisal scored from a form (or on items), on its own
 * page: every section / SOP with each item's rating or pass / fail / N/A, and
 * the comments behind their icons. Opened from the marks; Back returns there.
 */
export default function CriterionMarksPage() {
  const { id = '', criterionId = '' } = useParams<{ id: string; criterionId: string }>();
  const [params] = useSearchParams();
  const inTeacherApp = params.get('app') === 'teacher';
  const p = inTeacherApp ? TEACHER : ADMIN;
  const { isMobile } = useIsMobile();
  const goBack = useGoBack(`/appraisals/${id}${inTeacherApp ? '?app=teacher' : ''}`);
  const bandOf = useScoreBand();
  const { data: run, isPending, error } = useQuery({ queryKey: runKey(id), queryFn: () => fetchAppraisalRun(id), retry: false });
  const item = run ? criterionItems(run.form.sections).find(x => x.c.id === criterionId) : undefined;
  const score = run && item ? criterionScore(item.c, valuesFrom(run.scores), run.form.missingPolicy) : null;
  // An SOP check: one SOP at a time, picked from a dropdown (there can be many) — the first to start with.
  const groups = item ? inputGroups(item.c) : [];
  const sopCheck = isSopCheck(groups);
  const [sopAt, setSopAt] = useState(0);

  return (
    <div style={{ padding: isMobile ? 16 : '24px 32px 48px', fontFamily: p.font, background: p.bg, minHeight: '100%' }}>
      <div style={{ maxWidth: PAGE_MAX_WIDTH, margin: '0 auto', paddingTop: inTeacherApp ? TEACHER_CONTENT_TOP : 0 }}>
        {/* In the teacher app the top bar has Back already. */}
        {!inTeacherApp && (
          <button type="button" onClick={goBack} style={{ ...button(p, 'ghost', { small: true }), padding: '4px 8px 4px 0', marginBottom: 8 }}>
            <FontAwesomeIcon icon={faChevronLeft} /> Back
          </button>
        )}
        {isPending && <LoadingSpinner />}
        {error && <div role="alert" style={{ ...card(p), color: p.red, fontSize: 14 }}>{(error as Error).message || 'Couldn’t open this appraisal.'}</div>}
        {run && !item && <div role="alert" style={{ ...card(p), fontSize: 14, color: p.muted }}>That criterion isn’t on this appraisal.</div>}
        {run && item && (
          <>
            <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 700, color: p.text }}>
                  <span style={{ color: p.muted, marginRight: 8 }}>{item.number}</span>{item.c.name}
                </h1>
                <div style={{ fontSize: 14, color: p.muted, marginTop: 2 }}>
                  {run.mine ? '' : `${run.teacherName} · `}{periodLabel(run.periodType, run.period)}
                </div>
              </div>
              <strong style={{ fontSize: 22, color: score == null ? p.muted : bandOf(score).color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {score == null ? '—' : Math.round(score)}<span style={{ fontSize: 13, color: p.muted, fontWeight: 500 }}> / 100</span>
              </strong>
            </header>
            {item.c.description && !sopCheck && <p style={{ margin: '0 0 12px', fontSize: 14, color: p.muted, lineHeight: 1.5 }}>{item.c.description}</p>}
            {sopCheck && (() => {
              const values = valuesFrom(run.scores);
              const g = groups[Math.min(sopAt, groups.length - 1)];
              const prog = sopProgress(g, values);
              const sopScore = groupScore(g, values, run.form.missingPolicy);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <select aria-label="SOP" value={sopAt} onChange={e => setSopAt(Number(e.target.value))}
                    style={{ flex: 1, minWidth: 0, minHeight: 44, padding: '8px 12px', fontSize: 16, fontFamily: 'inherit', color: p.text, background: '#fff', border: `1px solid ${p.borderStrong}`, borderRadius: 10 }}>
                    {groups.map((x, gi) => <option key={x.name ?? gi} value={gi}>{x.name}</option>)}
                  </select>
                  <span style={{ fontSize: 13, color: p.muted, whiteSpace: 'nowrap' }}>
                    {prog.passed} of {prog.total} passed · <strong style={{ color: sopScore == null ? p.muted : bandOf(sopScore).color }}>{sopScore == null ? '—' : Math.round(sopScore)}</strong>
                  </span>
                </div>
              );
            })()}
            <section aria-label="Items" style={card(p)}>
              <CriterionItems c={item.c} values={valuesFrom(run.scores)} notes={notesFrom(run.scores)} palette={p} onlyGroup={sopCheck ? Math.min(sopAt, groups.length - 1) : undefined} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
