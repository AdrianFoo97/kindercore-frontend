import { useCallback, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { setMissionTarget, TeacherCareerData } from '../api/career-missions.js';

/**
 * Mission target management — persists pinned-target state to the
 * backend via the /target endpoint. The source of truth is the same
 * `teacher-career` query the page already loads, so we don't need a
 * second fetch — we read `isTargeted` off each mission's progress.
 *
 * Optimistic updates: toggling flips the cached value immediately so
 * the pin UI feels instant; on error we roll back.
 */
export function useMissionTargets(teacherId: string | undefined) {
  const qc = useQueryClient();
  const queryKey = ['teacher-career', teacherId];

  const cached = qc.getQueryData<TeacherCareerData>(queryKey);

  const targets = useMemo(() => {
    if (!cached) return new Set<string>();
    return new Set(
      cached.missions
        .filter(m => m.progress?.isTargeted === true)
        .map(m => m.id),
    );
  }, [cached]);

  const isTargeted = useCallback(
    (missionId: string) => targets.has(missionId),
    [targets],
  );

  const mutation = useMutation({
    mutationFn: ({ missionId, next }: { missionId: string; next: boolean }) => {
      if (!teacherId) throw new Error('No teacher');
      return setMissionTarget(teacherId, missionId, next);
    },
    onMutate: async ({ missionId, next }) => {
      // Cancel any in-flight career fetch so it doesn't overwrite our
      // optimistic update.
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<TeacherCareerData>(queryKey);
      if (previous) {
        qc.setQueryData<TeacherCareerData>(queryKey, {
          ...previous,
          missions: previous.missions.map(m => {
            if (m.id !== missionId) return m;
            const baseProgress = m.progress ?? {
              id: 'optimistic',
              teacherId: teacherId ?? '',
              missionId,
              status: 'PENDING' as const,
              evidenceCount: 0,
              evidenceTotal: 0,
              isTargeted: false,
              notes: null,
              startedAt: null,
              submittedAt: null,
              approvedAt: null,
              approvedBy: null,
              createdAt: '',
              updatedAt: '',
            };
            return { ...m, progress: { ...baseProgress, isTargeted: next } };
          }),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const toggle = useCallback((missionId: string) => {
    if (!teacherId) return;
    const next = !targets.has(missionId);
    mutation.mutate({ missionId, next });
  }, [targets, teacherId, mutation]);

  return { targets, isTargeted, toggle };
}
