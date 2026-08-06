import { useState, useMemo, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCheck, faXmark, faTriangleExclamation, faFileImport, faPaste, faFile } from '@fortawesome/free-solid-svg-icons';
import { fetchCandidateFormOptions, importCandidates, CreateCandidateInput, ImportResult } from '../../api/candidates.js';
import { useToast } from '../../components/common/Toast.js';
import type { CommuteTime } from '../../types/index.js';

// Bulk-import candidates from a Google Sheet paste (TSV) or a spreadsheet
// file. Content flow: paste/upload → parse → header mapping → preview
// with per-row validation → import in batches to the backend.
//
// Deliberately kept simpler than the leads' ImportLeadsPage — the
// recruitment domain has fewer moving parts (no packages, no student
// side-effects). If we need incremental status upserts or a resume
// URL companion column later we can extend the mapping shape.

const C = {
  bg: '#f8fafc', surface: '#ffffff', text: '#0f172a', textSub: '#3f4b5c',
  muted: '#64748b', mutedSoft: '#94a3b8',
  border: '#e2e8f0', borderSoft: '#eef0f3',
  primary: '#5a67d8', primaryDeep: '#3c339a', primarySoft: '#eef2ff',
  success: '#059669', successSoft: '#ecfdf5',
  danger: '#dc2626', dangerSoft: '#fef2f2',
  warning: '#b45309', warningSoft: '#fef3c7',
};

// Fields the importer knows how to write. Each carries a `required`
// flag matching the backend validator so the preview can flag rows
// that would fail before they hit the network.
// "Status marker" keys are used for boolean-shaped workflow columns
// (Attended, Offered, Rejected, etc.). When any of them is truthy on
// a row, the row's status is set to the corresponding pipeline stage.
// Multiple markers on the same row are resolved via STATUS_PRIORITY.
type StatusMarkerKey =
  | 'statusMarker_CONTACTED'
  | 'statusMarker_INTERVIEWING'
  | 'statusMarker_PENDING_DECISION'
  | 'statusMarker_OFFER_SENT'
  | 'statusMarker_HIRED'
  | 'statusMarker_REJECTED'
  | 'statusMarker_REJECTED_NO_SHOW'
  | 'statusMarker_REJECTED_DECLINED_OFFER';

type FieldKey =
  | 'fullName' | 'phone' | 'dob' | 'addressLocation' | 'commuteTime'
  | 'desiredPosition' | 'experienceRange' | 'qualification' | 'qualificationOther'
  | 'expectedSalary' | 'salaryJustification' | 'availableFrom' | 'preferredStartDate'
  | 'careerGoals' | 'whyKindergartenTeacher' | 'howDidYouKnow' | 'notes'
  | 'utmSource' | 'resumeUrl' | 'submittedAt' | 'interviewStart'
  | StatusMarkerKey
  | 'skip';

interface FieldSpec {
  key: FieldKey;
  label: string;
  required: boolean;
  hint?: string;
  // Common header aliases used by the auto-mapper.
  aliases: string[];
}

const FIELDS: FieldSpec[] = [
  { key: 'fullName',              label: 'Full name',            required: true,  aliases: ['name', 'full name', 'candidate name', 'applicant name', 'your name'] },
  { key: 'phone',                 label: 'Phone / WhatsApp',     required: true,  aliases: ['phone', 'phone number', 'whatsapp', 'contact', 'mobile', 'contact number', 'wa'] },
  { key: 'dob',                   label: 'Date of birth',        required: true,  hint: 'YYYY-MM-DD', aliases: ['dob', 'date of birth', 'birthday', 'birth date'] },
  { key: 'addressLocation',       label: 'Where they live',      required: true,  aliases: ['address', 'location', 'where do you live', 'where they live', 'where are you staying', 'where do you stay', 'staying', 'residing', 'live in'] },
  { key: 'commuteTime',           label: 'Commute',              required: true,  hint: 'UNDER_15 · MIN_15_30 · MIN_30_45 · MIN_45_60 · OVER_60 · WILL_MOVE', aliases: ['commute', 'commute time', 'travel time', 'estimated travel time'] },
  { key: 'desiredPosition',       label: 'Position',             required: true,  aliases: ['position', 'role', 'applied position', 'which role apply', 'applying for', 'apply for', 'which position'] },
  { key: 'experienceRange',       label: 'Experience',           required: true,  aliases: ['experience', 'years of experience', 'experience range', 'teaching experience'] },
  { key: 'qualification',         label: 'Qualification',        required: true,  aliases: ['qualification', 'education', 'highest qualification', 'highest education'] },
  { key: 'qualificationOther',    label: 'Qualification (other)',required: false, aliases: ['qualification other', 'other qualification'] },
  { key: 'expectedSalary',        label: 'Expected salary',      required: true,  hint: 'RM per month, numeric', aliases: ['expected salary', 'salary ask', 'salary', 'expected monthly salary', 'salary expectation'] },
  { key: 'salaryJustification',   label: 'Salary justification', required: true,  aliases: ['salary justification', 'why this salary', 'deserved salary', 'deserve salary', 'why deserve', 'please describe specifically', 'demonstrate your ability', 'skills, experiences, and achievements', 'meet all the listed expectations', 'justify your salary'] },
  { key: 'availableFrom',         label: 'Earliest start',       required: true,  hint: 'YYYY-MM-DD', aliases: ['available from', 'earliest start date', 'earliest start', 'earliest available'] },
  { key: 'preferredStartDate',    label: 'Preferred start',      required: true,  hint: 'YYYY-MM-DD', aliases: ['preferred start date', 'preferred start', 'ideal start'] },
  { key: 'careerGoals',           label: 'Career goals',         required: true,  aliases: ['career goals', 'life goal', 'goals', '3-5 year goals', 'personal or career goals', 'next 3 to 5 years', 'personal goals', 'career plan', 'ambition'] },
  { key: 'whyKindergartenTeacher',label: 'Why kindergarten',     required: true,  aliases: ['why kindergarten teacher', 'why become kinder teacher', 'why kinder', 'why do you want to work as a kindergarten', 'why teaching', 'why teach'] },
  { key: 'howDidYouKnow',         label: 'How they heard',       required: true,  aliases: ['how did you hear about us', 'where did you find this job', 'source', 'heard via', 'find this job', 'where did you find'] },
  { key: 'notes',                 label: 'Notes',                required: false, aliases: ['notes', 'anything else', 'remarks', 'language', 'languages', 'language ability', 'additional info'] },
  { key: 'utmSource',             label: 'UTM source',           required: false, aliases: ['utm source', 'utm_source', 'utm', 'campaign'] },
  { key: 'resumeUrl',             label: 'Resume URL',           required: false, hint: 'Full https:// URL (e.g. Google Drive)', aliases: ['resume url', 'resume link', 'resume', 'cv url'] },
  { key: 'submittedAt',           label: 'Original submission date', required: false, hint: 'Preserves the applicant\'s original submit timestamp instead of defaulting to now.', aliases: ['timestamp', 'submitted at', 'submitted on', 'submission date', 'date submitted'] },
  // Appointment column in the source sheet — actually a date, not a
  // boolean. A parseable value here sets the interview datetime AND
  // promotes the row to INTERVIEWING (unless a stronger status marker
  // downstream — Hired, Rejected, etc. — wins).
  { key: 'interviewStart',        label: 'Interview date',       required: false, hint: 'Parseable date → sets the interview slot and promotes status to INTERVIEWING.', aliases: ['appointment', 'appointment date', 'interview date', 'interview scheduled at', 'interview start', 'scheduled date'] },

  // Status-marker fields — boolean columns from workflow-tracking
  // sheets (Attended / Offered / Rejected / etc.). Truthy value on
  // any of these promotes the row to the matching pipeline stage.
  // Multiple markers on the same row → highest-priority stage wins
  // (see STATUS_PRIORITY below).
  { key: 'statusMarker_CONTACTED',                label: 'Marker: Contacted',            required: false, hint: 'Truthy value in this column → status becomes CONTACTED (has appointment scheduled).', aliases: ['contacted', 'has appointment'] },
  { key: 'statusMarker_INTERVIEWING',              label: 'Marker: Interviewing',          required: false, hint: 'Truthy value → status becomes INTERVIEWING.', aliases: ['interviewing', 'interview scheduled'] },
  { key: 'statusMarker_PENDING_DECISION',          label: 'Marker: Attended (Pending decision)', required: false, hint: 'Truthy value → status becomes PENDING_DECISION.', aliases: ['attended', 'interviewed'] },
  { key: 'statusMarker_OFFER_SENT',                label: 'Marker: Offered',              required: false, hint: 'Truthy value → status becomes OFFER_SENT.', aliases: ['offered', 'offer sent'] },
  { key: 'statusMarker_HIRED',                     label: 'Marker: Hired',                required: false, hint: 'Truthy value → status becomes HIRED.', aliases: ['accepted', 'accepted offer', 'hired'] },
  { key: 'statusMarker_REJECTED',                  label: 'Marker: Rejected (generic)',   required: false, hint: 'Truthy value → status becomes REJECTED.', aliases: ['rejected', 'not suitable'] },
  { key: 'statusMarker_REJECTED_NO_SHOW',           label: 'Marker: Didn\'t attend',      required: false, hint: 'Truthy value → status becomes REJECTED with reason "No-show".', aliases: ["didn't attend", 'did not attend', 'didnt attend', 'no show', 'no-show', 'noshow', 'absent', 'no attend'] },
  { key: 'statusMarker_REJECTED_DECLINED_OFFER',    label: 'Marker: Declined offer',      required: false, hint: 'Truthy value → status becomes REJECTED with reason "Declined offer".', aliases: ['declined offer', 'declined'] },
];

// Highest-priority truthy marker wins when a row has multiple markers
// set (e.g. Interviewed=true AND Offered=true AND Rejected=true → the
// row is REJECTED because that's the terminal state).
const STATUS_PRIORITY: StatusMarkerKey[] = [
  'statusMarker_HIRED',                    // Terminal — highest
  'statusMarker_REJECTED_NO_SHOW',
  'statusMarker_REJECTED_DECLINED_OFFER',
  'statusMarker_REJECTED',
  'statusMarker_OFFER_SENT',
  'statusMarker_PENDING_DECISION',
  'statusMarker_INTERVIEWING',
  'statusMarker_CONTACTED',                // Least advanced
];

const MARKER_TO_STATUS: Record<StatusMarkerKey, 'CONTACTED' | 'INTERVIEWING' | 'PENDING_DECISION' | 'OFFER_SENT' | 'HIRED' | 'REJECTED'> = {
  statusMarker_CONTACTED:                'CONTACTED',
  statusMarker_INTERVIEWING:              'INTERVIEWING',
  statusMarker_PENDING_DECISION:          'PENDING_DECISION',
  statusMarker_OFFER_SENT:                'OFFER_SENT',
  statusMarker_HIRED:                     'HIRED',
  statusMarker_REJECTED:                  'REJECTED',
  statusMarker_REJECTED_NO_SHOW:          'REJECTED',
  statusMarker_REJECTED_DECLINED_OFFER:   'REJECTED',
};

// Same sentinel strings the app uses internally so the admin's filter
// / grouping code recognises the reason class. Keep in sync with the
// constants in CandidatesPage.
const REJECTION_SENTINELS: Partial<Record<StatusMarkerKey, string>> = {
  statusMarker_REJECTED_NO_SHOW:        'Candidate did not attend the interview.',
  statusMarker_REJECTED_DECLINED_OFFER: 'Candidate declined the offer.',
  statusMarker_REJECTED:                 'Not suitable.',
};

// Truthy cell values across common sheet shapes: booleans, "TRUE",
// "yes", "1", checkmark chars, etc. Everything else counts as falsy.
function isTruthyCell(raw: string): boolean {
  if (!raw) return false;
  const v = String(raw).trim().toLowerCase();
  return v === 'true' || v === 'yes' || v === 'y' || v === '1'
      || v === 'x' || v === '✓' || v === '☑' || v === '✔';
}

const COMMUTE_ALIASES: Record<string, CommuteTime> = {
  'UNDER_15': 'UNDER_15', '<15': 'UNDER_15', '< 15 MIN': 'UNDER_15', 'LESS THAN 15 MINUTES': 'UNDER_15', 'LESS THAN 15 MIN': 'UNDER_15', 'LESS THAN 15': 'UNDER_15',
  'MIN_15_30': 'MIN_15_30', '15-30': 'MIN_15_30', '15-30 MINUTES': 'MIN_15_30', '15-30 MIN': 'MIN_15_30', '15 - 30 MINUTES': 'MIN_15_30',
  'MIN_30_45': 'MIN_30_45', '30-45': 'MIN_30_45', '30-45 MINUTES': 'MIN_30_45', '30-45 MIN': 'MIN_30_45', '30 - 45 MINUTES': 'MIN_30_45',
  'MIN_45_60': 'MIN_45_60', '45-60': 'MIN_45_60', '45-60 MINUTES': 'MIN_45_60', '45-60 MIN': 'MIN_45_60', '45 - 60 MINUTES': 'MIN_45_60',
  'OVER_60': 'OVER_60', '>1H': 'OVER_60', '> 1 HR': 'OVER_60', 'MORE THAN 1 HOUR': 'OVER_60', 'MORE THAN 60 MINUTES': 'OVER_60', 'MORE THAN 60 MIN': 'OVER_60',
  'WILL_MOVE': 'WILL_MOVE', 'MOVE': 'WILL_MOVE', 'WILL MOVE': 'WILL_MOVE', 'WILL MOVE CLOSER': 'WILL_MOVE', 'WILLING TO MOVE': 'WILL_MOVE', 'WILLING TO MOVE CLOSER': 'WILL_MOVE', 'RELOCATE': 'WILL_MOVE',
};

function normalizeCommute(raw: string): CommuteTime | '' {
  if (!raw) return '';
  // Normalise en-dash / em-dash to plain hyphen so "15 – 30" and
  // "15 - 30" and "15-30" all map to the same alias key.
  const key = raw.trim().toUpperCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
  return COMMUTE_ALIASES[key] ?? '';
}

// Coerces a variety of date shapes to `YYYY-MM-DD`. Handles ISO, US
// locale (`M/D/YYYY`), Malaysian locale (`DD/MM/YYYY`), Excel serial
// numbers, and anything Date() can natively parse. Anything unparseable
// returns '' so the caller's default (or "missing" flag) kicks in
// instead of forwarding a bad value that trips the backend regex.
function normalizeDate(raw: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';
  // Already ISO — pass through.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or M/D/YYYY — the common non-ISO sheet shapes.
  const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slash) {
    let [, a, b, y] = slash;
    const na = Number(a), nb = Number(b);
    // If either number is > 12, we know that's the day. If both are
    // ambiguous (both ≤ 12), we default to DD/MM/YYYY — the more
    // common non-US convention and matches Malaysian sheets.
    const day = na > 12 ? na : (nb > 12 ? nb : na);
    const mon = na > 12 ? nb : (nb > 12 ? na : nb);
    // 2-digit year → 19xx if ≥ 30, else 20xx (typical DOB heuristic).
    let yyyy = Number(y);
    if (y.length === 2) yyyy = yyyy >= 30 ? 1900 + yyyy : 2000 + yyyy;
    if (day < 1 || day > 31 || mon < 1 || mon > 12) return '';
    return `${yyyy}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  // Excel serial number — days since 1899-12-30.
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 60000) { // sanity: 1954..2064
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400 * 1000);
      if (!isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
    }
  }
  // Last resort — hand it to Date() and hope. If it fails, return '' so
  // the caller falls back to a default rather than forwarding garbage.
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Extracts the FIRST number from a cell.
function normalizeNumber(raw: string): number | undefined {
  if (raw == null) return undefined;
  const match = String(raw).match(/(\d[\d,]*(?:\.\d+)?)/);
  if (!match) return undefined;
  const n = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

// Extract every plausible number from a cell so a salary answer like
// "RM 2,500 – RM 2,800" becomes { min: 2500, max: 2800 }. Ignores tiny
// numbers (< 100) so a dash or currency code masquerading as digits
// doesn't corrupt the range. Single-value answers set min == max
// (caller decides whether to write max to the payload).
function normalizeSalary(raw: string): { min?: number; max?: number } {
  if (raw == null) return {};
  const matches = String(raw).match(/\d[\d,]*(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return {};
  const nums = matches
    .map(s => Number(s.replace(/,/g, '')))
    .filter(n => Number.isFinite(n) && n >= 100);
  if (nums.length === 0) return {};
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

// Google Sheets stores phone-looking cells as numbers, which strips the
// leading zero of Malaysian mobiles ("0143870448" → 143870448). Restore
// it when the pattern is unambiguous: 9–10 digit starting with `1`, with
// no country-code prefix, and no leading zero. Anything already looking
// like "0XX-…" or "+60…" passes through unchanged.
function normalizePhone(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return s;
  // Already has leading zero or +60 country code — leave alone but
  // return the visually-cleaned form.
  if (s.startsWith('0') || s.startsWith('+') || digits.startsWith('60')) return s;
  // Bare 9–10 digit MY mobile ("143870448" or "1127659468") — prepend 0.
  if (/^1\d{8,9}$/.test(digits)) return '0' + digits;
  return s;
}

// Google Sheets timestamps land in whatever the sheet's locale used —
// commonly `DD/MM/YYYY HH:mm:ss` in Malaysia, `M/D/YYYY H:mm:ss` in
// US-locale sheets. `new Date()` on those is ambiguous or fails, so we
// pick a format explicitly and emit an ISO string. Anything we can't
// parse we return raw and let the backend fall back to `now`.
function normalizeTimestamp(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();
  // Already ISO-ish (YYYY-MM-DD…) — pass through.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  // DD/MM/YYYY[ HH:MM[:SS]] — the common Sheets export shape in MY.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, a, b, y, hh = '0', mm = '0', ss = '0'] = m;
    // If either number is > 12, we know it's the day component. If
    // both ≤ 12, we default to DD/MM/YYYY — the more common non-US
    // convention and matches the Malaysian sheets you're importing.
    const na = Number(a), nb = Number(b);
    const day = na > 12 ? na : (nb > 12 ? nb : na);
    const mon = na > 12 ? nb : (nb > 12 ? na : nb);
    const iso = `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? s : d.toISOString();
  }
  // Excel serial datetime (days since 1899-12-30, fractional part = time).
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 60000) { // sanity range 1954..2064
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400 * 1000);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  // Last-resort: hand it to Date() and hope.
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

// Peek at a column's sample cells to decide what shape the data has
// (number vs date vs boolean vs long text). Used to override obviously
// wrong header-based auto-maps: e.g. a column labelled "Expected
// Salary" that actually holds "I have 5 years teaching…" paragraphs
// should map to salaryJustification, not expectedSalary.
function sniffColumnShape(samples: string[]): 'number' | 'date' | 'boolean' | 'longtext' | 'shorttext' | 'empty' {
  const nonEmpty = samples.map(s => (s ?? '').trim()).filter(s => s.length > 0);
  if (nonEmpty.length === 0) return 'empty';
  const numLike     = nonEmpty.filter(s => /^\s*(RM\s*)?\d[\d,]*(?:\.\d+)?\s*$/i.test(s)).length;
  const boolLike    = nonEmpty.filter(s => /^(true|false|yes|no|y|n|0|1)$/i.test(s)).length;
  const dateLike    = nonEmpty.filter(s => /^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(s)).length;
  const avgLen      = nonEmpty.reduce((a, s) => a + s.length, 0) / nonEmpty.length;
  if (numLike  / nonEmpty.length > 0.7) return 'number';
  if (boolLike / nonEmpty.length > 0.7) return 'boolean';
  if (dateLike / nonEmpty.length > 0.7) return 'date';
  return avgLen > 40 ? 'longtext' : 'shorttext';
}

// Auto-match: for each parsed column, score every FieldSpec by the
// LONGEST matching alias substring and pick the winner. Longer alias
// = more specific = wins.
//
// Rationale: earlier revision took the first match, which meant short
// generic aliases like "role" (4 chars) beat longer more-specific ones
// like "expected salary" (15 chars) just because Position came first
// in the FIELDS array. Long Google Form question strings (e.g. "The
// typical salary range for this role is RM2,200 – RM2,600, depending
// on experience and skills. Please state your expected salary") were
// being routed to Position because "role" appeared before "expected
// salary" would have been considered.
function autoMap(headers: string[], rows: string[][] = []): FieldKey[] {
  const bodySamples = (colIdx: number) =>
    rows.slice(0, Math.min(rows.length, 20)).map(r => r[colIdx] ?? '');
  // Normalise apostrophe-like Unicode punctuation to ASCII. Google
  // Sheets auto-corrects `'` in headers like "Didn't Attend" to a smart
  // quote (U+2019), which then fails our substring-match against the
  // straight-quote alias "didn't attend". Squash both sides to the same
  // shape before matching.
  const normPunc = (s: string) => s
    .toLowerCase()
    .replace(/[‘’ʼʻ`´]/g, "'")
    .trim();
  return headers.map((h, i) => {
    const norm = normPunc(h);
    if (!norm) return 'skip' as FieldKey;
    let bestKey: FieldKey = 'skip';
    let bestScore = 0;
    for (const f of FIELDS) {
      const candidates = [f.label.toLowerCase(), ...f.aliases.map(a => a.toLowerCase())].map(normPunc);
      for (const alias of candidates) {
        if (alias.length < 3) continue; // reject noise like empty / single-char aliases
        if (!norm.includes(alias)) continue;
        // Whole-word match earns a bonus — "role" as a standalone word
        // is more meaningful than the same 4 chars hiding inside
        // "responsibilities". Word-boundary at both edges of the alias.
        const wordMatch = new RegExp(`(^|[^a-z0-9])${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(norm);
        const score = alias.length + (wordMatch ? 2 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestKey = f.key;
        }
      }
    }
    // Content-based override — reject header matches when the actual
    // cell content clearly doesn't match. Fixes cases like a column
    // labelled "Expected Salary" that actually holds paragraph text
    // (justification for Junior/Assistant applicants in the user's
    // sheet), which the header alone would map to expectedSalary.
    if (rows.length > 0 && bestKey !== 'skip') {
      const shape = sniffColumnShape(bodySamples(i));
      if (bestKey === 'expectedSalary' && shape === 'longtext') return 'salaryJustification';
      if (bestKey === 'salaryJustification' && shape === 'number') return 'expectedSalary';
      // Long-form Google Form questions labelled "Expected Salary" but
      // holding shortish text (still not a number) → treat as
      // justification since the field can't be numeric.
      if (bestKey === 'expectedSalary' && shape === 'shorttext') return 'salaryJustification';
    }
    return bestKey;
  });
}

// Proper delimited-file parser that respects quoted multi-line cells,
// escaped quotes ("" inside a quoted cell), and both \r\n / \n line
// endings. The old naive `split('\n').split('\t')` broke on any cell
// containing a newline (common when applicants type multi-line answers
// to "Why kindergarten teacher?") — the row shifted, and downstream
// columns (salary, phone, etc.) ended up reading data from the wrong
// column. Symptoms: nonsense salaries like RM 25,002,800 and rows with
// mixed-up fields.
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }  // escaped quote
        else inQuote = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"' && cell === '') {
        inQuote = true;
      } else if (ch === delimiter) {
        row.push(cell); cell = '';
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(cell); rows.push(row); row = []; cell = ''; i++;
      } else if (ch === '\n') {
        row.push(cell); rows.push(row); row = []; cell = '';
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.length > 0));
}

function parseTsv(text: string): string[][] {
  return parseDelimited(text, '\t');
}

// Try UTF-8 first (with strict validation); if the bytes aren't valid
// UTF-8, fall back to Windows-1252 (Excel's default encoding on
// Windows, which is what CSV exports from Excel usually use). Symptom
// of the wrong path: mojibake like `Iâ[][m` in place of `I'm` because
// UTF-8 curly-apostrophe bytes (E2 80 99) get read one-at-a-time
// through Latin-1.
async function decodeSmart(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  // Strip UTF-8 BOM if present so it doesn't leak into the first header.
  const hasBom = bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
  const start = hasBom ? 3 : 0;
  const slice = start ? bytes.subarray(start) : bytes;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(slice);
  } catch {
    return new TextDecoder('windows-1252').decode(slice);
  }
}

// ── UI ───────────────────────────────────────────────────────────────────────

type Phase = 'input' | 'map' | 'result';

export default function ImportCandidatesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<Phase>('input');
  const [pastedText, setPastedText] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<FieldKey[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Load form options so we can preview position + qualification values.
  useQuery({ queryKey: ['candidate-form-options'], queryFn: fetchCandidateFormOptions });

  const parseInput = () => {
    // Detect delimiter from the pasted content. Google Sheets Ctrl-C
    // gives TSV; a CSV export gives commas. Both go through the same
    // quoted-cell aware parser to survive multi-line answers.
    const matrix = parseDelimited(pastedText, pastedText.includes('\t') ? '\t' : ',');
    if (matrix.length < 2) {
      showToast('Need at least a header row plus one data row.', 'error');
      return;
    }
    const hdrs = matrix[0].map(h => String(h ?? ''));
    setHeaders(hdrs);
    setRows(matrix.slice(1));
    setMapping(autoMap(hdrs, matrix.slice(1)));
    setPhase('map');
  };

  const onFile = async (file: File) => {
    const name = file.name.toLowerCase();
    let matrix: string[][];
    if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
      // Plain-text delimited files go through our quoted-cell parser
      // directly. xlsx.js's CSV support was tripping over multi-line
      // answers in some rows, shifting downstream columns (salary,
      // timestamp, etc.) and producing nonsense values.
      const text = await decodeSmart(await file.arrayBuffer());
      matrix = parseDelimited(text, name.endsWith('.csv') ? ',' : '\t');
    } else {
      // .xlsx / .xls — use xlsx.js with cellDates so date cells come
      // back as Date objects (which our normalisers can then handle),
      // instead of raw Excel serial numbers.
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
        .map(r => r.map(c => {
          if (c == null) return '';
          if (Object.prototype.toString.call(c) === '[object Date]') return (c as Date).toISOString();
          return String(c);
        }));
    }
    if (matrix.length < 2) {
      showToast('Sheet must have a header row plus at least one data row.', 'error');
      return;
    }
    const hdrs = matrix[0].map(h => String(h ?? ''));
    setHeaders(hdrs);
    setRows(matrix.slice(1));
    setMapping(autoMap(hdrs, matrix.slice(1)));
    setPhase('map');
  };

  // Build a Candidate payload from a row using the current mapping.
  // Returns { payload, missing } — missing lists required fields that
  // are blank so the preview can flag them.
  const buildPayload = (row: string[]): { payload: Partial<CreateCandidateInput>; missing: string[] } => {
    const p: any = {};
    // Track which status markers this row triggered so we can resolve
    // the pipeline stage by priority after the loop finishes.
    const truthyMarkers = new Set<StatusMarkerKey>();

    for (let c = 0; c < mapping.length; c++) {
      const key = mapping[c];
      if (key === 'skip') continue;
      const raw = String(row[c] ?? '').trim();
      if (!raw) continue;
      // Status markers — record truthy values, don't put them on
      // the payload directly (they aren't backend fields).
      if (key.startsWith('statusMarker_')) {
        if (isTruthyCell(raw)) truthyMarkers.add(key as StatusMarkerKey);
        continue;
      }
      switch (key) {
        case 'commuteTime': {
          const v = normalizeCommute(raw);
          if (v) p.commuteTime = v;
          break;
        }
        case 'dob':
        case 'availableFrom':
        case 'preferredStartDate':
          p[key] = normalizeDate(raw);
          break;
        case 'submittedAt':
          // Sheets timestamps arrive as DD/MM/YYYY HH:mm:ss (Malaysia)
          // or M/D/YYYY H:mm:ss (US) — both trip new Date() on the
          // backend. Normalise to ISO here so the historical row
          // lands with its original submission time.
          p.submittedAt = normalizeTimestamp(raw);
          break;
        case 'interviewStart': {
          // Source cell can be date-only ("10/03/2025") or a full
          // timestamp — try timestamp first (keeps HH:MM if present),
          // fall back to date-only which stores as midnight local.
          const t = normalizeTimestamp(raw);
          if (t) { p.interviewStart = t; break; }
          const d = normalizeDate(raw);
          if (d) p.interviewStart = d;
          break;
        }
        case 'expectedSalary': {
          const range = normalizeSalary(raw);
          if (range.min !== undefined) p.expectedSalary = range.min;
          // Only preserve the upper bound when it's genuinely a range —
          // if the applicant named a single number, don't set max.
          if (range.max !== undefined && range.max !== range.min) {
            p.expectedSalaryMax = range.max;
          }
          break;
        }
        case 'phone':
          p.phone = normalizePhone(raw);
          break;
        default:
          p[key] = raw;
      }
    }

    // Resolve pipeline status from the truthy markers — highest
    // priority wins (HIRED > REJECTED variants > OFFER_SENT > … > NEW).
    // Reject-with-reason markers also inject the matching sentinel
    // rejection reason so the admin filter/grouping code recognises
    // "declined offer" / "no-show" rows properly.
    for (const marker of STATUS_PRIORITY) {
      if (truthyMarkers.has(marker)) {
        p.status = MARKER_TO_STATUS[marker];
        const reason = REJECTION_SENTINELS[marker];
        if (reason && !p.rejectionReason) p.rejectionReason = reason;
        break;
      }
    }
    // Interview-date auto-promotion — if the source row has a
    // parseable Appointment date and no stronger marker won above,
    // the row is at least at the INTERVIEWING stage.
    if (p.interviewStart && !p.status) p.status = 'INTERVIEWING';
    // Fill sensible defaults for required backend fields the source
    // sheet doesn't carry. Historical imports are triage-later data;
    // dropping rows just because the applicant's original form never
    // asked "when can you start" would lose data the admin actually
    // wants captured. Fields the admin can edit inline post-import.
    const todayIso = new Date().toISOString().slice(0, 10);
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const in30Iso = in30.toISOString().slice(0, 10);
    if (!p.salaryJustification) p.salaryJustification = 'Imported — no salary justification captured.';
    if (!p.availableFrom      || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.availableFrom)))      p.availableFrom = todayIso;
    if (!p.preferredStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.preferredStartDate))) p.preferredStartDate = in30Iso;
    if (!p.commuteTime)         p.commuteTime = 'WILL_MOVE';
    if (!p.experienceRange)     p.experienceRange = 'Less than 1 year';
    if (!p.qualification)       p.qualification = 'Others';
    if (!p.careerGoals)         p.careerGoals = 'Imported — not captured.';
    if (!p.whyKindergartenTeacher) p.whyKindergartenTeacher = 'Imported — not captured.';
    if (!p.howDidYouKnow)       p.howDidYouKnow = 'Imported';
    if (!p.addressLocation)     p.addressLocation = 'Not captured';
    if (p.expectedSalary == null) p.expectedSalary = 0; // placeholder — admin can edit
    // Force ISO shape on dob. If the normalized value isn't strictly
    // YYYY-MM-DD (edge cases the regex path missed) fall through to the
    // placeholder so the backend validator doesn't reject the row.
    if (!p.dob || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.dob))) p.dob = '1990-01-01';
    if (!p.desiredPosition)     p.desiredPosition = 'Not specified';
    // Tag the payload as an import so the backend validator relaxes
    // 18+ dob and past-date checks. Without this the frontend was
    // sending submissionSource: undefined and those refines fired for
    // legitimately-imported historical rows.
    p.submissionSource = 'imported';

    // Only two fields are truly non-negotiable for a candidate to be
    // recognisable — everything else has a defensible default above.
    const missing: string[] = [];
    if (!p.fullName)  missing.push('Full name');
    if (!p.phone)     missing.push('Phone');
    return { payload: p as Partial<CreateCandidateInput>, missing };
  };

  const previewRows = useMemo(() => {
    return rows.map((row, i) => {
      const { payload, missing } = buildPayload(row);
      return { index: i, row, payload, missing };
    });
  }, [rows, mapping]);

  const importableRows = previewRows.filter(r => r.missing.length === 0);
  const skippedRows = previewRows.filter(r => r.missing.length > 0);

  // Batch size for the /api/candidates/import POST. Backend caps a
  // single request at 500 rows; we go smaller (100) so each request
  // stays well under Express's JSON body limit even when rows carry
  // long career-goals / justification text. Larger imports fire
  // multiple requests sequentially and merge results.
  const IMPORT_BATCH = 100;
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  const doImport = async () => {
    if (importableRows.length === 0) return;
    setSubmitting(true);
    const payload = importableRows.map(r => r.payload);
    setImportProgress({ done: 0, total: payload.length });
    const merged: ImportResult = { inserted: 0, total: payload.length, results: [] };
    try {
      for (let i = 0; i < payload.length; i += IMPORT_BATCH) {
        const chunk = payload.slice(i, i + IMPORT_BATCH);
        const res = await importCandidates(chunk);
        merged.inserted += res.inserted;
        // Offset per-row indices so error rows in later batches map back
        // to the original spreadsheet row number, not the batch's index.
        for (const r of res.results) {
          merged.results.push({ ...r, index: r.index + i });
        }
        setImportProgress({ done: Math.min(i + IMPORT_BATCH, payload.length), total: payload.length });
      }
      setResult(merged);
      qc.invalidateQueries({ queryKey: ['candidates'] });
      qc.invalidateQueries({ queryKey: ['candidate-stats'] });
      // Repeat-applicant detection reads from a separate cross-tab
      // phone-index query — refresh it too, otherwise newly-imported
      // phones don't count towards the "Applied Nx" pill until the
      // next 60-second poll and the red sidebar circle stays grey.
      qc.invalidateQueries({ queryKey: ['candidate-phone-index'] });
      setPhase('result');
    } catch (e: any) {
      // Partial imports may have landed already — surface the count
      // that made it before the failure so the admin knows what to
      // reconcile.
      showToast(
        `Import failed after ${merged.inserted}/${payload.length} rows: ${e?.message ?? 'Unknown error'}`,
        'error',
      );
    } finally {
      setImportProgress(null);
      setSubmitting(false);
    }
  };

  // ── Step 1 (Upload) — drop-zone state, mirroring ImportLeadsPage ─────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropError, setDropError] = useState('');
  const handleBrowseClick = () => fileInputRef.current?.click();
  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropError('');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const nm = file.name.toLowerCase();
    if (!nm.endsWith('.csv') && !nm.endsWith('.xlsx') && !nm.endsWith('.xls') && !nm.endsWith('.tsv') && !nm.endsWith('.txt')) {
      setDropError('Please upload a .csv or .xlsx file.');
      return;
    }
    await onFile(file);
  }, []);
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);
  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    setDropError('');
    const file = e.target.files?.[0];
    if (file) await onFile(file);
    e.target.value = '';
  }, []);
  const [showColRef, setShowColRef] = useState(false);
  const [showPaste, setShowPaste] = useState(false);

  const downloadSampleCsv = () => {
    // Header row lifted from FIELDS so the sample stays in sync with
    // the importer's known columns. Sample row uses plausible Malaysian
    // teacher data so it's obvious what shape each column expects.
    const headers = [
      'Full Name', 'Phone', 'Date of Birth', 'Address', 'Travel Time', 'Desired Position',
      'Available From', 'Preferred Start Date', 'Experience', 'Qualification',
      'Expected Salary', 'Salary Justification', 'Career Goals',
      'Why Kindergarten Teacher', 'How Did You Know', 'Timestamp',
    ];
    const sample = [
      'Ali Bin Ahmad', '011-2345 6789', '1998-05-14', 'Taman Bukit Indah', 'Less than 15 minutes', 'Junior teacher',
      '2026-08-01', '2026-08-15', '1 - 2 years', 'Diploma / STPM / UEC / A level',
      '2500', 'Matches my current pay at previous kindy.', 'Move up to senior teacher within 3 years.',
      'I love working with young children.', 'Facebook', '06/07/2026 14:30:00',
    ];
    const csv = [headers.join(','), sample.map(v => v.includes(',') ? `"${v}"` : v).join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-candidates-import.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stepNum = phase === 'input' ? 1 : phase === 'map' ? 2 : 3;

  return (
    <div style={embedded ? undefined : { background: C.bg, minHeight: '100vh', padding: '32px 24px', fontFamily: 'system-ui, sans-serif', color: C.text }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {!embedded && (
          <>
            <button
              onClick={() => navigate('/hr/candidates')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none', color: C.textSub,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
              }}
            >
              <FontAwesomeIcon icon={faArrowLeft} /> Back to Candidates
            </button>

            <div style={{ marginBottom: 24 }}>
              <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: '#1a202c' }}>Import Candidates</h1>
              <p style={{ margin: 0, fontSize: 14, color: '#718096', lineHeight: 1.5 }}>
                Upload a CSV or Excel file to bulk import candidates. Existing candidates with matching phone numbers can be reviewed after upload.
              </p>
            </div>
          </>
        )}

        {/* ── Step indicator ────────────────────────────────────────── */}
        <StepIndicator current={stepNum} />

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 1 — Upload                                             */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {phase === 'input' && (
          <div>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleBrowseClick}
              style={{
                border: `2px dashed ${isDragOver ? '#2b6cb0' : dropError ? '#c47272' : '#cbd5e0'}`,
                borderRadius: 10,
                padding: '48px 32px',
                textAlign: 'center' as const,
                cursor: 'pointer',
                background: isDragOver ? '#ebf4ff' : dropError ? '#fff5f5' : '#fff',
                transition: 'border-color 0.15s, background 0.15s',
                userSelect: 'none' as const,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <svg
                  width="40" height="40" viewBox="0 0 24 24" fill="none"
                  stroke={isDragOver ? '#2b6cb0' : dropError ? '#c47272' : '#a0aec0'}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="12" x2="12" y2="18" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              {dropError ? (
                <>
                  <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: '#c47272' }}>{dropError}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#a0aec0' }}>Click to try again with a .csv or .xlsx file</p>
                </>
              ) : isDragOver ? (
                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#2b6cb0' }}>Release to upload</p>
              ) : (
                <>
                  <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: '#2d3748' }}>
                    Drop your CSV or Excel file here, or{' '}
                    <span style={{ color: '#2b6cb0', textDecoration: 'underline', cursor: 'pointer' }}>click to browse</span>
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#a0aec0' }}>Accepts .csv and .xlsx files</p>
                </>
              )}
            </div>

            {/* Actions row */}
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              <button
                onClick={e => { e.stopPropagation(); downloadSampleCsv(); }}
                style={{
                  padding: '10px 18px', background: '#fff', color: '#2d3748',
                  border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer',
                  fontSize: 14, fontWeight: 500,
                }}
              >
                ↓ Download sample CSV
              </button>
              <button
                onClick={() => setShowPaste(o => !o)}
                style={{
                  padding: '10px 18px', background: '#fff', color: '#2d3748',
                  border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer',
                  fontSize: 14, fontWeight: 500,
                }}
              >
                <FontAwesomeIcon icon={faPaste} style={{ marginRight: 6 }} />
                {showPaste ? 'Hide paste box' : 'Or paste from Google Sheets'}
              </button>
            </div>

            {/* Paste alternative — hidden by default, expanded on demand.
                Same parser as the file path; kept because Google Sheets
                Ctrl-C is often faster than "download as CSV → upload". */}
            {showPaste && (
              <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#4a5568', lineHeight: 1.5 }}>
                  Select the header row plus all the rows in your Sheet, Ctrl + C, then paste here.
                </p>
                <textarea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder={'Full Name\tPhone\tDate of Birth\t...\nAli Bin Ahmad\t011-1234567\t1998-05-14\t...'}
                  rows={8}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    border: `1px solid ${C.border}`, borderRadius: 6,
                    padding: '10px 12px', fontFamily: 'monospace', fontSize: 12,
                    lineHeight: 1.5, color: C.text, background: '#fff',
                    resize: 'vertical',
                  }}
                />
                <button
                  onClick={parseInput}
                  disabled={!pastedText.trim()}
                  style={{
                    marginTop: 10, padding: '10px 22px',
                    background: pastedText.trim() ? '#2b6cb0' : '#cbd5e0',
                    color: '#fff', border: 'none', borderRadius: 6,
                    cursor: pastedText.trim() ? 'pointer' : 'default',
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  Parse pasted rows
                </button>
              </div>
            )}

            {/* Column reference */}
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => setShowColRef(o => !o)}
                style={{
                  background: 'none', border: 'none', color: '#2b6cb0',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  padding: 0, textDecoration: 'underline',
                }}
              >
                {showColRef ? 'Hide column reference ▴' : 'Show column reference ▾'}
              </button>
              {showColRef && (
                <div style={{ marginTop: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 4, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Column', 'Required?', 'Notes'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 12px', background: '#f7fafc', color: '#4a5568', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {FIELDS.filter(f => f.key !== 'skip').map((f, i) => (
                        <tr key={f.key} style={{ background: i % 2 === 0 ? '#fff' : '#f7fafc' }}>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #edf2f7' }}>
                            <code style={{ background: '#edf2f7', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{f.label}</code>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #edf2f7' }}>
                            {f.required
                              ? <span style={{ background: '#fef2f2', color: '#c53030', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Required</span>
                              : <span style={{ background: '#edf2f7', color: '#4a5568', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>Optional</span>}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #edf2f7', color: '#4a5568' }}>
                            {f.hint ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {phase === 'map' && (
          <>
            <div style={cardStyle}>
              <h2 style={sectionH2}>Column mapping</h2>
              <p style={{ margin: '0 0 12px', color: C.textSub, fontSize: 13 }}>
                Auto-matched by header name. Override any wrong ones.
                Set to <em>Skip</em> to drop a column from the import.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={th}>Your column</th>
                      <th style={th}>Maps to</th>
                      <th style={th}>Sample row 1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((h, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                        <td style={{ ...td, fontWeight: 600 }}>{h || <span style={{ color: C.mutedSoft }}>(blank)</span>}</td>
                        <td style={td}>
                          <select
                            value={mapping[i] ?? 'skip'}
                            onChange={e => setMapping(m => m.map((v, j) => j === i ? e.target.value as FieldKey : v))}
                            style={{
                              padding: '6px 8px', border: `1px solid ${C.border}`,
                              borderRadius: 6, fontSize: 13, color: C.text, background: '#fff',
                            }}
                          >
                            <option value="skip">— Skip —</option>
                            {FIELDS.map(f => (
                              <option key={f.key} value={f.key}>
                                {f.label}{f.required ? ' *' : ''}
                              </option>
                            ))}
                          </select>
                          {mapping[i] && mapping[i] !== 'skip' && FIELDS.find(f => f.key === mapping[i])?.hint && (
                            <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>
                              {FIELDS.find(f => f.key === mapping[i])!.hint}
                            </div>
                          )}
                        </td>
                        <td style={{ ...td, color: C.mutedSoft, fontFamily: 'monospace', fontSize: 12 }}>
                          {rows[0]?.[i] ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: 16 }}>
              <h2 style={sectionH2}>
                Preview — {previewRows.length} row{previewRows.length === 1 ? '' : 's'}
                {skippedRows.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 13, color: C.warning, fontWeight: 500 }}>
                    · {skippedRows.length} will be skipped
                  </span>
                )}
              </h2>
              <div style={{ overflowX: 'auto', maxHeight: 400 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>Full name</th>
                      <th style={th}>Phone</th>
                      <th style={th}>Position</th>
                      <th style={th}>Salary</th>
                      <th style={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 50).map(r => (
                      <tr key={r.index} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                        <td style={td}>{r.index + 1}</td>
                        <td style={td}>{r.payload.fullName ?? '—'}</td>
                        <td style={td}>{r.payload.phone ?? '—'}</td>
                        <td style={td}>{r.payload.desiredPosition ?? '—'}</td>
                        <td style={td}>{r.payload.expectedSalary != null ? `RM ${r.payload.expectedSalary}` : '—'}</td>
                        <td style={td}>
                          {r.missing.length === 0 ? (
                            <span style={{ color: C.success, fontWeight: 600 }}>
                              <FontAwesomeIcon icon={faCheck} /> Ready
                            </span>
                          ) : (
                            <span style={{ color: C.warning, fontWeight: 600 }} title={`Missing: ${r.missing.join(', ')}`}>
                              <FontAwesomeIcon icon={faTriangleExclamation} /> Missing {r.missing.length}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.length > 50 && (
                  <div style={{ padding: '10px 0', color: C.mutedSoft, fontSize: 12 }}>
                    … showing first 50 of {previewRows.length} rows.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setPhase('input')} style={secondaryBtn}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back
              </button>
              <button
                onClick={doImport}
                disabled={submitting || importableRows.length === 0}
                style={{ ...primaryBtn, opacity: submitting || importableRows.length === 0 ? 0.55 : 1 }}
              >
                <FontAwesomeIcon icon={faFileImport} />
                {submitting
                  ? ' Importing…'
                  : ` Import ${importableRows.length} row${importableRows.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}

        {phase === 'result' && result && (
          <div style={cardStyle}>
            <h2 style={sectionH2}>Import result</h2>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16,
            }}>
              <Stat label="Attempted" value={result.total} />
              <Stat label="Inserted"  value={result.inserted} color={C.success} />
              <Stat label="Failed"    value={result.total - result.inserted} color={result.total - result.inserted > 0 ? C.danger : undefined} />
            </div>
            {result.results.filter(r => r.error).length > 0 && (
              <>
                <div style={{ fontWeight: 600, color: C.textSub, marginBottom: 8, fontSize: 13 }}>Errors</div>
                <div style={{ maxHeight: 300, overflowY: 'auto', border: `1px solid ${C.borderSoft}`, borderRadius: 8 }}>
                  {result.results.filter(r => r.error).map(r => (
                    <div key={r.index} style={{ padding: '8px 12px', borderBottom: `1px solid ${C.borderSoft}`, fontSize: 12 }}>
                      <strong>Row {r.index + 1}:</strong> <span style={{ color: C.danger }}>{r.error}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => navigate('/hr/candidates')} style={primaryBtn}>
                <FontAwesomeIcon icon={faCheck} /> Done — view candidates
              </button>
              <button onClick={() => { setPhase('input'); setPastedText(''); setRows([]); setHeaders([]); setMapping([]); setResult(null); }} style={secondaryBtn}>
                Import another batch
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full-screen import overlay — locks the UI while rows are being
          POSTed in batches so the admin sees a clear "we're working"
          state instead of a chip on a button. Percentage circle updates
          per completed batch. */}
      {importProgress && (
        <ImportProgressOverlay done={importProgress.done} total={importProgress.total} />
      )}
    </div>
  );
}

function ImportProgressOverlay({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.floor((done / total) * 100) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import in progress"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16,
          padding: '40px 48px', minWidth: 320,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          textAlign: 'center',
        }}
      >
        <div style={{ position: 'relative', width: 140, height: 140 }}>
          <svg width={140} height={140} viewBox="0 0 140 140">
            <circle cx={70} cy={70} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={10} />
            <circle
              cx={70} cy={70} r={radius}
              fill="none" stroke="#5a67d8" strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, fontWeight: 700, color: '#1a202c',
              fontVariantNumeric: 'tabular-nums' as const,
            }}
          >
            {pct}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a202c', marginBottom: 4 }}>
            Importing candidates…
          </div>
          <div style={{ fontSize: 13, color: '#718096', fontVariantNumeric: 'tabular-nums' as const }}>
            {done} of {total} rows uploaded
          </div>
        </div>
      </div>
    </div>
  );
}

// ── little bits ─────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
  padding: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
};
const sectionH2: React.CSSProperties = {
  margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: C.text,
};
const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 8px', fontSize: 12, color: C.muted,
  fontWeight: 700, borderBottom: `1px solid ${C.border}`, background: '#f8fafc',
};
const td: React.CSSProperties = {
  padding: '8px 8px', color: C.text, verticalAlign: 'top',
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', borderRadius: 10,
  background: C.primary, color: '#fff', border: 'none',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 14px', borderRadius: 10,
  background: '#fff', color: C.text, border: `1px solid ${C.border}`,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

function Chip({ active, label }: { active: boolean; label: string }) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 999, fontWeight: 600,
      background: active ? C.primarySoft : '#f1f5f9',
      color: active ? C.primaryDeep : C.muted,
      border: active ? `1px solid ${C.primary}` : `1px solid transparent`,
    }}>
      {label}
    </span>
  );
}

// 3-step numbered indicator, matched to ImportLeadsPage / ImportStudentsPage
// so all three importers share the same "Upload → Review → Import" rhythm.
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Upload file' },
    { n: 2, label: 'Review data' },
    { n: 3, label: 'Import' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, marginTop: 20 }}>
      {steps.map((s, i) => {
        const isActive = s.n === current;
        const isDone = s.n < current;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: isDone ? '#5b9a6f' : isActive ? '#2b6cb0' : '#e2e8f0',
                color: isDone || isActive ? '#fff' : '#a0aec0',
              }}
            >
              {isDone ? <FontAwesomeIcon icon={faCheck} /> : s.n}
            </div>
            <span
              style={{
                fontSize: 13, whiteSpace: 'nowrap' as const,
                fontWeight: isActive || isDone ? 600 : 400,
                color: isActive ? '#2b6cb0' : isDone ? '#5b9a6f' : '#a0aec0',
              }}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                style={{
                  height: 2, width: 32, margin: '0 8px', borderRadius: 1, flexShrink: 0,
                  background: isDone ? '#5b9a6f' : '#e2e8f0',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color ?? C.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}

void faXmark;
