import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboardList, faUsers, faSackDollar, faChild, faCalendarDays,
  faChartLine, faShieldHalved, faCircleCheck, faArrowRight, faBolt,
  faHandshake,
} from '@fortawesome/free-solid-svg-icons';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';

// Public homepage at kindertech-cloud.com/. Audience: kindergarten
// operators (owners, administrators, head teachers) evaluating the
// software. Lives outside any auth gate so a prospective customer —
// or Google's OAuth verification reviewer — can read it without
// signing in. Links visibly to /privacy and /terms.

const PRODUCT_NAME = 'KinderTech Cloud';
const CONTACT_EMAIL = 'support@kindertech-cloud.com';

// Indigo + slate palette — matches the rest of the admin app so the
// landing and the product feel like one brand.
const C = {
  text: '#0f172a',
  textSub: '#3f4b5c',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  border: '#e2e8f0',
  borderSoft: '#eef0f3',
  surface: '#ffffff',
  bg: '#f8fafc',
  bgSoft: '#f1f5f9',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  primaryDeep: '#3c339a',
  success: '#059669',
  successSoft: '#ecfdf5',
};

const features: { icon: any; title: string; body: string }[] = [
  {
    icon: faClipboardList,
    title: 'Enrolment & enquiries',
    body: 'Capture every enquiry from web, WhatsApp, walk-ins and referrals. Track each lead through tours, follow-ups, and conversion — with the source attribution you need to spend your marketing where it actually works.',
  },
  {
    icon: faUsers,
    title: 'Staff records',
    body: 'A single profile per teacher — schedule, position, level, qualifications, allowances, career history. Replace the spreadsheet sprawl.',
  },
  {
    icon: faSackDollar,
    title: 'Payroll & bonus pools',
    body: 'Monthly payroll, profit-sharing, and annual bonuses calculated from real revenue and expense ratios. Numbers you can defend to the auditor and to your team.',
  },
  {
    icon: faChild,
    title: 'Student records',
    body: 'Every enrolled child\'s profile, parent contacts, attendance, and onboarding paperwork in one place. Class and timetable changes update everywhere at once.',
  },
  {
    icon: faCalendarDays,
    title: 'Classes & timetables',
    body: 'Assign students to classes, define weekly timetables, manage substitution. Operations planner shows the week at a glance.',
  },
  {
    icon: faChartLine,
    title: 'Analytics that decide',
    body: 'Honest dashboards for sales, revenue, staff cost, finance, profit-share, and annual bonus — built from the same ledger as payroll, so the numbers always match.',
  },
];

const howItWorks: { step: string; title: string; body: string }[] = [
  {
    step: '01',
    title: 'Set up your school',
    body: 'Invite administrators and teachers, configure positions, salary tiers, and class structure.',
  },
  {
    step: '02',
    title: 'Bring your data in',
    body: 'Add students and staff. Connect lead capture forms to your website and WhatsApp. Optionally connect Google Calendar.',
  },
  {
    step: '03',
    title: 'Run the school',
    body: 'Track enrolments, run payroll, monitor finances, and see at a glance where your kindergarten stands — every day.',
  },
];

const benefits: { icon: any; title: string; body: string }[] = [
  {
    icon: faBolt,
    title: 'One source of truth',
    body: 'Lead data, payroll, finance, and reports come from one ledger. No more reconciling three spreadsheets at month-end.',
  },
  {
    icon: faShieldHalved,
    title: 'Built for Malaysian kindergartens',
    body: 'MYR-native, designed around how Malaysian preschools actually operate — fees, allowances, profit-sharing, and the local enquiry channels.',
  },
  {
    icon: faHandshake,
    title: 'Honest math',
    body: 'Bonus pools and profit-shares are computed from your actual revenue and operating costs — auditable, predictable, defensible to your team.',
  },
];

export default function HomePage() {
  return (
    <div style={s.page}>
      <style>{`
        .ktc-cta-primary:hover { background: ${C.primaryDeep} !important; }
        .ktc-cta-secondary:hover { background: ${C.primarySoft} !important; }
        .ktc-feature-card:hover { border-color: ${C.primaryBorder}; transform: translateY(-2px); }
        .ktc-feature-card { transition: border-color 180ms ease, transform 180ms ease; }
        .ktc-top-link:hover { color: ${C.primary} !important; }
      `}</style>

      {/* ── Top nav ─────────────────────────────────────────────── */}
      <header style={s.topBar}>
        <div style={s.topBarInner}>
          <Link to="/" style={s.brand}>
            <span style={s.brandMark}>K</span>
            <span style={{ fontWeight: 800, color: C.text }}>{PRODUCT_NAME}</span>
          </Link>
          <nav style={s.topNav}>
            <a href="#features" className="ktc-top-link" style={s.topNavLink}>Features</a>
            <a href="#why" className="ktc-top-link" style={s.topNavLink}>Why us</a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="ktc-top-link" style={s.topNavLink}>Contact</a>
            <Link to="/login" style={s.topLoginBtn}>Log in</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section style={s.hero}>
        <div style={s.heroInner}>
          <div style={s.heroEyebrow}>Kindergarten management software</div>
          <h1 style={s.h1}>
            Run your kindergarten<br />
            <span style={{ color: C.primary }}>without the spreadsheet sprawl.</span>
          </h1>
          <p style={s.heroSub}>
            {PRODUCT_NAME} brings enrolment, staff, payroll, student records,
            and class scheduling into one secure web app — built specifically
            for kindergarten owners and administrators in Malaysia.
          </p>
          <div style={s.heroCtaRow}>
            <a href={`mailto:${CONTACT_EMAIL}`} className="ktc-cta-primary" style={s.ctaPrimary}>
              Talk to us
              <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
            </a>
            <Link to="/login" className="ktc-cta-secondary" style={s.ctaSecondary}>
              Log in
            </Link>
          </div>
          <div style={s.heroAudience}>
            Built for kindergarten operators · Not a service for parents — if
            you're looking to enrol a child, please contact your kindergarten directly.
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section id="features" style={s.section}>
        <div style={s.sectionInner}>
          <div style={s.sectionHeader}>
            <div style={s.sectionEyebrow}>Features</div>
            <h2 style={s.h2}>Everything you need to run a kindergarten</h2>
            <p style={s.sectionSub}>
              From the first enquiry to year-end bonus payouts —
              all in one platform, none of the duct tape.
            </p>
          </div>
          <div style={s.featuresGrid}>
            {features.map(f => (
              <div key={f.title} className="ktc-feature-card" style={s.featureCard}>
                <div style={s.featureIcon}>
                  <FontAwesomeIcon icon={f.icon} style={{ fontSize: 18 }} />
                </div>
                <h3 style={s.featureTitle}>{f.title}</h3>
                <p style={s.featureBody}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section style={{ ...s.section, background: C.bgSoft }}>
        <div style={s.sectionInner}>
          <div style={s.sectionHeader}>
            <div style={s.sectionEyebrow}>How it works</div>
            <h2 style={s.h2}>From sign-up to running your day, in three steps</h2>
          </div>
          <div style={s.stepsGrid}>
            {howItWorks.map(step => (
              <div key={step.step} style={s.stepCard}>
                <div style={s.stepNumber}>{step.step}</div>
                <h3 style={s.stepTitle}>{step.title}</h3>
                <p style={s.stepBody}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why kindergarten operators choose us ────────────────── */}
      <section id="why" style={s.section}>
        <div style={s.sectionInner}>
          <div style={s.sectionHeader}>
            <div style={s.sectionEyebrow}>Why {PRODUCT_NAME}</div>
            <h2 style={s.h2}>Built for the way you actually run your school</h2>
          </div>
          <div style={s.benefitsGrid}>
            {benefits.map(b => (
              <div key={b.title} style={s.benefitCard}>
                <div style={s.benefitIcon}>
                  <FontAwesomeIcon icon={b.icon} style={{ fontSize: 20 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={s.benefitTitle}>{b.title}</h3>
                  <p style={s.benefitBody}>{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Google integration disclosure ───────────────────────── */}
      <section style={{ ...s.section, background: C.bgSoft }}>
        <div style={{ ...s.sectionInner, maxWidth: 820 }}>
          <div style={s.sectionHeader}>
            <div style={s.sectionEyebrow}>
              <FontAwesomeIcon icon={faGoogle} style={{ fontSize: 11, marginRight: 6 }} />
              Use of Google services
            </div>
            <h2 style={s.h2}>Optional Google Calendar integration</h2>
          </div>
          <div style={s.disclosureCard}>
            <p style={s.disclosureText}>
              {PRODUCT_NAME} optionally connects to your Google account using
              OAuth so school administrators can schedule events (parent tours,
              staff meetings, class events) into their Google Calendar. We
              request only the Google Calendar and basic profile scopes needed
              for this feature. You can revoke access at any time from your{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                style={s.link}
              >
                Google Account permissions page
              </a>
              .
            </p>
            <p style={s.disclosureText}>
              {PRODUCT_NAME}'s use and transfer of information received from
              Google APIs adheres to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                style={s.link}
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. See our full{' '}
              <Link to="/privacy" style={s.link}>Privacy Policy</Link>{' '}
              for details.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA band ────────────────────────────────────────────── */}
      <section style={s.ctaBand}>
        <div style={s.ctaBandInner}>
          <div>
            <h2 style={s.ctaBandTitle}>Ready to simplify your kindergarten operations?</h2>
            <p style={s.ctaBandSub}>
              Get in touch — we'll show you what {PRODUCT_NAME} looks like with
              your school's structure.
            </p>
          </div>
          <a href={`mailto:${CONTACT_EMAIL}`} className="ktc-cta-primary" style={{ ...s.ctaPrimary, flexShrink: 0 }}>
            Talk to us
            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
          </a>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.footerCol}>
            <Link to="/" style={s.brand}>
              <span style={s.brandMark}>K</span>
              <span style={{ fontWeight: 800, color: C.text }}>{PRODUCT_NAME}</span>
            </Link>
            <p style={s.footerTagline}>
              Kindergarten management software for owners, administrators, and teachers.
            </p>
          </div>
          <div style={s.footerCol}>
            <div style={s.footerColTitle}>Product</div>
            <a href="#features" style={s.footerLink}>Features</a>
            <a href="#why" style={s.footerLink}>Why us</a>
            <Link to="/login" style={s.footerLink}>Log in</Link>
          </div>
          <div style={s.footerCol}>
            <div style={s.footerColTitle}>Legal</div>
            <Link to="/privacy" style={s.footerLink}>Privacy Policy</Link>
            <Link to="/terms" style={s.footerLink}>Terms of Service</Link>
          </div>
          <div style={s.footerCol}>
            <div style={s.footerColTitle}>Contact</div>
            <a href={`mailto:${CONTACT_EMAIL}`} style={s.footerLink}>{CONTACT_EMAIL}</a>
            <div style={{ ...s.footerLink, color: C.mutedSoft, cursor: 'default' }}>Malaysia</div>
          </div>
        </div>
        <div style={s.footerBottom}>
          <span>&copy; {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 10, color: C.success }} />
            Built for kindergartens in Malaysia
          </span>
        </div>
      </footer>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: C.surface,
    color: C.text,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.55,
  },

  // Top nav
  topBar: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 50,
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderBottom: `1px solid ${C.border}`,
  },
  topBarInner: {
    maxWidth: 1140,
    margin: '0 auto',
    padding: '14px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  brand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 15,
    textDecoration: 'none',
    color: 'inherit',
  },
  brandMark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26, height: 26,
    borderRadius: 7,
    background: C.primary, color: '#fff',
    fontWeight: 800, fontSize: 14,
  },
  topNav: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
  },
  topNavLink: {
    color: C.textSub,
    textDecoration: 'none',
    fontSize: 14, fontWeight: 600,
    transition: 'color 160ms ease',
  },
  topLoginBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: 8,
    background: C.text,
    color: '#fff',
    fontSize: 13, fontWeight: 700,
    textDecoration: 'none',
  },

  // Hero
  hero: {
    padding: '88px 28px 64px',
    background: `radial-gradient(ellipse at top, ${C.primarySoft} 0%, ${C.surface} 60%)`,
  },
  heroInner: {
    maxWidth: 880,
    margin: '0 auto',
    textAlign: 'center' as const,
  },
  heroEyebrow: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 999,
    background: C.primarySoft,
    color: C.primaryDeep,
    border: `1px solid ${C.primaryBorder}`,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.02em',
    marginBottom: 22,
  },
  h1: {
    margin: 0,
    fontSize: 52,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.08,
    color: C.text,
  },
  heroSub: {
    margin: '22px auto 0',
    maxWidth: 680,
    fontSize: 18,
    fontWeight: 500,
    color: C.textSub,
    lineHeight: 1.6,
  },
  heroCtaRow: {
    marginTop: 32,
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  },
  ctaPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '13px 26px',
    borderRadius: 10,
    background: C.primary,
    color: '#fff',
    fontSize: 14, fontWeight: 700,
    textDecoration: 'none',
    transition: 'background 180ms ease',
  },
  ctaSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '13px 26px',
    borderRadius: 10,
    background: C.surface,
    color: C.primary,
    border: `1.5px solid ${C.primaryBorder}`,
    fontSize: 14, fontWeight: 700,
    textDecoration: 'none',
    transition: 'background 180ms ease',
  },
  heroAudience: {
    marginTop: 28,
    fontSize: 12.5,
    fontWeight: 500,
    color: C.mutedSoft,
    lineHeight: 1.55,
  },

  // Section
  section: {
    padding: '80px 28px',
  },
  sectionInner: {
    maxWidth: 1140,
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  sectionHeader: {
    textAlign: 'center' as const,
    maxWidth: 760,
    margin: '0 auto 48px',
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    color: C.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: 12,
  },
  h2: {
    margin: 0,
    fontSize: 34,
    fontWeight: 800,
    color: C.text,
    letterSpacing: '-0.025em',
    lineHeight: 1.15,
  },
  sectionSub: {
    margin: '14px 0 0',
    fontSize: 16,
    fontWeight: 500,
    color: C.textSub,
    lineHeight: 1.6,
  },

  // Features
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 18,
  },
  featureCard: {
    padding: 26,
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
  },
  featureIcon: {
    width: 44, height: 44,
    borderRadius: 11,
    background: C.primarySoft,
    color: C.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    border: `1px solid ${C.primaryBorder}`,
  },
  featureTitle: {
    margin: '0 0 8px',
    fontSize: 17,
    fontWeight: 800,
    color: C.text,
    letterSpacing: '-0.012em',
  },
  featureBody: {
    margin: 0,
    fontSize: 14.5,
    fontWeight: 500,
    color: C.textSub,
    lineHeight: 1.6,
  },

  // Steps
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 20,
  },
  stepCard: {
    padding: 28,
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
  },
  stepNumber: {
    fontSize: 28,
    fontWeight: 800,
    color: C.primary,
    letterSpacing: '-0.02em',
    marginBottom: 14,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  stepTitle: {
    margin: '0 0 8px',
    fontSize: 17,
    fontWeight: 800,
    color: C.text,
    letterSpacing: '-0.012em',
  },
  stepBody: {
    margin: 0,
    fontSize: 14.5,
    fontWeight: 500,
    color: C.textSub,
    lineHeight: 1.6,
  },

  // Benefits
  benefitsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 18,
  },
  benefitCard: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    padding: 24,
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
  },
  benefitIcon: {
    width: 46, height: 46,
    borderRadius: 12,
    background: C.successSoft,
    color: C.success,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitTitle: {
    margin: '2px 0 6px',
    fontSize: 16,
    fontWeight: 800,
    color: C.text,
    letterSpacing: '-0.012em',
  },
  benefitBody: {
    margin: 0,
    fontSize: 14,
    fontWeight: 500,
    color: C.textSub,
    lineHeight: 1.6,
  },

  // Google disclosure
  disclosureCard: {
    padding: 28,
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
  },
  disclosureText: {
    margin: '0 0 14px',
    fontSize: 14.5,
    fontWeight: 500,
    color: C.textSub,
    lineHeight: 1.65,
  },
  link: {
    color: C.primary,
    textDecoration: 'underline',
  },

  // CTA band
  ctaBand: {
    background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDeep} 100%)`,
    color: '#fff',
    padding: '64px 28px',
  },
  ctaBandInner: {
    maxWidth: 1140,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 28,
    flexWrap: 'wrap' as const,
  },
  ctaBandTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#fff',
  },
  ctaBandSub: {
    margin: '8px 0 0',
    fontSize: 15,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.55,
  },

  // Footer
  footer: {
    background: C.bg,
    borderTop: `1px solid ${C.border}`,
    padding: '48px 28px 24px',
    marginTop: 'auto',
  },
  footerInner: {
    maxWidth: 1140,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 32,
    marginBottom: 32,
  },
  footerCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  footerTagline: {
    margin: '4px 0 0',
    fontSize: 13,
    fontWeight: 500,
    color: C.muted,
    lineHeight: 1.55,
    maxWidth: 260,
  },
  footerColTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: C.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 4,
  },
  footerLink: {
    color: C.textSub,
    textDecoration: 'none',
    fontSize: 13.5,
    fontWeight: 600,
  },
  footerBottom: {
    maxWidth: 1140,
    margin: '0 auto',
    padding: '20px 0 0',
    borderTop: `1px solid ${C.borderSoft}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: 12,
    fontSize: 12,
    color: C.muted,
  },
};
