import { describe, it, expect } from 'vitest';
import type { TrainingItem } from '../../api/sop-observations';
import { TRAINING_STATUS, certifyProblem, sortTraining, todayDay, trainedOnProblem, trainingToGive } from '../../pages/teacherHome/myTraining';

// Teacher app → My training (SOP observations as trainee and as trainer).

const item = (id: string, status: TrainingItem['status'], createdAt: string, assessorAt: string | null = null): TrainingItem =>
  ({ id, teacherId: 't', teacherName: 'Nabila', sopTemplateId: 'sop-' + id, sopTitle: id, trainerId: 'tr', trainerName: 'Alicia', status, trainerAt: null, assessorAt, createdAt });

describe('My training', () => {
  it('lists what’s still open first (oldest first), then the certified ones (newest first)', () => {
    const sorted = sortTraining([
      item('done-old', 'CERTIFIED', '2026-01-01', '2026-02-01'), item('open-new', 'PENDING_TRAINER', '2026-10-01'),
      item('done-new', 'CERTIFIED', '2026-03-01', '2026-09-01'), item('open-old', 'PENDING_ASSESSOR', '2026-05-01'),
    ]);
    expect(sorted.map(i => i.id)).toEqual(['open-old', 'open-new', 'done-new', 'done-old']);
  });

  it('words each status for the trainee and the trainer, and counts the training waiting for the trainer on Home', () => {
    expect(TRAINING_STATUS.PENDING_TRAINER).toMatchObject({ trainee: 'Training to do', trainer: 'To train' });
    expect(trainingToGive({ asTrainer: [item('c', 'PENDING_TRAINER', 'x'), item('d', 'PENDING_ASSESSOR', 'x'), item('e', 'PENDING_TRAINER', 'x')] })).toBe(2);
    expect(trainingToGive({ asTrainer: [] })).toBe(0);
  });

  it('lets the trainer record today or an earlier day as the training day, never a future one', () => {
    expect(todayDay(new Date(2026, 10, 7))).toBe('2026-11-07');
    expect(trainedOnProblem('2026-11-17', '2026-11-17')).toBeNull();
    expect(trainedOnProblem('2026-11-18', '2026-11-17')).toMatch(/future/);
    expect(trainedOnProblem('', '2026-11-17')).toMatch(/Pick the day/);
  });

  it('keeps Certify off with the reason while a step failed or nothing passed', () => {
    expect(certifyProblem(['PASS', 'NA'])).toBeNull();
    expect(certifyProblem(['PASS', 'FAIL'])).toMatch(/send it back/);
    expect(certifyProblem(['NA'])).toMatch(/at least one step passed/);
  });
});
