import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { fetchTeacherAppraisals, deleteTeacherAppraisal, type TeacherAppraisal } from '../../api/teacher-appraisals.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';
import { useToast } from '../../components/common/Toast.js';
import { MONTH_LABELS, scoreColors } from './appraisalDisplay.js';
import { AppraisalFormModal } from './AppraisalFormModal.js';

// A staff member's appraisals — the Appraisals tab on their record, and the
// page behind Staff → ⋯ → Appraisal. One score per month (0–100), with notes
// and who evaluated; the average is the last 12 months.

const C = {
  primary: '#5a67d8', card: '#fff', text: '#1e293b',
  muted: '#94a3b8', sub: '#475569', border: '#e2e8f0',
};

export function AppraisalTab({ teacherId }: { teacherId: string }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-appraisals', teacherId],
    queryFn: () => fetchTeacherAppraisals(teacherId),
  });
  const items = data?.items ?? [];

  const now = new Date();

  // Year filter — scopes the history list only. The average above it is
  // always the last 12 months (worked out by the server, same as the
  // promotion gate and the teacher's own page).
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const yearItems = useMemo(() => items.filter(it => it.year === filterYear), [items, filterYear]);
  const twelveMonth = data?.summary;
  const average = twelveMonth?.average ?? null;

  // Record / edit both open the same pop-up as HR → Appraisals.
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState<TeacherAppraisal | null>(null);

  const remove = async (a: TeacherAppraisal) => {
    const ok = await confirm({
      entityType: 'Appraisal',
      entityName: `${MONTH_LABELS[a.month]} ${a.year}`,
      consequence: 'This appraisal record will be permanently removed.',
      onConfirm: async () => {
        await deleteTeacherAppraisal(a.id);
        qc.invalidateQueries({ queryKey: ['teacher-appraisals', teacherId] });
        qc.invalidateQueries({ queryKey: ['teacher-career', teacherId] });
        qc.invalidateQueries({ queryKey: ['appraisal-overview'] });
      },
    });
    if (ok) showToast('Appraisal deleted');
  };

  // Years for the history filter: this year, last year, and any year with records.
  const filterYearOptions = useMemo(() => {
    const ys = new Set<number>([now.getFullYear(), now.getFullYear() - 1]);
    for (const it of items) ys.add(it.year);
    return [...ys].sort((a, b) => b - a);
  }, [items, now]);

  if (isLoading) return <div style={s.card}><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Loading…</p></div>;

  return (
    <>
      {/* Summary card with inline year filter */}
      <div style={{ ...s.card, background: 'linear-gradient(135deg, #f8fafc 0%, #eef0fa 100%)', borderColor: '#c7d2fe' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Average Appraisal · Last 12 Months
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                {twelveMonth?.recordCount ?? 0} of the last 12 months appraised
              </div>
            </div>
            <button type="button" onClick={() => setRecording(true)} style={s.saveBtn}>
              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11, marginRight: 6 }} />
              Record appraisal
            </button>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1,
              color: average != null ? scoreColors(average).color : C.muted,
            }}>
              {average != null ? `${average}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* History list — scoped to selected year */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <h2 style={{ ...s.sectionTitle, margin: 0 }}>History</h2>
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600,
              border: `1px solid ${C.primary}33`, borderRadius: 8,
              background: '#fff', color: C.primary, cursor: 'pointer', outline: 'none',
            }}
          >
            {filterYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {yearItems.length === 0 ? (
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>No appraisals recorded for {filterYear}.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {yearItems.map(a => {
              const sc = scoreColors(a.score);
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 10,
                  background: editing?.id === a.id ? '#eef0fa' : '#fff',
                }}>
                  <div style={{
                    width: 56, padding: '6px 8px', borderRadius: 8,
                    background: sc.bg, color: sc.color,
                    textAlign: 'center', fontWeight: 700, fontSize: 13,
                  }}>
                    {Math.round(a.score)}%
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                      {MONTH_LABELS[a.month]} {a.year}
                      {a.evaluatedBy && (
                        <span style={{ marginLeft: 8, fontWeight: 500, color: C.muted, fontSize: 11 }}>
                          · {a.evaluatedBy}
                        </span>
                      )}
                    </div>
                    {a.notes && (
                      <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>
                        {a.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setEditing(a)} className="et-tab" style={{
                      padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                      border: `1px solid ${C.border}`, background: '#fff', color: C.sub, cursor: 'pointer',
                    }}>
                      <FontAwesomeIcon icon={faPen} style={{ fontSize: 10, marginRight: 4 }} />
                      Edit
                    </button>
                    <button onClick={() => remove(a)} className="et-del-career" style={{
                      padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                      border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer',
                    }}>
                      <FontAwesomeIcon icon={faTrash} style={{ fontSize: 10 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {recording && (
        <AppraisalFormModal
          teacherId={teacherId}
          year={now.getFullYear()}
          month={now.getMonth()}
          existing={null}
          canChangeMonth
          onClose={() => setRecording(false)}
          onSaved={() => {
            showToast('Appraisal recorded');
            setRecording(false);
          }}
        />
      )}

      {editing && (
        <AppraisalFormModal
          teacherId={teacherId}
          year={editing.year}
          month={editing.month}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            showToast('Appraisal updated');
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: C.card, borderRadius: 14, padding: '22px 26px', border: '1px solid #eef0f4', marginBottom: 16,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
  },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' },
  saveBtn: { padding: '10px 28px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer' },
};
