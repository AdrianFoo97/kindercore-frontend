import { describe, it, expect, beforeEach, vi } from 'vitest';
import { teacherNavMatch } from '../../components/common/TeacherMobileNav';
import { teacherTopBar } from '../../components/common/TeacherTopBar';
import { hasInAppHistory } from '../../hooks/useGoBack';

// The teacher app on a phone: the bottom bar highlights the tab a screen
// belongs to, and the top-left back arrow returns to where you came from.

const TEACHER_ID = 't-1';
const GO_BACK = '__history_back__';

beforeEach(() => {
  const store: Record<string, string> = { user: JSON.stringify({ teacherId: TEACHER_ID }) };
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null });
});

describe('Teacher app — which bottom tab is highlighted', () => {
  it('shows My guide ideas, one idea and the new-guide form under Home, where they are opened from', () => {
    for (const path of ['/operations/sops/my-suggestions', '/operations/sops/my-suggestions/r-9', '/operations/sops/propose']) {
      expect(teacherNavMatch(path, '?app=teacher')?.activeSeg).toBe('home');
    }
    // Making the changes a supervisor asked for — opened from My guide ideas too.
    expect(teacherNavMatch('/operations/sops/g-1/propose', '?resubmit=r-1&app=teacher')?.activeSeg).toBe('home');
  });

  it('keeps the guide library, a guide and Suggest an Edit under Guides', () => {
    for (const path of ['/operations/sops', '/operations/sops/g-1', '/operations/sops/g-1/propose']) {
      expect(teacherNavMatch(path, '?app=teacher')?.activeSeg).toBe('sop');
    }
  });
});

describe('Teacher app — the back arrow', () => {
  it('returns to wherever you came from when leaving a suggestion form, not a fixed screen', () => {
    expect(teacherTopBar('/operations/sops/propose', '?app=teacher&step=1')?.backTo).toBe(GO_BACK);
    expect(teacherTopBar('/operations/sops/g-1/propose', '?app=teacher&step=1')?.backTo).toBe(GO_BACK);
    expect(teacherTopBar('/operations/sops/my-suggestions', '?app=teacher')?.backTo).toBe(GO_BACK);
  });

  it('goes from step 2 of a suggestion form back to step 1, not out of the form', () => {
    expect(teacherTopBar('/operations/sops/propose', '?app=teacher&step=2')?.backTo).toContain('/operations/sops/propose');
    expect(teacherTopBar('/operations/sops/g-1/propose', '?app=teacher&step=2')?.backTo).toContain('step=1');
  });

  it('only uses the fallback screen when the page was opened directly, with nothing to go back to', () => {
    expect(hasInAppHistory('default')).toBe(false);
    expect(hasInAppHistory('k3j9x')).toBe(true);
  });
});
