import { apiFetch } from './client.js';

// Settings → Appraisal Forms (admin). A form ("template") is versioned: a live
// version is never edited in place — editing opens the next version as a draft.

export type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';
/** MANUAL = no schedule: an appraisal is started by hand when needed. */
export type Frequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'MANUAL';
export type MissingPolicy = 'REQUIRE_ALL' | 'REWEIGHT';
/** AUTO (pulled from app data) exists on the server but can't be chosen in the editor yet. */
/** POINTS = the average of the criterion's points, each scored its own way. FORM = a scoring form's weighted total. */
/** LEVELS = one of a set of named levels, each worth a percentage, or N/A (how SOP steps can be marked). */
export type InputType = 'RATING' | 'PERCENT' | 'YES_NO' | 'PASS_FAIL' | 'LEVELS' | 'NUMBER' | 'AUTO' | 'POINTS' | 'FORM';
/** How a single point can be scored. */
export type PointInputType = Exclude<InputType, 'AUTO' | 'POINTS' | 'FORM'>;
export type StageKind = 'ASSESS' | 'SIGN_OFF' | 'ACKNOWLEDGE';
export type StageScope = 'ANYONE' | 'OWN_TEAM';

/** A level's short name ("Outstanding") and, optionally, what it looks like — the assessor's rubric. */
export interface RatingLevel { value: number; label: string; description?: string }
export interface RatingScale { max: number; levels?: RatingLevel[] }
export interface NumberScale { target: number; higherIsBetter: boolean }

export interface TemplateCriterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  inputType: InputType;
  scaleConfig: RatingScale | NumberScale | Record<string, unknown> | null;
  /** Optional points it's judged on — each scored its own way, then averaged. Empty = scored directly. */
  points: { id: string; name: string; description?: string | null; inputType: PointInputType; scaleConfig: unknown }[];
  /** An SOP check's criterion: the SOP it scores — new appraisals pick up later edits to it. */
  sopTemplateId?: string | null;
}
export interface TemplateSection { id: string; name: string; weight: number; criteria: TemplateCriterion[] }
/** Sections as saved — on an appraisal form (with ids) or in a scoring form (without). */
export type SavedSection = Omit<TemplateSection, 'id' | 'criteria'> & { criteria: (Omit<TemplateCriterion, 'id' | 'points'> & { points: Omit<TemplateCriterion['points'][number], 'id'>[] })[] };
export interface TemplateStage { id: string; name: string; kind: StageKind; scope: StageScope; positionIds: string[] }

export interface AppraisalTemplate {
  id: string;
  familyId: string;
  name: string;
  description: string | null;
  frequency: Frequency;
  status: TemplateStatus;
  version: number;
  missingPolicy: MissingPolicy;
  updatedAt: string;
  sections: TemplateSection[];
  stages: TemplateStage[];
  /** Positions that use this form (all its versions). */
  positionIds: string[];
  /** What stops it going live, in plain words — empty when it can. */
  problems: string[];
  /** The same problems, by editor step: what's scored (sections, weights) and who appraises (the steps). */
  problemsByArea?: { basics?: string[]; scoring: string[]; approval: string[] };
  /** Another version of the same form that's a draft / live, if any. */
  draftId: string | null;
  activeId: string | null;
}

export interface AppraisalTemplateSummary {
  id: string;
  familyId: string;
  name: string;
  description: string | null;
  frequency: Frequency;
  status: TemplateStatus;
  version: number;
  updatedAt: string;
  draftId: string | null;
  sectionCount: number;
  criterionCount: number;
  positionIds: string[];
}

export type SectionsPayload = { name: string; weight: number; criteria: { name: string; description: string | null; weight: number; inputType: InputType; scaleConfig: unknown; points: { name: string; inputType: PointInputType; scaleConfig: unknown }[]; sopTemplateId?: string }[] }[];
export interface TemplateSavePayload {
  name: string;
  description: string | null;
  frequency: Frequency;
  missingPolicy: MissingPolicy;
  sections: SectionsPayload;
  stages: { name: string; kind: StageKind; scope: StageScope; positionIds: string[] }[];
}

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const fetchAppraisalTemplates = () => apiFetch<AppraisalTemplateSummary[]>('/api/appraisal-templates');
export const fetchAppraisalTemplate = (id: string) => apiFetch<AppraisalTemplate>(`/api/appraisal-templates/${id}`);
export const createAppraisalTemplate = (data: { name: string; description?: string | null }) =>
  apiFetch<AppraisalTemplate>('/api/appraisal-templates', json('POST', data));
export const saveAppraisalTemplate = (id: string, data: TemplateSavePayload) =>
  apiFetch<AppraisalTemplate>(`/api/appraisal-templates/${id}`, json('PUT', data));
export const deleteAppraisalTemplate = (id: string) => apiFetch<void>(`/api/appraisal-templates/${id}`, json('DELETE'));
/** The draft to edit for this form — its existing draft, or a copy of this version. */
export const newAppraisalTemplateVersion = (id: string) =>
  apiFetch<AppraisalTemplate>(`/api/appraisal-templates/${id}/new-version`, json('POST'));
export const activateAppraisalTemplate = (id: string) =>
  apiFetch<AppraisalTemplate>(`/api/appraisal-templates/${id}/activate`, json('POST'));
export const retireAppraisalTemplate = (id: string) =>
  apiFetch<AppraisalTemplate>(`/api/appraisal-templates/${id}/retire`, json('POST'));
export const setAppraisalTemplatePositions = (familyId: string, positionIds: string[]) =>
  apiFetch<{ positionIds: string[] }>(`/api/appraisal-template-families/${familyId}/positions`, json('PUT', { positionIds }));
