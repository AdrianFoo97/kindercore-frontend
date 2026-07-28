import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck, faPaperPlane, faTriangleExclamation,
  faArrowLeft, faArrowRight, faFileLines, faXmark,
  faChartLine, faHandHoldingDollar, faGift, faLocationDot, faHandshake,
} from '@fortawesome/free-solid-svg-icons';
import { fetchCandidateFormOptions, submitCandidateApplication, uploadCandidateResume, RecruitmentPosition } from '../api/candidates.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

// Public application form — shared via a link with prospective teachers.
// No auth gate. Posts to the public `POST /api/candidates` endpoint.
// The form is intentionally short: only what an admin needs to start a
// conversation. Everything else (interview details, references, salary
// negotiation) is captured by the admin during the pipeline.

// Brand colors sampled directly from the Ten Toes Preschool logo
// (public/logo.png): #0000a8 blue, #fcee21 yellow. Blue carries the
// structural/interactive weight (buttons, links, progress, borders);
// yellow is reserved for accents (the card's top stripe, decorative
// medallions) since large blocks of it read poorly as text/backgrounds.
const C = {
  bg: '#f5f6fc',
  surface: '#ffffff',
  text: '#0f172a',
  textSub: '#3f4b5c',
  muted: '#64748b',
  border: '#dde1f5',
  borderSoft: '#eef0fa',
  primary: '#0000a8',
  primaryDeep: '#00006e',
  primarySoft: '#e4e6fa',
  success: '#059669',
  successSoft: '#ecfdf5',
  // Deepened for legible text/icon contrast — the true brand yellow
  // (brandYellow, below) is reserved for flat decorative fills.
  gold: '#c99700',
  goldSoft: '#fff8db',
  // The exact brand yellow. Flat/decorative use only (gradient stripes,
  // large fills) — never as text or on small elements, where #fcee21
  // reads poorly against white.
  brandYellow: '#fcee21',
  // Fourth benefit-icon tint (leadership/partnership) — same violet the
  // app already uses for teacher-facing surfaces elsewhere, so it reads
  // as consistent with the rest of the product, not a one-off pick.
  violet: '#7c3aed',
  violetSoft: '#f3effe',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
};

type CommuteValue = '' | 'UNDER_15' | 'MIN_15_30' | 'MIN_30_45' | 'MIN_45_60' | 'OVER_60' | 'WILL_MOVE';

interface FormState {
  fullName: string;
  phone: string;
  dob: string;
  addressLocation: string;
  commuteTime: CommuteValue;
  desiredPosition: string;
  expectedSalary: string;
  /** Required when expectedSalary is filled in. */
  salaryJustification: string;
  availableFrom: string;
  preferredStartDate: string;
  experienceRange: string;
  qualification: string;
  /** Free-text shown only when qualification === 'Others'. */
  qualificationOther: string;
  /** Screening — required on step 3. */
  careerGoals: string;
  /** Screening — required on step 3. */
  whyKindergartenTeacher: string;
  howDidYouKnow: string;
  notes: string;
  /** Honeypot — bots fill, humans don't see it. */
  company: string;
}

const EMPTY: FormState = {
  fullName: '', phone: '', dob: '',
  addressLocation: '', commuteTime: '', desiredPosition: '',
  expectedSalary: '', salaryJustification: '',
  availableFrom: '', preferredStartDate: '', experienceRange: '',
  qualification: '', qualificationOther: '',
  careerGoals: '', whyKindergartenTeacher: '',
  howDidYouKnow: '', notes: '', company: '',
};

// Dev-only preset — populates the form on load with plausible dummy data
// so the admin can iterate on downstream pipeline UI without retyping the
// same fields every hot-reload. Randomised per load so each fresh submit
// lands as a distinct candidate. Guarded on import.meta.env.DEV so
// production builds ship an empty form.
const DEV_FIRST_NAMES = ['Nur', 'Siti', 'Aisyah', 'Lim', 'Chan', 'Priya', 'Farah', 'Ho', 'Wong', 'Tan'];
const DEV_LAST_NAMES  = ['Aina', 'Nurhaliza', 'Rahman', 'Xin Yi', 'Hui Min', 'Devi', 'Diana', 'Yuan Ting', 'Siew Fen', 'Mei Ling'];
const DEV_ADDRESSES   = ['Bukit Indah', 'Skudai', 'Pasir Gudang', 'Tampoi', 'Ulu Tiram', 'Taman Perling'];
const DEV_SALARY_JUSTIFICATIONS = [
  '3 years teaching K1 and K2 at Little Stars Kindergarten, Diploma in Early Childhood Education from Kolej Vokasional.',
  'Two years as a helper at a daycare centre, hands-on with toddlers and pre-schoolers daily.',
  '5 years experience teaching 4-6 year olds. Familiar with British and Malaysian curriculum.',
  '1 year assistant teaching at Playhouse Preschool. Trained in Montessori basics through a short course.',
];
const DEV_CAREER_GOALS = [
  'To become a lead teacher within three years and eventually take on curriculum design responsibilities.',
  'Grow into a senior teacher role and mentor new teachers.',
  'Complete my degree part-time while working and move into a curriculum coordinator role.',
];
const DEV_WHY_KG = [
  'I love the energy of young children and want to make a real difference in their earliest years.',
  'To gain experience',
  'I taught primary before but realised kindergarten is where the foundation is built.',
];
const DEV_NOTES = [
  'Referred by existing teacher',
  '',
  'Available for interview on weekday mornings',
];
const pickRand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function makeDevPrefill(): FormState {
  const first = pickRand(DEV_FIRST_NAMES);
  const last = pickRand(DEV_LAST_NAMES);
  // DOB roughly 20–40 years back so age is plausible.
  const yearsBack = 20 + Math.floor(Math.random() * 20);
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - yearsBack);
  // Earliest start ~ 1 week out, preferred start ~ 3 weeks out.
  const availableFrom = new Date(); availableFrom.setDate(availableFrom.getDate() + 7);
  const preferredStart = new Date(); preferredStart.setDate(preferredStart.getDate() + 21);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const commute = pickRand(['UNDER_15', 'MIN_15_30', 'MIN_30_45', 'MIN_45_60', 'OVER_60', 'WILL_MOVE'] as const);
  return {
    fullName: `${first} ${last}`,
    phone: `01${1 + Math.floor(Math.random() * 9)}-${String(1000000 + Math.floor(Math.random() * 9000000)).slice(0, 7)}`,
    dob: iso(dob),
    addressLocation: pickRand(DEV_ADDRESSES),
    commuteTime: commute,
    desiredPosition: '',              // filled once formOptions loads
    expectedSalary: String(2000 + Math.floor(Math.random() * 3000)),
    salaryJustification: pickRand(DEV_SALARY_JUSTIFICATIONS),
    availableFrom: iso(availableFrom),
    preferredStartDate: iso(preferredStart),
    experienceRange: '',              // filled once formOptions loads
    qualification: '',                // filled once formOptions loads
    qualificationOther: '',
    careerGoals: pickRand(DEV_CAREER_GOALS),
    whyKindergartenTeacher: pickRand(DEV_WHY_KG),
    howDidYouKnow: '',                // filled once formOptions loads
    notes: pickRand(DEV_NOTES),
    company: '',                      // honeypot stays empty
  };
}
const DEV_MODE = (import.meta as any).env?.DEV === true;

const RESUME_ACCEPT = '.pdf,application/pdf';
const RESUME_MAX_BYTES = 10 * 1024 * 1024;
const isOthersBucket = (label: string) => label.trim().toLowerCase() === 'others';


// Order matches the enum on the backend. Labels are what the candidate
// sees in the dropdown.
const COMMUTE_OPTIONS: { value: Exclude<CommuteValue, ''>; label: string }[] = [
  { value: 'UNDER_15',   label: 'Less than 15 minutes' },
  { value: 'MIN_15_30',  label: '15 – 30 minutes' },
  { value: 'MIN_30_45',  label: '30 – 45 minutes' },
  { value: 'MIN_45_60',  label: '45 – 60 minutes' },
  { value: 'OVER_60',    label: 'More than 1 hour' },
  { value: 'WILL_MOVE',  label: "I'll move closer if hired" },
];

const STEPS = [
  { key: 'about', label: 'About you' },
  { key: 'role',  label: 'Role & experience' },
  { key: 'more',  label: 'A bit more' },
] as const;
type StepKey = typeof STEPS[number]['key'];

// Three-phase render. `welcome` sells the opportunity (drives more
// applications from candidates who'd otherwise close the tab), `form`
// is the wizard, `done` is the thank-you view.
type Phase = 'welcome' | 'form' | 'done';

// Copy is intentionally warm and specific rather than generic HR-speak.
// Edit inline to match your kindergarten's voice — the bracketed
// placeholders below are the parts most worth personalising.
const KINDERGARTEN_NAME  = 'our kindergarten';
const KINDERGARTEN_PLACE = 'Johor Bahru';

// Tight copy: three punchy reasons, each with its own visual tint so
// the page reads at a glance. Icons + colors are the visual anchors —
// the copy explains, the icons make the reader pause.
// Each row is one leg of the mission trio (continuously grow / unleash
// their potential / share in success). Order mirrors the mission line
// above so each card reads as the "how" for one promise.
const WELCOME_REASONS: Array<{
  icon: typeof faChartLine;
  tint: 'primary' | 'gold' | 'success' | 'violet';
  title: string;
  body: string;
}> = [
  {
    icon: faChartLine, tint: 'primary',
    title: 'A clear path from teacher to leader',
    body: 'Progress through six defined career levels—from Assistant Teacher to Principal—with clear expectations, promotion criteria, and salary progression.',
  },
  {
    icon: faGift, tint: 'gold',
    title: 'Rewards that grow with your contribution',
    body: 'Earn more as you grow through performance rewards, attendance incentives, seniority recognition, training allowances, and profit sharing.',
  },
  {
    icon: faHandHoldingDollar, tint: 'success',
    title: 'A culture where you can thrive',
    body: 'Work in a children-first team that values care, collaboration, recognition, and continuous improvement.',
  },
  {
    icon: faHandshake, tint: 'violet',
    title: 'A pathway to leadership and partnership',
    body: 'High-performing team members committed to growing with us may progress into leadership and long-term partnership opportunities.',
  },
];


export default function ApplyPage() {
  const { isMobile } = useIsMobile();
  const S = makeStyles(!isMobile);
  // Marketing attribution — captured once from ?utm_source= in the URL
  // and sent along with the application. Job-board links can be built
  // like /apply?utm_source=jobstreet so the admin knows which channel
  // brought each candidate, independent of what they self-report.
  const [searchParams] = useSearchParams();
  const utmSourceRef = useRef<string>(searchParams.get('utm_source') || '');
  // Dev-mode: prefill the form with plausible dummy data so we don't
  // retype the same fields on every hot reload. Production builds always
  // start empty.
  const [form, setForm] = useState<FormState>(() => DEV_MODE ? makeDevPrefill() : EMPTY);
  const [step, setStep] = useState<StepKey>('about');
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>('welcome');
  const [error, setError] = useState<string | null>(null);
  // Counts failed submit attempts so we can escalate the error copy —
  // gentle "try again" first, then a screenshot-and-WhatsApp fallback.
  const [failedAttempts, setFailedAttempts] = useState(0);
  // Modal for the compare-roles table on step 2 (Position dropdown).
  const [compareRolesOpen, setCompareRolesOpen] = useState(false);
  // Resume file chosen by the candidate. Held in memory until form
  // submit; uploaded as a second request after the candidate is created.
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  /** Non-blocking warning if the candidate record is created but the
   *  resume upload itself fails — e.g. network blip. */
  const [resumeWarning, setResumeWarning] = useState<string | null>(null);
  // Free-text companion to "Other" in the referral source dropdown.
  // Kept as ephemeral UI state — merged into howDidYouKnow at submit
  // time so the persisted field always holds the concrete source, not
  // the sentinel "Other".
  const [howDidYouKnowOther, setHowDidYouKnowOther] = useState('');

  const stepIdx = STEPS.findIndex(s => s.key === step);
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;
  // Timestamp of the last step advance. Used to reject submits that
  // fire within a short window after Next is clicked, which prevents a
  // click-through from hitting the Submit button that renders in the
  // exact same spot on the newly-shown step.
  const advancedAtRef = useRef(0);
  const goNext = () => {
    setError(null);
    setStep(STEPS[Math.min(stepIdx + 1, STEPS.length - 1)].key);
    advancedAtRef.current = Date.now();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Back from step 1 returns to the welcome view (not disabled) — form
  // answers stay in state, so if they come back to the form nothing is
  // lost. Any other step just decrements.
  const goBack = () => {
    setError(null);
    if (stepIdx === 0) {
      setPhase('welcome');
    } else {
      setStep(STEPS[stepIdx - 1].key);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Per-step gate. Step 1: name + phone. Step 2: expected salary +
  // Every field is required except `notes` ("anything else"). Backend
  // Applicants must be 18+. Native date pickers let anyone type a
  // recent date past our max attribute in some browsers, so we
  // re-check in JS as well.
  const MIN_AGE_YEARS = 18;
  const maxDobStr = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
    return d.toISOString().slice(0, 10);
  })();
  const minDobStr = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 100);
    return d.toISOString().slice(0, 10);
  })();
  const dobIsValid = (() => {
    if (!form.dob) return false;
    return form.dob >= minDobStr && form.dob <= maxDobStr;
  })();
  const dobError = form.dob && !dobIsValid
    ? `You need to be at least ${MIN_AGE_YEARS} to apply.`
    : '';

  // Start-date guard — earliest and preferred start dates can't be in
  // the past. Both use the same today-onwards floor (native date
  // picker's `min` attribute, plus JS runtime check because some
  // browsers accept anything the user types).
  const todayStr = new Date().toISOString().slice(0, 10);
  const availableFromValid = !form.availableFrom || form.availableFrom >= todayStr;
  const preferredStartValid = !form.preferredStartDate || form.preferredStartDate >= todayStr;
  const availableFromError = form.availableFrom && !availableFromValid
    ? "Earliest start date can't be in the past."
    : '';
  const preferredStartError = form.preferredStartDate && !preferredStartValid
    ? "Preferred start date can't be in the past."
    : '';

  // Phone guard — the onChange handler already strips letters, but a
  // real phone still needs some digits. 8 covers a Malaysian mobile
  // (01X-XXXXXXX = 10 digits, but some inputs shorten "01" → 8 min).
  const phoneDigitCount = (form.phone.match(/\d/g) ?? []).length;
  const phoneValid = phoneDigitCount >= 8;
  const phoneError = form.phone.trim().length > 0 && !phoneValid
    ? 'Enter a valid phone number (digits only).'
    : '';

  // validators mirror the same required set as a safety net.
  const stepValid = (() => {
    if (step === 'about') {
      return form.fullName.trim().length > 0
        && phoneValid
        && dobIsValid
        && form.addressLocation.trim().length > 0
        && form.commuteTime.length > 0
        && form.availableFrom.trim().length > 0
        && form.preferredStartDate.trim().length > 0
        && availableFromValid
        && preferredStartValid;
    }
    if (step === 'role') {
      return form.desiredPosition.trim().length > 0
        && form.experienceRange.trim().length > 0
        && form.qualification.trim().length > 0
        // "Others" bucket needs an accompanying description.
        && (!isOthersBucket(form.qualification) || form.qualificationOther.trim().length > 0)
        && form.expectedSalary.trim().length > 0
        && form.salaryJustification.trim().length > 0
        && resumeFile != null;
    }
    if (step === 'more') {
      const referralValid = form.howDidYouKnow === 'Other'
        ? howDidYouKnowOther.trim().length > 0
        : form.howDidYouKnow.trim().length > 0;
      return form.careerGoals.trim().length > 0
        && form.whyKindergartenTeacher.trim().length > 0
        && referralValid;
    }
    return true;
  })();

  // Single spread bag for every <Field …> so we don't repeat style props.
  const fp = { fieldStyle: S.field, labelStyle: S.labelText };

  // Apply-form dropdown options come from a dedicated public endpoint that
  // reads two admin-editable SystemSetting arrays (recruitment_positions,
  // recruitment_qualifications) and falls back to defaults server-side.
  const { data: formOptions } = useQuery({
    queryKey: ['candidate-form-options'],
    queryFn: fetchCandidateFormOptions,
    staleTime: 5 * 60_000,
  });
  const positions = formOptions?.positions ?? [];
  const qualifications = formOptions?.qualifications ?? [];
  const experienceRanges = formOptions?.experienceRanges ?? [];
  const referralSources = formOptions?.referralSources ?? [];
  const schoolAddress = formOptions?.address ?? '';

  // Dev-mode: finish the prefill once the dropdown options land. We
  // couldn't pick these at useState-init time because they're loaded
  // asynchronously. Only fills fields that are still blank so we don't
  // clobber anything the user typed while the query was in flight.
  useEffect(() => {
    if (!DEV_MODE || !formOptions) return;
    setForm(prev => ({
      ...prev,
      desiredPosition:  prev.desiredPosition  || (positions[Math.floor(Math.random() * positions.length)]?.name ?? ''),
      experienceRange:  prev.experienceRange  || (experienceRanges[Math.floor(Math.random() * experienceRanges.length)] ?? ''),
      qualification:    prev.qualification    || (qualifications[Math.floor(Math.random() * qualifications.length)] ?? ''),
      howDidYouKnow:    prev.howDidYouKnow    || (referralSources[Math.floor(Math.random() * referralSources.length)] ?? ''),
    }));
  }, [formOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Currently picked position — used to show the salary band hint under
  // the dropdown. Only shown when both min and max are set by the admin.
  const pickedPosition = positions.find(p => p.name === form.desiredPosition) ?? null;
  const hasBand = pickedPosition
    && pickedPosition.minSalary != null && pickedPosition.maxSalary != null
    && pickedPosition.maxSalary >= pickedPosition.minSalary;

  const showOtherQualification = isOthersBucket(form.qualification);

  useEffect(() => {
    document.title = 'Apply — KinderCore';
  }, []);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const canSubmit = form.fullName.trim().length > 0
    && phoneValid
    && dobIsValid
    && form.addressLocation.trim().length > 0
    && form.commuteTime.length > 0
    && form.availableFrom.trim().length > 0
    && form.preferredStartDate.trim().length > 0
    && availableFromValid
    && preferredStartValid
    && form.desiredPosition.trim().length > 0
    && form.experienceRange.trim().length > 0
    && form.qualification.trim().length > 0
    && (!isOthersBucket(form.qualification) || form.qualificationOther.trim().length > 0)
    && form.expectedSalary.trim().length > 0
    && form.salaryJustification.trim().length > 0
    && resumeFile != null
    && form.careerGoals.trim().length > 0
    && form.whyKindergartenTeacher.trim().length > 0
    && form.howDidYouKnow.trim().length > 0
    && (form.howDidYouKnow !== 'Other' || howDidYouKnowOther.trim().length > 0)
    && !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLast) return;
    // Click-through guard: if we just advanced steps within the last
    // 400 ms, the Submit button that now sits where Next used to be
    // likely inherited a stray mouseup/click from the Next press.
    // Require the user to click it deliberately.
    if (Date.now() - advancedAtRef.current < 400) return;
    if (!canSubmit) return;
    setError(null);
    setResumeWarning(null);
    setSubmitting(true);
    try {
      const { id } = await submitCandidateApplication({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        dob: form.dob || undefined,
        addressLocation: form.addressLocation.trim() || undefined,
        commuteTime: form.commuteTime || undefined,
        desiredPosition: form.desiredPosition || undefined,
        expectedSalary: Number(form.expectedSalary),
        salaryJustification: form.salaryJustification.trim(),
        availableFrom: form.availableFrom || undefined,
        preferredStartDate: form.preferredStartDate || undefined,
        experienceRange: form.experienceRange || undefined,
        qualification: form.qualification || undefined,
        qualificationOther: showOtherQualification ? form.qualificationOther.trim() || undefined : undefined,
        careerGoals: form.careerGoals.trim(),
        whyKindergartenTeacher: form.whyKindergartenTeacher.trim(),
        howDidYouKnow: (form.howDidYouKnow === 'Other'
          ? howDidYouKnowOther.trim()
          : form.howDidYouKnow) || undefined,
        notes: form.notes.trim() || undefined,
        utmSource: utmSourceRef.current || undefined,
        company: form.company, // honeypot
      });

      // Two-step flow: candidate row first, resume second. If the upload
      // fails we still consider the application submitted — surface a
      // non-blocking warning so the candidate knows to follow up.
      if (resumeFile) {
        try {
          await uploadCandidateResume(id, resumeFile);
        } catch (upErr: any) {
          setResumeWarning(
            upErr?.message
              ? `Your application was received, but we couldn't upload your resume: ${upErr.message}. Please email it to us.`
              : "Your application was received, but we couldn't upload your resume. Please email it to us.",
          );
        }
      }

      setPhase('done');
    } catch (err: any) {
      setError(err?.message ?? 'Submission failed. Please try again.');
      setFailedAttempts(n => n + 1);
    }
    setSubmitting(false);
  };

  if (phase === 'welcome') {
    return (
      <div style={S.shell}>
        <div style={S.welcomeCard}>
          {/* Coloured accent bar at the top of the card — small brand touch
              that reads as intentional design, not a generic form. */}
          <div style={S.cardAccent} />

          {/* Hero — vision leads. "Join us" becomes the small kicker;
              the H1 weight is spent on the actual reason to apply. */}
          <div style={S.welcomeHero}>
            <img src="/logo.png" alt="Ten Toes Preschool" style={S.welcomeLogo} />
            <h1 style={S.welcomeH1}>
              Grow as a teacher.<br />
              Lead with purpose.<br />
              Share in success.
            </h1>
          </div>

          {/* "For our teachers" panel — bridge line as its heading, the
              three benefits nested inside. Treating them as one grouped
              block visually reinforces "these things go together, and
              here's why." */}
          <div style={S.forTeachersPanel}>
            <p style={S.forTeachersLead}>
              At Ten Toes, teaching is more than a job. Build a long-term career through clear progression, continuous development, fair rewards, and opportunities to lead.
            </p>
            <div style={S.reasonsGrid}>
              {WELCOME_REASONS.map((r, idx) => (
                <div key={r.title} style={{ ...S.reasonRow, ...(idx === 0 ? S.reasonRowFirst : null) }}>
                  <div style={S.reasonIcon(r.tint)}>
                    <FontAwesomeIcon icon={r.icon} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.reasonTitle}>{r.title}</div>
                    <div style={S.reasonBody}>{r.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Large gradient CTA + tight foot note. */}
          <button
            type="button"
            style={S.welcomeCta}
            onClick={() => { setPhase('form'); window.scrollTo({ top: 0 }); }}
          >
            Start my career journey <FontAwesomeIcon icon={faArrowRight} />
          </button>
          <p style={S.ctaSub}>
            Takes about 5 minutes
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div style={S.shell}>
        <div style={S.card}>
          <div style={S.cardAccent} />
          <div style={S.doneHero}>
            <div style={S.doneMedallion}>
              <FontAwesomeIcon icon={faCircleCheck} />
            </div>
            <h1 style={S.welcomeH1}>Application received</h1>
            <p style={S.lead}>
              Thank you for applying. Here's what happens next.
            </p>
          </div>

          {/* Next steps timeline — same shape as the enquiry confirmation
              so applicants get a clear picture of the process, not just
              a "we'll get back to you" black box. */}
          <div style={S.nextStepsCard}>
            <p style={S.nextStepsTitle}>What happens next</p>

            <div style={{ ...S.nextStepRow, marginBottom: 16 }}>
              <div style={S.nextStepDotCol}>
                <div style={S.nextStepDot(true)}>1</div>
                <div style={S.nextStepConnector} />
              </div>
              <div style={{ paddingBottom: 4 }}>
                <p style={S.nextStepTitle}>We'll review your application</p>
                <p style={S.nextStepBody}>
                  Our HR team will go through your application carefully.
                </p>
              </div>
            </div>

            <div style={{ ...S.nextStepRow, marginBottom: 16 }}>
              <div style={S.nextStepDotCol}>
                <div style={S.nextStepDot(false)}>2</div>
                <div style={S.nextStepConnector} />
              </div>
              <div style={{ paddingBottom: 4 }}>
                <p style={S.nextStepTitle}>We'll reach out on WhatsApp</p>
                <p style={S.nextStepBody}>
                  If your background fits, we'll message you at <strong>{form.phone}</strong> to
                  set up an interview.
                </p>
              </div>
            </div>

            <div style={{ ...S.nextStepRow, marginBottom: 16 }}>
              <div style={S.nextStepDotCol}>
                <div style={S.nextStepDot(false)}>3</div>
                <div style={S.nextStepConnector} />
              </div>
              <div style={{ paddingBottom: 4 }}>
                <p style={S.nextStepTitle}>Interview</p>
                <p style={S.nextStepBody}>
                  You'll meet the team and get to know us.
                </p>
              </div>
            </div>

            <div style={S.nextStepRow}>
              <div style={S.nextStepDotCol}>
                <div style={S.nextStepDot(false)}>4</div>
              </div>
              <div>
                <p style={S.nextStepTitle}>Decision</p>
                <p style={S.nextStepBody}>
                  We'll let you know either way after the interview.
                </p>
              </div>
            </div>
          </div>
          {resumeWarning && (
            <div style={S.errorBox}>
              <FontAwesomeIcon icon={faTriangleExclamation} />
              <span>{resumeWarning}</span>
            </div>
          )}
          {/* No "back to start" here — the confirmation is a terminal
              state on purpose. Giving the applicant an easy "start over"
              button right after a successful submit invites accidental
              double-submissions with no real benefit. */}
        </div>
      </div>
    );
  }

  return (
    <div style={S.shell}>
      <form
        style={S.card}
        onSubmit={e => {
          e.preventDefault();
          // Enter inside an input would otherwise submit on the first step.
          // Only let the form actually submit on the last step.
          if (isLast) onSubmit(e); else if (stepValid) goNext();
        }}
      >
        <div style={S.cardAccent} />
        {/* Header — the H1 is the current step name because that's what
            the user needs to know right now. Marketing-copy heading was
            dead weight (they already clicked Apply from the vision page).
            Small kicker above carries the progress count so the stepper
            below can drop its redundant caption. */}
        <div style={S.header}>
          <div style={{ minWidth: 0 }}>
            <div style={S.stepKicker}>Step {stepIdx + 1} of {STEPS.length}</div>
            <h1 style={S.h1}>{STEPS[stepIdx].label}</h1>
          </div>
        </div>

        {/* Slim stepper — visual only, since the H1 above already names
            the step. Dots are 22px instead of the previous heavy 40px,
            and the connecting line is a hairline. */}
        <div aria-label={`Step ${stepIdx + 1} of ${STEPS.length}: ${STEPS[stepIdx].label}`}>
          <div style={S.stepBar}>
            {STEPS.map((s, i) => {
              const state: 'done' | 'current' | 'todo' =
                i < stepIdx ? 'done' : i === stepIdx ? 'current' : 'todo';
              return (
                <Fragment key={s.key}>
                  <div style={S.stepDot(state)}>
                    {state === 'done' ? <FontAwesomeIcon icon={faCircleCheck} /> : i + 1}
                  </div>
                  {i < STEPS.length - 1 && <div style={S.stepLine(i < stepIdx)} />}
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* Honeypot — hidden from real users, bots fill it. The
            `name` attribute deliberately avoids common autofill
            categories (name/email/phone/address/company) because Chrome
            was ignoring autoComplete="off" and helpfully filling
            `name="company"` with the applicant's employer from their
            Google profile, tripping the honeypot for real humans. */}
        <input
          type="text"
          name="hp_website"
          value={form.company}
          onChange={e => update('company', e.target.value)}
          autoComplete="new-password"
          tabIndex={-1}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          aria-hidden="true"
        />

        {step === 'about' && (
          <>
            <div style={S.row2}>
              <Field {...fp} label="Full name" required>
                <input style={S.input} value={form.fullName}
                  onChange={e => update('fullName', e.target.value)} required />
              </Field>
              <Field {...fp} label="WhatsApp / Phone" required>
                <input
                  style={{
                    ...S.input,
                    ...(phoneError ? { borderColor: '#dc2626' } : null),
                  }}
                  value={form.phone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  // Strip anything that isn't a digit, plus, space, dash,
                  // or parenthesis so the input can't ever hold letters.
                  // (`type="tel"` alone does not enforce this — it only
                  // hints the mobile keyboard.)
                  onChange={e => update('phone', e.target.value.replace(/[^\d+\-()\s]/g, ''))}
                  onKeyDown={e => {
                    // Also swallow alpha keys pre-emptively so paste of
                    // letters doesn't briefly flash before the onChange
                    // filter kicks in.
                    if (/^[A-Za-z]$/.test(e.key)) e.preventDefault();
                  }}
                  required
                  placeholder="01X-XXXXXXX"
                />
                {phoneError && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                    {phoneError}
                  </div>
                )}
              </Field>
            </div>
            <Field {...fp} label="Date of birth" required>
              <input
                style={{
                  ...S.input,
                  ...(dobError ? { borderColor: '#dc2626' } : null),
                }}
                value={form.dob}
                type="date"
                required
                max={maxDobStr}
                min={minDobStr}
                onChange={e => update('dob', e.target.value)}
              />
              {dobError && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                  {dobError}
                </div>
              )}
            </Field>
            <Field {...fp} label="Where do you live?" required>
              <input style={S.input} value={form.addressLocation} required
                onChange={e => update('addressLocation', e.target.value)}
                placeholder="e.g. Taman Bukit Indah, Taman Molek…" />
            </Field>
            <Field {...fp} label="Commute time to our school" required>
              <select style={S.input} value={form.commuteTime} required
                onChange={e => update('commuteTime', e.target.value as CommuteValue)}>
                <option value="">—</option>
                {COMMUTE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {schoolAddress && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                  fontSize: 12.5, color: C.muted, lineHeight: 1.4,
                  marginTop: -3,
                }}>
                  <FontAwesomeIcon icon={faLocationDot} style={{ marginTop: 2, flexShrink: 0, color: C.primary }} />
                  <span>Our school is at <strong style={{ color: C.text }}>{schoolAddress}</strong> — estimate your commute from there.</span>
                </div>
              )}
            </Field>
            <div style={S.row2}>
              <Field {...fp} label="Earliest start date" required>
                <input
                  style={{
                    ...S.input,
                    ...(availableFromError ? { borderColor: '#dc2626' } : null),
                  }}
                  value={form.availableFrom}
                  type="date"
                  required
                  min={todayStr}
                  onChange={e => update('availableFrom', e.target.value)}
                />
                {availableFromError && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                    {availableFromError}
                  </div>
                )}
              </Field>
              <Field {...fp} label="Preferred start date" required>
                <input
                  style={{
                    ...S.input,
                    ...(preferredStartError ? { borderColor: '#dc2626' } : null),
                  }}
                  value={form.preferredStartDate}
                  type="date"
                  required
                  min={todayStr}
                  onChange={e => update('preferredStartDate', e.target.value)}
                />
                {preferredStartError && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                    {preferredStartError}
                  </div>
                )}
              </Field>
            </div>
          </>
        )}

        {step === 'role' && (
          <>
            {/* Sequence is deliberate: candidate declares position (sees
                the salary band) → their experience → their qualification
                → THEN names an expected salary. By the time they type a
                number, they've already told us their credentials and can
                self-calibrate. Resume upload is last so it doesn't
                distract from the honest-money step. */}
            <Field {...fp} label="Position" required>
              <select style={S.input} value={form.desiredPosition} required
                onChange={e => update('desiredPosition', e.target.value)}>
                <option value="" disabled>Select a position</option>
                {positions.map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCompareRolesOpen(true)}
                style={S.compareRolesLink}
              >
                Not sure? Compare roles →
              </button>
            </Field>
            <Field {...fp} label="Years of teaching experience" required>
              <select style={S.input} value={form.experienceRange} required
                onChange={e => update('experienceRange', e.target.value)}>
                <option value="">—</option>
                {experienceRanges.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field {...fp} label="Highest qualification" required>
              <select style={S.input} value={form.qualification} required
                onChange={e => {
                  update('qualification', e.target.value);
                  // Clear the "Others" detail when switching to a preset.
                  if (!isOthersBucket(e.target.value)) update('qualificationOther', '');
                }}>
                <option value="">—</option>
                {qualifications.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </Field>
            {showOtherQualification && (
              <Field {...fp} label="Specify your qualification" required>
                <input style={S.input} value={form.qualificationOther} required
                  onChange={e => update('qualificationOther', e.target.value)}
                  placeholder="e.g. Master's degree in Early Childhood Education" />
              </Field>
            )}
            <Field {...fp} label="Expected monthly salary (RM)" required>
              <input style={S.input} value={form.expectedSalary} type="number" min={0} required
                onChange={e => update('expectedSalary', e.target.value)} />
              {/* Mirrors the old Google Form, which showed the band right
                  next to the salary question. */}
              {hasBand && pickedPosition && <SalaryBandHint position={pickedPosition} />}
            </Field>
            <Field {...fp}
              label="Please share any early childhood experience that supports your expected salary"
              required>
              <textarea style={{ ...S.input, minHeight: 100, fontFamily: 'inherit', resize: 'vertical' }}
                value={form.salaryJustification}
                onChange={e => update('salaryJustification', e.target.value)}
                maxLength={1000} />
            </Field>
            {/* Resume upload — required, LAST on this step by design.
                Local pre-check on type + size; backend re-validates with
                magic-byte sniffing. */}
            <Field {...fp} label="Resume (PDF only — max 10 MB)" required>
              <ResumePicker
                file={resumeFile}
                error={resumeError}
                onPick={(f) => {
                  setResumeError(null);
                  if (!f) { setResumeFile(null); return; }
                  if (f.size > RESUME_MAX_BYTES) {
                    setResumeError('File is larger than 10 MB.');
                    return;
                  }
                  if (!f.name.toLowerCase().endsWith('.pdf')) {
                    setResumeError('Only PDF files are allowed.');
                    return;
                  }
                  setResumeFile(f);
                }}
                isMobile={isMobile}
              />
            </Field>
          </>
        )}

        {step === 'more' && (
          <>
            <Field {...fp} label="What are your personal or career goals for the next 3 – 5 years?" required>
              <textarea style={{ ...S.input, minHeight: 110, fontFamily: 'inherit', resize: 'vertical' }}
                value={form.careerGoals}
                onChange={e => update('careerGoals', e.target.value)}
                maxLength={1000}
                placeholder="Where do you see yourself going, and how does this role fit?" />
            </Field>
            <Field {...fp} label="Why do you want to work as a kindergarten teacher?" required>
              <textarea style={{ ...S.input, minHeight: 110, fontFamily: 'inherit', resize: 'vertical' }}
                value={form.whyKindergartenTeacher}
                onChange={e => update('whyKindergartenTeacher', e.target.value)}
                maxLength={1000}
                placeholder="Tell us what draws you to teaching young children specifically." />
            </Field>
            <Field {...fp} label="How did you hear about us?" required>
              <select style={S.input} value={form.howDidYouKnow} required
                onChange={e => update('howDidYouKnow', e.target.value)}>
                <option value="">—</option>
                {referralSources.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {form.howDidYouKnow === 'Other' && (
                <input
                  style={{ ...S.input, marginTop: 8 }}
                  value={howDidYouKnowOther}
                  onChange={e => setHowDidYouKnowOther(e.target.value)}
                  required
                  placeholder="Please tell us where"
                  autoFocus
                />
              )}
            </Field>
            <Field {...fp} label="Anything else you'd like us to know?">
              <textarea style={{ ...S.input, minHeight: 80, fontFamily: 'inherit', resize: 'vertical' }}
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                placeholder="Optional" />
            </Field>
          </>
        )}

        {error && (
          <div style={S.errorBox}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginTop: 2 }} />
            <div>
              {failedAttempts < 2 ? (
                <div>Something went wrong. Please try again.</div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Still not working?
                  </div>
                  <div style={{ lineHeight: 1.5 }}>
                    Screenshot this page and WhatsApp us at{' '}
                    <a
                      href="https://wa.me/60115837769"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#b91c1c', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      011-5583 7769
                    </a>
                    {' '}so we can help.
                  </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#991b1b', marginTop: 6, opacity: 0.8 }}>
                Error: {error}
              </div>
            </div>
          </div>
        )}

        <div style={S.navRow}>
          {/* Back is always enabled — from step 1 it returns to the
              welcome view, from later steps it goes to the previous. */}
          <button
            type="button"
            onClick={goBack}
            style={S.backBtn(false)}
          >
            <FontAwesomeIcon icon={faArrowLeft} /> Back
          </button>

          {isLast ? (
            <button type="submit" style={S.submitBtn(canSubmit)} disabled={!canSubmit}>
              <FontAwesomeIcon icon={faPaperPlane} />
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!stepValid}
              style={S.nextBtn(stepValid)}
            >
              Next <FontAwesomeIcon icon={faArrowRight} />
            </button>
          )}
        </div>

        <p style={S.footnote}>
          Step {stepIdx + 1} of {STEPS.length} ·
          By submitting, you agree to be contacted by our HR team.
        </p>
      </form>
      {compareRolesOpen && (
        <CompareRolesModal onClose={() => setCompareRolesOpen(false)} isMobile={isMobile} />
      )}
    </div>
  );
}

// ── Compare-roles helper (step 2 Position picker) ─────────────────────────
// Data-driven so a Settings page could later drive the copy without
// touching this component. Each attribute is a row; each role is a column.
const ROLE_COMPARE_ATTRS: Array<{ label: string; values: [string, string, string] }> = [
  {
    label: 'Support role',
    values: [
      'Provides support to the lead teacher.',
      'Collaborates closely with the team.',
      'Provides guidance and leadership to teachers.',
    ],
  },
  {
    label: 'Independence',
    values: [
      'Works with direction, learning the ropes.',
      'Runs day-to-day tasks without close supervision.',
      'Leads with a high level of autonomy.',
    ],
  },
  {
    label: 'Mentorship',
    values: [
      'Typically not involved in mentoring others.',
      'Guides and mentors assistant teachers.',
      'Provides mentorship and coaching across the team.',
    ],
  },
  {
    label: 'Classroom management',
    values: [
      'Supports the lead teacher with classroom routines.',
      'Contributes to daily classroom management.',
      'Owns effective classroom management outcomes.',
    ],
  },
  {
    label: 'Team collaboration',
    values: [
      'Works within a small teaching team.',
      'Collaborates actively with colleagues.',
      'Leads collaboration across teachers and helpers.',
    ],
  },
];
const ROLE_COMPARE_HEADS: [string, string, string] = ['Assistant Teacher', 'Junior Teacher', 'Senior Teacher'];

function CompareRolesModal(props: { onClose: () => void; isMobile: boolean }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [props]);
  const m = !props.isMobile;
  return (
    <div
      onClick={props.onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, width: 'min(760px, 100%)',
          maxHeight: 'calc(100vh - 32px)', display: 'flex',
          flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(15,23,42,0.25)',
        }}
      >
        <div style={{
          padding: '18px 22px 12px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: m ? 20 : 17, fontWeight: 700, color: C.text }}>
              Which role fits you?
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textSub, lineHeight: 1.5 }}>
              A quick guide to how the three teaching roles differ day-to-day.
              Not sure? Pick the closest match — we'll talk it through in the interview.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: C.muted, fontSize: 18, padding: 4, lineHeight: 1,
            }}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: m ? '16px 22px 22px' : '12px 16px 18px' }}>
          {m ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: '20%', padding: '10px 8px', textAlign: 'left', color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }} />
                  {ROLE_COMPARE_HEADS.map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 12px', textAlign: 'left', fontWeight: 700,
                      color: C.text, background: [C.primarySoft, '#dbeafe', C.successSoft][i],
                      borderTopLeftRadius: 8, borderTopRightRadius: 8,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_COMPARE_ATTRS.map((row, ri) => (
                  <tr key={row.label} style={{ borderBottom: ri === ROLE_COMPARE_ATTRS.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 8px', color: C.textSub, fontWeight: 600, verticalAlign: 'top' }}>
                      {row.label}
                    </td>
                    {row.values.map((v, ci) => (
                      <td key={ci} style={{ padding: '12px 12px', color: C.text, lineHeight: 1.5, verticalAlign: 'top' }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* Attribute-first grouping — one card per attribute, three
               role rows inside. Lets the reader see "Support role" once
               and compare the three roles at a glance without having
               to scroll and remember. */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ROLE_COMPARE_ATTRS.map(row => (
                <div key={row.label} style={{
                  border: `1px solid ${C.borderSoft}`, borderRadius: 12, overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 14px', fontWeight: 700, color: C.text, fontSize: 14,
                    background: '#f8fafc', borderBottom: `1px solid ${C.borderSoft}`,
                  }}>{row.label}</div>
                  <div>
                    {ROLE_COMPARE_HEADS.map((h, i) => {
                      const tint = [C.primarySoft, '#dbeafe', C.successSoft][i];
                      const chipText = ['#4338ca', '#0369a1', '#047857'][i];
                      return (
                        <div key={h} style={{
                          display: 'flex', gap: 10, padding: '10px 14px',
                          borderBottom: i === ROLE_COMPARE_HEADS.length - 1 ? 'none' : '1px solid #f1f5f9',
                        }}>
                          <span style={{
                            flexShrink: 0, alignSelf: 'flex-start',
                            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                            background: tint, color: chipText,
                            whiteSpace: 'nowrap' as const,
                          }}>{h}</span>
                          <span style={{ fontSize: 13, color: C.text, lineHeight: 1.5, flex: 1 }}>
                            {row.values[i]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{
          padding: '12px 22px', borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            onClick={props.onClose}
            style={{
              padding: '9px 18px', borderRadius: 10,
              background: C.primary, color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// Defined at module scope (not inside ApplyPage) so its identity is stable
// across renders — re-creating the component on every keystroke would force
// the input subtree to remount and lose focus mid-typing. Styles come in
// via props because they're computed per breakpoint.
function Field(props: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  fieldStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
}) {
  return (
    <label style={props.fieldStyle}>
      <span style={props.labelStyle}>
        {props.label}
        {props.required && <span style={{ color: C.danger, marginLeft: 4 }}>*</span>}
      </span>
      {props.children}
    </label>
  );
}

// Shown under Expected salary, right where the candidate is typing a
// number — mirrors the old Google Form, which showed the band next to
// the same question.
function SalaryBandHint({ position }: { position: RecruitmentPosition }) {
  return (
    <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.4, marginTop: -3 }}>
      Typical salary range for {position.name}:
      {' '}<strong style={{ fontWeight: 700 }}>RM {position.minSalary!.toLocaleString()} – RM {position.maxSalary!.toLocaleString()}</strong>
      , depending on experience, skills and qualification.
    </span>
  );
}

// Resume picker — drop-target shape on desktop, big tap target on mobile.
// Doesn't upload by itself; just hands the chosen File back via onPick.
function ResumePicker(props: {
  file: File | null;
  error: string | null;
  onPick: (file: File | null) => void;
  isMobile: boolean;
}) {
  if (props.file) {
    const sizeKb = Math.round(props.file.size / 1024);
    return (
      <div style={resumeStyles.selected}>
        <FontAwesomeIcon icon={faFileLines} style={{ color: C.primary }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={resumeStyles.fileName}>{props.file.name}</div>
          <div style={resumeStyles.fileMeta}>{sizeKb.toLocaleString()} KB</div>
        </div>
        <button
          type="button"
          onClick={() => props.onPick(null)}
          style={resumeStyles.removeBtn}
          aria-label="Remove file"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
    );
  }
  return (
    <>
      <label style={resumeStyles.picker(props.isMobile)}>
        <FontAwesomeIcon icon={faFileLines} style={{ color: C.primary, fontSize: 18 }} />
        <span style={resumeStyles.pickerLabel}>
          {props.isMobile ? 'Tap to choose your resume' : 'Click to choose your resume'}
        </span>
        <span style={resumeStyles.pickerHint}>PDF only · up to 10 MB</span>
        <input
          type="file"
          accept={RESUME_ACCEPT}
          onChange={e => {
            // Stop the change event from bubbling — belt-and-braces so a
            // parent form doesn't get any inherited enter/submit noise
            // when the file dialog closes.
            e.stopPropagation();
            props.onPick(e.target.files?.[0] ?? null);
          }}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      </label>
      {props.error && (
        <div style={resumeStyles.error}>
          <FontAwesomeIcon icon={faTriangleExclamation} /> {props.error}
        </div>
      )}
    </>
  );
}

const resumeStyles = {
  picker: (mobile: boolean): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 6, padding: mobile ? '20px 16px' : '18px 16px',
    border: `1.5px dashed ${C.border}`, borderRadius: 10,
    background: '#fff', color: C.text, cursor: 'pointer',
    position: 'relative',
  }),
  pickerLabel: { fontSize: 14, fontWeight: 600, color: C.text },
  pickerHint: { fontSize: 12, color: C.muted },
  selected: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', border: `1px solid ${C.border}`,
    borderRadius: 10, background: C.primarySoft,
  } as React.CSSProperties,
  fileName: { fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as React.CSSProperties,
  fileMeta: { fontSize: 12, color: C.muted },
  removeBtn: {
    width: 32, height: 32, borderRadius: 8, border: 'none',
    background: 'transparent', color: C.muted, fontSize: 14, cursor: 'pointer',
  } as React.CSSProperties,
  error: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: C.danger, marginTop: 6,
  } as React.CSSProperties,
};

// Mobile-first style factory. Defaults target a phone screen; the `m`
// (desktop) branch widens spacing, font, and switches paired fields back
// to a 2-column grid. iOS Safari auto-zooms inputs under 16px font, so the
// mobile input fontSize is pinned at 16.
const makeStyles = (m: boolean) => ({
  shell: {
    minHeight: '100vh', background: C.bg,
    padding: m ? '32px 16px' : '12px 10px',
    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    color: C.text,
  } as React.CSSProperties,
  // Form card mirrors the welcome card's visual language: same accent
  // bar top, shadow, border and radius. Keeps a wider max-width because
  // the form has 2-column rows the welcome doesn't.
  card: {
    position: 'relative', overflow: 'hidden',
    width: '100%', maxWidth: 640, background: C.surface,
    borderRadius: m ? 20 : 16,
    border: `1px solid ${C.border}`,
    padding: m ? '32px 28px' : '24px 18px',
    display: 'flex', flexDirection: 'column', gap: m ? 14 : 12,
    boxShadow: '0 6px 24px rgba(15,23,42,0.05)',
  } as React.CSSProperties,
  // Shared gradient accent bar rendered as an absolute div at the top of
  // any card. Reused by the welcome card, the form card and the done view.
  cardAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 5,
    background: C.primary,
  } as React.CSSProperties,
  header: {
    display: 'flex', alignItems: 'center', gap: m ? 14 : 12,
    marginBottom: m ? 8 : 4,
  } as React.CSSProperties,
  h1: {
    fontSize: m ? 26 : 20, fontWeight: 700, margin: 0, color: C.text,
    lineHeight: 1.2,
  } as React.CSSProperties,
  // Small eyebrow above the H1 — replaces the redundant "Step X of Y"
  // caption that used to sit below the stepper.
  stepKicker: {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
    color: C.muted, marginBottom: 4,
  } as React.CSSProperties,
  lead: { fontSize: 15, color: C.textSub, lineHeight: 1.55, margin: '8px 0 16px' } as React.CSSProperties,
  section: {
    fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
    letterSpacing: 0.6, margin: '14px 0 6px',
    borderTop: `1px solid ${C.borderSoft}`, paddingTop: 16,
  } as React.CSSProperties,
  // Mobile = single column stack; desktop = 2-up grid.
  row2: {
    display: m ? 'grid' : 'flex',
    gridTemplateColumns: m ? '1fr 1fr' : undefined,
    flexDirection: m ? undefined : 'column',
    gap: 12,
  } as React.CSSProperties,
  field: { display: 'flex', flexDirection: 'column', gap: 6 } as React.CSSProperties,
  labelText: {
    fontSize: m ? 13 : 13, fontWeight: 600, color: C.textSub,
  } as React.CSSProperties,
  // Small in-line trigger under the Position dropdown that opens the
  // compare-roles modal. Kept subtle so confident candidates skim past
  // it; only draws attention when the applicant is undecided.
  compareRolesLink: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'transparent', border: 'none', padding: 0,
    color: C.primary,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,
  // ── Welcome view ─────────────────────────────────────────────────────
  // Card overrides for the welcome view: full border, top accent bar,
  // and slightly softer shadow. Keeps the form card unchanged.
  welcomeCard: {
    position: 'relative', overflow: 'hidden',
    width: '100%', maxWidth: 560, background: C.surface,
    borderRadius: m ? 20 : 16,
    border: `1px solid ${C.border}`,
    padding: m ? '36px 32px 28px' : '28px 20px 22px',
    display: 'flex', flexDirection: 'column', gap: m ? 18 : 16,
    boxShadow: '0 6px 24px rgba(15,23,42,0.05)',
  } as React.CSSProperties,
  welcomeHero: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', gap: m ? 12 : 10,
    padding: m ? '6px 0 4px' : '2px 0 2px',
  } as React.CSSProperties,
  // Brand mark that anchors the hero — the actual Ten Toes logo, not an
  // icon standing in for it. Height-constrained like the other logo
  // placements in the app (LandingPage, EnquiryFormPage) so its native
  // wordmark aspect ratio scales naturally instead of being cropped.
  welcomeLogo: {
    height: m ? 72 : 64,
    marginBottom: 2,
  } as React.CSSProperties,
  welcomeH1: {
    fontSize: m ? 24 : 20, fontWeight: 800, margin: 0, color: C.text,
    // Tighter leading than a single-line headline needs — three short
    // stacked lines read as one deliberate statement, not three loose
    // sentences, when the lines sit close together.
    lineHeight: 1.18, letterSpacing: -0.2,
    maxWidth: 480,
  } as React.CSSProperties,
  // Reasons — vertical rows separated by hairline dividers. Dividers
  // give the panel structure without the "list" feeling of bullets.
  reasonsGrid: {
    display: 'flex', flexDirection: 'column', gap: 0,
    marginTop: 4, background: 'transparent',
  } as React.CSSProperties,
  reasonRow: {
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: m ? '14px 0' : '12px 0',
    // Neutral hairline, not a leftover tint from the pre-rebrand indigo
    // palette — dividers should be quiet, not colored.
    borderTop: `1px solid ${C.borderSoft}`,
  } as React.CSSProperties,
  // First row shouldn't carry the top border — it sits right under the
  // "we provide:" lead-in and doesn't need visual separation there.
  reasonRowFirst: {
    borderTop: 'none', paddingTop: m ? 6 : 4,
  } as React.CSSProperties,
  // Soft tint badge — pale fill, colored glyph. Reads calmer than a
  // solid saturated square with a white icon, which looks more like an
  // app icon than a detail inside a form.
  reasonIcon: (tint: 'primary' | 'success' | 'gold' | 'violet'): React.CSSProperties => {
    const map = {
      primary: { soft: C.primarySoft, deep: C.primary },
      success: { soft: C.successSoft, deep: C.success },
      gold:    { soft: C.goldSoft,    deep: C.gold },
      violet:  { soft: C.violetSoft,  deep: C.violet },
    }[tint];
    return {
      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
      background: map.soft,
      color: map.deep,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 17,
    };
  },
  reasonTitle: {
    fontSize: m ? 15 : 14, fontWeight: 700, color: C.text, lineHeight: 1.3,
  } as React.CSSProperties,
  reasonBody: {
    fontSize: m ? 13 : 13, color: C.textSub, marginTop: 2, lineHeight: 1.5,
  } as React.CSSProperties,
  // "For our teachers" grouped panel — a quiet card (soft shadow, no
  // colored border) so it reads as a distinct block of proof without
  // competing with the button or icons for attention. A colored accent
  // border here was a Material-style move, not an Apple one — depth
  // comes from shadow, not from a stripe of brand color.
  forTeachersPanel: {
    background: '#fbfbfe',
    border: `1px solid ${C.borderSoft}`,
    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
    borderRadius: m ? 16 : 14,
    padding: m ? '20px 22px' : '16px 16px',
    display: 'flex', flexDirection: 'column', gap: m ? 12 : 10,
  } as React.CSSProperties,
  forTeachersLead: {
    // Secondary text color — the headline should be the darkest thing
    // on screen; a lead paragraph at full-strength black competes with
    // it instead of supporting it.
    fontSize: m ? 14 : 13, color: C.textSub, lineHeight: 1.5,
    margin: '-2px 0 4px',
  } as React.CSSProperties,
  // Bigger, more prominent CTA than the form's regular submit button.
  // Solid brand blue — the loud brand yellow reads as harsh/novelty at
  // this size and this is a professional application form, not a toy
  // brand's storefront. Yellow stays where it belongs: the logo mark.
  welcomeCta: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: m ? '14px 24px' : '14px 20px',
    borderRadius: 12, border: 'none',
    background: C.primary,
    color: '#fff', fontSize: m ? 16 : 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 6,
    boxShadow: '0 4px 14px rgba(0,0,168,0.25)',
    letterSpacing: 0.2,
  } as React.CSSProperties,
  ctaSub: {
    fontSize: 12, color: C.muted, textAlign: 'center',
    margin: '2px 0 0', lineHeight: 1.4,
  } as React.CSSProperties,
  input: {
    border: `1px solid ${C.border}`, borderRadius: m ? 8 : 10,
    // 16px font on mobile prevents iOS Safari auto-zoom on focus.
    padding: m ? '10px 12px' : '13px 14px',
    fontSize: m ? 14 : 16,
    background: '#fff', color: C.text, outline: 'none',
    width: '100%', boxSizing: 'border-box',
  } as React.CSSProperties,
  errorBox: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    background: C.dangerSoft, color: C.danger, padding: '10px 12px',
    borderRadius: 8, fontSize: 14, border: `1px solid #fecaca`,
  } as React.CSSProperties,
  stepBar: {
    display: 'flex', alignItems: 'center',
    gap: 6,
    padding: '4px 0 8px',
  } as React.CSSProperties,
  // Slim 22px dots. Done state uses a soft primary tint so it doesn't
  // shout for attention (the H1 above is the primary anchor now). The
  // current step uses a subtle ring instead of a heavy fill so the
  // done/current contrast reads as progression, not as celebration.
  stepDot: (state: 'done' | 'current' | 'todo'): React.CSSProperties => ({
    width: 22, height: 22, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
    background:
      state === 'current' ? C.primary
      : state === 'done'  ? C.primarySoft
      : '#fff',
    color:
      state === 'current' ? '#fff'
      : state === 'done'  ? C.primaryDeep
      : C.muted,
    border:
      state === 'todo' ? `1.5px solid ${C.border}`
      : 'none',
  }),
  stepLine: (done: boolean): React.CSSProperties => ({
    flex: 1, height: 2, background: done ? C.primarySoft : C.border, borderRadius: 2,
  }),
  navRow: {
    display: 'flex', justifyContent: 'space-between',
    gap: m ? 12 : 10, marginTop: m ? 12 : 16,
  } as React.CSSProperties,
  backBtn: (disabled: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: m ? '12px 18px' : '14px 18px',
    borderRadius: 10, fontSize: m ? 14 : 15, fontWeight: 600,
    background: '#fff', color: disabled ? '#cbd5e1' : C.textSub,
    border: `1px solid ${C.border}`,
    cursor: disabled ? 'default' : 'pointer',
    flex: m ? '0 0 auto' : '0 0 auto',
    minWidth: m ? undefined : 92,
  }),
  // Next + Submit share the welcome CTA's solid brand blue so the
  // primary action feels the same across every page.
  nextBtn: (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: m ? '12px 22px' : '14px 22px',
    borderRadius: 12, fontSize: m ? 14 : 15, fontWeight: 700,
    background: active ? C.primary : '#cbd5e1',
    color: '#fff', border: 'none',
    cursor: active ? 'pointer' : 'default',
    boxShadow: active ? '0 4px 14px rgba(0,0,168,0.25)' : 'none',
    letterSpacing: 0.2,
    marginLeft: m ? 'auto' : undefined,
    flex: m ? undefined : 1,
  }),
  submitBtn: (active: boolean) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: m ? '12px 22px' : '14px 22px',
    borderRadius: 12, fontSize: m ? 15 : 15, fontWeight: 700,
    background: active ? C.primary : '#cbd5e1',
    color: '#fff', border: 'none',
    cursor: active ? 'pointer' : 'default',
    boxShadow: active ? '0 4px 14px rgba(0,0,168,0.25)' : 'none',
    letterSpacing: 0.2,
    marginLeft: m ? 'auto' : undefined,
    flex: m ? undefined : 1,
  }) as React.CSSProperties,
  footnote: { fontSize: 12, color: C.muted, textAlign: 'center', margin: '8px 0 0' } as React.CSSProperties,
  // Done view — same shape as the welcome hero (centered column, big
  // medallion) but tinted green to signal success. Keeps a coherent
  // rhythm across welcome → form → done.
  doneHero: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', gap: m ? 12 : 10,
    padding: m ? '6px 0 4px' : '2px 0 2px',
  } as React.CSSProperties,
  doneMedallion: {
    width: m ? 72 : 64, height: m ? 72 : 64, borderRadius: '50%',
    background: C.successSoft,
    color: C.success,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: m ? 32 : 28,
    border: `1px solid ${C.successSoft}`,
    boxShadow: '0 4px 14px rgba(5,150,105,0.15)',
    marginBottom: 2,
  } as React.CSSProperties,
  // Next-steps timeline on the done page — matches the enquiry
  // confirmation's shape so both funnels feel like the same product.
  nextStepsCard: {
    marginTop: 20, padding: '20px 20px',
    background: '#fff', borderRadius: 14,
    border: `1px solid ${C.borderSoft}`,
    boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
  } as React.CSSProperties,
  nextStepsTitle: {
    margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: C.primaryDeep,
  } as React.CSSProperties,
  nextStepRow: {
    display: 'flex', gap: 14,
  } as React.CSSProperties,
  nextStepDotCol: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  nextStepDot: (active: boolean): React.CSSProperties => ({
    width: 26, height: 26, borderRadius: '50%',
    background: active ? C.primary : C.primarySoft,
    color: active ? '#fff' : C.primaryDeep,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700,
  }),
  nextStepConnector: {
    width: 1, flex: 1, background: C.border, margin: '4px 0',
  } as React.CSSProperties,
  nextStepTitle: {
    margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: C.text,
  } as React.CSSProperties,
  nextStepBody: {
    margin: 0, fontSize: 12, color: C.textSub, lineHeight: 1.5,
  } as React.CSSProperties,
});
