import { describe, it, expect } from 'vitest';
import {
  IN_USE_REASON, LEVEL_NAME_NEEDED, SCALE_NAME_NEEDED, matchingScale, resizeLevels, scaleDeleteBlocker, scaleIssues, scaleSummary, scaleToDraft, withDefaultScale,
} from '../../pages/settings/appraisalForms/ratingScales';
import { newCriterion, newSection, sectionsFromSaved, sectionsPayload } from '../../pages/settings/appraisalForms/appraisalFormDraft';

// Rating scales (Settings → Rating scales): a criterion scored on a rating
// picks one and keeps its own copy of the levels.

const standard = {
  id: 's1', name: 'Standard 1–3', max: 3, isDefault: true, isActive: true,
  levels: [{ value: 1, label: 'Not yet' }, { value: 2, label: 'Sometimes', description: 'Half the time.' }, { value: 3, label: 'Always' }],
};
const other = { ...standard, id: 's2', name: 'Other', isDefault: false, levels: standard.levels.map(l => ({ ...l, label: l.label + '!' })) };

describe('Rating scales', () => {
  it('copies a picked scale onto the criterion, and recognises which scale it came from', () => {
    const c = { ...newCriterion('Love'), ...scaleToDraft(standard) };
    expect(c.ratingLabels).toEqual(['Not yet', 'Sometimes', 'Always']);
    expect(c.ratingDescriptions).toEqual(['', 'Half the time.', '']);
    expect(matchingScale(c, [other, standard])?.id).toBe('s1');
    expect(matchingScale({ ...c, ratingLabels: ['Not yet', 'Sometimes', 'Changed'] }, [other, standard])).toBeNull();
    expect(scaleSummary(standard)).toBe('1 Not yet · 2 Sometimes · 3 Always');
  });

  it('gives a new rating with no wording the default scale, and never rewrites an existing one', () => {
    const fresh = newCriterion('Love');
    expect(withDefaultScale(fresh, [other, standard], true).ratingLabels).toEqual(['Not yet', 'Sometimes', 'Always']);
    expect(withDefaultScale(fresh, [other, standard], false)).toBe(fresh);
    const worded = { ...fresh, ratingLabels: ['Mine', '', '', '', ''] };
    expect(withDefaultScale(worded, [standard], true)).toBe(worded);
    expect(withDefaultScale({ ...fresh, inputType: 'YES_NO' as const }, [standard], true).ratingLabels).toEqual([]);
  });

  it('remembers which scale a rating was copied from, so that scale is known to be in use once the form is saved', () => {
    expect(withDefaultScale(newCriterion('Love'), [other, standard], true).scaleId).toBe('s1');
    const saved = sectionsPayload([{ ...newSection('Care'), criteria: [{ ...newCriterion('Love'), ...scaleToDraft(other), scaleId: 's2' }] }]);
    expect(saved[0].criteria[0].scaleConfig).toMatchObject({ scaleId: 's2', max: 3 });
    expect(sectionsFromSaved(saved as never)[0].criteria[0].scaleId).toBe('s2');
  });

  it('won\'t delete the default, or a scale an appraisal form has used — that one can only be made inactive', () => {
    expect(scaleDeleteBlocker({ isDefault: true, inUse: false })).toMatch(/default/);
    expect(scaleDeleteBlocker({ isDefault: false, inUse: true })).toBe(IN_USE_REASON);
    expect(scaleDeleteBlocker({ isDefault: false, inUse: false })).toBeNull();
  });

  it('needs a name and a name for every level, and keeps wording when the level count changes', () => {
    expect(scaleIssues({ name: ' ', max: 3, levels: resizeLevels([], 3) })).toEqual({ name: SCALE_NAME_NEEDED, levels: LEVEL_NAME_NEEDED });
    expect(scaleIssues({ name: 'Standard', max: 3, levels: standard.levels })).toEqual({});
    expect(resizeLevels(standard.levels, 4).map(l => l.label)).toEqual(['Not yet', 'Sometimes', 'Always', '']);
    expect(resizeLevels(standard.levels, 2).map(l => l.label)).toEqual(['Not yet', 'Sometimes']);
  });
});
