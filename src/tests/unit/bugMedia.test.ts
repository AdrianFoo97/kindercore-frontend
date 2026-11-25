import { describe, it, expect } from 'vitest';
import { bugFileProblem, isVideoUrl } from '../../pages/bugReports/bugMedia';

// Report a Bug → screenshots or a short screen recording, checked before uploading.

const MB = 1024 * 1024;

describe('Report a Bug — photos and videos', () => {
  it('takes photos under 5 MB and videos under 50 MB — and names the file that is wrong', () => {
    expect(bugFileProblem({ name: 'screen.png', type: 'image/png', size: 2 * MB })).toBeNull();
    expect(bugFileProblem({ name: 'rec.mp4', type: 'video/mp4', size: 40 * MB })).toBeNull();
    expect(bugFileProblem({ name: 'big.jpg', type: 'image/jpeg', size: 6 * MB })).toMatch(/big\.jpg.*under 5 MB/);
    expect(bugFileProblem({ name: 'long.mov', type: 'video/quicktime', size: 60 * MB })).toMatch(/long\.mov.*under 50 MB/);
    expect(bugFileProblem({ name: 'log.pdf', type: 'application/pdf', size: 1 })).toMatch(/isn’t a photo or video/);
  });

  it('tells a stored video from a photo by its ending', () => {
    expect(isVideoUrl('/uploads/bug-reports/abc.mp4')).toBe(true);
    expect(isVideoUrl('/uploads/bug-reports/abc.MOV')).toBe(true);
    expect(isVideoUrl('/uploads/bug-reports/abc.png')).toBe(false);
  });
});
