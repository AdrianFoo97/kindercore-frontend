import { Link } from 'react-router-dom';

// Public homepage — kindertech-cloud.com/. Purpose: explain what the
// product does, link visibly to the Privacy Policy + Terms of Service,
// and live OUTSIDE any login gate so the Google OAuth verification
// reviewer can read it without authenticating.

const PRODUCT_NAME = 'KinderTech Cloud';
const TAGLINE = 'Run your kindergarten in one place.';
const CONTACT_EMAIL = 'support@kindertech-cloud.com';

const features: { title: string; body: string }[] = [
  {
    title: 'Enrolment & enquiries',
    body: 'Capture parent enquiries from your website, WhatsApp, and walk-ins. Track each lead through to enrolment with attendance, follow-ups, and conversion analytics.',
  },
  {
    title: 'Staff & payroll',
    body: 'Manage teacher records, working schedules, allowances, monthly payroll, profit-sharing pools, and annual bonus calculations — driven from one honest data source.',
  },
  {
    title: 'Student records',
    body: 'Keep every enrolled student\'s profile, attendance, parent contacts, and onboarding paperwork in one place. Class assignments and timetables update everywhere at once.',
  },
  {
    title: 'Calendar scheduling',
    body: 'Optionally connect your Google Calendar so parent tours, staff meetings, and class events scheduled in KinderTech Cloud appear alongside your personal calendar.',
  },
];

export default function HomePage() {
  return (
    <div style={pageStyle}>
      {/* ── Top bar ────────────────────────────────────────────── */}
      <header style={topBarStyle}>
        <div style={brandStyle}>{PRODUCT_NAME}</div>
        <nav style={topNavStyle}>
          <Link to="/login" style={topNavLinkStyle}>Login</Link>
          <Link to="/enquiry" style={topNavLinkStyle}>For Parents</Link>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section style={heroStyle}>
        <h1 style={h1Style}>{TAGLINE}</h1>
        <p style={heroSubStyle}>
          {PRODUCT_NAME} is a kindergarten administration platform used by school
          owners, administrators, and teachers in Malaysia. It brings enrolment,
          staff management, payroll, student records, and scheduling together in
          one secure web app — with an optional Google Calendar integration for
          tours and events.
        </p>
        <div style={heroCtaRowStyle}>
          <Link to="/login" style={primaryCtaStyle}>Log in</Link>
          <Link to="/enquiry" style={secondaryCtaStyle}>Enrol your child</Link>
        </div>
      </section>

      {/* ── What it does ───────────────────────────────────────── */}
      <section style={featuresSectionStyle}>
        <h2 style={h2Style}>What {PRODUCT_NAME} does</h2>
        <div style={featuresGridStyle}>
          {features.map(f => (
            <div key={f.title} style={featureCardStyle}>
              <h3 style={featureTitleStyle}>{f.title}</h3>
              <p style={featureBodyStyle}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Google integration disclosure ──────────────────────── */}
      {/* This block exists specifically so Google's OAuth verification
          reviewer can see, on the public homepage, what we use their
          APIs for — and matches the wording in /privacy. */}
      <section style={disclosureSectionStyle}>
        <h2 style={h2Style}>Use of Google services</h2>
        <p style={bodyTextStyle}>
          {PRODUCT_NAME} optionally connects to your Google account using
          OAuth so school administrators can schedule events (parent tours,
          staff meetings, class events) into their Google Calendar. We request
          only the Google Calendar and basic profile scopes needed for this
          feature. You can revoke access at any time from your{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            style={inlineLinkStyle}
          >
            Google Account permissions page
          </a>
          .
        </p>
        <p style={bodyTextStyle}>
          {PRODUCT_NAME}'s use and transfer of information received from Google
          APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={inlineLinkStyle}
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. See our full{' '}
          <Link to="/privacy" style={inlineLinkStyle}>Privacy Policy</Link>{' '}
          for details.
        </p>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer style={footerStyle}>
        <div style={footerInnerStyle}>
          <div style={footerBrandStyle}>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>{PRODUCT_NAME}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
              &copy; {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.
            </div>
          </div>
          <nav style={footerNavStyle}>
            <Link to="/privacy" style={footerLinkStyle}>Privacy Policy</Link>
            <Link to="/terms" style={footerLinkStyle}>Terms of Service</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} style={footerLinkStyle}>Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#ffffff',
  color: '#1e293b',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  display: 'flex',
  flexDirection: 'column',
};

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 32px',
  borderBottom: '1px solid #e2e8f0',
  background: '#ffffff',
};
const brandStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em',
};
const topNavStyle: React.CSSProperties = {
  display: 'flex', gap: 20,
};
const topNavLinkStyle: React.CSSProperties = {
  color: '#475569', textDecoration: 'none', fontSize: 14, fontWeight: 600,
};

const heroStyle: React.CSSProperties = {
  padding: '80px 32px 60px',
  textAlign: 'center',
  maxWidth: 820,
  margin: '0 auto',
};
const h1Style: React.CSSProperties = {
  margin: 0,
  fontSize: 40,
  fontWeight: 800,
  letterSpacing: '-0.025em',
  lineHeight: 1.15,
  color: '#0f172a',
};
const heroSubStyle: React.CSSProperties = {
  marginTop: 18,
  fontSize: 17,
  fontWeight: 500,
  lineHeight: 1.6,
  color: '#475569',
};
const heroCtaRowStyle: React.CSSProperties = {
  marginTop: 28,
  display: 'flex',
  gap: 12,
  justifyContent: 'center',
  flexWrap: 'wrap',
};
const primaryCtaStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '12px 22px',
  borderRadius: 10,
  background: '#5a67d8',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 700,
  textDecoration: 'none',
};
const secondaryCtaStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '12px 22px',
  borderRadius: 10,
  background: '#ffffff',
  color: '#5a67d8',
  border: '1px solid #c7d2fe',
  fontSize: 14,
  fontWeight: 700,
  textDecoration: 'none',
};

const featuresSectionStyle: React.CSSProperties = {
  padding: '40px 32px 60px',
  maxWidth: 1080,
  margin: '0 auto',
  width: '100%',
  boxSizing: 'border-box',
};
const h2Style: React.CSSProperties = {
  margin: '0 0 24px',
  fontSize: 22,
  fontWeight: 800,
  color: '#0f172a',
  letterSpacing: '-0.018em',
};
const featuresGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 16,
};
const featureCardStyle: React.CSSProperties = {
  padding: 22,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
};
const featureTitleStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 15,
  fontWeight: 800,
  color: '#0f172a',
  letterSpacing: '-0.012em',
};
const featureBodyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13.5,
  fontWeight: 500,
  lineHeight: 1.55,
  color: '#475569',
};

const disclosureSectionStyle: React.CSSProperties = {
  padding: '40px 32px 80px',
  maxWidth: 820,
  margin: '0 auto',
  width: '100%',
  boxSizing: 'border-box',
};
const bodyTextStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 14.5,
  fontWeight: 500,
  lineHeight: 1.65,
  color: '#3f4b5c',
};
const inlineLinkStyle: React.CSSProperties = {
  color: '#5a67d8',
  textDecoration: 'underline',
};

const footerStyle: React.CSSProperties = {
  marginTop: 'auto',
  background: '#f8fafc',
  borderTop: '1px solid #e2e8f0',
  padding: '24px 32px',
};
const footerInnerStyle: React.CSSProperties = {
  maxWidth: 1080,
  margin: '0 auto',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
};
const footerBrandStyle: React.CSSProperties = {
  fontSize: 13,
};
const footerNavStyle: React.CSSProperties = {
  display: 'flex',
  gap: 22,
  flexWrap: 'wrap',
};
const footerLinkStyle: React.CSSProperties = {
  color: '#475569',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 600,
};
