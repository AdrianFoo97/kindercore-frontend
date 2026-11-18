// Message template groups — Common for everyone, each other group only for
// people with that module. The server enforces it (GET /api/settings drops the
// groups someone can't use — kindercore-backend/src/services/messageTemplates.logic.ts);
// this copy only decides what the screens list. Keep both in sync.
import { MODULES, type ModuleKey } from '../constants/authModules.js';

export const TEMPLATE_GROUPS = [
  { key: 'COMMON', label: 'Common', module: null },
  { key: 'MARKETING', label: 'Marketing', module: MODULES.MARKETING },
  { key: 'HR', label: 'HR', module: MODULES.HR },
] as const satisfies readonly { key: string; label: string; module: ModuleKey | null }[];
export type TemplateGroupKey = typeof TEMPLATE_GROUPS[number]['key'];

/** A built-in template: which group it's in and the settings holding its English and Chinese text. */
export interface BuiltInTemplate { id: string; name: string; group: TemplateGroupKey; en: string; zh: string }

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  { id: 'enquiry',             name: 'Enquiry',                group: 'MARKETING', en: 'whatsapp_template',              zh: 'whatsapp_template_zh' },
  { id: 'follow_up',           name: 'Follow Up',              group: 'MARKETING', en: 'whatsapp_followup_template',     zh: 'whatsapp_followup_template_zh' },
  { id: 'confirm_appointment', name: 'Confirm Appointment',    group: 'MARKETING', en: 'whatsapp_confirm_appt_template', zh: 'whatsapp_confirm_appt_template_zh' },
  { id: 'interview_invite',    name: 'Interview Invitation',   group: 'HR',        en: 'interview_wa_template',          zh: 'interview_wa_template_zh' },
  { id: 'interview_confirm',   name: 'Interview Confirmation', group: 'HR',        en: 'interview_confirm_wa_template',  zh: 'interview_confirm_wa_template_zh' },
  { id: 'offer_letter',        name: 'Offer Letter',           group: 'HR',        en: 'offer_wa_template',              zh: 'offer_wa_template_zh' },
];

/** A custom template's group — Common when it has none (or an unknown one). */
export function templateGroupOf(t: { group?: unknown }): TemplateGroupKey {
  return TEMPLATE_GROUPS.find(g => g.key === t.group)?.key ?? 'COMMON';
}

export function groupLabel(key: TemplateGroupKey): string {
  return TEMPLATE_GROUPS.find(g => g.key === key)!.label;
}

/** The groups someone may use, in display order (Common first). */
export function visibleTemplateGroups(hasModule: (m: ModuleKey) => boolean): TemplateGroupKey[] {
  return TEMPLATE_GROUPS.filter(g => g.module === null || hasModule(g.module)).map(g => g.key);
}
