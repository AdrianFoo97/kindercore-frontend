// Public page — Terms of Service. Hosted at /terms so the URL can be
// listed in the Google OAuth consent screen + reviewed by Google's
// verification team. Edit the COMPANY constants at the top to match
// your actual company details before publishing.

const COMPANY_NAME = 'KinderCore';
const CONTACT_EMAIL = 'support@kindercore.my';
const COMPANY_ADDRESS = 'Malaysia';
const DOMAIN = 'kindercore.my';
const GOVERNING_LAW_COUNTRY = 'Malaysia';
const LAST_UPDATED = '26 May 2026';

export default function TermsOfServicePage() {
  return (
    <div style={pageStyle}>
      <article style={contentStyle}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={h1Style}>Terms of Service</h1>
          <p style={metaStyle}>Last updated: {LAST_UPDATED}</p>
        </header>

        <p>
          These Terms of Service ("Terms") govern your access to and use of the{' '}
          <strong>{COMPANY_NAME}</strong> kindergarten administration platform (the
          "Service") provided by {COMPANY_NAME} ("we", "us", "our"), available at {DOMAIN}.
          By accessing or using the Service you agree to be bound by these Terms. If you do
          not agree, do not use the Service.
        </p>

        <h2 style={h2Style}>1. Eligibility</h2>
        <p>
          You must be at least 18 years old and have the legal capacity to enter into a
          binding contract to use the Service. If you are using the Service on behalf of a
          school or other organisation, you represent that you have the authority to bind
          that organisation to these Terms.
        </p>

        <h2 style={h2Style}>2. Description of the Service</h2>
        <p>
          The Service is a software platform that helps kindergartens manage day-to-day
          operations, including (but not limited to) lead enquiries, student onboarding,
          staff records, payroll, timetables, finance summaries, points and rewards, and
          calendar scheduling. Specific features may change from time to time.
        </p>

        <h2 style={h2Style}>3. Account Registration</h2>
        <p>To use the Service you must:</p>
        <ul>
          <li>Provide accurate and complete registration information;</li>
          <li>Keep your password and authentication tokens confidential;</li>
          <li>Promptly notify us of any unauthorised use of your account.</li>
        </ul>
        <p>
          You are responsible for all activity that occurs under your account. We are not
          liable for any loss or damage arising from your failure to safeguard your account
          credentials.
        </p>

        <h2 style={h2Style}>4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of any applicable law or regulation;</li>
          <li>Upload, transmit, or store content that infringes any third-party rights, is defamatory, obscene, or harmful;</li>
          <li>Attempt to gain unauthorised access to the Service, other accounts, or any related systems;</li>
          <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service;</li>
          <li>Use automated means (bots, scrapers) to access the Service in a way that imposes an unreasonable load;</li>
          <li>Use the Service to send unsolicited communications or spam;</li>
          <li>Misrepresent your identity or affiliation with any person or organisation.</li>
        </ul>

        <h2 style={h2Style}>5. Your Content</h2>
        <p>
          You retain all rights in the data and content you submit to the Service ("Your
          Content"). You grant us a limited, non-exclusive, worldwide licence to host,
          store, transmit, display, and process Your Content solely to operate the Service
          on your behalf.
        </p>
        <p>
          You are solely responsible for Your Content, including ensuring you have the
          right to collect and upload it (for example, parental consent to record information
          about enrolled children).
        </p>

        <h2 style={h2Style}>6. Third-Party Integrations</h2>
        <p>
          The Service integrates with third-party services such as Google (for calendar
          synchronisation and authentication). Your use of those integrations is also subject
          to the third party's terms and privacy policies. We are not responsible for the
          availability, accuracy, or content of third-party services.
        </p>
        <p>
          You may revoke any third-party integration at any time. Revoking access does not
          terminate your account but may disable features that depend on that integration.
        </p>

        <h2 style={h2Style}>7. Fees and Payment</h2>
        <p>
          Some features of the Service may be offered on a paid basis. If you subscribe to a
          paid plan, you agree to pay all applicable fees in accordance with the pricing in
          effect at the time of subscription. Fees are non-refundable except where required
          by law or expressly stated otherwise.
        </p>

        <h2 style={h2Style}>8. Intellectual Property</h2>
        <p>
          The Service, including its software, design, text, graphics, and other content
          (excluding Your Content), is owned by {COMPANY_NAME} and protected by intellectual
          property laws. We grant you a limited, non-exclusive, non-transferable,
          revocable licence to use the Service for its intended purpose, subject to these
          Terms.
        </p>

        <h2 style={h2Style}>9. Termination</h2>
        <p>You may stop using the Service at any time and request account deletion by emailing us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>.
        </p>
        <p>
          We may suspend or terminate your access to the Service immediately, with or
          without notice, if you breach these Terms, if continued use of the Service poses a
          security or legal risk, or if we discontinue the Service.
        </p>
        <p>
          Upon termination, your right to use the Service ends. We will retain or delete
          Your Content in accordance with our <a href="/privacy" style={linkStyle}>Privacy Policy</a>.
        </p>

        <h2 style={h2Style}>10. Disclaimers</h2>
        <p>
          The Service is provided <strong>"as is"</strong> and <strong>"as available"</strong>{' '}
          without warranties of any kind, whether express or implied, including but not
          limited to warranties of merchantability, fitness for a particular purpose,
          non-infringement, or that the Service will be uninterrupted, secure, error-free,
          or that defects will be corrected.
        </p>

        <h2 style={h2Style}>11. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, in no event will {COMPANY_NAME}, its
          directors, employees, or agents be liable for any indirect, incidental, special,
          consequential, or punitive damages, including loss of profits, data, goodwill, or
          other intangible losses, arising out of or in connection with your use of (or
          inability to use) the Service.
        </p>
        <p>
          Our total aggregate liability for any claim arising out of or relating to these
          Terms or the Service shall not exceed the greater of (a) the amount you paid us
          in the twelve months preceding the claim, or (b) one hundred Malaysian ringgit
          (RM 100).
        </p>

        <h2 style={h2Style}>12. Indemnification</h2>
        <p>
          You agree to indemnify and hold {COMPANY_NAME} harmless from any claims, losses,
          damages, liabilities, and expenses (including reasonable legal fees) arising from
          your use of the Service, your violation of these Terms, or your violation of any
          rights of a third party.
        </p>

        <h2 style={h2Style}>13. Governing Law and Jurisdiction</h2>
        <p>
          These Terms are governed by the laws of {GOVERNING_LAW_COUNTRY}, without regard to
          its conflict-of-laws principles. Any dispute arising out of or relating to these
          Terms or the Service shall be subject to the exclusive jurisdiction of the courts
          of {GOVERNING_LAW_COUNTRY}.
        </p>

        <h2 style={h2Style}>14. Changes to These Terms</h2>
        <p>
          We may revise these Terms from time to time. We will notify you of material
          changes by posting the updated Terms on this page and updating the "Last updated"
          date above. Continued use of the Service after changes take effect constitutes
          acceptance of the revised Terms.
        </p>

        <h2 style={h2Style}>15. Contact Us</h2>
        <p>For questions about these Terms, contact us at:</p>
        <p>
          <strong>{COMPANY_NAME}</strong><br />
          {COMPANY_ADDRESS}<br />
          Email: <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>
        </p>
      </article>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  padding: '40px 20px 80px',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  color: '#1e293b',
  lineHeight: 1.65,
};
const contentStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  background: '#ffffff',
  padding: '40px 44px',
  borderRadius: 14,
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  fontSize: 15,
};
const h1Style: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  color: '#0f172a',
};
const h2Style: React.CSSProperties = {
  marginTop: 32,
  marginBottom: 10,
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '-0.012em',
  color: '#0f172a',
};
const metaStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 12.5,
  color: '#64748b',
};
const linkStyle: React.CSSProperties = {
  color: '#5a67d8',
  textDecoration: 'underline',
};
