import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch, faLink, faCheck, faLocationDot,
  faChalkboardUser, faUserClock, faUserCheck, faUserXmark,
  faCircleNotch, faBullseye, faHeart,
  faBook, faUser, faGraduationCap, faQuestion,
  faSackDollar, faPhone,
  faStar, faInbox, faListCheck, faArrowUpWideShort, faTriangleExclamation,
  faExclamation, faFilter, faXmark, faCircleInfo, faArrowLeft, faArrowRight, faChevronLeft, faChevronRight,
  faFileLines, faCalendarDays, faEllipsisVertical, faNoteSticky, faPaperPlane, faClock,
  faList, faIdCard, faBolt, faScaleBalanced, faPen, faArrowRotateLeft, faBullhorn, faTrash, faArrowsRotate,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { CommuteTime } from '../types/index.js';
import {
  fetchCandidates, fetchCandidateStats, fetchCandidatePhoneIndex, deleteCandidate, fetchCandidateFormOptions,
  updateCandidate, downloadCandidateResume, fetchUpcomingInterviews,
  scheduleCandidateInterview,
} from '../api/candidates.js';
import { fetchUpcomingAppointments } from '../api/leads.js';
import { fetchSettings } from '../api/settings.js';

// Interview WhatsApp template placeholder resolver. Template strings come
// from settings.interview_wa_template / interview_wa_template_zh (seeded
// via scripts/seed.js). No hardcoded fallback here — if the setting is
// missing, the preview surfaces that state so the admin can seed it.
function applyInterviewTemplate(
  template: string,
  candidate: Candidate,
  start: Date,
  end: Date,
  isZh = false,
  /** Calendar-day offset for the {{confirmByDate}} placeholder — set
   *  from the `recruitment_interview_confirm_lead_days` system setting.
   *  Falls back to 2 when the setting is missing / not-yet-loaded. */
  confirmLeadDays = 2,
): string {
  const first = (candidate.fullName || '').trim().split(/\s+/)[0] || '';
  const position = candidate.desiredPosition ?? '';
  const locale = isZh ? 'zh-CN' : 'en-US';
  const day = start.toLocaleDateString(locale, { weekday: 'long' });
  const dateLocale = isZh ? 'zh-CN' : 'en-GB';
  const date = start.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  // Confirm-by = today + N calendar days, capped at the interview
  // date — a deadline that lands after the interview is nonsense. If
  // today+N would fall on or after the interview date, use the
  // interview date itself so the message reads "confirm before <day
  // of interview>" instead of "confirm after your interview already
  // happened".
  const confirmBy = new Date();
  confirmBy.setDate(confirmBy.getDate() + Math.max(1, confirmLeadDays));
  const startMidnight = new Date(start);
  startMidnight.setHours(0, 0, 0, 0);
  if (confirmBy >= startMidnight) confirmBy.setTime(startMidnight.getTime());
  const confirmByStr = confirmBy.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
  return template
    .replace(/\{\{candidateName\}\}/g, candidate.fullName ?? '')
    .replace(/\{\{firstName\}\}/g, first)
    .replace(/\{\{position\}\}/g, position)
    .replace(/\{\{positionSuffix\}\}/g,
      position ? (isZh ? `${position}职位` : ` for the ${position} role`) : '')
    .replace(/\{\{interviewDay\}\}/g, day)
    .replace(/\{\{interviewDate\}\}/g, date)
    .replace(/\{\{interviewTime\}\}/g, time)
    .replace(/\{\{interviewEndTime\}\}/g, endTime)
    .replace(/\{\{confirmByDate\}\}/g, confirmByStr);
}

// Offer WhatsApp template placeholders — resolves the message sent when
// moving a candidate PENDING_DECISION → OFFER_SENT. Sources: candidate's
// desired position, preferred start date, and expected salary
// (admin-editable in the modal before sending).
function applyOfferTemplate(
  template: string,
  candidate: Candidate,
  salary: number,
  startDate: string | null,
  isZh = false,
): string {
  const first = (candidate.fullName || '').trim().split(/\s+/)[0] || '';
  const position = candidate.desiredPosition ?? '';
  const dateLocale = isZh ? 'zh-CN' : 'en-GB';
  const startStr = startDate
    ? new Date(startDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
    : (isZh ? '待定' : 'to be discussed');
  return template
    .replace(/\{\{candidateName\}\}/g, candidate.fullName ?? '')
    .replace(/\{\{firstName\}\}/g, first)
    .replace(/\{\{position\}\}/g, position)
    .replace(/\{\{positionSuffix\}\}/g,
      position ? (isZh ? `${position}职位` : ` for the ${position} role`) : '')
    .replace(/\{\{startDate\}\}/g, startStr)
    .replace(/\{\{salary\}\}/g, salary.toLocaleString());
}
import { Candidate, CandidateStatus } from '../types/index.js';
import { useToast } from '../components/common/Toast.js';
import DeleteDialog from '../components/common/DeleteDialog.js';
import ConfirmDialog from '../components/common/ConfirmDialog.js';
import { CandidateQuickViewModal } from './candidates/CandidateQuickViewModal.js';

// Design tokens — refined palette + subtle shadow scale for a
// Linear/Ashby-style admin surface. Keeping the token names existing
// styles reference; only swapping the values where the change is subtle.
const C = {
  bg: '#f7f8fa',
  bgSoft: '#fafbfc',
  surface: '#ffffff',
  text: '#0f172a',
  textSub: '#3f4b5c',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  border: '#e5e7ec',
  borderSoft: '#eff0f4',
  // Slightly deeper indigo — reads as "product primary", not "brand
  // pastel". PrimaryHover for interactive states.
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  primaryDeep: '#3730a3',
  primarySoft: '#eef2ff',
  primarySofter: '#f5f7ff',
  success: '#059669',
  successSoft: '#ecfdf5',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  gold: '#b45309',
  goldSoft: '#fef3c7',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  info: '#0284c7',
  infoSoft: '#f0f9ff',
};

const SHADOW = {
  sm: '0 1px 2px rgba(15,23,42,0.04)',
  md: '0 4px 12px rgba(15,23,42,0.06)',
  lg: '0 12px 32px rgba(15,23,42,0.08)',
  focus: '0 0 0 3px rgba(79,70,229,0.15)',
};

/** Builds a wa.me URL from any phone shape. Strips non-digits and, if
 *  the caller wrote a local Malaysian number (starting with '0'),
 *  swaps the leading 0 for '60'. */
function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? `60${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

// ── Flag computation ────────────────────────────────────────────────────────
// Server-side "attention markers" so the admin sees at-a-glance signals
// they'd otherwise have to compute in their head: candidates asking above
// the band, candidates underpricing themselves, long-commute risks.
//
// Thresholds are ±20% around the position's published band, which is wide
// enough to avoid false positives on candidates who name a slightly-over
// number as an anchor.
type FlagKey = 'ABOVE_BAND' | 'UNDER_BAND' | 'LONG_COMMUTE';
interface Flag { key: FlagKey; level: 'red' | 'yellow'; label: string; detail: string }

/** Canonical phone key for cross-record matching. Strips non-digits,
 *  drops a leading `60` country code or `0` national prefix so
 *  `+60 12 345 6789`, `6012 345 6789`, and `012-3456789` all collapse
 *  to the same string. Used to flag repeat applicants — same phone,
 *  multiple submissions. Returns '' when there's nothing usable. */
function phoneKey(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('60')) return digits.slice(2);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/** "3+ years" bucket matcher — used by UNDER_BAND so we don't tag a
 *  fresh SPM graduate asking below the band as "underpricing themselves." */
const isExperiencedRange = (r: string | null): boolean => {
  if (!r) return false;
  const s = r.toLowerCase();
  return s.includes('3') || s.includes('5') || s.includes('more');
};

/** Normalises a human-readable label into a URL-safe utm_source
 *  value. "Facebook Ads" → "facebook_ads", "小红书" → "小红书" (kept
 *  as-is), spaces / punctuation collapsed to underscores. */
function toUtmSlug(label: string): string {
  return String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '_')  // preserve CJK
    .replace(/^_+|_+$/g, '');
}

function computeFlags(c: Candidate, positions: { name: string; minSalary: number | null; maxSalary: number | null }[]): Flag[] {
  const flags: Flag[] = [];
  const band = c.desiredPosition ? positions.find(p => p.name === c.desiredPosition) : null;

  if (c.expectedSalary != null && band?.maxSalary != null && band.maxSalary > 0) {
    if (c.expectedSalary > band.maxSalary * 1.2) {
      flags.push({
        key: 'ABOVE_BAND', level: 'red',
        label: 'Above band',
        detail: `Asking RM ${c.expectedSalary.toLocaleString()} vs band max RM ${band.maxSalary.toLocaleString()}.`,
      });
    }
  }
  if (c.expectedSalary != null && band?.minSalary != null && band.minSalary > 0
      && isExperiencedRange(c.experienceRange)) {
    if (c.expectedSalary < band.minSalary * 0.8) {
      flags.push({
        key: 'UNDER_BAND', level: 'yellow',
        label: 'Underpricing self',
        detail: `Asking RM ${c.expectedSalary.toLocaleString()} with 3+ years experience vs band min RM ${band.minSalary.toLocaleString()}. Cheap interview.`,
      });
    }
  }
  if (c.commuteTime === 'OVER_60') {
    flags.push({
      key: 'LONG_COMMUTE', level: 'yellow',
      label: 'Long commute',
      detail: 'Commute > 1 hour and not marked "will move closer". Retention risk.',
    });
  }
  return flags;
}

const STATUS_META: Record<CandidateStatus, { label: string; bg: string; fg: string; icon: any }> = {
  NEW:          { label: 'New',          bg: C.infoSoft,    fg: C.info,    icon: faUserClock },
  CONTACTED:        { label: 'Contacted',    bg: C.primarySoft, fg: C.primaryDeep, icon: faPhone },
  INTERVIEWING:     { label: 'Interviewing', bg: C.warningSoft, fg: C.warning, icon: faChalkboardUser },
  PENDING_DECISION: { label: 'Deciding',     bg: '#f5f3ff',      fg: '#6d28d9', icon: faCircleInfo },
  OFFER_SENT:       { label: 'Offer sent',   bg: '#fef3c7',      fg: '#a16207', icon: faPaperPlane },
  HIRED:            { label: 'Hired',        bg: C.successSoft, fg: C.success, icon: faUserCheck },
  REJECTED:         { label: 'Rejected',     bg: C.dangerSoft,  fg: C.danger,  icon: faUserXmark },
};

// Sentinel rejection reasons — kept as constants so the terminal-status
// derivation isn't smeared across the codebase as stringly-typed
// comparisons. Every reason variant needs a matching branch in
// `terminalStatusMeta` below.
const DECLINED_OFFER_REASON = 'Candidate declined the offer.';
const NO_SHOW_REASON = 'Candidate did not attend the interview.';
// Pre-offer withdrawal — candidate said no before we made a formal
// offer (e.g. accepted another job, changed mind about applying).
// Distinct from DECLINED_OFFER_REASON so the terminal-status pill can
// tell "they walked away early" apart from "they turned down our offer".
const WITHDREW_REASON = 'Candidate withdrew from consideration.';

// System-pinned quick-reject reason. Used as the default when rejecting
// a NEW candidate straight out of the inbox review card — the reviewer
// hasn't done a full screen so a specific reason isn't warranted, this
// is the "screening-pass fail" catch-all.
const NOT_SUITABLE_REASON = 'Not suitable';

// Preset rejection reasons shown in the Reject modal — HR-picked in one
// click, plus "Others" for a free-text override. Kept front-end only for
// now; if the org wants to configure them per-tenant later, move to
// settings.candidate_rejection_reasons.
const REJECTION_REASONS = [
  NOT_SUITABLE_REASON,
  'Not qualified — experience / qualification too low',
  'Not qualified — salary expectation too high',
  'Poor fit — mismatch with role or culture',
  'Weak screening answers',
  'Hired someone else',
  'Communication issues',
];

// Terminal-tab status column derivation — Hired, Rejected, Declined
// offer, or No-show. The rejection variants are flagged by the sentinel
// reason string set at the mutation site.
function terminalStatusMeta(c: Candidate): { label: string; bg: string; fg: string; icon: any } {
  if (c.status === 'HIRED') return STATUS_META.HIRED;
  if (c.status === 'REJECTED' && c.rejectionReason === DECLINED_OFFER_REASON) {
    return { label: 'Declined offer', bg: '#fef3c7', fg: '#a16207', icon: faPaperPlane };
  }
  if (c.status === 'REJECTED' && c.rejectionReason === NO_SHOW_REASON) {
    return { label: 'No-show', bg: '#f1f5f9', fg: C.muted, icon: faUserClock };
  }
  if (c.status === 'REJECTED' && c.rejectionReason === WITHDREW_REASON) {
    return { label: 'Withdrew', bg: '#fef3c7', fg: '#b45309', icon: faXmark };
  }
  if (c.status === 'REJECTED') return STATUS_META.REJECTED;
  return STATUS_META[c.status];
}


// Qualification → icon + colour mapping for the front-of-row medallion.
// Case-insensitive prefix match so admin-edited labels still resolve
// (e.g. "SPM / O-Level" and "SPM" both hit the SPM tile).
const QUAL_STYLES = {
  spm:      { icon: faUser,           bg: '#f1f5f9',     fg: '#64748b',      name: 'SPM' },
  diploma:  { icon: faBook,           bg: C.primarySoft, fg: C.primaryDeep,  name: 'Diploma' },
  bachelor: { icon: faGraduationCap,  bg: C.successSoft, fg: C.success,      name: "Bachelor's" },
  others:   { icon: faQuestion,       bg: C.warningSoft, fg: C.warning,      name: 'Others' },
  none:     { icon: faQuestion,       bg: '#f8fafc',     fg: '#94a3b8',      name: 'Not specified' },
} as const;
type QualKey = keyof typeof QUAL_STYLES;

function qualKey(qual: string | null): QualKey {
  if (!qual) return 'none';
  const s = qual.toLowerCase();
  if (s.includes('spm') || s.includes('o level') || s.includes('o-level')) return 'spm';
  if (s.includes('diploma') || s.includes('stpm') || s.includes('uec') || s.includes('a level') || s.includes('a-level')) return 'diploma';
  if (s.includes('bachelor') || s.includes('degree')) return 'bachelor';
  return 'others';
}

const COMMUTE_LABEL: Record<CommuteTime, string> = {
  UNDER_15:  '< 15 min',
  MIN_15_30: '15 – 30 min',
  MIN_30_45: '30 – 45 min',
  MIN_45_60: '45 – 60 min',
  OVER_60:   '> 1 hr',
  WILL_MOVE: 'Will move',
};

/** Best-effort display casing for a candidate's fullName. Historical
 *  imports + a few Google Form submissions arrive in ALL CAPS which
 *  reads as SHOUTING in the UI. If the string has no lowercase letters
 *  at all, title-case it (each word's first letter capitalised, rest
 *  lowered). Otherwise the name is left untouched — mixed-case entries
 *  reflect deliberate typing (e.g. "A/P Ravi" initialism) and we don't
 *  want to steamroll them. */
function displayName(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  // If there's any lowercase letter, leave it alone.
  if (/[a-z]/.test(trimmed)) return trimmed;
  return trimmed
    .toLowerCase()
    .split(/(\s+)/) // keep whitespace runs so multi-space stays intact
    .map(chunk => {
      if (/^\s+$/.test(chunk) || chunk.length === 0) return chunk;
      // Handle A/P, S/O, D/O style initialisms verbatim — uppercase
      // the whole token if it's short and slash-delimited.
      if (/^[a-z]\/[a-z]$/i.test(chunk)) return chunk.toUpperCase();
      return chunk.charAt(0).toUpperCase() + chunk.slice(1);
    })
    .join('');
}

/** Whole-year age from an ISO date-of-birth. */
function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

// Interview-tab time bucketing. Groups candidates by when their
// interview is scheduled: today (bordered/prominent), this week
// (Mon–Sun of the current calendar week, minus today), later, and
// no-date (INTERVIEWING rows without an interviewStart — e.g.
// imported without an Appointment column).
type InterviewBucket = 'past' | 'today' | 'this-week' | 'later' | 'no-date';
function interviewBucket(iso: string | null): InterviewBucket {
  if (!iso) return 'no-date';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'no-date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  // Monday of the current calendar week — JS Sunday=0, so shift.
  const startOfWeek = new Date(today);
  const dow = (today.getDay() + 6) % 7; // 0 = Mon
  startOfWeek.setDate(today.getDate() - dow);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7); // exclusive
  if (d < today) return 'past';
  if (d < tomorrow) return 'today';
  if (d < endOfWeek) return 'this-week';
  return 'later';
}
const INTERVIEW_BUCKET_LABEL: Record<InterviewBucket, string> = {
  past: 'Overdue — mark outcome',
  today: 'Today',
  'this-week': 'This week',
  later: 'Later',
  'no-date': 'No date set',
};
// Overdue comes first — those rows need attention before anything else.
const INTERVIEW_BUCKET_ORDER: InterviewBucket[] = ['past', 'today', 'this-week', 'later', 'no-date'];
// Per-bucket colour tokens (accent bar + subtle bg tint + text). Past
// uses danger red so "you owe an outcome" reads at a glance. Today
// gets the app's indigo primary. This week is sky. Later steps down to
// muted slate. No-date renders in amber for imported rows without a slot.
const INTERVIEW_BUCKET_STYLE: Record<InterviewBucket, { accent: string; tint: string; text: string }> = {
  'past':      { accent: '#dc2626', tint: '#fef2f2', text: '#991b1b' },
  'today':     { accent: '#5a67d8', tint: '#eef2ff', text: '#3c339a' },
  'this-week': { accent: '#0ea5e9', tint: '#f0f9ff', text: '#0369a1' },
  'later':     { accent: '#94a3b8', tint: '#f8fafc', text: '#475569' },
  'no-date':   { accent: '#d97706', tint: '#fffbeb', text: '#92400e' },
};
// Contextual date subtitle for each header — anchors abstract labels
// against a real calendar date so there's no ambiguity.
function interviewBucketSubtitle(bucket: InterviewBucket): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  if (bucket === 'past') return 'Interview date has passed — attended or no-show?';
  if (bucket === 'today') return fmt(today);
  if (bucket === 'this-week') {
    const endOfWeek = new Date(today);
    const dow = (today.getDay() + 6) % 7;
    endOfWeek.setDate(today.getDate() + (6 - dow));
    return `through ${fmt(endOfWeek)}`;
  }
  if (bucket === 'later') {
    const nextMon = new Date(today);
    const dow = (today.getDay() + 6) % 7;
    nextMon.setDate(today.getDate() + (7 - dow));
    return `from ${fmt(nextMon)}`;
  }
  return 'No appointment on record';
}

/** How long since an application was submitted, in the most compact form
 *  ("5m" / "3h" / "2d" / "1w"). Also returns an urgency level so the
 *  sidebar can colour aged candidates — anything past 3 days probably
 *  deserves an eye. */
type WaitLevel = 'fresh' | 'ok' | 'warn' | 'overdue';
function waitingSince(iso: string): { text: string; level: WaitLevel } {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return { text: '—', level: 'ok' };
  const ms = Date.now() - then;
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);
  const weeks = Math.floor(days / 7);
  let text: string;
  if      (minutes < 1)   text = 'now';
  else if (minutes < 60)  text = `${minutes}m`;
  else if (hours < 24)    text = `${hours}h`;
  else if (days < 14)     text = `${days}d`;
  else                    text = `${weeks}w`;
  const level: WaitLevel =
    days >= 7 ? 'overdue' :
    days >= 3 ? 'warn'    :
    days >= 1 ? 'ok'      :
                'fresh';
  return { text, level };
}

export default function CandidatesPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();

  // Single-mode pipeline. Every stage (NEW → CONTACTED → INTERVIEWING →
  // HIRED / REJECTED) is a sub-tab; "closed" is a convenience for
  // hired + rejected together.
  const [tab, setTab] = useState<'NEW' | 'CONTACTED' | 'INTERVIEWING' | 'PENDING_DECISION' | 'OFFER_SENT' | 'HIRED' | 'REJECTED' | 'closed'>('NEW');

  const [search, setSearch] = useState('');
  const [desiredPosition, setDesiredPosition] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  // Small popover for the apply-link picker: lists the admin-managed
  // referral sources. Each option copies /apply?utm_source=<slug>
  // where slug is derived from the source's label.
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const linkMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!linkMenuOpen) return;
    const onClickAway = (e: MouseEvent) => {
      if (linkMenuRef.current && !linkMenuRef.current.contains(e.target as Node)) {
        setLinkMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [linkMenuOpen]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Candidate | null>(null);
  const [schedulingCandidate, setSchedulingCandidate] = useState<Candidate | null>(null);
  // Per-row overflow menu (kebab). Menu is rendered as a fixed-positioned
  // overlay from the trigger's bounding rect so it isn't clipped by the
  // table's `overflow: hidden` wrapper.
  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  // Note editor modal target — null when closed.
  const [notingCandidate, setNotingCandidate] = useState<Candidate | null>(null);
  // Reject modal — collects a reason + optional note before setting the
  // candidate to REJECTED. Used from the Deciding stage where a plain
  // one-click reject would lose important context.
  const [rejectingCandidate, setRejectingCandidate] = useState<Candidate | null>(null);
  // Modal for the "Send offer" action — collects final salary/start date,
  // previews the WhatsApp message, saves the candidate as OFFER_SENT and
  // (optionally) fires WhatsApp with the offer text.
  const [offeringCandidate, setOfferingCandidate] = useState<Candidate | null>(null);
  // Confirm-interview modal — opened from the CONTACTED row primary CTA.
  // Shows the interview slot + a WhatsApp confirmation-message preview so
  // the admin can send the "your interview is confirmed for X at Y" note
  // and move the candidate to INTERVIEWING in one flow.
  const [confirmingCandidate, setConfirmingCandidate] = useState<Candidate | null>(null);

  // Advanced filters — all client-side. Kept as sets/booleans so the
  // filter-chip row can toggle values without heavy state juggling.
  const [experienceFilter, setExperienceFilter] = useState<Set<string>>(new Set());
  const [qualFilter, setQualFilter] = useState<Set<QualKey>>(new Set());
  const [maxSalary, setMaxSalary] = useState<string>('');
  const [shortCommute, setShortCommute] = useState<boolean>(false);
  const [shortlistedOnly, setShortlistedOnly] = useState<boolean>(false);
  // Rejection-reason subsets — useful on Rejected / All-closed after a
  // bulk import lands hundreds of rows at once. Sentinels kept in sync
  // with REJECTION_SENTINELS in ImportCandidatesPage.
  const [noShowOnly, setNoShowOnly] = useState<boolean>(false);
  const [declinedOfferOnly, setDeclinedOfferOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'salary_asc' | 'salary_desc' | 'name_asc'>('newest');
  // Client-side pagination for the terminal tabs (Hired / Rejected /
  // All closed) — those lists grow indefinitely as hires and rejections
  // accumulate (a bulk import can drop 800 rows at once), so they need
  // paging. Active-pipeline tabs stay unpaginated because their volumes
  // are naturally bounded.
  const CLOSED_PAGE_SIZE = 10;
  const [closedPage, setClosedPage] = useState(1);
  // Two view modes: 'list' (spreadsheet-style rows) and 'card' (sidebar
  // queue + expanded card + decision bar). Card view defaults on the NEW
  // tab because that's where triage happens; on other tabs list is the
  // more useful default. The admin can toggle either direction via the
  // switch in the toolbar.
  const [viewMode, setViewMode] = useState<'list' | 'card'>(tab === 'NEW' ? 'card' : 'list');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Snap viewMode back to the tab's default whenever the tab changes:
  // NEW → card (triage flow), everything else → list. The user can still
  // toggle within a tab, but switching tabs resets the default.
  useEffect(() => {
    setViewMode(tab === 'NEW' ? 'card' : 'list');
  }, [tab]);

  // Reset closed-tab pagination whenever anything upstream could change
  // the filtered list length. Otherwise page 5 might land on nothing
  // after a filter shrinks the list to 12 items.
  useEffect(() => {
    setClosedPage(1);
  }, [tab, search, desiredPosition, experienceFilter, qualFilter, maxSalary, shortCommute, shortlistedOnly, noShowOnly, declinedOfferOnly, sortBy]);


  // Focused review view — sidebar + card + decision bar interface.
  // Snapshotted queue so mutations don't reshuffle candidates mid-review;
  // session sets track outcomes so the sidebar can show ✓ / ⭐ / ✕.
  const reviewOpen = viewMode === 'card';
  const [queueSnapshot, setQueueSnapshot] = useState<Candidate[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [sessionActioned, setSessionActioned] = useState<Set<string>>(new Set());
  const [sessionShortlisted, setSessionShortlisted] = useState<Set<string>>(new Set());
  const [sessionRejected, setSessionRejected] = useState<Set<string>>(new Set());

  // Same public list candidates see on the apply form — keeps the admin
  // filter aligned with the dropdown that produced the data.
  const { data: formOptions } = useQuery({
    queryKey: ['candidate-form-options'],
    queryFn: fetchCandidateFormOptions,
  });
  const positions = formOptions?.positions ?? [];

  const { data: stats } = useQuery({
    queryKey: ['candidate-stats'],
    queryFn: fetchCandidateStats,
    refetchInterval: 60_000,
  });

  const { data: list, isLoading } = useQuery({
    queryKey: ['candidates', tab, search, desiredPosition],
    queryFn: () => fetchCandidates({
      status: tab as any,
      search: search || undefined,
      desiredPosition: desiredPosition || undefined,
      pageSize: 2000,
    }),
    // Poll every minute so applications arriving via the Google Form
    // bridge (or any other background source) surface without the
    // admin needing to switch tabs or refresh.
    refetchInterval: 60_000,
  });

  const rawItems = list?.items ?? [];

  // Cross-tab phone index so the repeat-applicant flag surfaces on
  // NEW even when the prior applications sit in Rejected. Backend
  // returns a raw phone array; we normalise + count here.
  const { data: phoneIndex } = useQuery({
    queryKey: ['candidate-phone-index'],
    queryFn: fetchCandidatePhoneIndex,
    refetchInterval: 60_000,
  });

  // ── Right context panel data ─────────────────────────────────────
  // Three feeds keep the panel usable independent of which tab the
  // admin is currently viewing.
  const { data: upcomingInterviewsFeed = [] } = useQuery({
    queryKey: ['upcoming-interviews'],
    queryFn: fetchUpcomingInterviews,
    refetchInterval: 60_000,
  });
  // Deciding — candidates who've been interviewed and are now awaiting
  // hire/reject. Kept in a dedicated fetch so it works regardless of
  // the active tab / filters.
  const { data: decidingList } = useQuery({
    queryKey: ['candidates-pending-decision'],
    queryFn: () => fetchCandidates({ status: 'PENDING_DECISION', pageSize: 100 }),
    refetchInterval: 60_000,
  });
  // Offer sent — candidates who received an offer and haven't responded.
  // Actionable: might need a follow-up nudge if too much time passed.
  const { data: offerSentList } = useQuery({
    queryKey: ['candidates-offer-sent'],
    queryFn: () => fetchCandidates({ status: 'OFFER_SENT', pageSize: 100 }),
    refetchInterval: 60_000,
  });
  const decidingCandidates = decidingList?.items ?? [];
  const offerSentCandidates = offerSentList?.items ?? [];

  // Any status change / delete / schedule etc. affects multiple
  // candidate feeds — the main list, the top-tab counts, the phone
  // index for repeat detection, upcoming interviews, and the two
  // context-panel status lists. Centralise the invalidation so
  // mutation sites don't drift and the right panel stays in sync
  // with the main list.
  const invalidateCandidateFeeds = () => {
    qc.invalidateQueries({ queryKey: ['candidates'] });
    qc.invalidateQueries({ queryKey: ['candidate-stats'] });
    qc.invalidateQueries({ queryKey: ['candidate-phone-index'] });
    qc.invalidateQueries({ queryKey: ['upcoming-interviews'] });
    qc.invalidateQueries({ queryKey: ['candidates-pending-decision'] });
    qc.invalidateQueries({ queryKey: ['candidates-offer-sent'] });
  };

  // Panel expand + tab state. Persisted through the session (not to
  // localStorage) so it re-opens where the admin left off.
  const [ctxPanelExpanded, setCtxPanelExpanded] = useState<boolean>(true);
  const [ctxPanelTab, setCtxPanelTab] = useState<'interviews' | 'deciding' | 'offered'>('interviews');
  // When a panel row is clicked we highlight the candidate briefly in
  // the main list so the admin can spot it. Timer clears after a beat.
  const [highlightCandidateId, setHighlightCandidateId] = useState<string | null>(null);
  useEffect(() => {
    if (!highlightCandidateId) return;
    const t = setTimeout(() => setHighlightCandidateId(null), 2500);
    return () => clearTimeout(t);
  }, [highlightCandidateId]);
  const jumpToCandidate = (c: Candidate) => {
    // Move to the tab that houses this candidate's status so the row
    // actually renders; the highlight effect then draws attention.
    const targetTab =
      c.status === 'PENDING_DECISION' ? 'PENDING_DECISION' :
      c.status === 'CONTACTED' ? 'CONTACTED' :
      c.status === 'INTERVIEWING' ? 'INTERVIEWING' :
      c.status;
    setTab(targetTab as typeof tab);
    setViewMode('list');
    setHighlightCandidateId(c.id);
    // Small delay so the row exists in the DOM by the time we scroll.
    setTimeout(() => {
      const el = document.querySelector(`[data-candidate-id="${c.id}"]`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 200);
  };
  const dupeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of (phoneIndex ?? [])) {
      const key = phoneKey(p);
      if (!key) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [phoneIndex]);
  const repeatCountFor = (c: Candidate) => dupeCounts.get(phoneKey(c.phone)) ?? 1;

  // Client-side filter + sort. All new advanced filters live here so the
  // backend stays simple. Positions are memoised through `formOptions`.
  const items = useMemo(() => {
    const maxSal = maxSalary ? Number(maxSalary) : null;
    let out = rawItems.filter(c => {
      // NEW tab is triage — the moment an interview has been scheduled
      // the candidate is out of triage (they now belong on Contacted /
      // Interview). Defensive filter for cases where the row's status
      // hasn't caught up to its interviewStart yet.
      if (tab === 'NEW' && c.interviewStart) return false;
      if (shortlistedOnly && !c.isShortlisted) return false;
      // No-show sentinel written by the bulk importer when a row's
      // "Didn't Attend" column is truthy — keep in sync with
      // REJECTION_SENTINELS in ImportCandidatesPage.
      if (noShowOnly && (c.status !== 'REJECTED' || c.rejectionReason !== 'Candidate did not attend the interview.')) return false;
      if (declinedOfferOnly && (c.status !== 'REJECTED' || c.rejectionReason !== 'Candidate declined the offer.')) return false;
      if (experienceFilter.size > 0 && (!c.experienceRange || !experienceFilter.has(c.experienceRange))) return false;
      if (qualFilter.size > 0 && !qualFilter.has(qualKey(c.qualification))) return false;
      if (maxSal != null && (c.expectedSalary == null || c.expectedSalary > maxSal)) return false;
      // "Short commute" = the two lowest buckets or "will move closer".
      if (shortCommute) {
        const ok = c.commuteTime === 'UNDER_15' || c.commuteTime === 'MIN_15_30' || c.commuteTime === 'WILL_MOVE';
        if (!ok) return false;
      }
      return true;
    });
    // Sort
    const byDate = (a: Candidate, b: Candidate) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    if (tab === 'INTERVIEWING') {
      // On the Interview tab we group by interviewStart bucket, so the
      // underlying sort has to be bucket-then-time-ascending; the
      // sortBy selector doesn't apply here (it's about applications,
      // not scheduled slots).
      const bucketRank = (c: Candidate) => INTERVIEW_BUCKET_ORDER.indexOf(interviewBucket(c.interviewStart));
      const timeOf = (c: Candidate) => c.interviewStart ? new Date(c.interviewStart).getTime() : Infinity;
      out = out.sort((a, b) => bucketRank(a) - bucketRank(b) || timeOf(a) - timeOf(b));
    }
    else if (sortBy === 'newest') out = out.sort(byDate);
    else if (sortBy === 'oldest') out = out.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    else if (sortBy === 'salary_asc') out = out.sort((a, b) => (a.expectedSalary ?? Infinity) - (b.expectedSalary ?? Infinity));
    else if (sortBy === 'salary_desc') out = out.sort((a, b) => (b.expectedSalary ?? -Infinity) - (a.expectedSalary ?? -Infinity));
    else if (sortBy === 'name_asc') out = out.sort((a, b) => a.fullName.localeCompare(b.fullName));
    // Shortlisted candidates stay in the user's chosen sort order.
    // The star is a visual marker + a filter chip ("Shortlisted only"),
    // not a resort trigger — clicking it shouldn't shuffle the list
    // under the admin's cursor.
    return out;
  }, [rawItems, shortlistedOnly, noShowOnly, declinedOfferOnly, experienceFilter, qualFilter, maxSalary, shortCommute, sortBy, tab]);

  // Terminal tabs — the list swaps its "Scheduled" column for a
  // "Status" column since scheduling is irrelevant once the candidate
  // is closed out; the outcome (Hired / Rejected / Declined offer) is
  // the useful column at that point.
  const isTerminalTab = tab === 'HIRED' || tab === 'REJECTED' || tab === 'closed';

  // Paginate the terminal tabs — a bulk import can drop hundreds of
  // rows onto Rejected in one go, and rendering that unpaginated melts
  // both the DOM and the eye. Active-pipeline tabs stay unpaginated.
  const showClosedPagination = isTerminalTab && items.length > CLOSED_PAGE_SIZE;
  const closedTotalPages = showClosedPagination
    ? Math.max(1, Math.ceil(items.length / CLOSED_PAGE_SIZE))
    : 1;
  const closedPageClamped = Math.min(closedPage, closedTotalPages);
  const displayItems = showClosedPagination
    ? items.slice((closedPageClamped - 1) * CLOSED_PAGE_SIZE, closedPageClamped * CLOSED_PAGE_SIZE)
    : items;

  const counts = stats?.counts;
  const closedTotal = counts ? counts.HIRED + counts.REJECTED : 0;
  const activeFilterCount =
    (experienceFilter.size > 0 ? 1 : 0)
    + (qualFilter.size > 0 ? 1 : 0)
    + (maxSalary ? 1 : 0)
    + (shortCommute ? 1 : 0)
    + (shortlistedOnly ? 1 : 0)
    + (noShowOnly ? 1 : 0)
    + (declinedOfferOnly ? 1 : 0);

  const delMut = useMutation({
    mutationFn: deleteCandidate,
    onSuccess: () => {
      showToast('Candidate removed');
      invalidateCandidateFeeds();
      setDeleteTarget(null);
    },
    onError: (e: any) => showToast(e?.message ?? 'Delete failed', 'error'),
  });

  // Reopen a terminal candidate — bounces them back to NEW and wipes
  // the terminal fields (rejectionReason / hiredAt). Meant as a recovery
  // path for accidental Reject / Hire clicks.
  const reopenMut = useMutation({
    mutationFn: (id: string) => updateCandidate(id, {
      status: 'NEW',
      rejectionReason: null,
      hiredAt: null,
    }),
    onSuccess: () => {
      showToast('Candidate reopened to New');
      invalidateCandidateFeeds();
      setReopenTarget(null);
    },
    onError: (e: any) => showToast(e?.message ?? 'Reopen failed', 'error'),
  });

  // Toggle the shortlist star on a candidate. Optimistic-lite: we just
  // invalidate afterwards so the star flips within a network round-trip.
  const shortlistMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      updateCandidate(id, { isShortlisted: next }),
    onSuccess: () => {
      invalidateCandidateFeeds();
    },
    onError: (e: any) => showToast(e?.message ?? 'Failed to update shortlist', 'error'),
  });

  // Move a candidate straight to CONTACTED (Inbox one-click action).
  const contactMut = useMutation({
    mutationFn: (id: string) => updateCandidate(id, { status: 'CONTACTED' }),
    onSuccess: () => {
      showToast('Moved to Contacted');
      invalidateCandidateFeeds();
    },
    onError: (e: any) => showToast(e?.message ?? 'Update failed', 'error'),
  });

  // Generic pipeline advance — used by "Mark confirmed" (CONTACTED →
  // INTERVIEWING) and "Mark interviewed" (INTERVIEWING → PENDING_DECISION).
  // The success toast is derived from the target status so we don't need
  // two near-identical mutations.
  const STAGE_LABEL: Record<string, string> = {
    INTERVIEWING: 'Interview confirmed',
    PENDING_DECISION: 'Marked interviewed',
    OFFER_SENT: 'Offer sent',
    HIRED: 'Marked hired',
  };
  const advanceStageMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CandidateStatus }) =>
      updateCandidate(id, { status }),
    onSuccess: (_data, vars) => {
      showToast(STAGE_LABEL[vars.status] ?? 'Stage updated');
      invalidateCandidateFeeds();
    },
    onError: (e: any) => showToast(e?.message ?? 'Update failed', 'error'),
  });

  // Reject a candidate from the Review card. Backend requires a reason;
  // during triage we send a generic one — admin can edit later in the
  // full modal if they want to be specific.
  const rejectMut = useMutation({
    mutationFn: (id: string) => updateCandidate(id, {
      status: 'REJECTED',
      rejectionReason: 'Not shortlisted during review.',
    }),
    onSuccess: () => {
      invalidateCandidateFeeds();
      // Backend cancels the interview + deletes the calendar event when
      // rejecting someone whose slot hasn't happened yet.
      qc.invalidateQueries({ queryKey: ['upcoming-interviews'] });
    },
    onError: (e: any) => showToast(e?.message ?? 'Reject failed', 'error'),
  });

  // Distinct from a plain reject — a "declined offer" outcome carries
  // its own reason string so the terminal-tab status column can render
  // it separately from a rejection made earlier in the pipeline.
  const declineOfferMut = useMutation({
    mutationFn: (id: string) => updateCandidate(id, {
      status: 'REJECTED',
      rejectionReason: DECLINED_OFFER_REASON,
    }),
    onSuccess: () => {
      showToast('Recorded as declined offer');
      invalidateCandidateFeeds();
    },
    onError: (e: any) => showToast(e?.message ?? 'Update failed', 'error'),
  });

  // Pre-offer withdrawal — candidate stepped away before we made a
  // formal offer. Sibling of declineOfferMut with a distinct reason so
  // the closed-tab pill can differentiate.
  const withdrewMut = useMutation({
    mutationFn: (id: string) => updateCandidate(id, {
      status: 'REJECTED',
      rejectionReason: WITHDREW_REASON,
    }),
    onSuccess: () => {
      showToast('Recorded as withdrew');
      invalidateCandidateFeeds();
    },
    onError: (e: any) => showToast(e?.message ?? 'Update failed', 'error'),
  });

  // Interview no-show — like decline offer, but for candidates who
  // never showed up to the scheduled interview. Same terminal status
  // (REJECTED) but a distinct reason string so the closed tabs can
  // render it as its own "No-show" pill.
  const noShowMut = useMutation({
    mutationFn: (id: string) => updateCandidate(id, {
      status: 'REJECTED',
      rejectionReason: NO_SHOW_REASON,
    }),
    onSuccess: () => {
      showToast('Marked as no-show');
      invalidateCandidateFeeds();
    },
    onError: (e: any) => showToast(e?.message ?? 'Update failed', 'error'),
  });

  // ── Review derived state + handlers ─────────────────────────────────
  const currentCandidate = queueSnapshot[currentIdx] ?? null;
  const canBack = currentIdx > 0;

  const goBack = () => setCurrentIdx(i => Math.max(0, i - 1));
  const goForward = () => setCurrentIdx(i => i + 1);
  const jumpTo = (idx: number) => setCurrentIdx(Math.max(0, Math.min(idx, queueSnapshot.length)));

  const markActioned = (id: string) =>
    setSessionActioned(prev => { const n = new Set(prev); n.add(id); return n; });

  const onReject = () => {
    if (!currentCandidate) return;
    // Open the shared Reject modal with "Not suitable" pre-selected —
    // the inbox review is fast triage, so the reviewer only needs to
    // hit Confirm (or override the reason) rather than pick from a
    // dropdown by default.
    setRejectingCandidate(currentCandidate);
  };
  // Shortlist is just a marker now (star in the card header) — not a
  // triage decision. Toggling doesn't mark "actioned" and doesn't advance.
  const onShortlist = () => {
    if (!currentCandidate) return;
    const id = currentCandidate.id;
    const nextValue = !currentCandidate.isShortlisted;
    shortlistMut.mutate({ id, next: nextValue });
    setQueueSnapshot(prev => prev.map(x => x.id === id ? { ...x, isShortlisted: nextValue } : x));
    setSessionShortlisted(prev => {
      const n = new Set(prev);
      if (nextValue) n.add(id); else n.delete(id);
      return n;
    });
  };
  const closeReview = () => {
    setQueueSnapshot([]);
    setCurrentIdx(0);
    setSessionActioned(new Set());
    setSessionShortlisted(new Set());
    setSessionRejected(new Set());
  };
  const restartReview = () => {
    setCurrentIdx(0);
    setSessionActioned(new Set());
    setSessionShortlisted(new Set());
    setSessionRejected(new Set());
    setQueueSnapshot([]);   // will re-snapshot from items via the effect below
  };

  // Track which tab the current snapshot was taken from. Prevents a
  // race between the tab-change reset and the async items fetch — if we
  // wiped the snapshot separately, the init effect could fail to
  // re-fill it (e.g. when items reference is stable across renders).
  // Here we take one atomic action per (tab, reviewOpen, items) tuple.
  const [snapshottedFor, setSnapshottedFor] = useState<string>('');

  // A snapshot represents the pool the reviewer is walking through.
  // Anything that changes the pool — tab, filters, sort, search, or
  // the position dropdown — invalidates it. Mutations mid-review don't
  // (they preserve the reviewer's place).
  const sessionKey = useMemo(() => [
    tab,
    search,
    desiredPosition,
    [...experienceFilter].sort().join(','),
    [...qualFilter].sort().join(','),
    maxSalary,
    shortCommute ? '1' : '0',
    shortlistedOnly ? '1' : '0',
    sortBy,
  ].join('|'), [tab, search, desiredPosition, experienceFilter, qualFilter, maxSalary, shortCommute, shortlistedOnly, noShowOnly, declinedOfferOnly, sortBy]);

  useEffect(() => {
    if (!reviewOpen) return;
    // First time this (tab + filter combo) is seen in card view, and
    // items have loaded: freeze a snapshot so mutations don't reshuffle
    // mid-review. Filter changes invalidate the snapshot so the sidebar
    // reflects the new pool.
    if (items.length > 0 && snapshottedFor !== sessionKey) {
      setQueueSnapshot(items);
      setCurrentIdx(0);
      setSessionActioned(new Set());
      setSessionShortlisted(new Set());
      setSessionRejected(new Set());
      setSnapshottedFor(sessionKey);
    }
  }, [sessionKey, reviewOpen, items, snapshottedFor]);

  // Leaving card view (switch to list, or terminal tab default) wipes
  // the session state so the next card-view visit starts fresh.
  useEffect(() => {
    if (!reviewOpen) {
      closeReview();
      setSnapshottedFor(''); // force re-snapshot when card view re-opens
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewOpen]);

  // Close any open row overflow menu on outside click / Escape / scroll.
  // (Scroll matters because the menu is position: fixed anchored to the
  // trigger's initial rect — scrolling would leave it floating.)
  useEffect(() => {
    if (!rowMenuOpenId) return;
    const close = () => { setRowMenuOpenId(null); setRowMenuAnchor(null); };
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('[data-row-menu]')) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
    };
  }, [rowMenuOpenId]);

  // Keyboard shortcuts — only when the review overlay is open.
  useEffect(() => {
    if (!reviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tagName = (e.target as HTMLElement | null)?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft')       { e.preventDefault(); if (canBack) goBack(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); if (currentCandidate) goForward(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reviewOpen, currentCandidate?.id, canBack]);

  const copyApplyLink = async (source?: string) => {
    const cleaned = toUtmSlug(source ?? '');
    const url = cleaned
      ? `${window.location.origin}/apply?utm_source=${encodeURIComponent(cleaned)}`
      : `${window.location.origin}/apply`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      showToast(cleaned ? `Link copied · tagged “${cleaned}”` : 'Apply link copied');
      setLinkMenuOpen(false);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      showToast('Could not copy link', 'error');
    }
  };
  // Referral-source list drives the picker options — reads from the
  // same public /api/candidates/form-options endpoint the apply form
  // uses, so the two surfaces can never drift. Backend handles the
  // "no DB row → use defaults" fallback. "Other" is filtered out
  // because it's a free-text sentinel, not a real channel.
  const referralSourcesForPicker = (formOptions?.referralSources ?? [])
    .filter(s => s.toLowerCase() !== 'other');

  // Right context panel docks on every view — matches how the Leads
  // page always shows its panel. Shell keeps its native `margin: 0
  // auto` centering; the panel sits in the natural right-side
  // whitespace on wide viewports so the main content stays visually
  // centered (no jarring shift-left when the panel appears).
  const showCtxPanel = true;

  return (
    <>
    <div style={S.shell}>
      {/* Row-menu hover feedback — CSS-in-JS is inline everywhere else in
          this page, but for :hover state on the dropdown items a single
          scoped stylesheet is much lighter than wiring mouseEnter/Leave
          on every menu row. */}
      <style>{`
        .kc-row-menu-item { background: transparent; transition: background 0.1s ease; }
        .kc-row-menu-item:hover:not(:disabled) { background: #eef2ff; }
        .kc-row-menu-item:focus-visible { outline: 2px solid #c7d2fe; outline-offset: -2px; background: #eef2ff; }
      `}</style>
      <div style={S.headerRow}>
        <div>
          <h1 style={S.h1}>Candidates</h1>
          <p style={S.subtitle}>Review applicants and manage your hiring pipeline.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div ref={linkMenuRef} style={{ position: 'relative' }}>
          <button style={S.linkBtn(linkCopied)} onClick={() => setLinkMenuOpen(o => !o)}>
            <FontAwesomeIcon icon={linkCopied ? faCheck : faLink} style={{ fontSize: 12 }} />
            {linkCopied ? 'Link copied' : 'Copy apply link'}
          </button>
          {linkMenuOpen && (
            <div style={S.linkPopover}>
              <div style={S.linkPopoverLabel}>Plain link</div>
              <button
                type="button"
                className="kc-row-menu-item"
                style={{ ...S.menuItemBtn, marginBottom: 4 }}
                onClick={() => copyApplyLink()}
              >
                <FontAwesomeIcon icon={faLink} fixedWidth style={{ marginRight: 8, color: '#94a3b8', fontSize: 12 }} />
                /apply
              </button>
              <div style={S.linkPopoverLabel}>
                Tracked — referral sources
              </div>
              {referralSourcesForPicker.length === 0 && (
                <div style={{ padding: '6px 10px', fontSize: 11, color: C.mutedSoft }}>
                  Add sources in Settings → Recruitment.
                </div>
              )}
              {referralSourcesForPicker.map(label => (
                <button
                  key={label}
                  type="button"
                  className="kc-row-menu-item"
                  style={S.menuItemBtn}
                  onClick={() => copyApplyLink(label)}
                >
                  <FontAwesomeIcon icon={faLink} fixedWidth style={{ marginRight: 8, color: C.primary, fontSize: 12 }} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Pipeline stage tabs — one row from NEW to Rejected. */}
      <div style={S.tabBar}>
        <TabBtn label="New"        count={counts?.NEW}              active={tab === 'NEW'}              onClick={() => setTab('NEW')} />
        <TabBtn label="Contacted"  count={counts?.CONTACTED}        active={tab === 'CONTACTED'}        onClick={() => setTab('CONTACTED')} />
        <TabBtn label="Interview"  count={counts?.INTERVIEWING}     active={tab === 'INTERVIEWING'}     onClick={() => setTab('INTERVIEWING')} />
        <TabBtn label="Deciding"   count={counts?.PENDING_DECISION} active={tab === 'PENDING_DECISION'} onClick={() => setTab('PENDING_DECISION')} />
        <TabBtn label="Offer sent" count={counts?.OFFER_SENT}       active={tab === 'OFFER_SENT'}       onClick={() => setTab('OFFER_SENT')} />
        <div style={S.tabSep} />
        <TabBtn label="Hired"      count={counts?.HIRED}        active={tab === 'HIRED'}        onClick={() => setTab('HIRED')} />
        <TabBtn label="Rejected"   count={counts?.REJECTED}     active={tab === 'REJECTED'}     onClick={() => setTab('REJECTED')} />
        <TabBtn label="All closed" count={closedTotal}          active={tab === 'closed'}       onClick={() => setTab('closed')} />
      </div>

      {/* Toolbar — search + position + filter button + sort + density */}
      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <FontAwesomeIcon icon={faSearch} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: C.muted, fontSize: 13,
          }} />
          <input
            style={S.search}
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              title="Clear search"
              aria-label="Clear search"
              style={S.searchClearBtn}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>
        <select
          style={S.select}
          value={desiredPosition}
          onChange={e => setDesiredPosition(e.target.value)}
        >
          <option value="">All positions</option>
          {positions.map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>

        <button
          onClick={() => setShowFilters(f => !f)}
          style={S.filterToggleBtn(showFilters || activeFilterCount > 0)}
        >
          <FontAwesomeIcon icon={faFilter} />
          Filters
          {activeFilterCount > 0 && <span style={S.filterCountBadge}>{activeFilterCount}</span>}
        </button>

        <select
          style={S.select}
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          title="Sort"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="salary_asc">Salary ↑</option>
          <option value="salary_desc">Salary ↓</option>
          <option value="name_asc">Name A → Z</option>
        </select>

        <div style={S.densitySwitch}>
          <button
            onClick={() => setViewMode('list')}
            style={S.densityBtn(viewMode === 'list')}
            title="List view — spreadsheet-style rows"
          >
            <FontAwesomeIcon icon={faList} />
          </button>
          <button
            onClick={() => setViewMode('card')}
            style={S.densityBtn(viewMode === 'card')}
            title="Card view — one candidate at a time with sidebar queue"
          >
            <FontAwesomeIcon icon={faIdCard} />
          </button>
        </div>

      </div>

      {/* Filter drawer — chips + quick toggles. Collapses to save vertical
          space; re-opens when the user wants to refine. */}
      {showFilters && (
        <div style={S.filterDrawer}>
          <FilterChipRow
            label="Experience"
            options={formOptions?.experienceRanges ?? []}
            selected={experienceFilter}
            onToggle={v => {
              const next = new Set(experienceFilter);
              next.has(v) ? next.delete(v) : next.add(v);
              setExperienceFilter(next);
            }}
          />
          <FilterChipRow
            label="Qualification"
            options={(['spm','diploma','bachelor','others'] as QualKey[])}
            selected={qualFilter}
            labelFor={v => QUAL_STYLES[v as QualKey].name}
            onToggle={v => {
              const next = new Set(qualFilter);
              next.has(v as QualKey) ? next.delete(v as QualKey) : next.add(v as QualKey);
              setQualFilter(next);
            }}
          />
          <div style={S.filterFlexRow}>
            <label style={S.filterInlineLabel}>Max salary (RM)</label>
            <input
              type="number"
              min={0}
              value={maxSalary}
              onChange={e => setMaxSalary(e.target.value)}
              placeholder="e.g. 2500"
              style={{ ...S.select, width: 140 }}
            />
            <label style={S.toggleChip(shortCommute)}>
              <input type="checkbox" checked={shortCommute} onChange={e => setShortCommute(e.target.checked)} style={{ display: 'none' }} />
              Commute ≤ 30 min
            </label>
            <label style={S.toggleChip(shortlistedOnly)}>
              <input type="checkbox" checked={shortlistedOnly} onChange={e => setShortlistedOnly(e.target.checked)} style={{ display: 'none' }} />
              <FontAwesomeIcon icon={faStar} /> Favourites only
            </label>
            <label style={S.toggleChip(noShowOnly)}>
              <input type="checkbox" checked={noShowOnly} onChange={e => setNoShowOnly(e.target.checked)} style={{ display: 'none' }} />
              No-show only
            </label>
            <label style={S.toggleChip(declinedOfferOnly)}>
              <input type="checkbox" checked={declinedOfferOnly} onChange={e => setDeclinedOfferOnly(e.target.checked)} style={{ display: 'none' }} />
              Declined offer only
            </label>
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setExperienceFilter(new Set());
                  setQualFilter(new Set());
                  setMaxSalary('');
                  setShortCommute(false);
                  setShortlistedOnly(false);
                  setNoShowOnly(false);
                  setDeclinedOfferOnly(false);
                }}
                style={S.clearFiltersBtn}
              >
                <FontAwesomeIcon icon={faXmark} /> Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Focused Review view ───────────────────────────────────────
          Renders IN PLACE OF the table when the NEW tab is active.
          Two-column workspace: sidebar with the session queue on the
          left, decision card + Prev/Next + sticky decision bar on the
          right. Switching tabs above returns to the normal list view. */}
      {reviewOpen && (
        <div style={S.reviewOverlay}>

          {queueSnapshot.length === 0 ? (
            // Empty state matches the list-view's shape (same outer
            // bordered surface + centered content) so the two view
            // modes feel like the same page, just different densities.
            // Loading placeholder shown while items are still fetching
            // to prevent a "Nothing to review" flash on tab switch.
            isLoading || items.length > 0 ? (
              <div style={S.tableWrap}>
                <div style={S.empty}>
                  <FontAwesomeIcon icon={faCircleNotch} spin style={{ fontSize: 20, color: C.mutedSoft }} />
                </div>
              </div>
            ) : (
              <div style={S.tableWrap}>
                <div style={S.empty}>
                  <div style={S.emptyIcon}>
                    <FontAwesomeIcon icon={faInbox} />
                  </div>
                  <div style={S.emptyTitle}>Nothing to review</div>
                  <p style={S.emptyLine}>
                    No new applications right now. When candidates apply, they'll appear here.
                  </p>
                </div>
              </div>
            )
          ) : (
            <div style={S.reviewLayout}>
              {/* ── Sidebar ── */}
              <ReviewSidebar
                items={queueSnapshot}
                currentIdx={currentIdx}
                sessionActioned={sessionActioned}
                sessionShortlisted={sessionShortlisted}
                sessionRejected={sessionRejected}
                isRepeat={c => repeatCountFor(c) > 1}
                groupByInterviewBucket={tab === 'INTERVIEWING'}
                hideScheduled={tab === 'NEW'}
                onJump={jumpTo}
              />

              {/* ── Right column: nav + card + decision bar ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                {currentCandidate ? (
                  <>
                    {/* Prev / position / Next — navigation only */}
                    <div style={S.reviewNavBar}>
                      <button
                        onClick={goBack}
                        disabled={!canBack}
                        style={S.navPillBtn(canBack)}
                        title="Previous candidate (←)"
                      >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        Previous
                      </button>
                      <span style={S.navPositionLabel}>
                        <strong style={{ color: C.text, fontWeight: 700 }}>{currentIdx + 1}</strong>
                        <span style={{ color: C.mutedSoft }}> / {queueSnapshot.length}</span>
                      </span>
                      <button
                        onClick={goForward}
                        style={S.navPillBtn(true)}
                        title="Next candidate (→)"
                      >
                        Next
                        <FontAwesomeIcon icon={faArrowRight} />
                      </button>
                    </div>

                    <InboxReviewCard
                      c={currentCandidate}
                      positions={positions}
                      repeatCount={repeatCountFor(currentCandidate)}
                      onRepeatSearch={() => {
                        // Jump to All closed and pre-fill the search
                        // bar with this candidate's phone. Matches how
                        // the admin would manually investigate a repeat
                        // — "what did we do the last few times?"
                        setTab('closed');
                        setSearch(currentCandidate.phone ?? '');
                      }}
                      onOpenModal={() => setOpenId(currentCandidate.id)}
                      onScheduleInterview={() => setSchedulingCandidate(currentCandidate)}
                      onToggleShortlist={onShortlist}
                      shortlistPending={shortlistMut.isPending}
                    />

                    {/* Sticky decision bar — stage-appropriate actions.
                        NEW uses the review-flow handlers that also mark
                        the candidate as actioned + advance the queue;
                        other stages fire the same mutations the list
                        view rows use. HIRED / REJECTED get no bar since
                        there's nothing to advance to. */}
                    {currentCandidate.status === 'NEW' && (
                      <div style={S.reviewActionBar}>
                        <button onClick={onReject} disabled={rejectMut.isPending} style={S.rejectBtn}>
                          <FontAwesomeIcon icon={faUserXmark} /> Reject
                        </button>
                        <button
                          onClick={() => setSchedulingCandidate(currentCandidate)}
                          style={S.scheduleDecisionBtn}
                        >
                          <FontAwesomeIcon icon={faCalendarDays} />
                          {currentCandidate.interviewStart ? 'Reschedule interview' : 'Schedule interview'}
                        </button>
                      </div>
                    )}
                    {currentCandidate.status === 'CONTACTED' && (
                      <div style={S.reviewActionBar}>
                        <button
                          onClick={() => setSchedulingCandidate(currentCandidate)}
                          style={S.rejectBtn}
                        >
                          <FontAwesomeIcon icon={faCalendarDays} /> Reschedule
                        </button>
                        <button
                          onClick={() => setConfirmingCandidate(currentCandidate)}
                          disabled={advanceStageMut.isPending}
                          style={S.scheduleDecisionBtn}
                        >
                          <FontAwesomeIcon icon={faCheck} /> Confirm interview
                        </button>
                      </div>
                    )}
                    {currentCandidate.status === 'INTERVIEWING' && (
                      <div style={S.reviewActionBar}>
                        <button
                          onClick={() => noShowMut.mutate(currentCandidate.id)}
                          disabled={noShowMut.isPending}
                          style={S.rejectBtn}
                        >
                          <FontAwesomeIcon icon={faUserXmark} /> Didn't attend
                        </button>
                        <button
                          onClick={() => advanceStageMut.mutate({ id: currentCandidate.id, status: 'PENDING_DECISION' })}
                          disabled={advanceStageMut.isPending}
                          style={S.scheduleDecisionBtn}
                        >
                          <FontAwesomeIcon icon={faCheck} /> Mark interviewed
                        </button>
                      </div>
                    )}
                    {currentCandidate.status === 'PENDING_DECISION' && (
                      <div style={S.reviewActionBar}>
                        <button
                          onClick={() => setRejectingCandidate(currentCandidate)}
                          style={S.rejectBtn}
                        >
                          <FontAwesomeIcon icon={faUserXmark} /> Reject
                        </button>
                        <button
                          onClick={() => setOfferingCandidate(currentCandidate)}
                          style={{ ...S.scheduleDecisionBtn, background: C.success }}
                        >
                          <FontAwesomeIcon icon={faPaperPlane} /> Send offer
                        </button>
                      </div>
                    )}
                    {currentCandidate.status === 'OFFER_SENT' && (
                      <div style={S.reviewActionBar}>
                        <button
                          onClick={() => declineOfferMut.mutate(currentCandidate.id)}
                          disabled={declineOfferMut.isPending}
                          style={S.rejectBtn}
                        >
                          <FontAwesomeIcon icon={faUserXmark} /> Declined
                        </button>
                        <button
                          onClick={() => advanceStageMut.mutate({ id: currentCandidate.id, status: 'HIRED' })}
                          disabled={advanceStageMut.isPending}
                          style={{ ...S.scheduleDecisionBtn, background: C.success }}
                        >
                          <FontAwesomeIcon icon={faUserCheck} /> Accepted
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={S.reviewDone}>
                    <div style={S.reviewDoneIcon}>
                      <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <div style={S.emptyTitle}>Reviewed everyone</div>
                    <p style={S.emptyLine}>
                      Went through all {queueSnapshot.length} candidate{queueSnapshot.length === 1 ? '' : 's'}.
                      {sessionShortlisted.size > 0 && <> Favourited {sessionShortlisted.size}.</>}
                      {sessionRejected.size > 0 && <> Rejected {sessionRejected.size}.</>}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={() => setCurrentIdx(0)} style={S.linkBtn(false)}>
                        Review again
                      </button>
                      <button onClick={restartReview} style={S.linkBtn(false)}>
                        Restart session
                      </button>
                      <button
                        onClick={() => setTab('CONTACTED')}
                        style={{ ...S.linkBtn(false), background: C.primary, color: '#fff', borderColor: C.primary }}
                      >
                        Go to Contacted
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ ...S.tableWrap, display: reviewOpen ? 'none' : undefined }}>
        {isLoading ? (
          <div style={S.empty}>
            <FontAwesomeIcon icon={faCircleNotch} spin style={{ marginRight: 8 }} />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div style={S.empty}>
            <div style={S.emptyIcon}>
              <FontAwesomeIcon icon={tab === 'NEW' ? faInbox : faListCheck} />
            </div>
            <div style={S.emptyTitle}>
              {tab === 'NEW' ? 'No new applications' : 'Nothing here yet'}
            </div>
            <p style={S.emptyLine}>
              {activeFilterCount > 0
                ? 'No candidates match the current filters. Try clearing a filter or two.'
                : tab === 'NEW'
                  ? 'New applications will land here. Share the apply link to start receiving applications.'
                  : 'Candidates move into this stage as they progress through the pipeline.'}
            </p>
          </div>
        ) : (
            // Div grid list. Using divs (not a <table>) means the header
            // row and every body row share pixel-identical
            // outer geometry, so the inner rowGrid's columns land in the
            // same place. A real <table> with colSpan={2} on every row lets
            // the browser size the underlying columns freely, which drifts
            // the header labels off their content.
            <div style={S.divList}>
              <div style={S.divHeader}>
                <div style={isTerminalTab ? S.rowGridTerminal : S.rowGrid}>
                  <div style={{ ...S.thLabel, textAlign: 'center' as const, justifySelf: 'center' }}>#</div>
                  <div style={S.thLabel}>Candidate</div>
                  <div style={{ ...S.thLabel, textAlign: 'center' as const, justifySelf: 'center' }}>Qual</div>
                  <div style={S.thLabel}>Salary ask</div>
                  <div style={S.thLabel}>Location</div>
                  {isTerminalTab && <div style={S.thLabel}>Submitted</div>}
                  <div style={S.thLabel}>
                    {isTerminalTab ? 'Status' : 'Scheduled'}
                  </div>
                  <div style={{ ...S.thLabel, textAlign: 'right' as const, justifySelf: 'end' }}>Actions</div>
                </div>
              </div>
              {displayItems.map((c, idx) => {
                const meta = STATUS_META[c.status];
                const q = QUAL_STYLES[qualKey(c.qualification)];
                const age = calcAge(c.dob);
                const flags = computeFlags(c, positions);
                const qualDisplay = c.qualification?.toLowerCase() === 'others' && c.qualificationOther
                  ? c.qualificationOther : c.qualification;

                // Interview tab — insert a section header before the
                // first row of each bucket (Today / This week / Later /
                // No date). Because items are already sorted by bucket,
                // detecting the transition just needs a lookup at
                // idx-1.
                const groupHeader = (() => {
                  if (tab !== 'INTERVIEWING') return null;
                  const currBucket = interviewBucket(c.interviewStart);
                  const prev = displayItems[idx - 1];
                  const prevBucket = prev ? interviewBucket(prev.interviewStart) : null;
                  if (currBucket === prevBucket) return null;
                  const groupCount = displayItems.filter(x => interviewBucket(x.interviewStart) === currBucket).length;
                  const palette = INTERVIEW_BUCKET_STYLE[currBucket];
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={`hdr-${currBucket}`}
                      style={{
                        ...S.interviewGroupHeader,
                        background: palette.tint,
                        borderLeft: `3px solid ${palette.accent}`,
                        marginTop: isFirst ? 0 : 24,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ ...S.interviewGroupLabel, color: palette.text }}>
                          {INTERVIEW_BUCKET_LABEL[currBucket]}
                        </span>
                        <span style={S.interviewGroupSubtitle}>{interviewBucketSubtitle(currBucket)}</span>
                      </div>
                      <span style={{ ...S.interviewGroupCount, background: palette.accent, color: '#fff' }}>
                        {groupCount}
                      </span>
                    </div>
                  );
                })();

                // Flags — small icons that only show when the flag is
                // triggered. Hover shows the detail sentence.
                const flagIcons = flags.length > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {flags.map(f => (
                      <span
                        key={f.key}
                        title={`${f.label} — ${f.detail}`}
                        style={S.flagIcon(f.level)}
                      >
                        <FontAwesomeIcon icon={f.level === 'red' ? faTriangleExclamation : faExclamation} />
                      </span>
                    ))}
                  </span>
                );

                const wa = (
                  <a
                    href={waLink(c.phone)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    title={`WhatsApp ${c.phone}`}
                    style={S.waBtn}
                  >
                    <FontAwesomeIcon icon={faWhatsapp} />
                  </a>
                );

                // Row background: shortlisted rows get a very soft yellow
                // tint so they're identifiable at a glance without visually
                // shouting. Hover deepens the tint slightly.
                const bgIdle  = c.isShortlisted ? '#fefce8' : 'transparent';
                const bgHover = c.isShortlisted ? '#fef9c3' : C.bg;

                void bgIdle; void bgHover; // Only compact needs these; comfortable renders in its own branch below.

                // Local helper: the kebab-with-fixed-positioned-menu block
                // used at every pipeline stage. Rendered inline via a
                // callback so it closes over `c` and the shared row-menu
                // state without a full component-factoring effort.
                // Reusable pieces so the menu below stays scannable.
                const closeMenu = () => { setRowMenuOpenId(null); setRowMenuAnchor(null); };
                const sep = <div style={S.menuSep} />;
                const sectionLabel = (label: string, icon?: any) => (
                  <div style={S.menuSectionLabel}>
                    {icon && <FontAwesomeIcon icon={icon} style={{ fontSize: 10, color: '#c0c7d1' }} />}
                    {label}
                  </div>
                );
                // Small tinted-square icon "medallion" for decision items —
                // borrowed from the leads menu so decisions read as more
                // consequential than the neutral action rows.
                const menuMedallion = (icon: any, bg: string, fg: string) => (
                  <span style={{ ...S.menuMedallion, background: bg }}>
                    <FontAwesomeIcon icon={icon} style={{ fontSize: 10, color: fg }} />
                  </span>
                );

                // Stage-appropriate decision buttons, mirroring the row's
                // primary CTAs. Same handlers, just surfaced through the
                // menu as a secondary entry point.
                const renderDecisionButtons = (row: Candidate) => {
                  const s = row.status;
                  // Terminal stages have nothing to decide.
                  if (s === 'HIRED' || s === 'REJECTED') return null;
                  // Positive advance (green) is per-stage; Decline (red)
                  // is universal — an admin can close a candidate out at
                  // any stage. Both the row's primary CTA and this menu
                  // route Reject/Decline through the same modal so a
                  // reason is always captured.
                  // Same three final decisions on every non-terminal
                  // stage — a candidate can be offered, withdraw, or be
                  // rejected at any point in the funnel. Stage-specific
                  // bookkeeping (Mark interviewed / Didn't attend /
                  // Accepted) lives on the row's primary CTAs; the
                  // context menu is reserved for these terminal outcomes.
                  void s; // Same menu contents on every non-terminal stage.
                  return (
                    <>
                      {sep}
                      {sectionLabel('Decision', faScaleBalanced)}
                      <div style={{ padding: '0 2px' }}>
                        <button className="kc-row-menu-item" style={S.menuItemBtn} onClick={() => { setOfferingCandidate(row); closeMenu(); }}>
                          {menuMedallion(faPaperPlane, '#dcfce7', '#16a34a')}
                          <span style={{ color: '#15803d', fontWeight: 600 }}>Send offer</span>
                        </button>
                        <button className="kc-row-menu-item" style={S.menuItemBtn} onClick={() => { setRejectingCandidate(row); closeMenu(); }}>
                          {menuMedallion(faXmark, '#ffe4e6', '#e11d48')}
                          <span style={{ color: '#9f1239' }}>Reject candidate</span>
                        </button>
                      </div>
                    </>
                  );
                };

                const renderRowKebab = (row2: Candidate) => (
                  <div data-row-menu style={{ position: 'relative' }}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (rowMenuOpenId === row2.id) {
                          closeMenu();
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setRowMenuAnchor({
                            top: rect.bottom + 4,
                            right: window.innerWidth - rect.right,
                          });
                          setRowMenuOpenId(row2.id);
                        }
                      }}
                      style={S.kebabBtn}
                      title="More actions"
                    >
                      <FontAwesomeIcon icon={faEllipsisVertical} />
                    </button>
                    {rowMenuOpenId === row2.id && rowMenuAnchor && (
                      <div
                        style={{
                          ...S.rowMenu,
                          position: 'fixed',
                          top: rowMenuAnchor.top,
                          right: rowMenuAnchor.right,
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        {sectionLabel('Actions', faBolt)}
                        <div style={{ padding: '0 2px' }}>
                          <button
                            type="button"
                            className="kc-row-menu-item"
                            style={S.menuItemBtn}
                            onClick={() => {
                              shortlistMut.mutate({ id: row2.id, next: !row2.isShortlisted });
                              closeMenu();
                            }}
                          >
                            <FontAwesomeIcon
                              icon={faStar}
                              fixedWidth
                              style={{ marginRight: 8, color: row2.isShortlisted ? '#eab308' : '#94a3b8', fontSize: 12 }}
                            />
                            {row2.isShortlisted ? 'Remove from favourites' : 'Mark as favourite'}
                          </button>
                          <a
                            href={waLink(row2.phone)}
                            target="_blank"
                            rel="noreferrer"
                            className="kc-row-menu-item"
                            style={S.menuItemLink}
                            onClick={closeMenu}
                          >
                            <FontAwesomeIcon icon={faWhatsapp} fixedWidth style={{ marginRight: 8, color: '#25D366', fontSize: 13 }} />
                            Send WhatsApp
                          </a>
                          <button
                            type="button"
                            className="kc-row-menu-item"
                            style={S.menuItemBtn}
                            onClick={() => { setNotingCandidate(row2); closeMenu(); }}
                          >
                            <FontAwesomeIcon icon={faNoteSticky} fixedWidth style={{ marginRight: 8, color: '#94a3b8', fontSize: 12 }} />
                            {row2.adminNotes ? 'Edit note' : 'Add note'}
                          </button>
                          {(() => {
                            const hasResume = !!row2.resumeUrl || !!row2.resumePath;
                            return (
                              <button
                                type="button"
                                disabled={!hasResume}
                                title={hasResume ? undefined : 'This candidate did not attach a resume.'}
                                className="kc-row-menu-item"
                                style={{
                                  ...S.menuItemBtn,
                                  opacity: hasResume ? 1 : 0.45,
                                  cursor: hasResume ? 'pointer' : 'default',
                                }}
                                onClick={() => {
                                  if (!hasResume) return;
                                  closeMenu();
                                  // Prefer the external URL (Google Drive-hosted
                                  // resume from the Apps Script bridge). Falls
                                  // back to the auth-gated internal fetch for
                                  // native /apply uploads.
                                  if (row2.resumeUrl) {
                                    window.open(row2.resumeUrl, '_blank', 'noopener,noreferrer');
                                  } else {
                                    const win = window.open('', '_blank');
                                    downloadCandidateResume(row2.id, win).catch((e: any) => {
                                      showToast(e?.message ?? 'Could not open resume.', 'error');
                                    });
                                  }
                                }}
                              >
                                <FontAwesomeIcon icon={faFileLines} fixedWidth style={{ marginRight: 8, color: '#94a3b8', fontSize: 12 }} />
                                View resume
                              </button>
                            );
                          })()}
                          {/* Schedule / Reschedule interview — only on
                              active-pipeline rows. Reuses the same
                              modal the row's primary CTA opens; wiring
                              is the setSchedulingCandidate state. Label
                              switches based on whether a slot is
                              already booked. */}
                          {row2.status !== 'HIRED' && row2.status !== 'REJECTED' && (
                            <button
                              type="button"
                              className="kc-row-menu-item"
                              style={S.menuItemBtn}
                              onClick={() => { setSchedulingCandidate(row2); closeMenu(); }}
                            >
                              <FontAwesomeIcon icon={faCalendarDays} fixedWidth style={{ marginRight: 8, color: '#94a3b8', fontSize: 12 }} />
                              {row2.interviewStart ? 'Reschedule interview' : 'Schedule interview'}
                            </button>
                          )}
                        </div>
                        {renderDecisionButtons(row2)}
                        {/* Recovery + destructive actions on terminal
                            rows — "accidentally rejected the wrong
                            person" is common enough to surface Reopen
                            as a first-class menu item, and Delete
                            (with confirmation) sits alongside for the
                            case where the row should just go away
                            (test data, duplicate, spam). Both are
                            hidden for active-pipeline candidates. */}
                        {(row2.status === 'HIRED' || row2.status === 'REJECTED') && (
                          <>
                            {sep}
                            <div style={{ padding: '0 2px' }}>
                              <button
                                type="button"
                                className="kc-row-menu-item"
                                style={S.menuItemBtn}
                                onClick={() => { setReopenTarget(row2); closeMenu(); }}
                              >
                                <FontAwesomeIcon icon={faArrowRotateLeft} fixedWidth style={{ marginRight: 8, color: '#94a3b8', fontSize: 12 }} />
                                Reopen candidate
                              </button>
                              <button
                                type="button"
                                className="kc-row-menu-item"
                                style={{ ...S.menuItemBtn, color: C.danger }}
                                onClick={() => { setDeleteTarget(row2); closeMenu(); }}
                              >
                                <FontAwesomeIcon icon={faTrash} fixedWidth style={{ marginRight: 8, color: C.danger, fontSize: 12 }} />
                                Delete candidate
                              </button>
                            </div>
                          </>
                        )}
                        {sep}
                        <div style={{ padding: '0 2px' }}>
                          <button
                            type="button"
                            className="kc-row-menu-item"
                            style={S.menuItemBtn}
                            onClick={() => { setOpenId(row2.id); closeMenu(); }}
                          >
                            <FontAwesomeIcon icon={faPen} fixedWidth style={{ marginRight: 8, color: C.primary, fontSize: 12 }} />
                            View candidate details
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
                void renderRowKebab; // used by all stage branches below

                // Comfortable-density row — plain <div> with a CSS Grid
                // inside. Because both the header row and each body row
                // share this exact wrapper structure, the inner grid's
                // columns line up perfectly (no table quirks).
                const isHighlighted = highlightCandidateId === c.id;
                return (
                  <Fragment key={c.id}>
                  {groupHeader}
                  <div
                      data-candidate-id={c.id}
                      style={{
                        ...S.divRow,
                        background: isHighlighted ? '#fef3c7' : c.isShortlisted ? '#fcfaf3' : 'transparent',
                        boxShadow: isHighlighted
                          ? 'inset 3px 0 0 0 #f59e0b, 0 0 0 2px #fde68a'
                          : c.isShortlisted ? `inset 3px 0 0 0 #d97706` : 'inset 3px 0 0 0 transparent',
                        cursor: 'default',
                        transition: isHighlighted ? 'background 0.3s, box-shadow 0.3s' : undefined,
                      } as React.CSSProperties}
                      onMouseEnter={e => {
                        if (isHighlighted) return;
                        e.currentTarget.style.background = c.isShortlisted ? '#fdf5db' : C.primarySofter;
                      }}
                      onMouseLeave={e => {
                        if (isHighlighted) return;
                        e.currentTarget.style.background = c.isShortlisted ? '#fcfaf3' : 'transparent';
                      }}>
                      <div style={isTerminalTab ? S.rowGridTerminal : S.rowGrid}>
                        {/* Col 0 — row index (1-based, as displayed after sort/filter) */}
                        <div style={S.rowNumCell}>{idx + 1}</div>
                        {/* Col 1 — identity + role */}
                        <div style={S.colIdentity}>
                          <div style={S.rowHeader}>
                            <span style={S.nameText}>{displayName(c.fullName)}</span>
                            {age != null && (
                              <span title={`${age} years old`} style={S.ageText}>{age} yrs</span>
                            )}
                            {c.submissionSource === 'google_form' && (
                              <span
                                style={S.sourceBadge}
                                title="Submitted via Google Form"
                                aria-label="Submitted via Google Form"
                              >
                                <FontAwesomeIcon icon={faGoogle} />
                              </span>
                            )}
                            {repeatCountFor(c) > 1 && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setTab('closed');
                                  setSearch(c.phone ?? '');
                                }}
                                style={S.repeatIconBtn}
                                title={`Applied ${repeatCountFor(c)}× — click to search this phone in All closed.`}
                                aria-label={`Repeat applicant — search phone in All closed`}
                              >
                                <FontAwesomeIcon icon={faArrowsRotate} />
                                <span style={S.repeatCount}>{repeatCountFor(c)}×</span>
                              </button>
                            )}
                            {flagIcons}
                            {(c.careerGoals || c.whyKindergartenTeacher || c.desiredPosition || c.adminNotes) && (
                              <span style={S.hoverIconGroup}>
                                {c.careerGoals && (
                                  <span title={c.careerGoals} style={S.hoverIcon}>
                                    <FontAwesomeIcon icon={faBullseye} />
                                  </span>
                                )}
                                {c.whyKindergartenTeacher && (
                                  <span title={c.whyKindergartenTeacher} style={S.hoverIcon}>
                                    <FontAwesomeIcon icon={faHeart} />
                                  </span>
                                )}
                                {/* Role — was a text pill on the bottom row.
                                    Collapsed to an icon-only glyph beside
                                    the heart; the full role name lives in
                                    the tooltip. */}
                                {c.desiredPosition && (
                                  <span title={`Applying for: ${c.desiredPosition}`} style={S.hoverIcon}>
                                    <FontAwesomeIcon icon={faChalkboardUser} />
                                  </span>
                                )}
                                {c.adminNotes && (
                                  <span
                                    title={c.adminNotes}
                                    style={{ ...S.hoverIcon, color: '#d97706', cursor: 'pointer' }}
                                    onClick={e => { e.stopPropagation(); setNotingCandidate(c); }}
                                  >
                                    <FontAwesomeIcon icon={faNoteSticky} />
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          {c.experienceRange && (
                            <div style={S.identityMeta}>
                              <span title="Years of teaching experience" style={S.expText}>
                                {c.experienceRange}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Col 3 — qualification icon (leads-source style,
                            plain grey glyph, tooltip carries the label) */}
                        <div
                          title={qualDisplay ? `Qualification: ${qualDisplay}` : 'No qualification'}
                          style={{ ...S.qualIcon(q.bg, q.fg), justifySelf: 'center' }}
                        >
                          <FontAwesomeIcon icon={q.icon} />
                        </div>

                        {/* Col 4 — salary (secondary hierarchy: number matches
                            name weight but no oversized display value) */}
                        <div style={S.colSalary}>
                          {c.expectedSalary != null ? (
                            <div style={S.salaryValue}>
                              <span style={S.currencyLabel}>RM</span>
                              {c.expectedSalary.toLocaleString()}
                              {c.expectedSalaryMax != null && c.expectedSalaryMax !== c.expectedSalary && (
                                <> – {c.expectedSalaryMax.toLocaleString()}</>
                              )}
                              {c.salaryJustification && (
                                <span
                                  title={c.salaryJustification}
                                  style={S.salaryInfoIcon}
                                >
                                  <FontAwesomeIcon icon={faCircleInfo} />
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={S.muted}>—</div>
                          )}
                        </div>

                        {/* Col 5 — commute chip first, then location.
                            Candidates sometimes type a full sentence in
                            the address field; we clip to the first three
                            words in the row and reveal the full text via
                            the row-level title tooltip. */}
                        <div style={S.colLocation}>
                          {c.addressLocation ? (() => {
                            // Google Maps directions link — omitting the
                            // origin lets Maps pick "Your location" (with
                            // the browser's usual geolocation prompt).
                            const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.addressLocation + ', Malaysia')}`;
                            return (
                              <a
                                href={mapsHref}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={S.locationLink}
                                title={`Open in Google Maps — directions from your location to ${c.addressLocation}`}
                              >
                                <FontAwesomeIcon icon={faLocationDot} style={{ color: C.mutedSoft, fontSize: 11, marginRight: 6, flexShrink: 0, marginTop: 3 }} />
                                {/* Text + chip share an inner flex wrapper
                                    so that when the chip wraps, it slides
                                    under the address text — not under the
                                    pin icon at column 0. */}
                                <span style={S.locationInner}>
                                  <span style={{ overflowWrap: 'anywhere' }}>{c.addressLocation}</span>
                                  {c.commuteTime && (
                                    <span style={S.commuteChip} title={`Commute: ${COMMUTE_LABEL[c.commuteTime]}`}>
                                      {COMMUTE_LABEL[c.commuteTime]}
                                    </span>
                                  )}
                                </span>
                              </a>
                            );
                          })() : (
                            <div style={S.muted}>—</div>
                          )}
                        </div>

                        {/* Col 5.5 — original submission date. Only on
                            terminal tabs (Hired / Rejected / All closed),
                            where "when did this land" is the piece of
                            context the admin scans against once the
                            interview slot no longer matters. */}
                        {isTerminalTab && (
                          <div style={S.colSubmitted} title={`Submitted ${fmtDate(c.submittedAt)}`}>
                            {fmtDate(c.submittedAt)}
                          </div>
                        )}
                        {/* Col 6 — swaps between "Scheduled" (interview
                            date) on active tabs and "Status" (terminal
                            outcome pill) on Hired / Rejected / closed. */}
                        <div style={S.colScheduled}>
                          {isTerminalTab ? (() => {
                            const term = terminalStatusMeta(c);
                            // Only append the reason for a plain "Rejected"
                            // — "Declined offer" / "No-show" already carry
                            // their reason in the pill label, and "Hired"
                            // has no reason.
                            const appendReason = c.status === 'REJECTED'
                              && !!c.rejectionReason
                              && c.rejectionReason !== DECLINED_OFFER_REASON
                              && c.rejectionReason !== NO_SHOW_REASON;
                            return (
                              <span style={S.terminalPill(term.bg, term.fg)} title={c.rejectionReason ?? undefined}>
                                <FontAwesomeIcon icon={term.icon} style={{ fontSize: 11, flexShrink: 0, marginTop: 3 }} />
                                <span style={S.terminalPillText}>
                                  {term.label}
                                  {appendReason && <span style={{ opacity: 0.85 }}>: {c.rejectionReason}</span>}
                                </span>
                              </span>
                            );
                          })() : c.interviewStart ? (() => {
                            const d = new Date(c.interviewStart);
                            const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                            const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            const fullStr = d.toLocaleString('en-GB', {
                              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                              hour: 'numeric', minute: '2-digit', hour12: true,
                            });
                            return (
                              <div style={S.scheduledCell} title={`Interview: ${fullStr}`}>
                                <FontAwesomeIcon icon={faCalendarDays} style={{ color: C.mutedSoft, fontSize: 11, flexShrink: 0 }} />
                                <span style={S.scheduledDate}>{dateStr}</span>
                                <span style={S.scheduledTime}>{timeStr}</span>
                              </div>
                            );
                          })() : (
                            <div style={S.muted}>—</div>
                          )}
                        </div>

                        {/* Col 7 — stage-appropriate actions. CONTACTED has
                            two primary actions (Reschedule + Mark confirmed)
                            with WhatsApp tucked in the overflow menu; other
                            stages show a single advance button + WhatsApp
                            inline. Terminal stages show only a pill. */}
                        <div style={S.colActions}>
                          {c.status === 'NEW' ? (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); contactMut.mutate(c.id); }}
                                disabled={contactMut.isPending}
                                style={S.contactBtn}
                              >
                                <FontAwesomeIcon icon={faPhone} /> Contact →
                              </button>
                              {renderRowKebab(c)}
                            </>
                          ) : c.status === 'CONTACTED' ? (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); setSchedulingCandidate(c); }}
                                style={S.rescheduleBtn}
                              >
                                <FontAwesomeIcon icon={faCalendarDays} /> Reschedule
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmingCandidate(c); }}
                                disabled={advanceStageMut.isPending}
                                style={S.contactBtn}
                              >
                                <FontAwesomeIcon icon={faCheck} /> Confirm interview
                              </button>
                              {renderRowKebab(c)}
                            </>
                          ) : c.status === 'INTERVIEWING' ? (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); noShowMut.mutate(c.id); }}
                                disabled={noShowMut.isPending}
                                style={S.rejectSmallBtn}
                              >
                                <FontAwesomeIcon icon={faUserXmark} /> Didn't attend
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); advanceStageMut.mutate({ id: c.id, status: 'PENDING_DECISION' }); }}
                                disabled={advanceStageMut.isPending}
                                style={S.contactBtn}
                              >
                                <FontAwesomeIcon icon={faCheck} /> Attended
                              </button>
                              {renderRowKebab(c)}
                            </>
                          ) : c.status === 'PENDING_DECISION' ? (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); setRejectingCandidate(c); }}
                                style={S.rejectSmallBtn}
                              >
                                <FontAwesomeIcon icon={faUserXmark} /> Reject
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setOfferingCandidate(c); }}
                                style={S.offerBtn}
                              >
                                <FontAwesomeIcon icon={faPaperPlane} /> Send offer
                              </button>
                              {renderRowKebab(c)}
                            </>
                          ) : c.status === 'OFFER_SENT' ? (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); declineOfferMut.mutate(c.id); }}
                                disabled={declineOfferMut.isPending}
                                style={S.rejectSmallBtn}
                              >
                                <FontAwesomeIcon icon={faUserXmark} /> Declined
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); advanceStageMut.mutate({ id: c.id, status: 'HIRED' }); }}
                                disabled={advanceStageMut.isPending}
                                style={S.offerBtn}
                              >
                                <FontAwesomeIcon icon={faUserCheck} /> Accepted
                              </button>
                              {renderRowKebab(c)}
                            </>
                          ) : (
                            // Terminal stages (HIRED / REJECTED / etc.) —
                            // the Status column already shows the outcome
                            // pill, so the Actions column just carries
                            // the kebab for View details / resume / notes.
                            renderRowKebab(c)
                          )}
                        </div>
                      </div>
                  </div>
                  </Fragment>
                );
              })}
              {showClosedPagination && (
                <div style={S.pagerBar}>
                  <div style={S.pagerInfo}>
                    Showing{' '}
                    <strong>{(closedPageClamped - 1) * CLOSED_PAGE_SIZE + 1}</strong>
                    –
                    <strong>{Math.min(closedPageClamped * CLOSED_PAGE_SIZE, items.length)}</strong>
                    {' '}of <strong>{items.length}</strong>
                  </div>
                  <div style={S.pagerControls}>
                    <button
                      type="button"
                      onClick={() => setClosedPage(p => Math.max(1, p - 1))}
                      disabled={closedPageClamped === 1}
                      style={S.pagerBtn(closedPageClamped === 1)}
                    >
                      <FontAwesomeIcon icon={faArrowLeft} /> Prev
                    </button>
                    <span style={S.pagerPage}>
                      Page <strong>{closedPageClamped}</strong> of {closedTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setClosedPage(p => Math.min(closedTotalPages, p + 1))}
                      disabled={closedPageClamped === closedTotalPages}
                      style={S.pagerBtn(closedPageClamped === closedTotalPages)}
                    >
                      Next <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                  </div>
                </div>
              )}
            </div>
        )}
      </div>

      {openId && (
        <CandidateQuickViewModal
          id={openId}
          onClose={() => setOpenId(null)}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          entityType="Candidate"
          entityName={deleteTarget.fullName}
          actionLabel="Remove"
          onConfirm={async () => { await delMut.mutateAsync(deleteTarget.id); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {reopenTarget && (
        <ConfirmDialog
          title={`Reopen ${reopenTarget.fullName}?`}
          message={
            <span>
              They'll return to <strong>New</strong> and any rejection reason
              or hire date will be cleared. You'll then be able to re-triage
              them from the top of the pipeline.
            </span>
          }
          confirmLabel="Reopen candidate"
          loading={reopenMut.isPending}
          onConfirm={() => reopenMut.mutate(reopenTarget.id)}
          onCancel={() => setReopenTarget(null)}
        />
      )}


      {rejectingCandidate && (
        <RejectCandidateModal
          candidate={rejectingCandidate}
          defaultReason={
            // Pre-select "Not suitable" when rejecting from the inbox
            // review card so triage is one confirm-click away.
            reviewOpen && queueSnapshot.some(x => x.id === rejectingCandidate.id)
              ? NOT_SUITABLE_REASON
              : undefined
          }
          onClose={() => setRejectingCandidate(null)}
          onRejected={() => {
            const id = rejectingCandidate.id;
            invalidateCandidateFeeds();
            // Rejecting a candidate can also cancel an upcoming interview
            // (backend auto-removes the calendar event) — refresh the
            // upcoming feed so the scheduler and any clash checks reflect
            // the freed-up slot.
            qc.invalidateQueries({ queryKey: ['upcoming-interviews'] });
            // If the reject came from the inbox review card, keep the
            // session bookkeeping in sync + advance to the next
            // candidate — same rhythm as the old one-click reject.
            if (reviewOpen && queueSnapshot.some(x => x.id === id)) {
              markActioned(id);
              setSessionRejected(prev => { const n = new Set(prev); n.add(id); return n; });
              setSessionShortlisted(prev => { const n = new Set(prev); n.delete(id); return n; });
              goForward();
            }
            setRejectingCandidate(null);
          }}
        />
      )}

      {notingCandidate && (
        <NoteEditorModal
          candidate={notingCandidate}
          onClose={() => setNotingCandidate(null)}
          onSaved={updated => {
            invalidateCandidateFeeds();
            // Keep the modal open with the fresh data if the caller
            // returned it, so admins can keep editing without a reopen.
            setNotingCandidate(updated ?? null);
          }}
        />
      )}

      {offeringCandidate && (
        <SendOfferModal
          candidate={offeringCandidate}
          onClose={() => setOfferingCandidate(null)}
          onSent={() => {
            invalidateCandidateFeeds();
            setOfferingCandidate(null);
          }}
        />
      )}

      {confirmingCandidate && (
        <ConfirmInterviewModal
          candidate={confirmingCandidate}
          onClose={() => setConfirmingCandidate(null)}
          onConfirmed={() => {
            invalidateCandidateFeeds();
            setConfirmingCandidate(null);
          }}
        />
      )}

      {schedulingCandidate && (
        <InterviewSchedulerModal
          candidate={schedulingCandidate}
          onClose={() => setSchedulingCandidate(null)}
          onSaved={() => {
            const id = schedulingCandidate.id;
            // Only count as an actioned decision when we're inside a
            // review session (i.e. NEW tab). Elsewhere the button just
            // schedules without affecting session counters.
            const wasInReview = reviewOpen && queueSnapshot.some(x => x.id === id);
            setQueueSnapshot(prev => prev.map(x =>
              x.id === id
                ? { ...x, interviewStart: new Date().toISOString() }
                : x));
            if (wasInReview) {
              markActioned(id);
              // Scheduling is a triage decision — advance to the next
              // candidate the same way Reject does.
              goForward();
            }
            setSchedulingCandidate(null);
          }}
        />
      )}
    </div>
    {showCtxPanel && (
      <CandidateContextPanel
        expanded={ctxPanelExpanded}
        activeTab={ctxPanelTab}
        upcomingInterviews={upcomingInterviewsFeed}
        decidingCandidates={decidingCandidates}
        offerSentCandidates={offerSentCandidates}
        onToggle={() => setCtxPanelExpanded(v => !v)}
        onTabChange={t => { setCtxPanelTab(t); setCtxPanelExpanded(true); }}
        onSelect={jumpToCandidate}
        onSelectInterview={id => {
          // Find the full candidate row from the list feed, or fall
          // back to jumping to the Interview tab and highlighting.
          const c = rawItems.find(x => x.id === id)
            ?? decidingCandidates.find(x => x.id === id)
            ?? offerSentCandidates.find(x => x.id === id);
          if (c) jumpToCandidate(c);
          else {
            setTab('INTERVIEWING');
            setViewMode('list');
            setHighlightCandidateId(id);
          }
        }}
      />
    )}
    </>
  );
}

// ── Inbox Review card ─────────────────────────────────────────────────────
// Full-height decision card. Big fonts, ample padding, all screening data
// visible without hovers — this is the "am I interviewing this person or
// not?" surface. Keyboard shortcuts (← Prev, → Next, Esc close) are set
// up by the parent.

// ── Review sidebar ──────────────────────────────────────────────────
// Left-column list in the NEW-tab review view. Each row shows the
// candidate's position in the snapshot queue plus the session outcome
// (rejected × / actioned ✓ / shortlist tint). Auto-scrolls the current
// row into view when it changes (keeps the viewport centered around the
// person being reviewed as the admin walks the queue with ← / →).
// ── Right context panel ──────────────────────────────────────────────
// Docked, collapsible right-hand rail on the Candidates list view.
// Mirrors the pattern used by LeadsPage's ContextPanel — three tabs
// (Interviews / Pending / Follow-Up), each with a scrollable list.
// Placed with `position: fixed` so it doesn't force a layout rewrite
// of the main shell; it hugs the right side of the viewport at
// nav-safe top offset.
function isSameCandidateDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function CandidateContextPanel(props: {
  expanded: boolean;
  activeTab: 'interviews' | 'deciding' | 'offered';
  upcomingInterviews: { id: string; fullName: string; interviewStart: string; interviewEnd: string | null }[];
  decidingCandidates: Candidate[];
  offerSentCandidates: Candidate[];
  onToggle: () => void;
  onTabChange: (t: 'interviews' | 'deciding' | 'offered') => void;
  onSelect: (c: Candidate) => void;
  onSelectInterview: (interviewId: string) => void;
}) {
  const { expanded, activeTab, upcomingInterviews, decidingCandidates, offerSentCandidates, onToggle, onTabChange, onSelect, onSelectInterview } = props;
  const today = new Date();

  const tabs = [
    { key: 'interviews' as const, label: 'Interviews', icon: faCalendarDays,        count: upcomingInterviews.length,   color: '#1d4ed8' },
    { key: 'deciding' as const,   label: 'Deciding',   icon: faScaleBalanced,        count: decidingCandidates.length,   color: '#d97706', alert: decidingCandidates.length > 0 },
    { key: 'offered' as const,    label: 'Offer sent', icon: faPaperPlane,           count: offerSentCandidates.length,  color: '#16a34a' },
  ];

  // Fixed-position wrapper: docks the panel flush against the bottom
  // of the app-level Navbar (height 50px) so there's no daylight
  // between them — matches how the Leads context panel sits.
  const wrapperStyle: React.CSSProperties = {
    position: 'fixed',
    top: 50, right: 0, bottom: 0,
    zIndex: 40,
    background: '#fff',
    borderLeft: '1px solid #e2e8f0',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-8px 0 24px rgba(15,23,42,0.04)',
    transition: 'width 0.15s ease',
  };

  if (!expanded) {
    return (
      <div style={{ ...wrapperStyle, width: 44 }} className="kc-no-scrollbar">
        <button onClick={onToggle}
          title="Show context panel"
          style={{ width: 32, height: 32, margin: '10px auto 8px', borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11 }}>
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        {tabs.map(t => (
          <button key={t.key} onClick={() => onTabChange(t.key)}
            title={`${t.label} (${t.count})`}
            style={{
              width: 32, height: 32, margin: '0 auto 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              background: t.alert ? '#fffbeb' : 'transparent',
              color: t.alert ? t.color : '#94a3b8', fontSize: 12,
            }}>
            <FontAwesomeIcon icon={t.icon} />
            {t.count > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2, fontSize: 9, fontWeight: 700,
                background: t.alert ? t.color : '#64748b', color: '#fff',
                borderRadius: 10, padding: '0 4px', lineHeight: '14px', minWidth: 14, textAlign: 'center' as const,
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ ...wrapperStyle, width: 280 }} className="kc-no-scrollbar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Context</span>
        <button onClick={onToggle}
          title="Collapse"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, padding: 4 }}>
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px 8px' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => onTabChange(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7,
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.key ? 600 : 500,
            background: activeTab === t.key ? (t.alert ? '#fffbeb' : '#f1f5f9') : 'transparent',
            color: activeTab === t.key ? t.color : '#64748b', fontFamily: 'inherit',
            transition: 'all 0.12s',
          }}>
            <FontAwesomeIcon icon={t.icon} style={{ fontSize: 11, width: 14 }} />
            {t.label}
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
              background: t.count > 0 ? (t.alert ? t.color : '#e5e7eb') : '#f1f5f9',
              color: t.count > 0 ? (t.alert ? '#fff' : '#374151') : '#cbd5e1',
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: '#f1f5f9', margin: '0 14px' }} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {activeTab === 'interviews' && (() => {
          const sorted = [...upcomingInterviews].sort((a, b) =>
            new Date(a.interviewStart).getTime() - new Date(b.interviewStart).getTime());
          const groups: { label: string; isToday: boolean; items: typeof sorted }[] = [];
          for (const iv of sorted) {
            const d = new Date(iv.interviewStart);
            const isToday = isSameCandidateDay(d, today);
            const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const dayPart = d.toLocaleDateString('en-GB', { weekday: 'short' });
            const label = isToday ? `Today · (${dayPart}) ${datePart}` : `(${dayPart}) ${datePart}`;
            const existing = groups.find(g => g.label === label);
            if (existing) existing.items.push(iv);
            else groups.push({ label, isToday, items: [iv] });
          }
          return groups.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12, color: '#cbd5e1' }}>No upcoming interviews</div>
          ) : groups.map((group, gi) => (
            <div key={group.label}>
              <div style={{
                padding: '6px 14px', fontSize: 10, fontWeight: 700,
                color: group.isToday ? '#1d4ed8' : '#64748b',
                letterSpacing: '0.05em', textTransform: 'uppercase' as const,
                background: group.isToday ? '#eff6ff' : '#f8fafc',
                borderTop: gi > 0 ? '1px solid #e2e8f0' : 'none',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{group.label}</span>
                <span style={{
                  fontSize: 9, fontWeight: 600,
                  color: group.isToday ? '#3b82f6' : '#94a3b8',
                  background: group.isToday ? '#dbeafe' : '#e2e8f0',
                  borderRadius: 8, padding: '1px 6px',
                }}>{group.items.length}</span>
              </div>
              {group.items.map(iv => {
                const s = new Date(iv.interviewStart);
                const e = iv.interviewEnd ? new Date(iv.interviewEnd) : null;
                const fmtT = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
                return (
                  <div key={iv.id}
                    onClick={() => onSelectInterview(iv.id)}
                    onMouseEnter={ev => (ev.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                    style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', gap: 10, transition: 'background 0.1s' }}>
                    <div style={{ width: 3, height: 28, borderRadius: 2, background: group.isToday ? '#3b82f6' : '#e2e8f0', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {displayName(iv.fullName)}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtT(s)}{e ? ` – ${fmtT(e)}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ));
        })()}

        {activeTab === 'deciding' && (
          <>
            {decidingCandidates.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#cbd5e1' }}>
                <FontAwesomeIcon icon={faCheck} style={{ marginRight: 5, color: '#22c55e' }} /> No candidates awaiting a decision
              </div>
            ) : (
              <>
                <div style={{ padding: '6px 14px 4px', fontSize: 10, color: '#b45309' }}>Hire or reject after the interview</div>
                {decidingCandidates.map(c => (
                  <div key={c.id}
                    onClick={() => onSelect(c)}
                    onMouseEnter={ev => (ev.currentTarget.style.background = '#fffbeb')}
                    onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {displayName(c.fullName)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.desiredPosition ?? 'No role'}</div>
                    </div>
                    <FontAwesomeIcon icon={faArrowRight} style={{ color: '#d97706', fontSize: 11, flexShrink: 0 }} />
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {activeTab === 'offered' && (
          <>
            {offerSentCandidates.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#cbd5e1' }}>
                <FontAwesomeIcon icon={faCheck} style={{ marginRight: 5, color: '#22c55e' }} /> No open offers
              </div>
            ) : (
              <>
                <div style={{ padding: '6px 14px 4px', fontSize: 10, color: '#16a34a' }}>Waiting for the candidate to accept</div>
                {offerSentCandidates.map(c => (
                  <div key={c.id}
                    onClick={() => onSelect(c)}
                    onMouseEnter={ev => (ev.currentTarget.style.background = '#f0fdf4')}
                    onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {displayName(c.fullName)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.desiredPosition ?? 'No role'}</div>
                    </div>
                    <FontAwesomeIcon icon={faArrowRight} style={{ color: '#16a34a', fontSize: 11, flexShrink: 0 }} />
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const SIDEBAR_PAGE_SIZE = 20;
function ReviewSidebar(props: {
  items: Candidate[];
  currentIdx: number;
  sessionActioned: Set<string>;
  sessionShortlisted: Set<string>;
  sessionRejected: Set<string>;
  isRepeat: (c: Candidate) => boolean;
  groupByInterviewBucket: boolean;
  /** Drop rows with an interviewStart set. Only true on the NEW-tab
   *  triage queue — those candidates have been scheduled so they no
   *  longer belong in triage. On tabs where scheduled candidates ARE
   *  the whole point (Interview / Contacted), pass false or every row
   *  gets filtered out. */
  hideScheduled: boolean;
  onJump: (idx: number) => void;
}) {
  const { items, currentIdx, sessionActioned, sessionShortlisted, sessionRejected, isRepeat, groupByInterviewBucket, hideScheduled, onJump } = props;
  const listRef = useRef<HTMLUListElement | null>(null);

  // Filter out rejected candidates so the sidebar clears them out
  // immediately — no strike-through leftovers cluttering the queue.
  // `origIdx` is kept so we can still map clicks + the auto-scroll
  // target back to the parent's queueSnapshot index.
  const liveItems = useMemo(
    () => items
      .map((c, origIdx) => ({ c, origIdx }))
      .filter(({ c }) =>
        !sessionRejected.has(c.id)
        // On NEW-tab triage, scheduled candidates drop out of the
        // sidebar the moment the Schedule modal saves — same rhythm
        // as rejected rows. On tabs where scheduled candidates ARE
        // the queue (Contacted / Interview), keep them.
        && (!hideScheduled || !c.interviewStart)),
    [items, sessionRejected, hideScheduled],
  );

  // Client-side paging for long queues (bulk imports easily produce
  // 800+). Auto-flip to the page containing the current candidate so
  // ← / → in the main pane keeps the sidebar aligned with what's shown.
  // Disabled when grouping by interview bucket — headers + pagination
  // compose poorly, and Interview queues are short enough to fit.
  const totalPages = groupByInterviewBucket
    ? 1
    : Math.max(1, Math.ceil(liveItems.length / SIDEBAR_PAGE_SIZE));
  const currentLiveIdx = liveItems.findIndex(x => x.origIdx === currentIdx);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (groupByInterviewBucket) return;
    if (currentLiveIdx >= 0) setPage(Math.floor(currentLiveIdx / SIDEBAR_PAGE_SIZE));
  }, [currentLiveIdx, groupByInterviewBucket]);
  const pageClamped = Math.min(page, totalPages - 1);
  const start = groupByInterviewBucket ? 0 : pageClamped * SIDEBAR_PAGE_SIZE;
  const visibleItems = groupByInterviewBucket
    ? liveItems
    : liveItems.slice(start, start + SIDEBAR_PAGE_SIZE);

  // Keep the current row in view as the admin navigates. `nearest`
  // avoids scrolling when the row is already visible.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${currentIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIdx, pageClamped]);

  return (
    <aside style={S.reviewSidebar} aria-label="Candidate review queue">
      <div style={S.reviewSidebarHeader}>
        <span style={S.reviewSidebarLabel}>Candidates</span>
      </div>
      <ul ref={listRef} style={S.reviewSidebarList} role="listbox" aria-activedescendant={`review-item-${currentIdx}`}>
        {visibleItems.map(({ c, origIdx }, offset) => {
          // Sidebar number is 1-based over the LIVE list (after
          // rejections drop out) so the admin sees "1, 2, 3…" without
          // holes where rejected rows used to be.
          const displayNum = start + offset + 1;
          // Insert a group header before the first row of each
          // interview bucket. Uses the same buckets as the list view
          // so the two surfaces read consistently.
          const groupHeader = (() => {
            if (!groupByInterviewBucket) return null;
            const currBucket = interviewBucket(c.interviewStart);
            const prev = visibleItems[offset - 1];
            const prevBucket = prev ? interviewBucket(prev.c.interviewStart) : null;
            if (currBucket === prevBucket) return null;
            const count = visibleItems.filter(x => interviewBucket(x.c.interviewStart) === currBucket).length;
            const palette = INTERVIEW_BUCKET_STYLE[currBucket];
            const isFirstGroup = offset === 0;
            return (
              <li
                key={`hdr-${currBucket}`}
                style={{
                  ...S.sidebarGroupHeader,
                  background: palette.tint,
                  borderLeft: `3px solid ${palette.accent}`,
                  marginTop: isFirstGroup ? 8 : 14,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <span style={{ ...S.sidebarGroupLabel, color: palette.text }}>
                    {INTERVIEW_BUCKET_LABEL[currBucket]}
                  </span>
                  <span style={S.sidebarGroupSubtitle}>{interviewBucketSubtitle(currBucket)}</span>
                </div>
                <span style={{ ...S.sidebarGroupCount, background: palette.accent, color: '#fff' }}>
                  {count}
                </span>
              </li>
            );
          })();
          return (
            <Fragment key={c.id}>
              {groupHeader}
              <ReviewSidebarItem
                candidate={c}
                idx={origIdx}
                displayNum={displayNum}
                isCurrent={origIdx === currentIdx}
                isShortlisted={c.isShortlisted || sessionShortlisted.has(c.id)}
                isRejected={false}
                isActioned={sessionActioned.has(c.id)}
                isRepeat={isRepeat(c)}
                showInterviewSlot={groupByInterviewBucket}
                onSelect={() => onJump(origIdx)}
              />
            </Fragment>
          );
        })}
      </ul>
      {totalPages > 1 && (
        <div style={S.reviewSidebarPager}>
          <button
            type="button"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={pageClamped === 0}
            style={S.reviewSidebarPagerBtn(pageClamped === 0)}
            aria-label="Previous page"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <span style={S.reviewSidebarPagerLabel}>
            {pageClamped + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={pageClamped === totalPages - 1}
            style={S.reviewSidebarPagerBtn(pageClamped === totalPages - 1)}
            aria-label="Next page"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      )}
    </aside>
  );
}

function ReviewSidebarItem(props: {
  candidate: Candidate;
  idx: number;
  displayNum: number;
  isCurrent: boolean;
  isShortlisted: boolean;
  isRejected: boolean;
  isActioned: boolean;
  isRepeat: boolean;
  showInterviewSlot: boolean;
  onSelect: () => void;
}) {
  const { candidate: c, idx, displayNum, isCurrent, isShortlisted, isRejected, isActioned, isRepeat, showInterviewSlot, onSelect } = props;
  const wait = waitingSince(c.submittedAt);
  const qual = QUAL_STYLES[qualKey(c.qualification)];
  const qualTooltip = c.qualification
    ? `Qualification: ${c.qualification === 'Others' && c.qualificationOther ? c.qualificationOther : c.qualification}`
    : 'Qualification not specified';

  // Salary tooltip — the amount lives on the sack icon so it can lead
  // the subtitle line without eating horizontal room in the sidebar.
  const salaryTooltip = c.expectedSalary != null
    ? (c.expectedSalaryMax != null && c.expectedSalaryMax !== c.expectedSalary
        ? `Expected salary: RM ${c.expectedSalary.toLocaleString()} – ${c.expectedSalaryMax.toLocaleString()}`
        : `Expected salary: RM ${c.expectedSalary.toLocaleString()}`)
    : 'Expected salary not specified';

  // Actioned-but-not-rejected candidates (i.e. moved to CONTACTED via
  // Schedule Interview) get a small green check inside the medallion so
  // the admin can see at a glance which rows they've already worked.
  const showChecked = isActioned && !isRejected;

  const ariaLabel = [
    c.fullName,
    isCurrent && '(current)',
    isRejected && 'rejected in this session',
    isShortlisted && 'shortlisted',
    isActioned && !isRejected && 'reviewed',
  ].filter(Boolean).join(', ');

  return (
    <li>
      <button
        id={`review-item-${idx}`}
        data-idx={idx}
        onClick={onSelect}
        role="option"
        aria-selected={isCurrent}
        aria-label={ariaLabel}
        style={S.reviewSidebarItem(isCurrent, isRejected)}
        onMouseEnter={e => {
          if (isCurrent) return;
          e.currentTarget.style.background = C.bgSoft;
          e.currentTarget.style.borderColor = C.borderSoft;
        }}
        onMouseLeave={e => {
          if (isCurrent) return;
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }}
      >
        <span
          style={S.reviewSidebarNum(isCurrent, isShortlisted, isRejected, isRepeat)}
          title={isRepeat ? 'Repeat applicant — this phone has applied more than once.' : undefined}
        >
          {isRejected ? <FontAwesomeIcon icon={faXmark} />
           : showChecked ? <FontAwesomeIcon icon={faCheck} />
           : displayNum}
        </span>
        <div style={S.reviewSidebarTextCol}>
          {/* Name line — flex row so the coloured qualification glyph
              sits inline with the name at the same vertical baseline.
              minWidth: 0 on both the row and the name span is what
              lets the name ellipsis-truncate instead of pushing the
              icon to its own line when the row is narrow. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <FontAwesomeIcon
              icon={qual.icon}
              title={qualTooltip}
              style={{ color: qual.fg, fontSize: 11, flexShrink: 0, cursor: 'help' }}
            />
            <span style={{ ...S.reviewSidebarName(isRejected), minWidth: 0, flex: 1 }}>{displayName(c.fullName)}</span>
          </div>
          {/* Subtitle — RM amount (as digits, not icon) then years of
              experience. The role the candidate applied for is dropped
              here because it's already visible on the main card. */}
          {(c.expectedSalary != null || c.experienceRange) && (
            <span style={S.reviewSidebarSub}>
              {c.expectedSalary != null && (
                <span title={salaryTooltip} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {c.expectedSalaryMax != null && c.expectedSalaryMax !== c.expectedSalary
                    ? `RM ${c.expectedSalary.toLocaleString()} – ${c.expectedSalaryMax.toLocaleString()}`
                    : `RM ${c.expectedSalary.toLocaleString()}`}
                </span>
              )}
              {c.expectedSalary != null && c.experienceRange && (
                <span style={{ color: C.mutedSoft, margin: '0 5px' }}>·</span>
              )}
              {c.experienceRange && (
                <span
                  title={`Experience: ${c.experienceRange}`}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {c.experienceRange}
                </span>
              )}
            </span>
          )}
        </div>
        {showInterviewSlot ? (
          // Interview tab — the meaningful timestamp is the interview
          // slot, not "waiting since applied". Show it as a neutral
          // chip; the group header already colour-codes the bucket.
          (() => {
            if (!c.interviewStart) return null;
            const d = new Date(c.interviewStart);
            if (isNaN(d.getTime())) return null;
            const slot = `${d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
            return (
              <span title={`Interview: ${d.toLocaleString('en-GB')}`} style={S.sidebarInterviewSlot}>
                {slot}
              </span>
            );
          })()
        ) : (
          <span
            title={`Waiting since ${fmtDate(c.submittedAt)}`}
            style={S.waitBadge(wait.level)}
          >
            {wait.text}
          </span>
        )}
      </button>
    </li>
  );
}

function InboxReviewCard(props: {
  c: Candidate;
  positions: { name: string; minSalary: number | null; maxSalary: number | null }[];
  repeatCount: number;
  onRepeatSearch: () => void;
  onOpenModal: () => void;
  onScheduleInterview: () => void;
  onToggleShortlist: () => void;
  shortlistPending: boolean;
}) {
  const { c, repeatCount, onRepeatSearch } = props;
  const q = QUAL_STYLES[qualKey(c.qualification)];
  const age = calcAge(c.dob);
  const flags = computeFlags(c, props.positions);
  const qualDisplay = c.qualification?.toLowerCase() === 'others' && c.qualificationOther
    ? c.qualificationOther
    : (c.qualification ?? null);

  // Header kebab — opens a small popover with row-scoped actions.
  // Currently just "Open full details" so admins have a consistent
  // top-right menu shape even for the card view.
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!headerMenuOpen) return;
    const onAway = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onAway);
    return () => document.removeEventListener('mousedown', onAway);
  }, [headerMenuOpen]);

  return (
    <div style={S.reviewCard}>
      {/* Header — identity + applying-for chip in top-right */}
      <div style={S.reviewCardHeader}>
        <div style={S.reviewQualIcon(q.bg, q.fg)}>
          <FontAwesomeIcon icon={q.icon} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.reviewName}>
            {displayName(c.fullName)}
            {age != null && <span style={S.reviewAge}>· {age} yrs</span>}
            {c.submissionSource === 'google_form' && (
              <span
                style={{ ...S.sourceBadge, marginLeft: 8 }}
                title="Submitted via Google Form"
                aria-label="Submitted via Google Form"
              >
                <FontAwesomeIcon icon={faGoogle} />
              </span>
            )}
            {repeatCount > 1 && (
              <button
                type="button"
                onClick={onRepeatSearch}
                style={{ ...S.repeatIconBtn, marginLeft: 8 }}
                title={`Applied ${repeatCount}× — click to search this phone in All closed.`}
                aria-label={`Repeat applicant — search phone in All closed`}
              >
                <FontAwesomeIcon icon={faArrowsRotate} />
                <span style={S.repeatCount}>{repeatCount}×</span>
              </button>
            )}
          </div>
          <div style={S.reviewSub}>
            {c.addressLocation && (() => {
              // Same Maps deep-link the list view uses — omitting the
              // origin lets Maps pick the viewer's current location.
              const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.addressLocation + ', Malaysia')}`;
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    title={`Open in Google Maps — directions from your location to ${c.addressLocation}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      color: C.textSub, textDecoration: 'none',
                    }}
                  >
                    <FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 11, color: C.mutedSoft }} />
                    <span style={{ textDecoration: 'underline', textDecorationColor: C.borderSoft, textUnderlineOffset: 3 }}>
                      {c.addressLocation}
                    </span>
                  </a>
                  {c.commuteTime && (
                    <span style={S.commuteInlineChip}>{COMMUTE_LABEL[c.commuteTime]}</span>
                  )}
                </span>
              );
            })()}
            {flags.length > 0 && (
              <>
                <span style={S.subDot}>·</span>
                {flags.map(f => (
                  <span key={f.key} title={f.detail} style={S.flagPill(f.level)}>
                    <FontAwesomeIcon icon={f.level === 'red' ? faTriangleExclamation : faExclamation} />
                    {f.label}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={props.onToggleShortlist}
            disabled={props.shortlistPending}
            title={c.isShortlisted ? 'Remove from favourites' : 'Mark as favourite'}
            style={S.starToggle(c.isShortlisted)}
          >
            <FontAwesomeIcon icon={faStar} />
          </button>
          {(c.resumeUrl || c.resumePath) ? (
            <button
              type="button"
              onClick={() => {
                if (c.resumeUrl) {
                  window.open(c.resumeUrl, '_blank', 'noopener,noreferrer');
                } else {
                  const win = window.open('', '_blank');
                  downloadCandidateResume(c.id, win).catch((e: any) => {
                    alert(e?.message ?? 'Could not open resume.');
                  });
                }
              }}
              title={c.resumeOriginalName ? `Open ${c.resumeOriginalName}` : 'Open resume'}
              style={S.resumeIconBtn}
            >
              <FontAwesomeIcon icon={faFileLines} />
            </button>
          ) : (
            <span
              title="This candidate did not attach a resume."
              style={S.resumeIconMissing}
              aria-label="No resume attached"
            >
              <FontAwesomeIcon icon={faFileLines} />
            </span>
          )}
          <span style={S.applyingChip}>
            <FontAwesomeIcon icon={faChalkboardUser} style={{ fontSize: 11 }} />
            Applying for <strong>{c.desiredPosition ?? '—'}</strong>
          </span>
          <div ref={headerMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setHeaderMenuOpen(o => !o)}
              style={S.kebabBtn}
              aria-label="More actions"
            >
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </button>
            {headerMenuOpen && (
              <div style={S.reviewHeaderMenu}>
                <button
                  type="button"
                  className="kc-row-menu-item"
                  style={S.menuItemBtn}
                  onClick={() => { props.onOpenModal(); setHeaderMenuOpen(false); }}
                >
                  <FontAwesomeIcon icon={faPen} fixedWidth style={{ marginRight: 8, color: C.primary, fontSize: 12 }} />
                  Open full details
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Salary + Background — paired blocks so the reviewer can weigh
          the salary ask against the candidate's experience and
          qualification without scrolling. Salary keeps the wider left
          column since the justification prose is usually the longest. */}
      {(c.expectedSalary != null || c.salaryJustification || c.experienceRange || c.qualification) && (
        <div style={S.salaryPairRow}>
          {/* Salary block — headline number + justification */}
          {(c.expectedSalary != null || c.salaryJustification) && (
            <div style={{ ...S.reviewQuoteBlock('salary'), flex: '2 1 320px' }}>
              <div style={S.salaryBlockTopRow}>
                <div style={S.reviewQuoteLabel('salary')}>
                  <FontAwesomeIcon icon={faSackDollar} /> Salary Ask
                </div>
                {c.expectedSalary != null && (
                  <div style={S.reviewSalary}>
                    RM {c.expectedSalary.toLocaleString()}
                    {c.expectedSalaryMax != null && c.expectedSalaryMax !== c.expectedSalary && (
                      <> – {c.expectedSalaryMax.toLocaleString()}</>
                    )}
                  </div>
                )}
              </div>
              {c.salaryJustification && (
                <p style={S.reviewQuoteText}>{c.salaryJustification}</p>
              )}
            </div>
          )}

          {/* Background block — qualification + experience, so the
              reviewer can decide if the salary ask is reasonable. Uses
              a tinted medallion for the qualification so it visually
              signals the tier (Bachelor's green, Diploma indigo, etc.). */}
          {(c.experienceRange || c.qualification) && (() => {
            const q = QUAL_STYLES[qualKey(c.qualification)];
            const qualLabel = c.qualification?.toLowerCase() === 'others' && c.qualificationOther
              ? `Others — ${c.qualificationOther}`
              : (c.qualification ?? 'Not specified');
            return (
              <div style={{ ...S.reviewQuoteBlock('goals'), flex: '1 1 220px', display: 'flex', flexDirection: 'column' }}>
                <div style={S.reviewQuoteLabel('goals')}>
                  <FontAwesomeIcon icon={faGraduationCap} /> Background
                </div>
                <div style={{ ...S.backgroundList, marginTop: 4, flex: 1, justifyContent: 'center' }}>
                  <div style={S.backgroundRow}>
                    <span style={S.backgroundMedallion(q.bg, q.fg)}>
                      <FontAwesomeIcon icon={q.icon} />
                    </span>
                    <div>
                      <div style={S.backgroundLabel}>Qualification</div>
                      <div style={S.backgroundValue}>{qualLabel}</div>
                    </div>
                  </div>
                  {c.experienceRange && (
                    <div style={S.backgroundRow}>
                      <span style={S.backgroundMedallion(C.primarySoft, C.primaryDeep)}>
                        <FontAwesomeIcon icon={faClock} />
                      </span>
                      <div>
                        <div style={S.backgroundLabel}>Experience</div>
                        <div style={S.backgroundValue}>{c.experienceRange}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {c.whyKindergartenTeacher && (
        <div style={S.reviewQuoteBlock('motivation')}>
          <div style={S.reviewQuoteLabel('motivation')}>
            <FontAwesomeIcon icon={faHeart} /> Why kindergarten teacher?
          </div>
          <p style={S.reviewQuoteText}>{c.whyKindergartenTeacher}</p>
        </div>
      )}
      {c.careerGoals && (
        <div style={S.reviewQuoteBlock('goals')}>
          <div style={S.reviewQuoteLabel('goals')}>
            <FontAwesomeIcon icon={faBullseye} /> 3 – 5 year goals
          </div>
          <p style={S.reviewQuoteText}>{c.careerGoals}</p>
        </div>
      )}

      {/* Anything else — always rendered so an empty block signals "we
          asked but they didn't say", not "we forgot to show it".
          Neutral variant since this is meta-info, not motivation. */}
      <div style={S.reviewQuoteBlock('neutral')}>
        <div style={S.reviewQuoteLabel('neutral')}>
          <FontAwesomeIcon icon={faCircleInfo} /> Anything else we should know?
        </div>
        {c.notes ? (
          <p style={S.reviewQuoteText}>{c.notes}</p>
        ) : (
          <p style={{ ...S.reviewQuoteText, color: C.mutedSoft, fontStyle: 'italic' }}>—</p>
        )}
      </div>

      {/* Footer — meta clusters (timing / start / source) · Open Resume.
          "Open full details" moved to the header kebab menu. */}
      {(() => {
        const wait = waitingSince(c.submittedAt);
        // Compact start-date formatter — omits the year when it's the
        // current year (the vast majority of cases), keeping the row
        // scannable. "23 Jul 2027" only shown for out-of-year dates.
        const thisYear = new Date().getFullYear();
        const startFmt = (v: string | null) => {
          if (!v) return null;
          const d = new Date(v);
          return d.toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short',
            ...(d.getFullYear() !== thisYear ? { year: 'numeric' } : {}),
          });
        };
        // Three logical groups rendered as icon-prefixed clusters with
        // subtle vertical dividers between them:
        //   1. Timing     — when they applied + how long it's been
        //   2. Start      — earliest → preferred availability
        //   3. Source     — self-report ("heard via") + utm attribution
        // Each cluster is independently visible / hidden based on data
        // presence, and the whole row wraps naturally on narrow widths.
        const availStart = startFmt(c.availableFrom);
        const availPref  = startFmt(c.preferredStartDate);
        const hasStart   = availStart || availPref;
        const hasSource  = c.howDidYouKnow || c.utmSource;
        return (
          <div style={S.reviewFooterMeta}>
            <div style={S.footerMetaClusters}>
              {/* Cluster 1 — timing */}
              <span style={S.footerMetaCluster} title={`Applied ${fmtDate(c.submittedAt)}`}>
                <FontAwesomeIcon icon={faClock} style={{ fontSize: 11, color: C.mutedSoft, flexShrink: 0 }} />
                Applied {fmtDate(c.submittedAt)}
                <span style={{ ...S.waitBadge(wait.level), marginLeft: 8 }}>
                  waiting {wait.text}
                </span>
              </span>

              {/* Cluster 2 — start availability */}
              {hasStart && (
                <>
                  <span style={S.footerMetaSep} aria-hidden />
                  <span style={S.footerMetaCluster} title="Earliest available → Preferred start">
                    <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 11, color: C.mutedSoft, flexShrink: 0 }} />
                    {availStart ?? '—'}
                    <span style={{ margin: '0 6px', color: C.mutedSoft }}>→</span>
                    {availPref ?? '—'}
                  </span>
                </>
              )}

              {/* Cluster 3 — source (self-report + utm) */}
              {hasSource && (
                <>
                  <span style={S.footerMetaSep} aria-hidden />
                  <span style={S.footerMetaCluster} title="Heard via (self-report) · via <utm_source>">
                    <FontAwesomeIcon icon={faBullhorn} style={{ fontSize: 11, color: C.mutedSoft, flexShrink: 0 }} />
                    {c.howDidYouKnow ?? 'Unknown source'}
                    {c.utmSource && (
                      <span style={S.footerMetaUtm}>via {c.utmSource}</span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Interview scheduler modal ──────────────────────────────────────────
// Pattern mirrors the Leads AppointmentModal: pick a date, choose a slot
// from a morning/afternoon grid, see clash markers against other events.
// Clash detection combines two feeds:
//   - Upcoming candidate interviews (this candidate's own interview is
//     excluded so rescheduling doesn't clash with itself).
//   - Upcoming lead enquiry appointments — parent visits happening on
//     the same day/time block the interviewer just as another candidate
//     would.
// On save, PATCHes the candidate with interviewStart + interviewEnd and,
// if not already there, moves them to INTERVIEWING.
// Fallback used only if the interview_duration_minutes setting hasn't
// been loaded yet. Once settings resolve, the modal uses the value from
// there (see `durationMin` in InterviewSchedulerModal).
const INTERVIEW_DURATION_MIN = 45;

// Lightweight modal for adding/editing a note on a candidate. Uses the
// same visual language as the scheduler modal (backdrop, card, header,
// footer) but strips it down to a single textarea.
// Modal for rejecting a candidate at the Deciding stage. Requires a
// selected reason (preset list + "Others" free-text), plus an optional
// admin note. Mirrors the leads RejectModal pattern so HR has the same
// mental model across both funnels.
function RejectCandidateModal(props: {
  candidate: Candidate;
  defaultReason?: string;
  onClose: () => void;
  onRejected: () => void;
}) {
  const { candidate, defaultReason, onClose, onRejected } = props;
  const { showToast } = useToast();
  const [reason, setReason] = useState(defaultReason ?? '');
  const [otherText, setOtherText] = useState('');
  const [notes, setNotes] = useState(candidate.adminNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isOther = reason === 'Others';
  const finalReason = isOther ? otherText.trim() : reason;
  const canReject = !!finalReason && !saving;

  const handleConfirm = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    if (isOther && !otherText.trim()) { setError('Please describe the reason.'); return; }
    setSaving(true); setError('');
    try {
      await updateCandidate(candidate.id, {
        status: 'REJECTED',
        rejectionReason: finalReason,
        adminNotes: notes.trim() || null,
      });
      showToast('Candidate rejected');
      onRejected();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to reject.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={ISM.backdrop} onClick={onClose}>
      <div style={{ ...ISM.card, width: 'min(460px, 100%)' }} onClick={e => e.stopPropagation()}>
        <div style={ISM.header}>
          <div>
            <h2 style={ISM.title}>Reject candidate</h2>
            <div style={ISM.subtitle}>{candidate.fullName} · {candidate.phone}</div>
          </div>
          <button onClick={onClose} style={ISM.closeBtn} title="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div style={{ padding: '18px 24px 20px', display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>
              Reason <span style={{ color: C.danger }}>*</span>
            </span>
            <select
              value={reason}
              onChange={e => { setReason(e.target.value); setError(''); }}
              style={{
                padding: '9px 10px', border: `1px solid ${C.border}`, borderRadius: 8,
                fontSize: 13, background: '#fafafa', color: C.text, cursor: 'pointer',
              }}
            >
              <option value="">— select reason —</option>
              {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="Others">Others</option>
            </select>
          </label>

          {isOther && (
            <input
              value={otherText}
              onChange={e => { setOtherText(e.target.value); setError(''); }}
              placeholder="Describe the reason…"
              autoFocus
              style={{
                padding: '9px 10px', border: `1px solid ${C.border}`, borderRadius: 8,
                fontSize: 13, background: '#fafafa', color: C.text,
              }}
            />
          )}

          <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>
              Notes <span style={{ fontSize: 11, fontWeight: 400, color: C.mutedSoft }}>(optional)</span>
            </span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any remarks before confirming…"
              style={{
                display: 'block', width: '100%', height: 90, resize: 'vertical' as const,
                padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const,
                lineHeight: 1.5, background: '#fafafa', color: C.text,
              }}
            />
          </label>
        </div>

        {error && <div style={ISM.errorRow}>{error}</div>}

        <div style={ISM.footer}>
          <button onClick={onClose} style={ISM.cancelBtn}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleConfirm}
            disabled={!canReject}
            style={{
              padding: '9px 20px',
              background: C.danger, color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: canReject ? 'pointer' : 'default',
              opacity: canReject ? 1 : 0.6,
            }}
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Send-offer modal — collects the final offer details (salary, start
// date), previews the WhatsApp message from settings.offer_wa_template
// (EN/中文), and on Confirm PATCHes the candidate to OFFER_SENT + can
// open the pre-filled WhatsApp draft in one click. Mirrors the layout
// of the interview scheduler modal so admins have one mental model.
function SendOfferModal(props: {
  candidate: Candidate;
  onClose: () => void;
  onSent: () => void;
}) {
  const { candidate, onClose, onSent } = props;
  const { showToast } = useToast();
  const [salary, setSalary] = useState<string>(String(candidate.expectedSalary ?? ''));
  const [startDate, setStartDate] = useState<string>(candidate.preferredStartDate?.slice(0, 10) ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msgEditing, setMsgEditing] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('en');
  const [messageEn, setMessageEn] = useState('');
  const [messageZh, setMessageZh] = useState('');
  const [messageEnEdited, setMessageEnEdited] = useState(false);
  const [messageZhEdited, setMessageZhEdited] = useState(false);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const templateEn = (settings?.offer_wa_template as string | undefined) ?? '';
  const templateZh = (settings?.offer_wa_template_zh as string | undefined) ?? '';
  const message = lang === 'en' ? messageEn : messageZh;
  const setMessage = (v: string) => {
    if (lang === 'en') { setMessageEn(v); setMessageEnEdited(true); }
    else               { setMessageZh(v); setMessageZhEdited(true); }
  };

  const salaryNum = Number(salary);
  const canConfirm = salary.trim().length > 0 && !isNaN(salaryNum) && salaryNum > 0 && !saving;

  // Re-fill both language previews whenever salary / start / templates
  // change (unless the admin hand-edited that language).
  useEffect(() => {
    if (!isNaN(salaryNum) && salaryNum > 0) {
      if (!messageEnEdited) setMessageEn(applyOfferTemplate(templateEn, candidate, salaryNum, startDate || null, false));
      if (!messageZhEdited) setMessageZh(applyOfferTemplate(templateZh, candidate, salaryNum, startDate || null, true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salary, startDate, templateEn, templateZh, messageEnEdited, messageZhEdited]);

  const persist = async () => {
    if (!canConfirm) { setError('Please enter a salary.'); return; }
    setSaving(true); setError('');
    try {
      await updateCandidate(candidate.id, {
        status: 'OFFER_SENT',
        expectedSalary: salaryNum,
        preferredStartDate: startDate || null,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send offer.');
      setSaving(false);
      throw e;
    }
    setSaving(false);
  };

  const handleSave = async () => {
    try { await persist(); showToast('Offer sent'); onSent(); } catch { /* error already surfaced */ }
  };

  const handleSaveAndWa = async () => {
    if (!candidate.phone) { setError('No phone on file.'); return; }
    try {
      await persist();
      const href = `${waLink(candidate.phone)}?text=${encodeURIComponent(message)}`;
      window.open(href, '_blank', 'noopener,noreferrer');
      showToast('Offer sent');
      onSent();
    } catch { /* error already surfaced */ }
  };

  return (
    <div style={ISM.backdrop} onClick={onClose}>
      <div style={ISM.card} onClick={e => e.stopPropagation()}>
        <div style={ISM.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...ISM.headerIcon, background: C.successSoft, color: C.success }}>
              <FontAwesomeIcon icon={faPaperPlane} />
            </div>
            <div>
              <h2 style={ISM.title}>Send offer</h2>
              <div style={ISM.subtitle}>
                {candidate.fullName} · {candidate.desiredPosition ?? 'No position'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={ISM.closeBtn} title="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div style={ISM.body}>
          {/* Left — offer terms */}
          <div style={ISM.leftCol}>
            <div style={ISM.sectionLabel}>
              <span style={ISM.stepChip}>1</span> Offer terms
            </div>

            <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>
                Monthly salary (RM) <span style={{ color: C.danger }}>*</span>
              </span>
              <input
                type="number"
                min={0}
                value={salary}
                onChange={e => setSalary(e.target.value)}
                style={ISM.dateInput}
              />
              {candidate.expectedSalary != null && (
                <span style={{ fontSize: 11, color: C.mutedSoft }}>
                  Candidate asked for RM {candidate.expectedSalary.toLocaleString()}
                </span>
              )}
            </label>

            <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={ISM.dateInput}
              />
              {candidate.preferredStartDate && (
                <span style={{ fontSize: 11, color: C.mutedSoft }}>
                  Candidate preferred {new Date(candidate.preferredStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </label>
          </div>

          {/* Right — message preview */}
          <div style={ISM.rightCol}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={ISM.sectionLabel}>
                <span style={ISM.stepChip}>2</span> Message preview
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={ISM.langSwitch}>
                  {(['en', 'zh'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLang(t)}
                      style={{
                        ...ISM.langBtn,
                        background: lang === t ? '#fff' : 'transparent',
                        color: lang === t ? '#1e293b' : '#94a3b8',
                        boxShadow: lang === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      {t === 'en' ? 'EN' : '中文'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setMsgEditing(v => !v)}
                  style={ISM.editToggle}
                >
                  {msgEditing ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {(lang === 'en' ? templateEn : templateZh) === '' ? (
              <div style={ISM.msgMissing}>
                No {lang === 'en' ? 'English' : 'Chinese'} offer template configured.
                Seed one by setting <code>offer_wa_template{lang === 'en' ? '' : '_zh'}</code> in system settings.
              </div>
            ) : msgEditing ? (
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                style={ISM.msgEdit}
              />
            ) : (
              <div style={ISM.msgPreview}>
                {message || <span style={{ color: C.mutedSoft, fontStyle: 'italic' }}>Fill in the salary to preview</span>}
              </div>
            )}
          </div>
        </div>

        {error && <div style={ISM.errorRow}>{error}</div>}

        <div style={ISM.footer}>
          <button onClick={onClose} style={ISM.cancelBtn}>Cancel</button>
          <div style={{ flex: 1 }} />
          {candidate.phone && (
            <button
              type="button"
              style={ISM.waBtn}
              title="Save and open WhatsApp with the offer message"
              disabled={!canConfirm}
              onClick={handleSaveAndWa}
            >
              <FontAwesomeIcon icon={faWhatsapp} /> {saving ? 'Sending…' : 'Send & Open WhatsApp'}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!canConfirm}
            style={{ ...ISM.saveBtn, opacity: canConfirm ? 1 : 0.6 }}
          >
            {saving ? 'Sending…' : 'Send offer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm interview modal ────────────────────────────────────────────
// Fired from the CONTACTED row's primary CTA. Shows the interview slot
// summary (from candidate.interviewStart / End) + a WhatsApp confirmation
// message preview so the admin can send "your interview is confirmed for
// X at Y" and advance the candidate to INTERVIEWING in one flow. Mirrors
// the SendOfferModal layout so admins have one mental model for
// "compose + send + status change" moments.
const DEFAULT_CONFIRM_INTERVIEW_TEMPLATE_EN = `Hi Ms. {{firstName}},

*Interview Details:*

Date: *{{interviewDate}} ({{interviewDay}})*
Time: {{interviewTime}}
Location: 2, Jalan Indah 19/3, Taman Bukit Indah, 81200 JB, Johor

https://maps.app.goo.gl/oEcyAyiNHyqFfNEG7

We're looking forward to meeting you and discussing this opportunity further.`;
const DEFAULT_CONFIRM_INTERVIEW_TEMPLATE_ZH = `{{firstName}}老师您好，

*面试详情：*

日期：*{{interviewDate}} ({{interviewDay}})*
时间：{{interviewTime}}
地点：2, Jalan Indah 19/3, Taman Bukit Indah, 81200 JB, Johor

https://maps.app.goo.gl/oEcyAyiNHyqFfNEG7

期待与您见面，进一步讨论这个机会。`;

function ConfirmInterviewModal(props: {
  candidate: Candidate;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const { candidate, onClose, onConfirmed } = props;
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msgEditing, setMsgEditing] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('en');
  const [messageEn, setMessageEn] = useState('');
  const [messageZh, setMessageZh] = useState('');
  const [messageEnEdited, setMessageEnEdited] = useState(false);
  const [messageZhEdited, setMessageZhEdited] = useState(false);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const templateEn = (settings?.interview_confirm_wa_template as string | undefined)?.trim() || DEFAULT_CONFIRM_INTERVIEW_TEMPLATE_EN;
  const templateZh = (settings?.interview_confirm_wa_template_zh as string | undefined)?.trim() || DEFAULT_CONFIRM_INTERVIEW_TEMPLATE_ZH;
  const confirmLeadDays = Number(settings?.recruitment_interview_confirm_lead_days) || 2;
  const message = lang === 'en' ? messageEn : messageZh;
  const setMessage = (v: string) => {
    if (lang === 'en') { setMessageEn(v); setMessageEnEdited(true); }
    else               { setMessageZh(v); setMessageZhEdited(true); }
  };

  // Slot is fixed for this modal — read from the candidate's stored
  // interview times. If missing (unusual for a CONTACTED row), fall
  // back to "now" so the preview still renders something sane; the
  // admin can hand-edit the message before sending.
  const start = candidate.interviewStart ? new Date(candidate.interviewStart) : new Date();
  const end = candidate.interviewEnd
    ? new Date(candidate.interviewEnd)
    : new Date(start.getTime() + 45 * 60_000);
  const hasSlot = !!candidate.interviewStart;

  useEffect(() => {
    if (!messageEnEdited) setMessageEn(applyInterviewTemplate(templateEn, candidate, start, end, false, confirmLeadDays));
    if (!messageZhEdited) setMessageZh(applyInterviewTemplate(templateZh, candidate, start, end, true, confirmLeadDays));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateEn, templateZh, messageEnEdited, messageZhEdited, candidate.id]);

  const persist = async () => {
    setSaving(true); setError('');
    try {
      await updateCandidate(candidate.id, { status: 'INTERVIEWING' });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to confirm interview.');
      setSaving(false);
      throw e;
    }
    setSaving(false);
  };

  const handleConfirm = async () => {
    try { await persist(); showToast('Interview confirmed'); onConfirmed(); } catch { /* surfaced */ }
  };

  const handleConfirmAndWa = async () => {
    if (!candidate.phone) { setError('No phone on file.'); return; }
    try {
      await persist();
      const href = `${waLink(candidate.phone)}?text=${encodeURIComponent(message)}`;
      window.open(href, '_blank', 'noopener,noreferrer');
      showToast('Interview confirmed');
      onConfirmed();
    } catch { /* surfaced */ }
  };

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const durationMin = Math.round((end.getTime() - start.getTime()) / 60_000);


  return (
    <div style={ISM.backdrop} onClick={onClose}>
      <div style={ISM.card} onClick={e => e.stopPropagation()}>
        <div style={ISM.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={ISM.headerIcon}>
              <FontAwesomeIcon icon={faCalendarDays} />
            </div>
            <div>
              <h2 style={ISM.title}>Confirm interview</h2>
              <div style={ISM.subtitle}>
                {candidate.fullName} · {candidate.desiredPosition ?? 'No position'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={ISM.closeBtn} title="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Slot summary */}
        <div style={ISM.summaryWrap}>
          <div style={{
            ...ISM.summary,
            background: hasSlot ? '#f0f9ff' : '#fffbeb',
            borderColor: hasSlot ? '#bae6fd' : '#fde68a',
          }}>
            <div style={ISM.summaryDate}>
              <span style={ISM.summaryDow}>{start.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span style={ISM.summaryDay}>{start.getDate()}</span>
              <span style={ISM.summaryMonth}>{start.toLocaleDateString('en-US', { month: 'short' })}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={ISM.summaryTime}>{fmtTime(start)} – {fmtTime(end)}</div>
              <div style={ISM.summaryFullDate}>
                {start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}{durationMin} min
                {!hasSlot && ' · No slot on file'}
              </div>
            </div>
          </div>
        </div>

        {/* Body — single column since the slot is fixed and there's
            nothing else to collect. Matches the Schedule modal's message
            preview card exactly. Generous top padding pushes the "1
            Message preview" section label well clear of the summary
            card above so the header isn't crammed against it. */}
        <div style={{ ...ISM.body, paddingTop: 32 }}>
          <div style={{ ...ISM.rightCol, flex: 1 }}>
            {/* Align to the bottom of the flex row so the label and
                the toggle buttons all sit on the same baseline right
                above the message box — the label reads as the box's
                own header instead of floating above it. */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={ISM.sectionLabel}>
                <span style={ISM.stepChip}>1</span> Message preview
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={ISM.langSwitch}>
                  {(['en', 'zh'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLang(t)}
                      style={{
                        ...ISM.langBtn,
                        background: lang === t ? '#fff' : 'transparent',
                        color: lang === t ? '#1e293b' : '#94a3b8',
                        boxShadow: lang === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      {t === 'en' ? 'EN' : '中文'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setMsgEditing(v => !v)}
                  style={ISM.editToggle}
                >
                  {msgEditing ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>
            {msgEditing ? (
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                style={{ ...ISM.msgEdit, minHeight: 260 }}
              />
            ) : (
              <div style={{ ...ISM.msgPreview, minHeight: 260 }}>
                {message || <span style={{ color: C.mutedSoft, fontStyle: 'italic' }}>Fill in the slot to preview</span>}
              </div>
            )}
          </div>
        </div>

        {error && <div style={ISM.errorRow}>{error}</div>}

        <div style={ISM.footer}>
          <button onClick={onClose} style={ISM.cancelBtn}>Cancel</button>
          <div style={{ flex: 1 }} />
          {candidate.phone && (
            <button
              type="button"
              style={ISM.waBtn}
              title="Move to Interviewing and open WhatsApp with the confirmation message"
              disabled={saving}
              onClick={handleConfirmAndWa}
            >
              <FontAwesomeIcon icon={faWhatsapp} /> {saving ? 'Confirming…' : 'Confirm & Open WhatsApp'}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={saving}
            style={{ ...ISM.saveBtn, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteEditorModal(props: {
  candidate: Candidate;
  onClose: () => void;
  onSaved: (updated?: Candidate | null) => void;
}) {
  const { candidate, onClose, onSaved } = props;
  const { showToast } = useToast();
  const [note, setNote] = useState(candidate.adminNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const trimmed = note.trim();
      await updateCandidate(candidate.id, { adminNotes: trimmed || null });
      showToast(trimmed ? 'Note saved' : 'Note cleared');
      // Close after saving; parent will refetch and reflect the change.
      onSaved(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={ISM.backdrop} onClick={onClose}>
      <div style={{ ...ISM.card, width: 'min(560px, 100%)' }} onClick={e => e.stopPropagation()}>
        <div style={ISM.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...ISM.headerIcon, background: '#fef3c7', color: '#d97706' }}>
              <FontAwesomeIcon icon={faNoteSticky} />
            </div>
            <div>
              <h2 style={ISM.title}>{candidate.adminNotes ? 'Edit note' : 'Add note'}</h2>
              <div style={ISM.subtitle}>{candidate.fullName}</div>
            </div>
          </div>
          <button onClick={onClose} style={ISM.closeBtn} title="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div style={{ padding: '18px 24px 4px' }}>
          <textarea
            autoFocus
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Referred by Aina · asked about probation length · followup Fri"
            style={{
              display: 'block', width: '100%', height: 180,
              resize: 'none' as const,
              padding: '11px 13px', border: `1px solid ${C.border}`, borderRadius: 8,
              fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const,
              lineHeight: 1.55, background: '#fff', color: C.text,
            }}
          />
        </div>

        {error && <div style={ISM.errorRow}>{error}</div>}

        <div style={ISM.footer}>
          <button onClick={onClose} style={ISM.cancelBtn}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button onClick={handleSave} disabled={saving} style={ISM.saveBtn}>
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InterviewSchedulerModal(props: {
  candidate: Candidate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { candidate, onClose, onSaved } = props;
  const qc = useQueryClient();
  const { showToast } = useToast();

  // Default to the existing interview time (reschedule) or the next
  // weekday at 10:00 (new booking).
  const initial = (() => {
    if (candidate.interviewStart) {
      const d = new Date(candidate.interviewStart);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
  })();
  const [dateTime, setDateTime] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msgEditing, setMsgEditing] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('en');
  // Per-language message state so switching langs doesn't clobber edits.
  const [messageEn, setMessageEn] = useState('');
  const [messageZh, setMessageZh] = useState('');
  const [messageEnEdited, setMessageEnEdited] = useState(false);
  const [messageZhEdited, setMessageZhEdited] = useState(false);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const templateEn = (settings?.interview_wa_template as string | undefined) ?? '';
  const templateZh = (settings?.interview_wa_template_zh as string | undefined) ?? '';
  // Admin-configurable interview duration (fallback to the module-level
  // constant when settings haven't resolved yet).
  const durationMin = Number(settings?.interview_duration_minutes) || INTERVIEW_DURATION_MIN;
  // How many calendar days after "now" the candidate has to confirm the
  // interview — feeds {{confirmByDate}} in the invitation template.
  const confirmLeadDays = Number(settings?.recruitment_interview_confirm_lead_days) || 2;
  const message = lang === 'en' ? messageEn : messageZh;
  const setMessage = (v: string) => {
    if (lang === 'en') { setMessageEn(v); setMessageEnEdited(true); }
    else               { setMessageZh(v); setMessageZhEdited(true); }
  };

  const { data: otherInterviews = [] } = useQuery({
    queryKey: ['upcoming-interviews'],
    queryFn: fetchUpcomingInterviews,
    staleTime: 30_000,
  });
  const { data: leadAppts = [] } = useQuery({
    queryKey: ['upcoming-appointments'],
    queryFn: fetchUpcomingAppointments,
    staleTime: 30_000,
  });
  // Google Calendar connection status. Force a fresh check when the
  // modal opens (staleTime: 0) — a cached "connected: true" from
  // earlier can be a lie if the token has since been revoked
  // (invalid_grant). The pre-flight lets us disable the Schedule
  // button + show the connect-first banner instead of failing on
  // save with a cryptic Google error.
  const { data: googleStatus, isLoading: googleLoading } = useQuery({
    queryKey: ['google-status'],
    queryFn: () => import('../api/google.js').then(m => m.getGoogleStatus()),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const calendarDisconnected = !googleLoading && googleStatus?.connected === false;


  // Normalize both feeds to a common { id, label, start, end } shape.
  const events = useMemo(() => {
    const iv = otherInterviews
      .filter(x => x.id !== candidate.id)
      .map(x => ({
        id: `iv:${x.id}`,
        label: `Interview · ${x.fullName}`,
        kind: 'interview' as const,
        start: new Date(x.interviewStart),
        end: x.interviewEnd
          ? new Date(x.interviewEnd)
          : new Date(new Date(x.interviewStart).getTime() + durationMin * 60_000),
      }));
    const eq = leadAppts.map(a => ({
      id: `lead:${a.id}`,
      label: `Enquiry · ${a.childName}`,
      kind: 'enquiry' as const,
      start: new Date(a.appointmentStart),
      end: a.appointmentEnd
        ? new Date(a.appointmentEnd)
        : new Date(new Date(a.appointmentStart).getTime() + durationMin * 60_000),
    }));
    return [...iv, ...eq];
  }, [otherInterviews, leadAppts, candidate.id]);

  const selected = dateTime ? new Date(dateTime) : null;
  const selectedEnd = selected ? new Date(selected.getTime() + durationMin * 60_000) : null;

  const clashes = selected && selectedEnd
    ? events.filter(ev => ev.start < selectedEnd && ev.end > selected)
    : [];
  const hasClash = clashes.length > 0;

  // Build morning + afternoon slot lists in half-hour steps.
  const timeSlots = (() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    for (let h = 8; h <= 17; h++) {
      for (const m of ['00', '30']) {
        if (h === 17 && m === '30') continue;
        const s = `${String(h).padStart(2, '0')}:${m}`;
        (h < 12 ? morning : afternoon).push(s);
      }
    }
    return { morning, afternoon };
  })();
  const dateStr = dateTime.split('T')[0];
  const selectedTime = dateTime.split('T')[1] || '';
  const slotClashes = new Set<string>();
  for (const slot of [...timeSlots.morning, ...timeSlots.afternoon]) {
    const sStart = new Date(`${dateStr}T${slot}`);
    const sEnd = new Date(sStart.getTime() + durationMin * 60_000);
    if (events.some(ev => ev.start < sEnd && ev.end > sStart)) slotClashes.add(slot);
  }

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const fmtSlotLabel = (slot: string) =>
    new Date(`2000-01-01T${slot}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Keep both language previews in sync with the selected slot — unless
  // the admin has hand-edited that language (then leave it alone).
  useEffect(() => {
    if (!selected || !selectedEnd) return;
    if (!messageEnEdited) setMessageEn(applyInterviewTemplate(templateEn, candidate, selected, selectedEnd, false, confirmLeadDays));
    if (!messageZhEdited) setMessageZh(applyInterviewTemplate(templateZh, candidate, selected, selectedEnd, true, confirmLeadDays));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateTime, templateEn, templateZh, messageEnEdited, messageZhEdited, confirmLeadDays]);

  // Persist to the DB via the calendar-sync endpoint. `skipCalendar`
  // is set when the admin explicitly chose the fallback link after a
  // Google Calendar failure — the DB still gets the interview, but no
  // event is created.
  const doPersist = async (skipCalendar: boolean) => {
    if (!selected || !selectedEnd) { setError('Pick a date and time.'); return; }
    setSaving(true); setError('');
    try {
      await scheduleCandidateInterview(candidate.id, {
        interviewStart: selected.toISOString(),
        interviewEnd: selectedEnd.toISOString(),
        whatsappMessage: message,
        skipCalendar,
      });
      showToast(candidate.interviewStart ? 'Interview rescheduled' : 'Interview scheduled');
      // Modal-scoped: helper isn't in reach here; invalidate every
      // candidate-related feed explicitly so both the main list and
      // the parent's right-side context panel refresh.
      qc.invalidateQueries({ queryKey: ['candidates'] });
      qc.invalidateQueries({ queryKey: ['candidate-stats'] });
      qc.invalidateQueries({ queryKey: ['upcoming-interviews'] });
      qc.invalidateQueries({ queryKey: ['candidates-pending-decision'] });
      qc.invalidateQueries({ queryKey: ['candidates-offer-sent'] });
      onSaved();
    } catch (e: any) {
      // Bubble the message up so the UI can offer a "save without
      // calendar" retry link (see the error block in JSX below).
      setError(e?.message ?? 'Failed to save interview.');
    } finally {
      setSaving(false);
    }
  };
  const handleSave = () => doPersist(false);
  const handleSaveNoCalendar = () => doPersist(true);

  return (
    <div style={ISM.backdrop} onClick={onClose}>
      <div style={ISM.card} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={ISM.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={ISM.headerIcon}>
              <FontAwesomeIcon icon={faCalendarDays} />
            </div>
            <div>
              <h2 style={ISM.title}>
                {candidate.interviewStart ? 'Reschedule interview' : 'Schedule interview'}
              </h2>
              <div style={ISM.subtitle}>
                {candidate.fullName} · {candidate.desiredPosition ?? 'No position'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={ISM.closeBtn} title="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Selected slot summary */}
        <div style={ISM.summaryWrap}>
          <div style={{
            ...ISM.summary,
            background: hasClash ? '#fffbeb' : '#f0f9ff',
            borderColor: hasClash ? '#fde68a' : '#bae6fd',
          }}>
            <div style={ISM.summaryDate}>
              <span style={ISM.summaryDow}>{selected!.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span style={ISM.summaryDay}>{selected!.getDate()}</span>
              <span style={ISM.summaryMonth}>{selected!.toLocaleDateString('en-US', { month: 'short' })}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={ISM.summaryTime}>{fmtTime(selected!)} – {fmtTime(selectedEnd!)}</div>
              <div style={ISM.summaryFullDate}>
                {selected!.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}{durationMin} min
              </div>
            </div>
            {hasClash && (
              <div style={ISM.clashCol}>
                <div style={ISM.clashTitle}>
                  <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: '#f59e0b' }} />
                  Conflicts
                </div>
                {clashes.slice(0, 3).map(c => (
                  <div key={c.id} style={ISM.clashRow}>
                    {c.label} · {fmtTime(c.start)}–{fmtTime(c.end)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={ISM.body}>
          {/* Left — date + slot grid */}
          <div style={ISM.leftCol}>
            <div style={ISM.sectionLabel}>
              <span style={ISM.stepChip}>1</span> Date &amp; time
            </div>
            <input
              type="date"
              value={dateStr}
              onChange={e => {
                const time = selectedTime || '10:00';
                setDateTime(`${e.target.value}T${time}`);
              }}
              style={ISM.dateInput}
            />

            <div style={{ marginTop: 12 }}>
              <div style={ISM.slotGroupLabel}>Morning</div>
              <div style={ISM.slotGrid}>
                {timeSlots.morning.map(slot => {
                  const isSel = selectedTime === slot;
                  const isClash = slotClashes.has(slot);
                  return (
                    <button
                      key={slot}
                      onClick={() => setDateTime(`${dateStr}T${slot}`)}
                      style={{
                        ...ISM.slotBtn,
                        background: isSel ? (isClash ? '#fef3c7' : C.primary)
                                    : isClash ? '#fffbeb'
                                    : '#f1f5f9',
                        color: isSel ? (isClash ? '#92400e' : '#fff')
                                : isClash ? '#92400e'
                                : '#334155',
                        boxShadow: isSel && isClash ? 'inset 0 0 0 2px #f59e0b' : 'none',
                      }}
                    >
                      {fmtSlotLabel(slot)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={ISM.slotGroupLabel}>Afternoon</div>
              <div style={ISM.slotGrid}>
                {timeSlots.afternoon.map(slot => {
                  const isSel = selectedTime === slot;
                  const isClash = slotClashes.has(slot);
                  return (
                    <button
                      key={slot}
                      onClick={() => setDateTime(`${dateStr}T${slot}`)}
                      style={{
                        ...ISM.slotBtn,
                        background: isSel ? (isClash ? '#fef3c7' : C.primary)
                                    : isClash ? '#fffbeb'
                                    : '#f1f5f9',
                        color: isSel ? (isClash ? '#92400e' : '#fff')
                                : isClash ? '#92400e'
                                : '#334155',
                        boxShadow: isSel && isClash ? 'inset 0 0 0 2px #f59e0b' : 'none',
                      }}
                    >
                      {fmtSlotLabel(slot)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right — WhatsApp template preview.
              Three rows stacked: section label · toolbar (tabs + Edit) ·
              message box. Kept unwrapped rather than inside a card so
              the toolbar reads as a control row, not part of the message. */}
          <div style={ISM.rightCol}>
            <div style={{ ...ISM.sectionLabel, marginBottom: 10 }}>
              <span style={ISM.stepChip}>2</span> Message preview
            </div>
            <div style={ISM.msgToolbar}>
              <div style={ISM.langSwitch}>
                {(['en', 'zh'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLang(t)}
                    style={{
                      ...ISM.langBtn,
                      background: lang === t ? '#fff' : 'transparent',
                      color: lang === t ? '#1e293b' : '#94a3b8',
                      boxShadow: lang === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    {t === 'en' ? 'EN' : '中文'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMsgEditing(v => !v)}
                style={ISM.editToggle}
              >
                <FontAwesomeIcon icon={faPen} style={{ fontSize: 10 }} /> {msgEditing ? 'Done' : 'Edit'}
              </button>
            </div>
            {(lang === 'en' ? templateEn : templateZh) === '' ? (
              <div style={ISM.msgMissing}>
                No {lang === 'en' ? 'English' : 'Chinese'} interview template configured.
                Seed one by setting <code>interview_wa_template{lang === 'en' ? '' : '_zh'}</code> in system settings.
              </div>
            ) : msgEditing ? (
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                style={ISM.msgEdit}
              />
            ) : (
              <div style={ISM.msgPreview}>
                {message || <span style={{ color: C.mutedSoft, fontStyle: 'italic' }}>Pick a date and time to preview</span>}
              </div>
            )}
            {(lang === 'en' ? messageEnEdited : messageZhEdited) && (
              <button
                type="button"
                onClick={() => {
                  if (lang === 'en') {
                    setMessageEnEdited(false);
                    if (selected && selectedEnd) setMessageEn(applyInterviewTemplate(templateEn, candidate, selected, selectedEnd, false, confirmLeadDays));
                  } else {
                    setMessageZhEdited(false);
                    if (selected && selectedEnd) setMessageZh(applyInterviewTemplate(templateZh, candidate, selected, selectedEnd, true, confirmLeadDays));
                  }
                }}
                style={ISM.resetLink}
              >
                Reset to template
              </button>
            )}

          </div>
        </div>

        {/* Preflight — surfaced when Google Calendar is disconnected
            (or the token was revoked). Blocks the primary save so the
            admin isn't left staring at a cryptic error after the fact,
            while still offering the "no calendar" escape hatch. */}
        {calendarDisconnected && (
          <div style={ISM.warnRow}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Google Calendar isn't connected</div>
            <div style={{ lineHeight: 1.5 }}>
              <a href="/settings/calendar" style={{ color: '#92400e', fontWeight: 600, textDecoration: 'underline' }}>
                Connect it in Settings
              </a>
              {' '}before scheduling, or{' '}
              <button
                type="button"
                onClick={handleSaveNoCalendar}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#92400e', fontWeight: 600, fontSize: 12, textDecoration: 'underline' }}
              >
                save the interview without calendar sync
              </button>.
            </div>
          </div>
        )}

        {error && (
          <div style={ISM.errorRow}>
            {/Google/i.test(error) ? (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Google Calendar sync failed</div>
                <div style={{ lineHeight: 1.5 }}>
                  {error.replace(/^Google Calendar error:\s*/i, '')}. You can{' '}
                  <button
                    type="button"
                    onClick={handleSaveNoCalendar}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#92400e', fontWeight: 600, fontSize: 12, textDecoration: 'underline' }}
                  >
                    save the interview without adding to Google Calendar
                  </button>
                  , or reconnect Calendar in Settings and retry.
                </div>
              </div>
            ) : error}
          </div>
        )}

        {/* Footer */}
        <div style={ISM.footer}>
          <button onClick={onClose} style={ISM.cancelBtn}>Cancel</button>
          <div style={{ flex: 1 }} />
          {candidate.phone && selected && (
            <button
              type="button"
              style={{ ...ISM.waBtn, opacity: calendarDisconnected ? 0.55 : 1 }}
              disabled={saving || calendarDisconnected}
              onClick={async () => {
                await handleSave();
                const href = `${waLink(candidate.phone)}?text=${encodeURIComponent(message)}`;
                window.open(href, '_blank', 'noopener,noreferrer');
              }}
            >
              <FontAwesomeIcon icon={faWhatsapp} /> {saving
                ? 'Saving…'
                : candidate.interviewStart
                  ? 'Reschedule & Open WhatsApp'
                  : 'Schedule & Open WhatsApp'}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || calendarDisconnected}
            style={{ ...ISM.saveBtn, opacity: calendarDisconnected ? 0.55 : 1 }}
          >
            {saving ? 'Saving…' : candidate.interviewStart ? 'Reschedule' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ISM = {
  backdrop: {
    position: 'fixed' as const, inset: 0, background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 24,
  } as React.CSSProperties,
  card: {
    background: '#fff', borderRadius: 14, width: 'min(880px, 100%)',
    maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' as const,
    boxShadow: '0 24px 60px rgba(15,23,42,0.25)', overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  } as React.CSSProperties,
  headerIcon: {
    width: 36, height: 36, borderRadius: 8, background: '#eef2ff',
    color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15,
  } as React.CSSProperties,
  title: { margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 } as React.CSSProperties,
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 } as React.CSSProperties,
  closeBtn: {
    background: 'none', border: 'none', fontSize: 15, cursor: 'pointer',
    color: '#94a3b8', padding: '4px 6px',
  } as React.CSSProperties,

  summaryWrap: { padding: '16px 24px 0' } as React.CSSProperties,
  summary: {
    padding: '12px 16px', borderRadius: 10, border: '1px solid transparent',
    display: 'flex', alignItems: 'center', gap: 14,
  } as React.CSSProperties,
  summaryDate: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    background: '#fff', borderRadius: 8, padding: '6px 12px', border: '1px solid #e0f2fe',
    minWidth: 48, lineHeight: 1,
  } as React.CSSProperties,
  summaryDow: { fontSize: 10, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' } as React.CSSProperties,
  summaryDay: { fontSize: 20, fontWeight: 800, color: '#0c4a6e', lineHeight: 1.2 } as React.CSSProperties,
  summaryMonth: { fontSize: 9, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' } as React.CSSProperties,
  summaryTime: { fontSize: 14, fontWeight: 700, color: '#0c4a6e' } as React.CSSProperties,
  summaryFullDate: { fontSize: 11, color: '#0369a1', marginTop: 2 } as React.CSSProperties,
  clashCol: { marginLeft: 'auto', textAlign: 'right' as const, minWidth: 200, flexShrink: 0 } as React.CSSProperties,
  clashTitle: {
    fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 3,
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5,
  } as React.CSSProperties,
  clashRow: { fontSize: 11, color: '#92400e' } as React.CSSProperties,

  body: { display: 'flex', padding: '16px 24px 20px', gap: 22, overflowY: 'auto' as const } as React.CSSProperties,
  leftCol: { flex: '0 0 330px', paddingRight: 22, borderRight: '1px solid #f1f5f9' } as React.CSSProperties,
  rightCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const } as React.CSSProperties,
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: '#334155', letterSpacing: '0.03em',
    textTransform: 'uppercase' as const, marginBottom: 10,
    display: 'flex', alignItems: 'center', gap: 7,
  } as React.CSSProperties,
  stepChip: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 18, height: 18, borderRadius: '50%',
    background: '#4f46e5', color: '#fff', fontSize: 10, fontWeight: 700,
  } as React.CSSProperties,
  dateInput: {
    display: 'block', width: '100%', padding: '8px 10px',
    border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13,
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
    background: '#fff', color: '#1e293b',
  } as React.CSSProperties,
  slotGroupLabel: {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6,
  } as React.CSSProperties,
  slotGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 } as React.CSSProperties,
  slotBtn: {
    padding: '7px 0', fontSize: 11, fontWeight: 600, borderRadius: 7,
    cursor: 'pointer', border: 'none', outline: 'none',
    transition: 'all 0.12s ease',
  } as React.CSSProperties,

  editToggle: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, color: C.primary, fontWeight: 600, padding: 0,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  } as React.CSSProperties,
  langSwitch: {
    display: 'inline-flex', borderRadius: 6,
    background: '#f1f5f9', padding: 2,
  } as React.CSSProperties,
  langBtn: {
    padding: '2px 11px', borderRadius: 5, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', lineHeight: '18px', border: 'none',
    background: 'transparent', color: '#94a3b8',
  } as React.CSSProperties,
  msgMissing: {
    padding: '12px 14px', borderRadius: 10,
    background: '#fffbeb', border: '1px solid #fde68a',
    color: '#92400e', fontSize: 12, lineHeight: 1.6,
    height: 260, boxSizing: 'border-box' as const,
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  // Legacy standalone preview + editor — still used by the Offer modal.
  msgPreview: {
    background: '#f8faf9', borderRadius: 10, padding: '12px 14px',
    fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const,
    overflowY: 'auto' as const, height: 260,
    border: '1px solid #e5e7eb', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  msgEdit: {
    display: 'block', width: '100%', height: 260,
    resize: 'none' as const,
    padding: '11px 13px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const,
    lineHeight: 1.55, background: '#fff', color: '#1e293b',
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  // Toolbar row for the message preview — lang tabs on the left, Edit
  // action on the right, sitting above the preview box.
  msgToolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, gap: 10,
  } as React.CSSProperties,
  resetLink: {
    background: 'none', border: 'none', padding: 0,
    color: C.muted, fontSize: 11, cursor: 'pointer',
    marginTop: 8, alignSelf: 'flex-start' as const,
    textDecoration: 'underline',
  } as React.CSSProperties,

  errorRow: {
    margin: '0 24px 12px', padding: '8px 12px', borderRadius: 8,
    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
    fontSize: 12,
  } as React.CSSProperties,
  // Amber-toned pre-flight banner. Distinct from the red errorRow so
  // the admin reads it as "you need to do something first" rather
  // than "a save just failed".
  warnRow: {
    margin: '0 24px 12px', padding: '8px 12px', borderRadius: 8,
    background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
    fontSize: 12,
  } as React.CSSProperties,

  footer: {
    padding: '14px 24px', borderTop: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center', gap: 10, background: '#fafbfc',
  } as React.CSSProperties,
  cancelBtn: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
    cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500,
    padding: '9px 16px',
  } as React.CSSProperties,
  saveBtn: {
    padding: '9px 20px', background: '#4f46e5', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
  } as React.CSSProperties,
  waBtn: {
    padding: '9px 16px', background: '#25D366', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
  } as React.CSSProperties,
};

function FilterChipRow(props: {
  label: string;
  options: string[];
  selected: Set<string>;
  labelFor?: (v: string) => string;
  onToggle: (v: string) => void;
}) {
  const label = props.labelFor ?? ((v: string) => v);
  return (
    <div style={S.filterFlexRow}>
      <span style={S.filterInlineLabel}>{props.label}</span>
      {props.options.map(o => {
        const on = props.selected.has(o);
        return (
          <button key={o} onClick={() => props.onToggle(o)} style={S.chip(on)}>
            {on && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} />}
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}

function TabBtn(props: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={props.onClick} style={S.tabBtn(props.active)}>
      {props.label}
      {typeof props.count === 'number' && (
        <span style={S.tabCount(props.active)}>{props.count}</span>
      )}
    </button>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

const S = {
  shell: {
    padding: '28px 32px 40px', maxWidth: 1360, margin: '0 auto',
    color: C.text, background: C.bg, minHeight: '100%',
  } as React.CSSProperties,
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24, gap: 12, flexWrap: 'wrap',
  } as React.CSSProperties,
  h1: {
    fontSize: 24, fontWeight: 700, margin: 0, color: C.text,
    letterSpacing: -0.2,
  } as React.CSSProperties,
  subtitle: {
    fontSize: 14, color: C.muted, margin: '6px 0 0', lineHeight: 1.45,
  } as React.CSSProperties,
  linkBtn: (copied: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: copied ? C.successSoft : C.surface,
    color: copied ? C.success : C.text,
    border: `1px solid ${copied ? '#a7f3d0' : C.border}`,
    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', height: 36,
    boxShadow: SHADOW.sm,
  }),
  linkPopover: {
    position: 'absolute' as const, top: 44, right: 0, zIndex: 30,
    minWidth: 240, background: C.surface,
    border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '8px 6px',
    boxShadow: '0 12px 32px rgba(15,23,42,0.14)',
  } as React.CSSProperties,
  // Same shape as linkPopover but tuned for the smaller kebab in the
  // review-card header — narrower and closer to the trigger.
  reviewHeaderMenu: {
    position: 'absolute' as const, top: 36, right: 0, zIndex: 30,
    minWidth: 200, background: C.surface,
    border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '6px 4px',
    boxShadow: '0 12px 32px rgba(15,23,42,0.14)',
  } as React.CSSProperties,
  linkPopoverLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
    textTransform: 'uppercase' as const, color: C.muted,
    padding: '6px 10px 4px',
  } as React.CSSProperties,
  tabBar: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: 4, marginBottom: 16, flexWrap: 'wrap',
    boxShadow: SHADOW.sm,
  } as React.CSSProperties,
  tabSep: { width: 1, height: 20, background: C.border, margin: '0 4px' } as React.CSSProperties,
  tabBtn: (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '6px 12px', borderRadius: 6, border: 'none',
    fontSize: 13, fontWeight: 600,
    background: active ? C.primary : 'transparent',
    color: active ? '#fff' : C.textSub,
    cursor: 'pointer', height: 30,
    transition: 'background 0.12s, color 0.12s',
  }),
  tabCount: (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 20, height: 18, padding: '0 6px', borderRadius: 999,
    background: active ? 'rgba(255,255,255,0.22)' : C.borderSoft,
    color: active ? '#fff' : C.muted,
    fontSize: 11, fontWeight: 700,
  }),
  toolbar: {
    display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center',
    flexWrap: 'wrap',
  } as React.CSSProperties,
  searchWrap: { position: 'relative', flex: 1, maxWidth: 380, minWidth: 220 } as React.CSSProperties,
  searchIcon: {
    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
    color: C.mutedSoft, fontSize: 13,
  } as React.CSSProperties,
  search: {
    // Right padding widened to 36px so the value never runs under the
    // clear (×) button when the input has content.
    width: '100%', border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '0 36px 0 38px', fontSize: 14, background: C.surface,
    color: C.text, outline: 'none', height: 40,
    boxShadow: SHADOW.sm,
  } as React.CSSProperties,
  searchClearBtn: {
    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
    width: 22, height: 22, borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', color: C.mutedSoft,
    border: 'none', fontSize: 12, cursor: 'pointer',
    padding: 0,
  } as React.CSSProperties,
  select: {
    border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 12px',
    fontSize: 13.5, background: C.surface, color: C.text, outline: 'none',
    height: 40, cursor: 'pointer', boxShadow: SHADOW.sm,
  } as React.CSSProperties,
  tableWrap: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, overflow: 'hidden',
    boxShadow: SHADOW.sm,
  } as React.CSSProperties,
  table: {
    width: '100%', borderCollapse: 'collapse' as const,
  } as React.CSSProperties,
  // ── Comfortable-density div list ──────────────────────────────────
  // Divs (not <table>) so header and row share pixel-identical outer
  // geometry — no colSpan / column-width guessing games.
  divList: {
    display: 'flex', flexDirection: 'column' as const,
  } as React.CSSProperties,
  divHeader: {
    padding: '11px 20px',
    borderBottom: `1px solid ${C.border}`, background: '#fafbfc',
  } as React.CSSProperties,
  divRow: {
    padding: '20px 20px',
    borderBottom: `1px solid ${C.borderSoft}`,
    cursor: 'pointer',
    transition: 'background 0.12s ease',
  } as React.CSSProperties,
  th: {
    textAlign: 'left', padding: '10px 18px',
    fontSize: 11, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.6,
    borderBottom: `1px solid ${C.border}`, background: '#f8fafc',
  } as React.CSSProperties,
  // Comfortable-density thead cell wraps a mirror of the row grid so
  // each column label sits directly over its column value.
  thGridWrap: {
    padding: '11px 20px',
    borderBottom: `1px solid ${C.border}`, background: '#fafbfc',
    textAlign: 'left' as const, // override <th>'s default centered text
  } as React.CSSProperties,
  thLabel: {
    fontSize: 10.5, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase' as const, letterSpacing: 0.7,
    textAlign: 'left' as const,
  } as React.CSSProperties,
  tr: {
    cursor: 'pointer',
    borderBottom: `1px solid ${C.borderSoft}`,
    transition: 'background 0.12s ease',
  } as React.CSSProperties,
  td: {
    padding: '16px 18px', fontSize: 14, color: C.text,
    verticalAlign: 'middle',
  } as React.CSSProperties,
  // Extra-roomy variant for the comfortable-density row — more vertical
  // room so the details grid inside has space to breathe.
  tdRoomy: {
    padding: '18px 20px', fontSize: 14, color: C.text,
  } as React.CSSProperties,
  tdSub: { fontSize: 12, color: C.muted, marginTop: 2 } as React.CSSProperties,
  muted: { color: C.muted, fontStyle: 'italic' } as React.CSSProperties,
  empty: {
    padding: '72px 20px', textAlign: 'center', color: C.muted, fontSize: 14,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  } as React.CSSProperties,
  emptyIcon: {
    width: 56, height: 56, borderRadius: '50%', background: C.primarySoft,
    color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22,
  } as React.CSSProperties,
  emptyTitle: { fontSize: 15, color: C.text, fontWeight: 700 } as React.CSSProperties,
  emptyLine: { fontSize: 13, color: C.muted, maxWidth: 340, lineHeight: 1.5 } as React.CSSProperties,
  statusPill: (bg: string, fg: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: bg, color: fg, padding: '4px 10px',
    borderRadius: 999, fontSize: 12, fontWeight: 600,
  }),
  // Qualification medallion at the front of every row — tinted per tier
  // so the eye can filter SPM/Diploma/Bachelor/Others at a glance.
  // Matches the leads-list source icon style: a plain glyph, no chip / no
  // border / no background — just a muted grey icon. `bg` and `fg` are
  // accepted but intentionally unused so callers don't have to change.
  qualIcon: (_bg: string, _fg: string): React.CSSProperties => ({
    width: 32, height: 32, flexShrink: 0,
    color: C.mutedSoft,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 17,
  }),
  // Line 1 — experience bracket, name, age, hover icons.
  rowLine1: {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
  } as React.CSSProperties,
  // Comfortable row — header cluster with more breathing room than rowLine1.
  rowHeader: {
    display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
  } as React.CSSProperties,
  // Secondary meta line under the name — position + experience read as a
  // single sentence rather than two competing pieces of chrome.
  identityMeta: {
    display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
    fontSize: 12.5, color: C.muted, lineHeight: 1.3, minWidth: 0,
  } as React.CSSProperties,
  rolePill: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: C.textSub, fontWeight: 500,
    overflowWrap: 'anywhere' as const,
  } as React.CSSProperties,
  metaSep: { color: C.mutedSoft, fontSize: 11, flexShrink: 0 } as React.CSSProperties,
  expText: { color: C.muted, fontWeight: 500, whiteSpace: 'nowrap' } as React.CSSProperties,
  // ── Horizontal-spread row grid ────────────────────────────────────────
  // Uses CSS Grid so every attribute has its own column and the
  // available row width is actually consumed. Order of columns:
  //   star | qual | identity+role | salary | location | actions
  // The 1.4fr on identity + 1fr on location lets those flex; salary is
  // auto so the money never wraps under its own label.
  // Column widths chosen for a spreadsheet-like scan: star + medallion
  // hold the left rail, identity flexes wide, salary/location share the
  // remaining space, applied is fixed-narrow, actions sit right-aligned.
  // NB: the actions column is FIXED (not `auto`) — with `auto`, the
  // header "ACTIONS" label collapses to ~40px while the body's button
  // cluster expands to ~320px, and the flex columns (identity, location)
  // absorb the difference asymmetrically, drifting labels off content.
  // Candidate identity | Qualification | Salary | Location | Scheduled | Actions
  // Shortlist toggle moved into the kebab menu — the yellow row tint
  // still marks a shortlisted candidate at a glance.
  //
  // Total min width tuned to fit the container without horizontal
  // scrolling: 200+40+120+160+180+320 = 1020 + 5×20 gaps = 1120px, well
  // under what the original (with the star column) required.
  rowGrid: {
    display: 'grid',
    gridTemplateColumns: '44px minmax(200px, 1.6fr) 40px 120px minmax(160px, 1.1fr) 180px 320px',
    gap: 20, alignItems: 'center',
  } as React.CSSProperties,
  // Terminal tabs (Hired / Rejected / All closed) never render row
  // action buttons — just a kebab. So the wide Actions column would
  // leave a huge visual gap next to the status pill. This variant
  // shrinks Actions to a kebab-sized column and lets the Status
  // column expand (via 2fr) to consume the freed width.
  rowGridTerminal: {
    display: 'grid',
    // Extra "Submitted" column between Location and Status — only
    // shown on Hired / Rejected / All-closed, where "when did we
    // close this out" is the piece of context the admin actually
    // scans against once scheduling is behind us.
    gridTemplateColumns: '44px minmax(200px, 1.6fr) 40px 120px minmax(160px, 1.1fr) 110px minmax(200px, 1.5fr) 50px',
    gap: 20, alignItems: 'center',
  } as React.CSSProperties,
  colSubmitted: {
    fontSize: 13, color: C.textSub, fontWeight: 500,
    fontVariantNumeric: 'tabular-nums' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  rowNumCell: {
    fontSize: 12, fontWeight: 700, color: '#94a3b8',
    fontVariantNumeric: 'tabular-nums' as const,
    textAlign: 'center' as const,
    justifySelf: 'center',
  } as React.CSSProperties,
  // Interview-tab section header — appears between bucketed groups.
  // Per-bucket palette applied at the callsite (tint / accent / text)
  // so each bucket reads as its own visual lane, not just another row.
  interviewGroupHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '14px 18px',
    borderTopRightRadius: 8, borderBottomRightRadius: 8,
    borderTop: `1px solid ${C.borderSoft}`,
    borderRight: `1px solid ${C.borderSoft}`,
    borderBottom: `1px solid ${C.borderSoft}`,
  } as React.CSSProperties,
  interviewGroupLabel: {
    fontSize: 13, fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: 0.7,
    lineHeight: 1.1,
  } as React.CSSProperties,
  interviewGroupSubtitle: {
    fontSize: 11, fontWeight: 500, color: C.mutedSoft,
    letterSpacing: 0.1,
  } as React.CSSProperties,
  interviewGroupCount: {
    fontSize: 12, fontWeight: 700,
    padding: '3px 10px', borderRadius: 999,
    fontVariantNumeric: 'tabular-nums' as const,
    minWidth: 22, textAlign: 'center' as const,
  } as React.CSSProperties,
  // Repeat-applicant marker — compact amber pill with the ↻ icon and
  // the count ("3×") inline. Clicking jumps to All closed and populates
  // the search bar with this candidate's phone number so the admin can
  // see the prior applications in one click.
  repeatIconBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 7px', borderRadius: 999,
    background: '#fef3c7', color: '#92400e',
    border: '1px solid #fde68a',
    fontSize: 10, cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.12s',
  } as React.CSSProperties,
  repeatCount: {
    fontSize: 11, fontWeight: 700,
    letterSpacing: 0.2,
    fontVariantNumeric: 'tabular-nums' as const,
  } as React.CSSProperties,
  colIdentity: {
    display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
  } as React.CSSProperties,
  roleLine: {
    fontSize: 13.5, color: C.textSub, lineHeight: 1.4,
  } as React.CSSProperties,
  // Small uppercase label above each column value — treats each
  // attribute as a self-contained cell so the eye doesn't have to
  // decode which number means what.
  colLabel: {
    fontSize: 10, fontWeight: 700, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.7,
    marginBottom: 2,
  } as React.CSSProperties,
  colSalary: {
    display: 'flex', flexDirection: 'column', minWidth: 0,
  } as React.CSSProperties,
  salaryValue: {
    fontSize: 14, color: C.text, fontWeight: 600,
    whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'baseline', gap: 6,
    fontVariantNumeric: 'tabular-nums' as const,
  } as React.CSSProperties,
  currencyLabel: {
    fontSize: 10.5, fontWeight: 600, color: C.mutedSoft,
    textTransform: 'uppercase' as const, letterSpacing: 0.6,
  } as React.CSSProperties,
  // Native-title hover icon revealing the candidate's own words on why
  // they named that number. Small and muted so it doesn't compete with
  // the salary figure.
  salaryInfoIcon: {
    color: '#94a3b8', fontSize: 12, cursor: 'default',
  } as React.CSSProperties,
  colLocation: {
    display: 'flex', flexDirection: 'column', minWidth: 0,
  } as React.CSSProperties,
  colScheduled: {
    display: 'flex', flexDirection: 'column' as const, minWidth: 0,
  } as React.CSSProperties,
  // Terminal-status pill — wraps the label + inline rejection reason
  // ("Rejected: Not suitable — experience / qualification too low").
  // Wraps to multiple lines instead of truncating so the reason is
  // legible at a glance. `border-radius: 10` (not fully-rounded) keeps
  // the shape sensible when the pill spans more than one line.
  terminalPill: (bg: string, fg: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'flex-start', gap: 6,
    background: bg, color: fg, padding: '4px 10px',
    borderRadius: 10, fontSize: 12, fontWeight: 600,
    maxWidth: '100%', minWidth: 0,
    lineHeight: 1.35,
    // Parent col is a flex column with default align-items: stretch,
    // which was making the inline-flex pill fill the column width.
    // Anchor to flex-start so the bg hugs the text width instead.
    alignSelf: 'flex-start',
  }),
  terminalPillText: {
    whiteSpace: 'normal' as const,
    wordBreak: 'break-word' as const,
    minWidth: 0,
  } as React.CSSProperties,
  scheduledCell: {
    display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
  } as React.CSSProperties,
  scheduledDate: {
    fontSize: 13, fontWeight: 600, color: C.text,
    fontVariantNumeric: 'tabular-nums' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  scheduledTime: {
    fontSize: 12, color: C.muted, fontWeight: 500,
    fontVariantNumeric: 'tabular-nums' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  locationValue: {
    fontSize: 13, color: C.textSub, lineHeight: 1.4,
    display: 'flex', alignItems: 'flex-start', gap: 8,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  // Clickable location — opens Google Maps directions in a new tab.
  // Looks identical to locationValue in idle state; underline appears
  // on hover only so the row doesn't feel like a wall of links.
  locationLink: {
    fontSize: 13, color: C.textSub, lineHeight: 1.4,
    display: 'flex', alignItems: 'flex-start',
    textDecoration: 'none', cursor: 'pointer', minWidth: 0,
  } as React.CSSProperties,
  locationInner: {
    display: 'flex', flexWrap: 'wrap' as const, alignItems: 'flex-start',
    gap: 6, minWidth: 0, flex: 1,
  } as React.CSSProperties,
  commuteChip: {
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: 999,
    background: C.bgSoft, color: C.muted,
    fontSize: 11, fontWeight: 500,
    border: `1px solid ${C.borderSoft}`,
    whiteSpace: 'nowrap' as const, flexShrink: 0,
  } as React.CSSProperties,
  colApplied: {
    display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
  } as React.CSSProperties,
  appliedDate: {
    fontSize: 12.5, color: C.textSub, fontWeight: 500,
    whiteSpace: 'nowrap' as const,
    fontVariantNumeric: 'tabular-nums' as const,
  } as React.CSSProperties,
  colActions: {
    display: 'flex', flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'flex-end', justifySelf: 'end',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  // Retained for the applied date under the identity column.
  appliedFoot: {
    fontSize: 11, color: '#94a3b8', marginTop: 2,
  } as React.CSSProperties,
  // Experience pill — "1 – 2 years experience" so the meaning is
  // explicit rather than a floating "1-2 years" that could mean
  // anything (age? years since graduation?).
  expBracket: {
    fontSize: 12, fontWeight: 600, color: C.primaryDeep,
    background: C.primarySoft, padding: '2px 8px', borderRadius: 999,
    cursor: 'default',
  } as React.CSSProperties,
  // Small G-logo chip next to the candidate's name/age indicating the
  // application came from an external Google Form (via the Apps
  // Script bridge), rather than the native /apply flow.
  sourceBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 18, height: 18, borderRadius: '50%',
    background: '#fff', border: '1px solid #e2e8f0',
    color: '#4285F4', fontSize: 10,
    cursor: 'default', flexShrink: 0,
  } as React.CSSProperties,
  nameText: {
    fontSize: 14.5, fontWeight: 650, color: C.text,
    letterSpacing: -0.1, lineHeight: 1.2,
  } as React.CSSProperties,
  ageText: {
    fontSize: 12, color: C.mutedSoft, fontWeight: 500,
    fontVariantNumeric: 'tabular-nums' as const,
  } as React.CSSProperties,
  // Grouped hover icons — plain inline glyphs, no box. Matches the flag
  // icon rhythm so flags + hover-info icons share one visual language.
  hoverIconGroup: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
  } as React.CSSProperties,
  hoverIcon: {
    color: C.mutedSoft, fontSize: 11, cursor: 'help',
    display: 'inline-flex', alignItems: 'center',
  } as React.CSSProperties,
  rowLine2: {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    marginTop: 3, fontSize: 13, color: C.textSub,
  } as React.CSSProperties,
  rowLine3: {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    marginTop: 3, fontSize: 12, color: C.textSub,
  } as React.CSSProperties,
  dot: { color: C.border, fontWeight: 700 } as React.CSSProperties,
  commute: { color: C.muted, marginLeft: 2 } as React.CSSProperties,
  waBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 8,
    border: `1px solid #dcfce7`, background: '#fff',
    color: '#25D366', fontSize: 15, textDecoration: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  // ── Toolbar extras ───────────────────────────────────────────────────
  filterToggleBtn: (on: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '0 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
    background: on ? C.primarySoft : C.surface,
    color: on ? C.primaryDeep : C.textSub,
    border: `1px solid ${on ? '#c7d2fe' : C.border}`,
    cursor: 'pointer', height: 40,
    boxShadow: on ? 'none' : SHADOW.sm,
  }),
  filterCountBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, padding: '0 6px', borderRadius: 999,
    background: C.primary, color: '#fff', fontSize: 11, fontWeight: 700,
  } as React.CSSProperties,
  densitySwitch: {
    display: 'inline-flex', gap: 2,
    background: C.surface, padding: 3, borderRadius: 10,
    border: `1px solid ${C.border}`, height: 40,
    boxShadow: SHADOW.sm,
  } as React.CSSProperties,
  densityBtn: (active: boolean): React.CSSProperties => ({
    padding: '0 12px', fontSize: 13, fontWeight: 600,
    background: active ? C.primary : 'transparent',
    color: active ? '#fff' : C.muted,
    border: 'none', cursor: 'pointer', borderRadius: 7,
    minWidth: 32, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.12s, color 0.12s',
  }),

  // ── Filter drawer ────────────────────────────────────────────────────
  filterDrawer: {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: 14, marginBottom: 12,
    display: 'flex', flexDirection: 'column', gap: 10,
  } as React.CSSProperties,
  filterFlexRow: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
  } as React.CSSProperties,
  filterInlineLabel: {
    fontSize: 12, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase', letterSpacing: 0.4,
    minWidth: 100,
  } as React.CSSProperties,
  chip: (on: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', borderRadius: 999,
    background: on ? C.primarySoft : C.bg,
    color: on ? C.primaryDeep : C.textSub,
    border: `1px solid ${on ? '#c7d2fe' : C.border}`,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }),
  toggleChip: (on: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 999,
    background: on ? C.warningSoft : C.bg,
    color: on ? C.warning : C.textSub,
    border: `1px solid ${on ? '#fde68a' : C.border}`,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
  }),
  clearFiltersBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', borderRadius: 8,
    background: 'transparent', border: 'none',
    color: C.danger, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    marginLeft: 'auto',
  } as React.CSSProperties,

  // ── Row extras ───────────────────────────────────────────────────────
  // Shortlist star — gold when on. Off-state has a visible outline and
  // slightly darker icon so it looks clickable, not disabled.
  starBtn: (on: boolean): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    background: on ? '#fef3c7' : '#fff',
    color: on ? '#eab308' : '#94a3b8',
    border: on ? '1px solid #fde68a' : `1px solid ${C.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, cursor: 'pointer', padding: 0,
    transition: 'color 0.12s, background 0.12s',
  }),
  // Smaller qualification medallion used in compact rows.
  qualIconSm: (bg: string, fg: string): React.CSSProperties => ({
    width: 26, height: 26, borderRadius: 6, flexShrink: 0,
    background: bg, color: fg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12,
  }),
  flagIcon: (level: 'red' | 'yellow'): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: 6, fontSize: 11,
    background: level === 'red' ? C.dangerSoft : C.warningSoft,
    color: level === 'red' ? C.danger : C.warning,
    cursor: 'default',
  }),
  contactBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8,
    background: C.primary, color: '#fff', border: 'none',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  } as React.CSSProperties,
  rescheduleBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 10px', borderRadius: 8,
    background: C.surface, color: C.textSub,
    border: `1px solid ${C.border}`,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,
  // Row-level Reject — outlined red so it sits secondary next to the
  // primary Offer button and doesn't compete for the eye's attention.
  rejectSmallBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 10px', borderRadius: 8,
    background: C.surface, color: C.danger,
    border: `1px solid #fecaca`,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,
  // Offer — the "yes we're hiring them" primary action. Green so it
  // reads as an approval, distinct from the indigo advance buttons at
  // earlier pipeline stages.
  offerBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8,
    background: C.success, color: '#fff',
    border: 'none',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  } as React.CSSProperties,
  // Pagination bar for the closed tab — sits inside divList so it
  // shares the same width and border boundary as the rows.
  pagerBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px', borderTop: `1px solid ${C.border}`,
    background: C.bgSoft, gap: 12, flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  pagerInfo: {
    fontSize: 12, color: C.textSub,
  } as React.CSSProperties,
  pagerControls: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
  } as React.CSSProperties,
  pagerPage: {
    fontSize: 12, color: C.textSub, minWidth: 100, textAlign: 'center' as const,
  } as React.CSSProperties,
  pagerBtn: (disabled: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 8,
    background: '#fff', color: disabled ? C.mutedSoft : C.text,
    border: `1px solid ${C.border}`,
    fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }),
  kebabBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 8,
    background: 'transparent', color: C.muted,
    border: `1px solid ${C.border}`,
    cursor: 'pointer',
  } as React.CSSProperties,
  rowMenu: {
    position: 'absolute' as const, top: 'calc(100% + 4px)', right: 0,
    minWidth: 220, zIndex: 20,
    background: C.surface, border: '1px solid #e8eaed',
    borderRadius: 12,
    boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.04)',
    padding: 5, display: 'flex', flexDirection: 'column' as const,
  } as React.CSSProperties,
  rowMenuItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 6,
    fontSize: 13, color: C.text, textDecoration: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,
  // ── Leads-style menu primitives ──────────────────────────────────
  menuSectionLabel: {
    padding: '8px 12px 4px',
    fontSize: 10, fontWeight: 700, color: '#9ca3af',
    letterSpacing: 0.6, textTransform: 'uppercase' as const,
    display: 'flex', alignItems: 'center', gap: 6,
  } as React.CSSProperties,
  menuSep: {
    height: 1, background: '#f0f2f5', margin: '3px 10px',
  } as React.CSSProperties,
  // Item base style — mirrors leads' inline "mI" button pattern so
  // Actions and Decision items sit in the same rhythm.
  menuItemBtn: {
    display: 'flex', alignItems: 'center', width: '100%',
    padding: '7px 10px', borderRadius: 6,
    border: 'none',
    textAlign: 'left' as const,
    fontSize: 13, color: C.text, cursor: 'pointer',
  } as React.CSSProperties,
  menuItemLink: {
    display: 'flex', alignItems: 'center', width: '100%',
    padding: '7px 10px', borderRadius: 6,
    fontSize: 13, color: C.text, textDecoration: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,
  // 20×20 tinted-square medallion for the Decision-section icons.
  menuMedallion: {
    width: 20, height: 20, borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    marginRight: 8, flexShrink: 0,
  } as React.CSSProperties,

  // Waiting-since badge — tinted per urgency so aged candidates surface.
  waitBadge: (level: WaitLevel): React.CSSProperties => {
    const palette = {
      fresh:   { bg: '#f0fdf4',       fg: '#16a34a' },
      ok:      { bg: '#f1f5f9',       fg: '#64748b' },
      warn:    { bg: C.warningSoft,   fg: C.warning },
      overdue: { bg: C.dangerSoft,    fg: C.danger  },
    }[level];
    return {
      fontSize: 10, fontWeight: 700,
      padding: '2px 6px', borderRadius: 999,
      background: palette.bg, color: palette.fg,
      flexShrink: 0, letterSpacing: 0.2,
    };
  },

  // ── Review view container + top bar ───────────────────────────────
  reviewOverlay: {
    display: 'flex', flexDirection: 'column', gap: 16,
  } as React.CSSProperties,

  // ── Review layout ──────────────────────────────────────────────────
  reviewLayout: {
    display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24,
    alignItems: 'start',
  } as React.CSSProperties,
  reviewSidebar: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: '14px 10px',
    position: 'sticky', top: 12,
    maxHeight: 'calc(100vh - 140px)', overflowY: 'auto',
    boxShadow: SHADOW.sm,
  } as React.CSSProperties,
  reviewSidebarHeader: {
    padding: '2px 8px 12px', borderBottom: `1px solid ${C.borderSoft}`,
    marginBottom: 8,
    display: 'flex', flexDirection: 'column', gap: 4,
  } as React.CSSProperties,
  reviewSidebarLabel: {
    fontSize: 11, fontWeight: 700, color: C.mutedSoft,
    textTransform: 'uppercase', letterSpacing: 0.7,
  } as React.CSSProperties,
  reviewSidebarList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: 2,
  } as React.CSSProperties,
  sidebarGroupHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '8px 10px', borderRadius: 6,
  } as React.CSSProperties,
  sidebarGroupLabel: {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: 0.6,
    lineHeight: 1.15,
  } as React.CSSProperties,
  sidebarGroupSubtitle: {
    fontSize: 10, fontWeight: 500, color: C.mutedSoft,
    lineHeight: 1.2,
  } as React.CSSProperties,
  sidebarGroupCount: {
    fontSize: 10, fontWeight: 700,
    padding: '1px 7px', borderRadius: 999,
    fontVariantNumeric: 'tabular-nums' as const,
    minWidth: 18, textAlign: 'center' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  // Interview-context badge on sidebar rows — replaces the
  // "waiting since applied" badge with the actual interview slot time
  // (e.g. "Tue 08 · 09:00"). Colour-neutral so it doesn't compete with
  // the group palette; the group header already carries urgency.
  sidebarInterviewSlot: {
    fontSize: 10, fontWeight: 600, color: '#475569',
    background: '#f1f5f9',
    padding: '3px 7px', borderRadius: 6,
    fontVariantNumeric: 'tabular-nums' as const,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  reviewSidebarPager: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '10px 8px 2px', marginTop: 8,
    borderTop: `1px solid ${C.borderSoft}`,
  } as React.CSSProperties,
  reviewSidebarPagerBtn: (disabled: boolean): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: C.surface, color: disabled ? C.mutedSoft : C.textSub,
    border: `1px solid ${C.border}`,
    fontSize: 11, cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }),
  reviewSidebarPagerLabel: {
    fontSize: 11, fontWeight: 600, color: C.mutedSoft,
    fontVariantNumeric: 'tabular-nums' as const,
  } as React.CSSProperties,
  reviewSidebarItem: (current: boolean, rejected: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '10px 10px', borderRadius: 10,
    background: current ? C.primarySoft : 'transparent',
    border: current ? `1px solid ${C.primarySoft}` : `1px solid transparent`,
    cursor: 'pointer', textAlign: 'left' as const,
    opacity: rejected ? 0.55 : 1,
    transition: 'background 0.12s, border-color 0.12s',
  }),
  reviewSidebarNum: (
    current: boolean, shortlisted: boolean, rejected: boolean, repeat: boolean,
  ): React.CSSProperties => ({
    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700,
    // Priority: rejected > repeat > current > shortlisted > default.
    // Repeat wins over selection so the "this person has applied before"
    // signal survives even when the row is the currently-selected one
    // (the row's own background tint still marks selection separately).
    // The red is red-400 (`#f87171`) — bright + saturated but light
    // enough not to feel like a hard system-error state.
    background: rejected    ? C.dangerSoft
              : repeat      ? '#ef4444'
              : current     ? C.primary
              : shortlisted ? '#fef3c7'
              : C.borderSoft,
    color:      rejected    ? C.danger
              : repeat      ? '#fff'
              : current     ? '#fff'
              : shortlisted ? '#a16207'
              : C.muted,
  }),
  reviewSidebarTextCol: {
    display: 'flex', flexDirection: 'column', gap: 1,
    minWidth: 0, flex: 1,
  } as React.CSSProperties,
  reviewSidebarName: (rejected: boolean): React.CSSProperties => ({
    fontSize: 13, color: C.text, fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    textDecoration: rejected ? 'line-through' : 'none',
    lineHeight: 1.2,
  }),
  reviewSidebarSub: {
    fontSize: 11, color: C.muted,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    lineHeight: 1.3,
  } as React.CSSProperties,

  // ── Prev / Next nav bar ────────────────────────────────────────────
  reviewNavBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '2px 4px',
  } as React.CSSProperties,
  navPillBtn: (enabled: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '8px 14px', borderRadius: 10,
    background: enabled ? C.surface : C.bgSoft,
    color: enabled ? C.textSub : C.mutedSoft,
    border: `1px solid ${C.border}`,
    fontSize: 13, fontWeight: 600,
    cursor: enabled ? 'pointer' : 'default',
    boxShadow: enabled ? SHADOW.sm : 'none',
  }),
  navPositionLabel: {
    fontSize: 13, color: C.textSub,
  } as React.CSSProperties,

  // ── Review card ────────────────────────────────────────────────────
  reviewCard: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: '24px 28px',
    display: 'flex', flexDirection: 'column', gap: 20,
    boxShadow: SHADOW.md,
  } as React.CSSProperties,
  reviewCardHeader: {
    display: 'flex', alignItems: 'flex-start', gap: 16,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  reviewQualIcon: (bg: string, fg: string): React.CSSProperties => ({
    width: 52, height: 52, borderRadius: 12, flexShrink: 0,
    background: bg, color: fg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20,
    border: `1px solid ${C.borderSoft}`,
  }),
  reviewName: {
    fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1.25,
    letterSpacing: -0.2,
  } as React.CSSProperties,
  reviewAge: {
    fontSize: 13, fontWeight: 500, color: C.mutedSoft, marginLeft: 8,
  } as React.CSSProperties,
  reviewSub: {
    fontSize: 13, color: C.textSub, marginTop: 6,
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  } as React.CSSProperties,
  reviewChipRow: {
    display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap',
  } as React.CSSProperties,
  applyingChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 8,
    background: C.primarySoft, color: C.primaryDeep,
    fontSize: 13, fontWeight: 600,
    border: `1px solid #d8def7`,
  } as React.CSSProperties,
  flagPill: (level: 'red' | 'yellow'): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    background: level === 'red' ? C.dangerSoft : C.warningSoft,
    color: level === 'red' ? C.danger : C.warning,
    cursor: 'default',
  }),
  reviewSalary: {
    fontSize: 22, fontWeight: 700, color: C.text,
    letterSpacing: -0.3, lineHeight: 1,
  } as React.CSSProperties,
  salaryBlockTopRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 12, marginBottom: 10,
  } as React.CSSProperties,
  // Two-column row that pairs the salary ask with the candidate's
  // background so the reviewer can weigh them side by side. Wraps to
  // stacked layout on narrower widths via flex-wrap.
  salaryPairRow: {
    display: 'flex', gap: 14, flexWrap: 'wrap' as const,
    alignItems: 'stretch',
  } as React.CSSProperties,
  backgroundList: {
    display: 'flex', flexDirection: 'column' as const, gap: 10,
  } as React.CSSProperties,
  backgroundRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
  } as React.CSSProperties,
  backgroundIcon: {
    color: C.mutedSoft, fontSize: 14, marginTop: 3,
    width: 16, flexShrink: 0,
  } as React.CSSProperties,
  // Tinted medallion for background rows — matches the qual-medallion
  // vocabulary used in the row list so the tier reads consistently
  // (Bachelor's green, Diploma indigo, SPM grey, etc.).
  backgroundMedallion: (bg: string, fg: string): React.CSSProperties => ({
    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
    background: bg, color: fg,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13,
    border: `1px solid ${C.borderSoft}`,
  }),
  // Small pill for commute time inline with the address (e.g. "> 1 hr")
  commuteInlineChip: {
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: 999,
    background: '#f1f5f9', color: C.muted,
    fontSize: 11, fontWeight: 500,
    border: `1px solid ${C.borderSoft}`, marginLeft: 4,
  } as React.CSSProperties,
  subDot: {
    color: C.mutedSoft, fontSize: 12, flexShrink: 0, margin: '0 2px',
  } as React.CSSProperties,
  backgroundLabel: {
    fontSize: 10.5, fontWeight: 700, color: C.mutedSoft,
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  } as React.CSSProperties,
  backgroundValue: {
    fontSize: 14, color: C.text, marginTop: 1, fontWeight: 500,
  } as React.CSSProperties,
  reviewQuoteBlock: (kind: 'salary' | 'motivation' | 'goals' | 'neutral'): React.CSSProperties => {
    const bar = {
      salary:     C.success,
      motivation: '#db2777',
      goals:      C.primary,
      neutral:    C.mutedSoft,
    }[kind];
    return {
      borderLeft: `3px solid ${bar}`,
      background: C.bgSoft,
      padding: '14px 16px',
      borderRadius: '0 10px 10px 0',
      border: `1px solid ${C.borderSoft}`,
      borderLeftWidth: 3,
    };
  },
  reviewQuoteLabel: (kind: 'salary' | 'motivation' | 'goals' | 'neutral'): React.CSSProperties => {
    const color = kind === 'salary' ? C.success
                : kind === 'motivation' ? '#be185d'
                : kind === 'neutral' ? C.muted
                : C.primaryDeep;
    return {
      fontSize: 11, fontWeight: 700, color,
      textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    };
  },
  reviewQuoteText: {
    fontSize: 14, color: C.text, lineHeight: 1.6, margin: 0,
    whiteSpace: 'pre-wrap',
  } as React.CSSProperties,
  reviewFooterMeta: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 12, color: C.muted, gap: 12,
    // Deliberately NOT wrapping — the button cluster on the right must
    // stay top-right; on tight widths the meta clusters wrap internally
    // (see footerMetaClusters below) instead of the whole row breaking.
    paddingTop: 10, borderTop: `1px solid ${C.borderSoft}`,
  } as React.CSSProperties,
  // Wrapping row of icon-prefixed clusters. Each cluster stays
  // together on wrap; the vertical dividers between them are
  // hidden by CSS at narrow widths where clusters collapse to their
  // own line (dividers only make sense on the same row).
  footerMetaClusters: {
    display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center',
    rowGap: 6, columnGap: 10,
    // Take the full remaining row width so the button cluster on the
    // right sits flush against the edge. `minWidth: 0` lets long meta
    // strings wrap internally instead of pushing the buttons off-screen.
    flex: 1, minWidth: 0,
  } as React.CSSProperties,
  footerMetaCluster: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: C.muted, whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  footerMetaSep: {
    display: 'inline-block', width: 1, height: 12,
    background: C.border, flexShrink: 0,
  } as React.CSSProperties,
  footerMetaUtm: {
    fontSize: 11, color: C.mutedSoft, marginLeft: 6,
    padding: '1px 6px', borderRadius: 999,
    border: `1px solid ${C.borderSoft}`, background: C.bgSoft,
  } as React.CSSProperties,
  linkTextBtn: {
    background: 'transparent', border: 'none', color: C.primary,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
  } as React.CSSProperties,
  resumeBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 8,
    background: C.surface, color: C.textSub,
    border: `1px solid ${C.border}`,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    boxShadow: SHADOW.sm,
    whiteSpace: 'nowrap' as const, flexShrink: 0,
  } as React.CSSProperties,
  whatsappBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 8,
    background: '#25D366', color: '#fff',
    border: '1px solid #1ea854',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    textDecoration: 'none',
    boxShadow: SHADOW.sm,
  } as React.CSSProperties,
  resumeMissing: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 8,
    background: C.bgSoft, color: C.mutedSoft,
    border: `1px dashed ${C.border}`,
    fontSize: 12, fontWeight: 600, cursor: 'default',
    whiteSpace: 'nowrap' as const, flexShrink: 0,
  } as React.CSSProperties,

  // ── Sticky decision bar ────────────────────────────────────────────
  reviewActionBar: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
    background: C.surface, border: `1px solid ${C.border}`,
    padding: 10, borderRadius: 12,
    position: 'sticky', bottom: 12,
    boxShadow: SHADOW.md,
  } as React.CSSProperties,
  rejectBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 16px', borderRadius: 10, border: `1px solid #fecaca`,
    background: C.surface, color: C.danger,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,
  scheduleDecisionBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    boxShadow: SHADOW.sm,
  } as React.CSSProperties,
  // Compact resume icon that sits beside the star in the card header.
  // Matches starToggle dimensions so the two buttons form a visually
  // balanced pair. Neutral slate tint — a resume is common enough not
  // to need an accent colour.
  resumeIconBtn: {
    width: 32, height: 32, borderRadius: 8,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, cursor: 'pointer',
    background: C.surface, color: C.textSub,
    border: `1px solid ${C.border}`,
    transition: 'all 0.12s ease',
  } as React.CSSProperties,
  // No-resume variant — dashed border, muted colour, non-interactive.
  resumeIconMissing: {
    width: 32, height: 32, borderRadius: 8,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, cursor: 'default',
    background: C.bgSoft, color: C.mutedSoft,
    border: `1px dashed ${C.border}`,
  } as React.CSSProperties,
  // Small marker star in the card header — click to add / remove from
  // shortlist. On = gold filled, Off = outlined grey.
  starToggle: (on: boolean): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: 8,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, cursor: 'pointer',
    background: on ? '#fef3c7' : 'transparent',
    color: on ? '#d97706' : C.mutedSoft,
    border: `1px solid ${on ? '#fde68a' : C.border}`,
    transition: 'all 0.12s ease',
  }),

  // ── Review "done" recap card ──────────────────────────────────────
  // Fills the main column (matches the width of a normal candidate
  // review card) so it doesn't float as a small island in the
  // wide 1fr slot beside the sidebar.
  reviewDone: {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
    padding: '56px 32px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 14, textAlign: 'center',
    boxShadow: SHADOW.sm,
  } as React.CSSProperties,
  reviewDoneIcon: {
    width: 64, height: 64, borderRadius: '50%',
    background: C.successSoft, color: C.success,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24,
    border: `1px solid #d1fae5`,
  } as React.CSSProperties,
};
