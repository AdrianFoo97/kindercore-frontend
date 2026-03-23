import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark, faTriangleExclamation, faArrowRight, faFile, faArrowsRotate } from '@fortawesome/free-solid-svg-icons';
import { submitLead, updateLead, fetchLeadPhones, UpdateLeadPayload } from '../api/leads.js';
import { fetchPackages, createPackage } from '../api/packages.js';
import { createStudent, updateStudent, patchOnboardingProgress, completeOnboarding } from '../api/students.js';
import { LeadStatus, Package } from '../types/index.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_STATUSES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'APPOINTMENT_BOOKED',
  'FOLLOW_UP',
  'ENROLLED',
  'LOST',
  'REJECTED',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_MIN = CURRENT_YEAR - 5;
const YEAR_MAX = CURRENT_YEAR + 6;

const BATCH_SIZE = 5;

// CSV column reference data
const COLUMN_REFERENCE = [
  { header: 'Submitted At',              field: 'submittedAt',              required: false, hint: 'Ignored on import — server sets this automatically' },
  { header: 'Child Name',                field: 'childName',                required: true,  hint: 'Full name of the child' },
  { header: 'Parent Phone',              field: 'parentPhone',              required: true,  hint: 'Contact number including country code if applicable' },
  { header: 'Child Date of Birth',       field: 'childDob',                 required: true,  hint: 'Format: YYYY-MM-DD (e.g. 2021-06-15)' },
  { header: 'Enrolment Year',            field: 'enrolmentYear',            required: true,  hint: `Integer year, e.g. ${CURRENT_YEAR} or ${CURRENT_YEAR + 1}` },
  { header: 'Relationship to Child',     field: 'relationship',             required: false, hint: 'e.g. Mother, Father, Guardian' },
  { header: 'Programme',                 field: 'programme',                required: false, hint: 'Full Day / Half Day / Basic' },
  { header: 'Preferred Appointment Time',field: 'preferredAppointmentTime', required: false, hint: 'Free text, e.g. "Weekday mornings"' },
  { header: 'Address / Location',        field: 'addressLocation',          required: false, hint: 'Area or full address' },
  { header: 'Needs Transport',           field: 'needsTransport',           required: false, hint: 'Yes or No' },
  { header: 'How Did You Know',          field: 'howDidYouKnow',            required: false, hint: 'e.g. Facebook, Google, Friend' },
  { header: 'Status',                    field: 'status',                   required: false, hint: 'NEW / CONTACTED / APPOINTMENT_BOOKED / FOLLOW_UP / ENROLLED / LOST / REJECTED' },
  { header: 'Notes',                     field: 'notes',                    required: false, hint: 'Any additional notes' },
  { header: 'Lost / Declined Reason',    field: 'lostReason',               required: false, hint: 'Only relevant when Status is LOST or REJECTED' },
  { header: 'Appointment Date',          field: 'appointmentDate',          required: false, hint: 'YYYY-MM-DD, sets appointment without creating calendar event' },
] as const;

const SAMPLE_CSV_ROW = [
  '',                           // Submitted At (ignored)
  'Tan Mei Ling',               // Child Name
  '+60123456789',               // Parent Phone
  `${CURRENT_YEAR - 2}-04-20`, // Child Date of Birth
  String(CURRENT_YEAR + 1),    // Enrolment Year
  'Mother',                     // Relationship to Child
  'Full Day',                   // Programme
  'Weekday mornings',           // Preferred Appointment Time
  'Petaling Jaya',              // Address / Location
  'No',                         // Needs Transport
  'Facebook',                   // How Did You Know
  'NEW',                        // Status
  'Interested in full-day programme', // Notes
  '',                           // Lost / Declined Reason
  '',                           // Appointment Date
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedRow {
  rowNum: number;
  submittedAt?: string;
  childName: string;
  parentPhone: string;
  childDob: string;
  enrolmentYear: number | null;
  relationship?: string;
  programme?: string;
  preferredAppointmentTime?: string;
  addressLocation?: string;
  needsTransport?: boolean;
  howDidYouKnow?: string;
  status?: LeadStatus;
  notes?: string;
  lostReason?: string;
  appointmentDate?: string;
  attended?: boolean;
  errors: string[];
  isDuplicate?: boolean;        // phone matches an existing lead in the DB
  existingLeadId?: string;      // the ID of the matching DB lead
  isFileDuplicate?: boolean;    // same phone appears earlier in this file
  fileOccurrenceIndex?: number; // which occurrence in the file (1 = first)
  fileOccurrenceTotal?: number; // total rows in the file sharing this phone
}

interface FailedRow {
  rowNum: number;
  childName: string;
  error: string;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

// ─────────────────────────────────────────────────────────────────────────────
// CSV Parser
// ─────────────────────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Map of normalised header strings to field names
const HEADER_MAP: Record<string, string> = {
  // Submitted At
  submittedat: 'submittedAt',
  // Child Name
  childname: 'childName',
  childsname: 'childName',
  nameofchild: 'childName',
  // Parent Phone
  parentphone: 'parentPhone',
  phone: 'parentPhone',
  contactnumber: 'parentPhone',
  parentcontact: 'parentPhone',
  mobilenumber: 'parentPhone',
  // Child Date of Birth
  childdateofbirth: 'childDob',
  dateofbirth: 'childDob',
  dob: 'childDob',
  childsdob: 'childDob',
  childdob: 'childDob',
  // Enrolment Year
  enrolmentyear: 'enrolmentYear',
  enrollmentyear: 'enrolmentYear',
  year: 'enrolmentYear',
  // Relationship to Child
  relationshiptochild: 'relationship',
  relationship: 'relationship',
  // Programme
  programme: 'programme',
  program: 'programme',
  // Preferred Appointment Time
  preferredappointmenttime: 'preferredAppointmentTime',
  preferredtime: 'preferredAppointmentTime',
  appointmenttime: 'preferredAppointmentTime',
  // Address / Location
  addresslocation: 'addressLocation',
  address: 'addressLocation',
  location: 'addressLocation',
  addressorlocation: 'addressLocation',
  // Needs Transport
  needstransport: 'needsTransport',
  transport: 'needsTransport',
  // How Did You Know
  howdidyouknow: 'howDidYouKnow',
  howdidyouhearaboutus: 'howDidYouKnow',
  source: 'howDidYouKnow',
  // Status
  status: 'status',
  leadstatus: 'status',
  // Notes
  notes: 'notes',
  note: 'notes',
  // Lost / Declined Reason
  lostdeclinedreason: 'lostReason',
  lostreason: 'lostReason',
  declinedreason: 'lostReason',
  lostorreason: 'lostReason',
  // Appointment Date
  appointmentdate: 'appointmentDate',
  appointment: 'appointmentDate',
  attended: 'attended',
};

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];

  // Find and parse header row
  const headerLine = lines[0];
  const rawHeaders = parseCsvLine(headerLine).map(h => h.trim());
  const fieldForCol: (string | null)[] = rawHeaders.map(h => {
    const normalised = normaliseHeader(h);
    return HEADER_MAP[normalised] ?? null;
  });

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // silently skip blank lines

    const cells = parseCsvLine(lines[i]).map(c => c.trim());

    // Check if row is completely blank (all cells empty)
    if (cells.every(c => c === '')) continue;

    // Build a raw field map
    const raw: Record<string, string> = {};
    cells.forEach((cell, colIdx) => {
      const field = fieldForCol[colIdx];
      if (field) raw[field] = cell;
    });

    const errors: string[] = [];

    // Validate required fields
    const childName = raw['childName'] ?? '';
    if (!childName) errors.push('Child Name is required');

    const parentPhone = raw['parentPhone'] ?? '';
    if (!parentPhone) errors.push('Parent Phone is required');

    const childDob = raw['childDob'] ?? '';
    if (!childDob) {
      errors.push('Child Date of Birth is required');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(childDob)) {
      errors.push(`Child Date of Birth must be in YYYY-MM-DD format (got: "${childDob}")`);
    }

    const rawYear = raw['enrolmentYear'] ?? '';
    let enrolmentYear: number | null = null;
    if (!rawYear) {
      errors.push('Enrolment Year is required');
    } else {
      const parsed = parseInt(rawYear, 10);
      if (isNaN(parsed) || String(parsed) !== rawYear.trim()) {
        errors.push(`Enrolment Year must be an integer (got: "${rawYear}")`);
      } else if (parsed < YEAR_MIN || parsed > YEAR_MAX) {
        errors.push(`Enrolment Year must be between ${YEAR_MIN} and ${YEAR_MAX} (got: ${parsed})`);
      } else {
        enrolmentYear = parsed;
      }
    }

    // Validate optional status
    let status: LeadStatus | undefined;
    const rawStatus = raw['status'] ?? '';
    if (rawStatus) {
      const upper = rawStatus.toUpperCase() as LeadStatus;
      if (VALID_STATUSES.includes(upper)) {
        status = upper;
      } else {
        errors.push(`Status must be one of ${VALID_STATUSES.join(', ')} (got: "${rawStatus}")`);
      }
    }

    // Validate optional needsTransport
    let needsTransport: boolean | undefined;
    const rawTransport = raw['needsTransport'] ?? '';
    if (rawTransport) {
      const lower = rawTransport.toLowerCase();
      if (lower === 'yes') {
        needsTransport = true;
      } else if (lower === 'no') {
        needsTransport = false;
      } else {
        errors.push(`Needs Transport must be "Yes" or "No" (got: "${rawTransport}")`);
      }
    }

    rows.push({
      rowNum: i, // 1-based, counting from header=0
      submittedAt: raw['submittedAt'] || undefined,
      childName,
      parentPhone,
      childDob,
      enrolmentYear,
      relationship: raw['relationship'] || undefined,
      programme: raw['programme'] || undefined,
      preferredAppointmentTime: raw['preferredAppointmentTime'] || undefined,
      addressLocation: raw['addressLocation'] || undefined,
      needsTransport,
      howDidYouKnow: raw['howDidYouKnow'] || undefined,
      status,
      notes: raw['notes'] || undefined,
      lostReason: raw['lostReason'] || undefined,
      appointmentDate: raw['appointmentDate'] || undefined,
      attended: raw['attended'] ? /^(yes|true|1)$/i.test(String(raw['attended']).trim()) : undefined,
      errors,
    });
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidRow(row: ParsedRow): boolean {
  return row.errors.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample CSV generator
// ─────────────────────────────────────────────────────────────────────────────

function generateSampleCsv(): string {
  const headers = COLUMN_REFERENCE.map(c => `"${c.header}"`).join(',');
  const row = SAMPLE_CSV_ROW.map(v => `"${v}"`).join(',');
  return `${headers}\n${row}\n`;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadErrorReport(rows: ParsedRow[]) {
  const headers = [...COLUMN_REFERENCE.map(c => `"${c.header}"`), '"Errors"'].join(',');
  const dataRows = rows.map(r => {
    const cells = [
      '',                                    // Submitted At
      r.childName,
      r.parentPhone,
      r.childDob,
      r.enrolmentYear != null ? String(r.enrolmentYear) : '',
      r.relationship ?? '',
      r.programme ?? '',
      r.preferredAppointmentTime ?? '',
      r.addressLocation ?? '',
      r.needsTransport === true ? 'Yes' : r.needsTransport === false ? 'No' : '',
      r.howDidYouKnow ?? '',
      r.status ?? '',
      r.notes ?? '',
      r.lostReason ?? '',
      r.appointmentDate ?? '',
      r.errors.join('; '),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    return cells;
  });
  downloadBlob(`${headers}\n${dataRows.join('\n')}\n`, 'import-errors.csv', 'text/csv');
}

// ─────────────────────────────────────────────────────────────────────────────
// Import runner
// ─────────────────────────────────────────────────────────────────────────────

async function importRow(row: ParsedRow, packages: Package[]): Promise<void> {
  const lead = await submitLead({
    childName: row.childName,
    parentPhone: row.parentPhone,
    childDob: row.childDob,
    enrolmentYear: row.enrolmentYear!,
    relationship: row.relationship,
    programme: row.programme,
    preferredAppointmentTime: row.preferredAppointmentTime,
    addressLocation: row.addressLocation,
    needsTransport: row.needsTransport,
    howDidYouKnow: row.howDidYouKnow,
    submittedAt: row.submittedAt,
  });

  const needsUpdate =
    (row.status && row.status !== 'NEW') ||
    (row.notes && row.notes.trim() !== '') ||
    (row.lostReason && row.lostReason.trim() !== '') ||
    (row.appointmentDate && row.appointmentDate.trim() !== '') ||
    row.attended !== undefined;

  if (needsUpdate) {
    const updateData: UpdateLeadPayload = {
      ...(row.status ? { status: row.status } : {}),
      ...(row.notes ? { notes: row.notes } : {}),
      ...(row.lostReason ? { lostReason: row.lostReason } : {}),
      ...(row.attended !== undefined ? { attended: row.attended } : {}),
    };
    if (row.appointmentDate) {
      const apptDate = new Date(row.appointmentDate);
      if (!isNaN(apptDate.getTime())) {
        updateData.appointmentStart = apptDate.toISOString();
        const endDate = new Date(apptDate.getTime() + 60 * 60 * 1000); // 1 hour
        updateData.appointmentEnd = endDate.toISOString();
      }
    }
    await updateLead(lead.id, updateData);
  }

  if (row.status === 'ENROLLED') {
    await tryCreateStudent(lead.id, row, packages);
  }
}

async function tryCreateStudent(leadId: string, row: ParsedRow, packages: Package[]): Promise<void> {
  const birthYear = parseInt(row.childDob.split('-')[0]);
  const ageAtEnrolment = row.enrolmentYear! - birthYear;
  const enrolmentMonth = row.submittedAt ? new Date(row.submittedAt).getMonth() + 1 : new Date().getMonth() + 1;

  // Match by year + programme + age, then fallback to year + programme only
  let pkg =
    packages.find(p => p.year === row.enrolmentYear && p.age === ageAtEnrolment && p.programme === row.programme) ??
    packages.find(p => p.year === row.enrolmentYear && p.age === ageAtEnrolment) ??
    packages.find(p => p.year === row.enrolmentYear && p.programme === row.programme) ??
    null;

  if (!pkg) {
    if (!import.meta.env.DEV) return; // in production, skip silently — package must be configured manually
    // DEV only: auto-create a package so the student can be enrolled
    const programme = row.programme ?? 'Full Day';
    pkg = await createPackage({
      year: row.enrolmentYear!,
      programme,
      age: ageAtEnrolment,
      name: `${programme} Age ${ageAtEnrolment} ${row.enrolmentYear}`,
      price: 0,
    });
    packages.push(pkg); // cache it so duplicate rows reuse the same package
  }

  const currentYear = new Date().getFullYear();
  const submittedYear = row.submittedAt ? new Date(row.submittedAt).getFullYear() : null;
  // Onboarding NOT completed if both timestamp year and enrolment year are current year
  const isCurrentYearEnrolment = submittedYear === currentYear && row.enrolmentYear === currentYear;

  try {
    const student = await createStudent({
      leadId,
      enrolmentYear: row.enrolmentYear!,
      enrolmentMonth,
      packageId: pkg.id,
      ...(row.submittedAt ? { enrolledAt: row.submittedAt } : {}),
      ...(row.notes ? { notes: row.notes } : {}),
    });

    if (!isCurrentYearEnrolment) {
      // Set start date = timestamp + 7 days
      const enrolledDate = row.submittedAt ? new Date(row.submittedAt) : new Date();
      const startDate = new Date(enrolledDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      await updateStudent(student.id, { startDate: startDate.toISOString().slice(0, 10) });

      // Mark all onboarding tasks as completed
      if (student.onboardingProgress && student.onboardingProgress.length > 0) {
        const allDone = student.onboardingProgress.map((t: { task: string; done: boolean }) => ({ ...t, done: true }));
        await patchOnboardingProgress(student.id, allDone);
        await completeOnboarding(student.id);
      }
    }
  } catch {
    // Ignore — student may already exist for this lead
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status colour helper
// ─────────────────────────────────────────────────────────────────────────────

function statusStyle(s: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    NEW:                { background: '#ebf4ff', color: '#2b6cb0' },
    CONTACTED:          { background: '#e9d8fd', color: '#553c9a' },
    APPOINTMENT_BOOKED: { background: '#fefcbf', color: '#744210' },
    FOLLOW_UP:          { background: '#feebc8', color: '#c05621' },
    ENROLLED:           { background: '#c6f6d5', color: '#276749' },
    LOST:               { background: '#fed7d7', color: '#9b2c2c' },
    REJECTED:           { background: '#fef3c7', color: '#92400e' },
  };
  return map[s] ?? { background: '#edf2f7', color: '#4a5568' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: 'Upload file' },
    { n: 2, label: 'Review data' },
    { n: 3, label: 'Import' },
  ];

  // Step 4 (done) is visually step 3 complete
  const activeStep = current === 4 ? 3 : current;

  return (
    <div style={styles.stepRow}>
      {steps.map((s, i) => {
        const isActive = s.n === activeStep;
        const isDone = s.n < activeStep;
        return (
          <div key={s.n} style={styles.stepItem}>
            <div
              style={{
                ...styles.stepCircle,
                ...(isDone
                  ? styles.stepCircleDone
                  : isActive
                  ? styles.stepCircleActive
                  : styles.stepCircleInactive),
              }}
            >
              {isDone ? <FontAwesomeIcon icon={faCheck} /> : s.n}
            </div>
            <span
              style={{
                ...styles.stepLabel,
                fontWeight: isActive || isDone ? 600 : 400,
                color: isActive ? '#2b6cb0' : isDone ? '#5b9a6f' : '#a0aec0',
              }}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                style={{
                  ...styles.stepConnector,
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

function ColumnReference() {
  const [open, setOpen] = useState(false);

  return (
    <div style={styles.colRefWrapper}>
      <button onClick={() => setOpen(o => !o)} style={styles.colRefToggle}>
        {open ? 'Hide column reference ▴' : 'Show column reference ▾'}
      </button>
      {open && (
        <div style={styles.colRefTable}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Column header', 'Required?', 'Notes / Format'].map(h => (
                  <th key={h} style={styles.thCell}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COLUMN_REFERENCE.map((col, i) => (
                <tr key={col.field} style={{ background: i % 2 === 0 ? '#fff' : '#f7fafc' }}>
                  <td style={styles.tdCell}>
                    <code style={styles.colCode}>{col.header}</code>
                  </td>
                  <td style={styles.tdCell}>
                    {col.required ? (
                      <span style={styles.badgeRequired}>Required</span>
                    ) : (
                      <span style={styles.badgeOptional}>Optional</span>
                    )}
                  </td>
                  <td style={{ ...styles.tdCell, color: '#4a5568' }}>{col.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportLeadsPage() {
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step / flow state
  const [step, setStep] = useState<Step>('upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropError, setDropError] = useState('');

  // File & parsed data
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // Import progress
  const [importDone, setImportDone] = useState(0);
  const [importFailed, setImportFailed] = useState<FailedRow[]>([]);
  const [importTotal, setImportTotal] = useState(0);

  // UI toggles
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  // How to handle leads whose phone already exists in the system
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update' | 'import'>('skip');
  // How to handle multiple rows in the file sharing the same phone number
  const [fileDuplicateAction, setFileDuplicateAction] = useState<'keepFirst' | 'keepLast' | 'importAll'>('importAll');
  // Table filter for the preview
  const [tableFilter, setTableFilter] = useState<'all' | 'errors' | 'inSystem' | 'inFile'>('all');
  const [previewPage, setPreviewPage] = useState(0);
  // Expand/collapse duplicate summary sections
  const [expandDbDups, setExpandDbDups] = useState(false);
  const [expandFileDups, setExpandFileDups] = useState(false);

  // ── Derived values ──────────────────────────────────────────────────────────

  const validRows = parsedRows.filter(isValidRow);
  const errorRows = parsedRows.filter(r => !isValidRow(r));
  const totalRows = parsedRows.length;
  const dbDuplicateRows  = parsedRows.filter(r => isValidRow(r) && r.isDuplicate);
  const fileDuplicateRows = parsedRows.filter(r => isValidRow(r) && r.isFileDuplicate);

  // Rows that will actually be processed at import time
  const rowsToImport = (() => {
    let rows = validRows;
    // DB duplicates
    if (duplicateAction === 'skip') rows = rows.filter(r => !r.isDuplicate);
    // File duplicates
    if (fileDuplicateAction === 'keepFirst') {
      rows = rows.filter(r => (r.fileOccurrenceTotal ?? 1) <= 1 || (r.fileOccurrenceIndex ?? 1) === 1);
    } else if (fileDuplicateAction === 'keepLast') {
      rows = rows.filter(r => (r.fileOccurrenceTotal ?? 1) <= 1 || (r.fileOccurrenceIndex ?? 1) === (r.fileOccurrenceTotal ?? 1));
    }
    return rows;
  })();

  // ── File handling ───────────────────────────────────────────────────────────

  async function applyDuplicateFlags(rows: ParsedRow[]): Promise<ParsedRow[]> {
    // Key = "submittedAt|normalizedPhone|normalizedChildName"
    // Different timestamp = different submission = NOT a duplicate (e.g. re-submission after a year)
    const makeKey = (submittedAt: string | undefined, phone: string, childName: string) =>
      `${(submittedAt ?? '').trim()}|${phone.replace(/\s/g, '').toLowerCase()}|${childName.trim().toLowerCase()}`;

    const dbKeyMap = new Map<string, string>(); // key → lead id
    try {
      const existing = await fetchLeadPhones();
      for (const e of existing) {
        dbKeyMap.set(makeKey(e.submittedAt, e.parentPhone, e.childName), e.id);
      }
    } catch {
      // If the fetch fails, proceed without DB duplicate detection
    }

    // First pass: count file occurrences per key
    const keyCounts = new Map<string, number>();
    for (const row of rows) {
      const key = makeKey(row.submittedAt, row.parentPhone, row.childName);
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }

    // Second pass: assign per-row flags
    const keyIndexes = new Map<string, number>();
    return rows.map(row => {
      const key = makeKey(row.submittedAt, row.parentPhone, row.childName);
      const existingLeadId = dbKeyMap.get(key);
      const isDuplicate = !!existingLeadId;
      const idx = (keyIndexes.get(key) ?? 0) + 1;
      keyIndexes.set(key, idx);
      const fileOccurrenceTotal = keyCounts.get(key) ?? 1;
      const isFileDuplicate = idx > 1;
      return { ...row, isDuplicate, existingLeadId, isFileDuplicate, fileOccurrenceIndex: idx, fileOccurrenceTotal };
    });
  }

  function processFile(file: File) {
    setDropError('');
    const name = file.name.toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
    const isCsv   = name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      setDropError('Please upload a .csv or .xlsx file. Other file types are not supported.');
      return;
    }

    const reader = new FileReader();

    const finish = async (rows: ParsedRow[]) => {
      const flagged = await applyDuplicateFlags(rows);
      setFileName(file.name);
      setParsedRows(flagged);
      setShowAllErrors(false);
      setStep('preview');
    };

    if (isCsv) {
      reader.onload = e => {
        const text = (e.target?.result as string) ?? '';
        void finish(parseCsv(text));
      };
      reader.readAsText(file, 'utf-8');
    } else {
      // Excel: read as ArrayBuffer, convert first sheet to CSV via xlsx
      reader.onload = e => {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws);
        void finish(parseCsv(csv));
      };
      reader.readAsArrayBuffer(file);
    }
  }

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, []);

  // ── Import ──────────────────────────────────────────────────────────────────

  async function importOrUpdateRow(row: ParsedRow, packages: Package[]): Promise<void> {
    // DB duplicate + "update" action → PATCH the existing lead instead of creating
    if (duplicateAction === 'update' && row.isDuplicate && row.existingLeadId) {
      await updateLead(row.existingLeadId, {
        childName: row.childName,
        parentPhone: row.parentPhone,
        childDob: row.childDob,
        enrolmentYear: row.enrolmentYear!,
        relationship: row.relationship ?? null,
        programme: row.programme ?? null,
        preferredAppointmentTime: row.preferredAppointmentTime ?? null,
        addressLocation: row.addressLocation ?? null,
        needsTransport: row.needsTransport ?? null,
        howDidYouKnow: row.howDidYouKnow ?? null,
        ...(row.status ? { status: row.status } : {}),
        ...(row.notes !== undefined ? { notes: row.notes } : {}),
        ...(row.lostReason !== undefined ? { lostReason: row.lostReason ?? null } : {}),
        ...(row.appointmentDate ? (() => {
          const d = new Date(row.appointmentDate);
          if (isNaN(d.getTime())) return {};
          return { appointmentStart: d.toISOString(), appointmentEnd: new Date(d.getTime() + 3600000).toISOString() };
        })() : {}),
        ...(row.attended !== undefined ? { attended: row.attended } : {}),
      });
      if (row.status === 'ENROLLED') {
        await tryCreateStudent(row.existingLeadId, row, packages);
      }
    } else {
      await importRow(row, packages);
    }
  }

  async function startImport() {
    if (rowsToImport.length === 0) return;

    setStep('importing');
    setImportDone(0);
    setImportFailed([]);
    setImportTotal(rowsToImport.length);

    let allPackages: Package[] = [];
    try { allPackages = await fetchPackages(); } catch { /* proceed without packages */ }

    let done = 0;
    const failed: FailedRow[] = [];

    for (let i = 0; i < rowsToImport.length; i += BATCH_SIZE) {
      const batch = rowsToImport.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async row => {
          try {
            await importOrUpdateRow(row, allPackages);
          } catch (err: unknown) {
            const msg =
              err instanceof Error
                ? err.message
                : typeof err === 'string'
                ? err
                : 'Unknown error';
            failed.push({ rowNum: row.rowNum, childName: row.childName, error: msg });
          } finally {
            done++;
            setImportDone(done);
          }
        }),
      );
    }

    setImportFailed(failed);
    setStep('done');
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function handleBrowseClick() {
    fileInputRef.current?.click();
  }

  function resetToUpload() {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setDropError('');
    setImportDone(0);
    setImportFailed([]);
    setImportTotal(0);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ ...styles.page, ...(isMobile ? { padding: '16px 12px' } : {}) }}>
      <div style={{ ...styles.inner, ...(isMobile ? { maxWidth: '100%' } : {}) }}>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={styles.heading}>Import Leads</h1>
          <p style={styles.subheading}>
            Upload a CSV or Excel file to bulk import leads. Existing leads with matching phone numbers are flagged as duplicates and skipped by default.
          </p>
        </div>

        {/* ── Step indicator ───────────────────────────────────────────────── */}
        {step !== 'done' && (
          <StepIndicator
            current={step === 'upload' ? 1 : step === 'preview' ? 2 : 3}
          />
        )}
        {step === 'done' && <StepIndicator current={4} />}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1 — Upload                                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 'upload' && (
          <div>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
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
                ...styles.dropZone,
                ...(isDragOver ? styles.dropZoneActive : {}),
                ...(dropError ? styles.dropZoneError : {}),
              }}
            >
              {/* File icon */}
              <div style={styles.dropIcon}>
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isDragOver ? '#2b6cb0' : dropError ? '#c47272' : '#a0aec0'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="12" x2="12" y2="18" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>

              {dropError ? (
                <>
                  <p style={{ ...styles.dropPrimary, color: '#c47272' }}>{dropError}</p>
                  <p style={styles.dropSecondary}>Click to try again with a .csv or .xlsx file</p>
                </>
              ) : isDragOver ? (
                <p style={{ ...styles.dropPrimary, color: '#2b6cb0' }}>Release to upload</p>
              ) : (
                <>
                  <p style={styles.dropPrimary}>
                    Drop your CSV or Excel file here, or{' '}
                    <span style={styles.dropBrowseLink}>click to browse</span>
                  </p>
                  <p style={styles.dropSecondary}>Accepts .csv and .xlsx files</p>
                </>
              )}
            </div>

            {/* Actions row */}
            <div style={styles.uploadActions}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  downloadBlob(generateSampleCsv(), 'sample-leads-import.csv', 'text/csv');
                }}
                style={styles.btnSecondary}
              >
                ↓ Download sample CSV
              </button>
            </div>

            {/* Column reference */}
            <ColumnReference />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 2 — Preview                                                    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 'preview' && (() => {
          const allValid   = errorRows.length === 0 && totalRows > 0;
          const allErrors  = validRows.length === 0 && totalRows > 0;
          const PAGE_SIZE   = 15;
          const filteredRows = parsedRows.filter(row => {
            if (tableFilter === 'errors')   return row.errors.length > 0;
            if (tableFilter === 'inSystem') return isValidRow(row) && row.isDuplicate;
            if (tableFilter === 'inFile')   return isValidRow(row) && row.isFileDuplicate;
            return true;
          });
          const totalPages  = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
          const safePage    = Math.min(previewPage, totalPages - 1);
          const pageRows    = filteredRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

          return (
            <div>

              {/* ── File summary bar ──────────────────────────────────────── */}
              <div style={styles.fileSummaryBar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}><FontAwesomeIcon icon={faFile} /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1a202c' }}>{fileName}</div>
                    <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>
                      {totalRows} {totalRows === 1 ? 'row' : 'rows'} detected
                    </div>
                  </div>
                </div>
                <button onClick={resetToUpload} style={styles.changeFileBtn}>
                  ← Change file
                </button>
              </div>

              {/* ── Stat grid ─────────────────────────────────────────────── */}
              <div style={styles.statGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{totalRows}</div>
                  <div style={styles.statLabel}>Total rows</div>
                </div>
                <div style={{ ...styles.statCard, background: '#f0fff4', borderColor: '#9ae6b4' }}>
                  <div style={{ ...styles.statValue, color: '#276749' }}>{validRows.length}</div>
                  <div style={{ ...styles.statLabel, color: '#5b9a6f' }}>Ready to import</div>
                </div>
                <div style={{ ...styles.statCard, ...(errorRows.length > 0 ? { background: '#fff5f5', borderColor: '#fed7d7' } : {}) }}>
                  <div style={{ ...styles.statValue, color: errorRows.length > 0 ? '#c53030' : '#a0aec0' }}>
                    {errorRows.length}
                  </div>
                  <div style={{ ...styles.statLabel, color: errorRows.length > 0 ? '#c47272' : '#a0aec0' }}>
                    {errorRows.length === 1 ? 'Row with errors' : 'Rows with errors'}
                  </div>
                </div>
                {dbDuplicateRows.length > 0 && (
                  <div style={{ ...styles.statCard, background: '#fff7ed', borderColor: '#fed7aa' }}>
                    <div style={{ ...styles.statValue, color: '#c2410c' }}>{dbDuplicateRows.length}</div>
                    <div style={{ ...styles.statLabel, color: '#ea580c' }}>Already in system</div>
                  </div>
                )}
                {fileDuplicateRows.length > 0 && (
                  <div style={{ ...styles.statCard, background: '#fffbeb', borderColor: '#fbd38d' }}>
                    <div style={{ ...styles.statValue, color: '#b7791f' }}>{fileDuplicateRows.length}</div>
                    <div style={{ ...styles.statLabel, color: '#d69e2e' }}>
                      {fileDuplicateRows.length === 1 ? 'Duplicate in file' : 'Duplicates in file'}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Validation banner ─────────────────────────────────────── */}
              {totalRows === 0 ? (
                <div style={{ ...styles.validationBanner, background: '#fff5f5', borderColor: '#fed7d7' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}><FontAwesomeIcon icon={faXmark} /></span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#c53030', marginBottom: 3 }}>No data found</div>
                    <div style={{ fontSize: 13, color: '#9b2c2c', lineHeight: 1.5 }}>
                      The file appears to be empty or contains only headers. Check your file and upload again.
                    </div>
                  </div>
                </div>
              ) : allValid ? (
                <div style={{ ...styles.validationBanner, background: '#f0fff4', borderColor: '#9ae6b4' }}>
                  <span style={{ fontSize: 20, flexShrink: 0, color: '#5b9a6f' }}><FontAwesomeIcon icon={faCheck} /></span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#276749', marginBottom: 3 }}>
                      All {validRows.length} {validRows.length === 1 ? 'row passes' : 'rows pass'} validation
                    </div>
                    <div style={{ fontSize: 13, color: '#2f855a', lineHeight: 1.5 }}>
                      Your file is clean and ready. Review the data below, then click Import when you're ready.
                    </div>
                  </div>
                </div>
              ) : allErrors ? (
                <div style={{ ...styles.validationBanner, background: '#fff5f5', borderColor: '#fed7d7' }}>
                  <span style={{ fontSize: 20, flexShrink: 0, color: '#c53030' }}><FontAwesomeIcon icon={faXmark} /></span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#c53030', marginBottom: 3 }}>
                      All {errorRows.length} {errorRows.length === 1 ? 'row has' : 'rows have'} errors
                    </div>
                    <div style={{ fontSize: 13, color: '#9b2c2c', lineHeight: 1.5 }}>
                      No rows can be imported. Fix the errors below, then re-upload your file.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ ...styles.validationBanner, background: '#fffff0', borderColor: '#ecc94b' }}>
                  <span style={{ fontSize: 20, flexShrink: 0, color: '#d69e2e' }}><FontAwesomeIcon icon={faTriangleExclamation} /></span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#744210', marginBottom: 3 }}>
                      {validRows.length} of {totalRows} rows are ready
                    </div>
                    <div style={{ fontSize: 13, color: '#975a16', lineHeight: 1.5 }}>
                      {errorRows.length} {errorRows.length === 1 ? 'row has' : 'rows have'} errors and will be skipped.
                      Review the issues below or download an error report to fix them before re-uploading.
                    </div>
                  </div>
                </div>
              )}


              {/* ── Error detail panel ────────────────────────────────────── */}
              {errorRows.length > 0 && (
                <div style={styles.errorPanel}>
                  <div style={styles.errorPanelHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: '#c53030' }}>
                      <span><FontAwesomeIcon icon={faXmark} /></span>
                      {errorRows.length} {errorRows.length === 1 ? 'row' : 'rows'} will be skipped
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {errorRows.length > 5 && (
                        <button onClick={() => setShowAllErrors(o => !o)} style={styles.expandBtn}>
                          {showAllErrors ? 'Show fewer' : `Show all ${errorRows.length}`}
                        </button>
                      )}
                      <button onClick={() => downloadErrorReport(errorRows)} style={styles.expandBtn}>
                        Download error report ↓
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {(showAllErrors ? errorRows : errorRows.slice(0, 5)).map(row => (
                      <div key={row.rowNum} style={styles.errorPanelRow}>
                        <span style={styles.errorRowBadge}>Row {row.rowNum}</span>
                        {row.childName && (
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#2d3748', flexShrink: 0 }}>
                            {row.childName}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: '#c53030' }}>
                          {row.errors.join(' · ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Duplicate summary panel ───────────────────────────────── */}
              {(dbDuplicateRows.length > 0 || fileDuplicateRows.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {dbDuplicateRows.length > 0 && (
                    <div style={{ border: '1px solid #fed7aa', borderRadius: 8, background: '#fff7ed', overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandDbDups(o => !o)}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14 }}><FontAwesomeIcon icon={faArrowsRotate} /></span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#9a3412' }}>
                            {dbDuplicateRows.length} {dbDuplicateRows.length === 1 ? 'lead' : 'leads'} already in your system
                          </span>
                          <span style={{ fontSize: 12, color: '#c2410c', background: '#fed7aa', borderRadius: 10, padding: '1px 8px' }}>
                            Phone match
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: '#c2410c' }}>{expandDbDups ? '▴ Hide' : '▾ Show'}</span>
                      </button>
                      {expandDbDups && (
                        <div style={{ borderTop: '1px solid #fed7aa', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                          {dbDuplicateRows.map(r => (
                            <div key={r.rowNum} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                              <span style={{ color: '#a0aec0', fontSize: 12, width: 48, flexShrink: 0 }}>Row {r.rowNum}</span>
                              <span style={{ fontWeight: 600, color: '#2d3748' }}>{r.childName}</span>
                              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#4a5568' }}>{r.parentPhone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {fileDuplicateRows.length > 0 && (
                    <div style={{ border: '1px solid #fbd38d', borderRadius: 8, background: '#fffbeb', overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandFileDups(o => !o)}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14 }}><FontAwesomeIcon icon={faTriangleExclamation} /></span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#744210' }}>
                            {fileDuplicateRows.length} {fileDuplicateRows.length === 1 ? 'row is a' : 'rows are'} duplicate{fileDuplicateRows.length !== 1 ? 's' : ''} within this file
                          </span>
                          <span style={{ fontSize: 12, color: '#b7791f', background: '#fbd38d', borderRadius: 10, padding: '1px 8px' }}>
                            Same phone
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: '#b7791f' }}>{expandFileDups ? '▴ Hide' : '▾ Show'}</span>
                      </button>
                      {expandFileDups && (
                        <div style={{ borderTop: '1px solid #fbd38d', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                          {fileDuplicateRows.map(r => (
                            <div key={r.rowNum} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                              <span style={{ color: '#a0aec0', fontSize: 12, width: 48, flexShrink: 0 }}>Row {r.rowNum}</span>
                              <span style={{ fontWeight: 600, color: '#2d3748' }}>{r.childName}</span>
                              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#4a5568' }}>{r.parentPhone}</span>
                              <span style={{ fontSize: 11, color: '#b7791f' }}>occurrence {r.fileOccurrenceIndex} of {r.fileOccurrenceTotal}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Preview table ─────────────────────────────────────────── */}
              <div style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#2d3748' }}>Data preview</div>
                  <div style={{ fontSize: 12, color: '#718096' }}>
                    {filteredRows.length} {filteredRows.length === 1 ? 'row' : 'rows'}{filteredRows.length !== totalRows ? ` (filtered from ${totalRows})` : ''}
                  </div>
                </div>

                {/* ── Table filter tabs ──────────────────────────────────── */}
                {totalRows > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                    {(
                      [
                        { key: 'all',     label: `All (${totalRows})` },
                        { key: 'errors',  label: `Errors (${errorRows.length})`,           show: errorRows.length > 0 },
                        { key: 'inSystem',label: `Already in system (${dbDuplicateRows.length})`, show: dbDuplicateRows.length > 0 },
                        { key: 'inFile',  label: `Duplicate in file (${fileDuplicateRows.length})`, show: fileDuplicateRows.length > 0 },
                      ] as const
                    ).filter(t => t.key === 'all' || t.show).map(t => (
                      <button
                        key={t.key}
                        onClick={() => { setTableFilter(t.key); setPreviewPage(0); }}
                        style={{
                          padding: '4px 12px',
                          border: '1px solid',
                          borderRadius: 20,
                          fontSize: 12,
                          cursor: 'pointer',
                          fontFamily: 'system-ui, sans-serif',
                          borderColor: tableFilter === t.key ? '#2b6cb0' : '#e2e8f0',
                          background: tableFilter === t.key ? '#ebf4ff' : '#fff',
                          color: tableFilter === t.key ? '#2b6cb0' : '#4a5568',
                          fontWeight: tableFilter === t.key ? 600 : 400,
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                <div style={styles.tableScroll}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Row', 'Child Name', 'Parent Phone', 'Date of Birth', 'Year', 'Status', 'Validation'].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map(row => {
                        const hasErr   = row.errors.length > 0;
                        const isDup    = !hasErr && (row.isDuplicate || row.isFileDuplicate);
                        const isHovered = hoveredRow === row.rowNum;
                        return (
                          <tr
                            key={row.rowNum}
                            onMouseEnter={() => setHoveredRow(row.rowNum)}
                            onMouseLeave={() => setHoveredRow(null)}
                            style={{
                              background: hasErr
                                ? isHovered ? '#fff0f0' : '#fff5f5'
                                : isDup
                                ? isHovered ? '#fefce8' : '#fffbeb'
                                : isHovered ? '#f0f7ff' : 'transparent',
                              transition: 'background 0.1s',
                            }}
                          >
                            <td style={{ ...styles.td, color: '#a0aec0', fontSize: 12, width: 48 }}>{row.rowNum}</td>
                            <td style={{ ...styles.td, fontWeight: 600 }}>
                              {row.childName || <em style={{ color: '#a0aec0', fontWeight: 400 }}>—</em>}
                            </td>
                            <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12 }}>
                              {row.parentPhone || <em style={{ color: '#a0aec0' }}>—</em>}
                            </td>
                            <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12, color: '#4a5568' }}>
                              {row.childDob || <em style={{ color: '#a0aec0' }}>—</em>}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              {row.enrolmentYear ?? <em style={{ color: '#a0aec0' }}>—</em>}
                            </td>
                            <td style={styles.td}>
                              <span style={{ ...styles.statusPill, ...statusStyle(row.status ?? 'NEW') }}>
                                {row.status ?? 'NEW'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {hasErr ? (
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                  <span style={{ color: '#c47272', fontWeight: 700, fontSize: 12, flexShrink: 0 }}><FontAwesomeIcon icon={faXmark} /></span>
                                  <span style={{ color: '#c53030', fontSize: 12 }}>
                                    {row.errors[0]}{row.errors.length > 1 ? ` (+${row.errors.length - 1} more)` : ''}
                                  </span>
                                </div>
                              ) : (row.isDuplicate || row.isFileDuplicate) ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                  {row.isDuplicate && (
                                    <span style={{ fontSize: 11, fontWeight: 600, background: '#fed7aa', color: '#9a3412', borderRadius: 4, padding: '1px 6px' }}>
                                      Already in system
                                    </span>
                                  )}
                                  {row.isFileDuplicate && (
                                    <span style={{ fontSize: 11, fontWeight: 600, background: '#fbd38d', color: '#744210', borderRadius: 4, padding: '1px 6px' }}>
                                      Duplicate in file
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ color: '#5b9a6f', fontWeight: 700, fontSize: 12 }}><FontAwesomeIcon icon={faCheck} /></span>
                                  <span style={{ color: '#276749', fontSize: 12 }}>Ready</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10 }}>
                    <button
                      onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: safePage === 0 ? '#f7fafc' : '#fff', color: safePage === 0 ? '#a0aec0' : '#2d3748', cursor: safePage === 0 ? 'default' : 'pointer', fontSize: 13 }}
                    >← Prev</button>
                    <span style={{ fontSize: 13, color: '#4a5568' }}>Page {safePage + 1} of {totalPages}</span>
                    <button
                      onClick={() => setPreviewPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage === totalPages - 1}
                      style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: safePage === totalPages - 1 ? '#f7fafc' : '#fff', color: safePage === totalPages - 1 ? '#a0aec0' : '#2d3748', cursor: safePage === totalPages - 1 ? 'default' : 'pointer', fontSize: 13 }}
                    >Next →</button>
                  </div>
                )}
              </div>

              {/* ── Import confirmation area ───────────────────────────────── */}
              <div style={styles.confirmArea}>
                <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={styles.confirmRow}>
                    <span style={styles.confirmLabel}>Will be imported</span>
                    <span style={{ ...styles.confirmValue, color: '#276749' }}>
                      {rowsToImport.length} {rowsToImport.length === 1 ? 'lead' : 'leads'}
                    </span>
                  </div>
                  {errorRows.length > 0 && (
                    <div style={styles.confirmRow}>
                      <span style={styles.confirmLabel}>Skipped (errors)</span>
                      <span style={{ ...styles.confirmValue, color: '#c05621' }}>
                        {errorRows.length} {errorRows.length === 1 ? 'row' : 'rows'} — shown in red above
                      </span>
                    </div>
                  )}
                  {dbDuplicateRows.length > 0 && (
                    <div style={{ ...styles.confirmRow, flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ ...styles.confirmLabel, fontWeight: 600, color: '#9a3412' }}>
                        <FontAwesomeIcon icon={faArrowsRotate} /> {dbDuplicateRows.length} {dbDuplicateRows.length === 1 ? 'lead' : 'leads'} already in system — how should we handle them?
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(
                          [
                            { value: 'skip',   label: 'Skip — do not import, leave existing lead unchanged' },
                            { value: 'update', label: 'Update existing — overwrite the matching lead with data from file' },
                            { value: 'import', label: 'Import as new — create a duplicate record anyway' },
                          ] as const
                        ).map(opt => (
                          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                            <input
                              type="radio"
                              name="duplicateAction"
                              value={opt.value}
                              checked={duplicateAction === opt.value}
                              onChange={() => setDuplicateAction(opt.value)}
                              style={{ cursor: 'pointer' }}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {fileDuplicateRows.length > 0 && (
                    <div style={{ ...styles.confirmRow, flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ ...styles.confirmLabel, fontWeight: 600, color: '#744210' }}>
                        <FontAwesomeIcon icon={faTriangleExclamation} /> {fileDuplicateRows.length} {fileDuplicateRows.length === 1 ? 'phone number appears' : 'phone numbers appear'} multiple times in this file — which to keep?
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(
                          [
                            { value: 'keepFirst', label: 'Keep first — import only the first occurrence of each phone' },
                            { value: 'keepLast',  label: 'Keep last — import only the last occurrence of each phone' },
                            { value: 'importAll', label: 'Import all — create a record for every occurrence' },
                          ] as const
                        ).map(opt => (
                          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                            <input
                              type="radio"
                              name="fileDuplicateAction"
                              value={opt.value}
                              checked={fileDuplicateAction === opt.value}
                              onChange={() => setFileDuplicateAction(opt.value)}
                              style={{ cursor: 'pointer' }}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ ...styles.confirmRow, borderBottom: 'none' }}>
                    <span style={styles.confirmLabel}>After import</span>
                    <span style={styles.confirmValue}>Leads appear in your Leads page immediately</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={resetToUpload} style={styles.btnSecondary}>
                    ← Back
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {rowsToImport.length === 0 && (
                      <span style={{ fontSize: 12, color: '#a0aec0' }}>
                        {validRows.length === 0 ? 'Fix all errors above to continue' : 'All valid rows are duplicates — choose "Update" or "Import as new" above'}
                      </span>
                    )}
                    <button
                      disabled={rowsToImport.length === 0}
                      onClick={startImport}
                      style={{
                        ...styles.btnPrimary,
                        ...(rowsToImport.length === 0 ? styles.btnDisabled : {}),
                        fontSize: 15,
                        padding: '11px 28px',
                      }}
                    >
                      {duplicateAction === 'update' && rowsToImport.some(r => r.isDuplicate)
                        ? <>Import {rowsToImport.filter(r => !r.isDuplicate).length} + Update {rowsToImport.filter(r => r.isDuplicate).length} <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} /></>
                        : <>Import {rowsToImport.length} {rowsToImport.length === 1 ? 'Lead' : 'Leads'} <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} /></>
                      }
                    </button>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 3 — Importing                                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 'importing' && (
          <div style={styles.importingWrapper}>
            <div style={styles.importingCard}>
              {/* Animated progress bar */}
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressBar,
                    width: importTotal > 0
                      ? `${Math.round((importDone / importTotal) * 100)}%`
                      : '0%',
                  }}
                />
              </div>

              <p style={styles.importingText}>
                Importing row {Math.min(importDone + 1, importTotal)} of {importTotal}…
              </p>
              <p style={styles.importingSubtext}>
                Please do not close this tab.
              </p>

              {importTotal > 0 && (
                <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>
                  {Math.round((importDone / importTotal) * 100)}% complete
                </p>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 4 — Done                                                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 'done' && (() => {
          const succeeded = importTotal - importFailed.length;
          const allOk = importFailed.length === 0;
          const allFailed = succeeded === 0;
          const partial = !allOk && !allFailed;

          return (
            <div style={styles.doneWrapper}>
              {/* Result card */}
              <div
                style={{
                  ...styles.doneCard,
                  ...(allOk
                    ? styles.doneCardSuccess
                    : allFailed
                    ? styles.doneCardError
                    : styles.doneCardWarning),
                }}
              >
                {/* Icon */}
                <div style={styles.doneIconWrapper}>
                  {allOk && (
                    <div style={{ ...styles.doneIcon, ...styles.doneIconSuccess }}><FontAwesomeIcon icon={faCheck} /></div>
                  )}
                  {allFailed && (
                    <div style={{ ...styles.doneIcon, ...styles.doneIconError }}><FontAwesomeIcon icon={faXmark} /></div>
                  )}
                  {partial && (
                    <div style={{ ...styles.doneIcon, ...styles.doneIconWarning }}><FontAwesomeIcon icon={faTriangleExclamation} /></div>
                  )}
                </div>

                {/* Message */}
                {allOk && (
                  <>
                    <h2 style={styles.doneHeading}>All done!</h2>
                    <p style={styles.doneMessage}>
                      {importTotal} {importTotal === 1 ? 'lead has' : 'leads have'} been added to your system.
                    </p>
                  </>
                )}
                {allFailed && (
                  <>
                    <h2 style={{ ...styles.doneHeading, color: '#c53030' }}>Import failed</h2>
                    <p style={styles.doneMessage}>
                      All {importTotal} rows could not be imported. Check the errors below and try again.
                    </p>
                  </>
                )}
                {partial && (
                  <>
                    <h2 style={{ ...styles.doneHeading, color: '#744210' }}>
                      {succeeded} of {importTotal} {importTotal === 1 ? 'lead' : 'leads'} imported
                    </h2>
                    <p style={styles.doneMessage}>
                      {importFailed.length} {importFailed.length === 1 ? 'row' : 'rows'} could not be imported — review the errors below.
                    </p>
                  </>
                )}
              </div>

              {/* Failed rows table */}
              {importFailed.length > 0 && (
                <div style={{ ...styles.card, marginTop: 16 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#2d3748' }}>
                    Failed rows ({importFailed.length})
                  </h3>
                  <div style={styles.tableScroll}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          {['Row', 'Child Name', 'Error'].map(h => (
                            <th key={h} style={styles.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importFailed.map(f => (
                          <tr key={f.rowNum} style={{ background: '#fff5f5' }}>
                            <td style={styles.td}>{f.rowNum}</td>
                            <td style={styles.td}>{f.childName || <em style={{ color: '#a0aec0' }}>—</em>}</td>
                            <td style={{ ...styles.td, color: '#c53030', fontSize: 12 }}>{f.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={styles.doneActions}>
                {!allFailed && (
                  <button
                    onClick={() => { queryClient.invalidateQueries({ queryKey: ['leads'] }); queryClient.invalidateQueries({ queryKey: ['lead-stats'] }); navigate('/leads'); }}
                    style={styles.btnPrimary}
                  >
                    View leads <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                  </button>
                )}
                <button onClick={resetToUpload} style={styles.btnSecondary}>
                  Import another file
                </button>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  // Layout
  page: {
    padding: '32px 24px',
    fontFamily: 'system-ui, sans-serif',
    color: '#2d3748',
    minHeight: '100vh',
    background: '#f7fafc',
  },
  inner: {
    maxWidth: 860,
    margin: '0 auto',
  },

  // Header
  heading: {
    margin: '0 0 6px',
    fontSize: 24,
    fontWeight: 700,
    color: '#1a202c',
  },
  subheading: {
    margin: 0,
    fontSize: 14,
    color: '#718096',
    lineHeight: 1.5,
  },

  // Step indicator
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginBottom: 28,
    marginTop: 20,
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  stepCircleActive: {
    background: '#2b6cb0',
    color: '#fff',
  },
  stepCircleDone: {
    background: '#5b9a6f',
    color: '#fff',
  },
  stepCircleInactive: {
    background: '#e2e8f0',
    color: '#a0aec0',
  },
  stepLabel: {
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  stepConnector: {
    height: 2,
    width: 32,
    margin: '0 8px',
    borderRadius: 1,
    flexShrink: 0,
  },

  // Card
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 20,
  },

  // Drop zone
  dropZone: {
    border: '2px dashed #cbd5e0',
    borderRadius: 10,
    padding: '48px 32px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#fff',
    transition: 'border-color 0.15s, background 0.15s',
    userSelect: 'none',
  },
  dropZoneActive: {
    borderColor: '#2b6cb0',
    background: '#ebf4ff',
  },
  dropZoneError: {
    borderColor: '#c47272',
    background: '#fff5f5',
  },
  dropIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dropPrimary: {
    margin: '0 0 6px',
    fontSize: 15,
    fontWeight: 500,
    color: '#2d3748',
  },
  dropBrowseLink: {
    color: '#2b6cb0',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  dropSecondary: {
    margin: 0,
    fontSize: 12,
    color: '#a0aec0',
  },

  // Upload actions
  uploadActions: {
    display: 'flex',
    gap: 12,
    marginTop: 16,
    flexWrap: 'wrap',
  },

  // Buttons
  btnPrimary: {
    padding: '10px 22px',
    background: '#2b6cb0',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'system-ui, sans-serif',
    transition: 'opacity 0.1s',
  },
  btnSecondary: {
    padding: '10px 18px',
    background: '#fff',
    color: '#2d3748',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'system-ui, sans-serif',
  },
  btnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },

  // Column reference
  colRefWrapper: {
    marginTop: 20,
  },
  colRefToggle: {
    background: 'none',
    border: 'none',
    color: '#2b6cb0',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    padding: 0,
    fontFamily: 'system-ui, sans-serif',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  colRefTable: {
    marginTop: 10,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  thCell: {
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 700,
    color: '#718096',
    background: '#f7fafc',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
  },
  tdCell: {
    padding: '7px 12px',
    fontSize: 13,
    borderBottom: '1px solid #f0f4f8',
    verticalAlign: 'top',
  },
  colCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    background: '#edf2f7',
    padding: '1px 5px',
    borderRadius: 3,
    color: '#2d3748',
  },
  badgeRequired: {
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    background: '#fff5f5',
    color: '#c53030',
    border: '1px solid #fed7d7',
    whiteSpace: 'nowrap',
  },
  badgeOptional: {
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    background: '#f7fafc',
    color: '#718096',
    border: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
  },

  // File summary bar
  fileSummaryBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '14px 18px', marginBottom: 16,
  },
  changeFileBtn: {
    background: 'none', border: '1px solid #e2e8f0', color: '#4a5568',
    cursor: 'pointer', fontSize: 13, fontWeight: 500, borderRadius: 6,
    padding: '5px 12px', fontFamily: 'system-ui, sans-serif', flexShrink: 0,
  },

  // Stat grid
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 12, marginBottom: 16,
  },
  statCard: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px',
  },
  statValue: { fontSize: 28, fontWeight: 700, color: '#1a202c', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: '#718096', marginTop: 4 },

  // Validation banner
  validationBanner: {
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: '14px 18px', borderRadius: 8, border: '1px solid', marginBottom: 16,
  },

  // Status breakdown
  statusBreakdown: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    marginBottom: 16, padding: '10px 14px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
  },

  // Status pill (reusable across table + breakdown)
  statusPill: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 10,
    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  },

  // Error panel
  errorPanel: {
    background: '#fff5f5', border: '1px solid #fed7d7',
    borderRadius: 8, marginBottom: 16, overflow: 'hidden',
  },
  errorPanelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', background: '#fff0f0', borderBottom: '1px solid #fed7d7',
  },
  errorPanelRow: {
    display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
    padding: '6px 0', borderBottom: '1px solid #ffeaea',
  },

  // Import confirmation area
  confirmArea: {
    marginTop: 24, background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '20px 24px',
  },
  confirmRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 0', borderBottom: '1px solid #f0f4f8',
  },
  confirmLabel: { fontSize: 13, color: '#718096' },
  confirmValue: { fontSize: 13, fontWeight: 600, color: '#2d3748', textAlign: 'right', maxWidth: '60%' },

  // Back link
  backLink: {
    background: 'none',
    border: 'none',
    color: '#2b6cb0',
    cursor: 'pointer',
    fontSize: 13,
    padding: 0,
    marginBottom: 16,
    fontFamily: 'system-ui, sans-serif',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },

  // File chip
  fileChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 14px',
    background: '#ebf4ff',
    border: '1px solid #bee3f8',
    borderRadius: 20,
    marginBottom: 16,
    fontSize: 13,
    color: '#2b6cb0',
    maxWidth: '100%',
  },
  fileChipIcon: { fontSize: 15, flexShrink: 0 },
  fileChipName: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileChipCount: { color: '#4a90d9', flexShrink: 0 },

  // Summary cards
  summaryCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px 18px',
    borderRadius: 8,
    border: '1px solid',
    marginBottom: 16,
    fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
  },
  summarySuccess: {
    background: '#f0fff4',
    borderColor: '#9ae6b4',
    color: '#276749',
  },
  summaryError: {
    background: '#fff5f5',
    borderColor: '#fed7d7',
    color: '#c53030',
  },
  summaryWarning: {
    background: '#fffff0',
    borderColor: '#faf089',
    color: '#744210',
  },
  summaryCardSplit: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  summaryIcon: {
    fontSize: 18,
    fontWeight: 700,
    color: '#5b9a6f',
    flexShrink: 0,
    lineHeight: 1.2,
  },

  // Error detail
  errorDetail: {
    background: '#fffaf0',
    border: '1px solid #fbd38d',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 16,
  },
  errorDetailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    color: '#c05621',
    cursor: 'pointer',
    fontSize: 12,
    textDecoration: 'underline',
    padding: 0,
    fontFamily: 'system-ui, sans-serif',
  },
  errorItem: {
    background: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: 6,
    padding: '8px 12px',
  },
  errorItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  errorRowBadge: {
    display: 'inline-block',
    padding: '1px 7px',
    background: '#c47272',
    color: '#fff',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  errorRowName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#2d3748',
  },
  errorList: {
    margin: 0,
    paddingLeft: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },

  // Preview table
  tableWrapper: {
    marginTop: 20,
  },
  tableScroll: {
    overflowX: 'auto',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    background: '#fff',
    minWidth: 600,
  },
  th: {
    padding: '9px 12px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 700,
    color: '#718096',
    background: '#f7fafc',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #f0f4f8',
    color: '#2d3748',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  },

  // Badges
  statusBadge: {
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    background: '#ebf4ff',
    color: '#2b6cb0',
    border: '1px solid #bee3f8',
  },
  errorBadge: {
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    background: '#fff5f5',
    color: '#c53030',
    border: '1px solid #fed7d7',
    cursor: 'help',
  },
  okBadge: {
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    background: '#f0fff4',
    color: '#5b9a6f',
    border: '1px solid #9ae6b4',
  },

  // Skip notice
  skipNotice: {
    margin: '12px 0 0',
    fontSize: 13,
    color: '#718096',
  },
  inlineLink: {
    background: 'none',
    border: 'none',
    color: '#2b6cb0',
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
    textDecoration: 'underline',
    fontFamily: 'system-ui, sans-serif',
  },

  // Import button bar
  importButtonBar: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 20,
    borderTop: '1px solid #e2e8f0',
  },

  // Importing step
  importingWrapper: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 40,
  },
  importingCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '40px 48px',
    textAlign: 'center',
    width: '100%',
    maxWidth: 480,
  },
  progressTrack: {
    height: 10,
    background: '#e2e8f0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #2b6cb0, #4299e1)',
    borderRadius: 5,
    transition: 'width 0.3s ease',
  },
  importingText: {
    margin: '0 0 6px',
    fontSize: 16,
    fontWeight: 600,
    color: '#2d3748',
  },
  importingSubtext: {
    margin: 0,
    fontSize: 13,
    color: '#a0aec0',
  },

  // Done step
  doneWrapper: {
    paddingTop: 16,
  },
  doneCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '36px 32px',
    borderRadius: 12,
    border: '1px solid',
  },
  doneCardSuccess: {
    background: '#f0fff4',
    borderColor: '#9ae6b4',
  },
  doneCardError: {
    background: '#fff5f5',
    borderColor: '#fed7d7',
  },
  doneCardWarning: {
    background: '#fffff0',
    borderColor: '#faf089',
  },
  doneIconWrapper: {
    marginBottom: 16,
  },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
  },
  doneIconSuccess: {
    background: '#5b9a6f',
    color: '#fff',
  },
  doneIconError: {
    background: '#c47272',
    color: '#fff',
  },
  doneIconWarning: {
    background: '#d69e2e',
    color: '#fff',
  },
  doneHeading: {
    margin: '0 0 8px',
    fontSize: 22,
    fontWeight: 700,
    color: '#1a202c',
  },
  doneMessage: {
    margin: 0,
    fontSize: 15,
    color: '#4a5568',
    lineHeight: 1.5,
  },
  doneActions: {
    display: 'flex',
    gap: 12,
    marginTop: 24,
    flexWrap: 'wrap',
  },
};
