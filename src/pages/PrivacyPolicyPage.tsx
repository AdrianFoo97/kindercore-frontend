// Public page — Privacy Policy. Hosted at /privacy so the URL can be
// listed in the Google OAuth consent screen + reviewed by Google's
// verification team. Edit the COMPANY constants at the top to match
// your actual company details before publishing.

const COMPANY_NAME = 'KinderCore';
const CONTACT_EMAIL = 'support@kindercore.my';
const COMPANY_ADDRESS = 'Malaysia';
const DOMAIN = 'kindercore.my';
const LAST_UPDATED = '26 May 2026';

export default function PrivacyPolicyPage() {
  return (
    <div style={pageStyle}>
      <article style={contentStyle}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={h1Style}>Privacy Policy</h1>
          <p style={metaStyle}>Last updated: {LAST_UPDATED}</p>
        </header>

        <p>
          This Privacy Policy describes how <strong>{COMPANY_NAME}</strong> ("we", "us", or
          "our") collects, uses, stores, shares, and deletes information when you use the
          {' '}{COMPANY_NAME} kindergarten administration platform (the "Service"), available
          at {DOMAIN}.
        </p>

        <p>
          By using the Service, you agree to the collection and use of information in
          accordance with this policy. If you do not agree, please do not use the Service.
        </p>

        <h2 style={h2Style}>1. Information We Collect</h2>

        <h3 style={h3Style}>1.1 Information you provide directly</h3>
        <ul>
          <li><strong>Account information</strong> — name, email address, phone number, role (administrator, teacher, parent), and password (stored as a one-way hash).</li>
          <li><strong>Employee records</strong> — for school administrators only: teacher profiles including position, salary, allowances, working schedule, performance appraisals, and career history.</li>
          <li><strong>Student records</strong> — for school administrators only: student names, dates of birth, parent contact details, enrolment dates, attendance, and any onboarding information you choose to record.</li>
          <li><strong>Operational data</strong> — class assignments, timetables, points earned and redemptions, lead enquiries, and finance records you enter.</li>
        </ul>

        <h3 style={h3Style}>1.2 Information collected automatically</h3>
        <ul>
          <li><strong>Authentication tokens</strong> — to keep you signed in securely.</li>
          <li><strong>Usage logs</strong> — IP address, browser type, page paths and timestamps, used for security monitoring and to diagnose issues.</li>
        </ul>

        <h3 style={h3Style}>1.3 Information from Google services</h3>
        <p>
          If you choose to connect your Google account to the Service (for example, to sync
          school calendars), we access the specific Google account data described in section{' '}
          <a href="#google-data" style={linkStyle}>4</a> below, and only after you have
          explicitly granted permission through Google's standard OAuth consent screen.
        </p>

        <h2 style={h2Style}>2. How We Use Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, operate, and maintain the Service;</li>
          <li>Authenticate you and protect your account;</li>
          <li>Calculate payroll, allowances, profit-sharing pools, points, and other administrative outputs;</li>
          <li>Communicate with you about service updates, security notices, and support requests;</li>
          <li>Diagnose technical issues and prevent fraud or abuse;</li>
          <li>Comply with applicable laws.</li>
        </ul>
        <p>
          We do <strong>not</strong> use your information, including any data obtained from
          Google APIs, to serve advertising, to build user profiles for purposes unrelated to
          the Service, or to train artificial intelligence or machine learning models.
        </p>

        <h2 style={h2Style} id="google-data">3. Google User Data — Limited Use Disclosure</h2>
        <p>
          When you choose to connect your Google account to the Service, we may request
          access to the following Google API scopes:
        </p>
        <ul>
          <li>
            <code>https://www.googleapis.com/auth/calendar</code> (or related Calendar
            scopes) — to create, read, and update calendar events that you or your school
            administrators schedule within the Service (for example, parent tour
            appointments, staff meetings, and class events).
          </li>
          <li>
            <code>openid</code>, <code>email</code>, and <code>profile</code> — to verify
            your identity and display your name and email within the Service.
          </li>
        </ul>
        <p>
          <strong>
            {COMPANY_NAME}'s use and transfer to any other app of information received from
            Google APIs will adhere to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </strong>
        </p>
        <p>Specifically, with respect to data received from Google APIs, we will:</p>
        <ul>
          <li>Use it only to provide and improve the user-facing features of the Service.</li>
          <li>Not transfer it to others except as necessary to provide the Service, to comply with applicable law, or as part of a merger, acquisition, or sale of assets with notice to you.</li>
          <li>Not use it for advertising.</li>
          <li>Not allow humans to read it unless we have your affirmative consent for specific messages, it is necessary for security purposes (such as investigating abuse), it is necessary to comply with applicable law, or its use is for internal operations and the data has been aggregated and anonymised.</li>
        </ul>

        <h2 style={h2Style}>4. How We Store and Protect Information</h2>
        <p>
          Your data is stored on servers operated by us or by reputable cloud providers, with
          access protected by industry-standard authentication, encryption in transit (TLS),
          and role-based access controls. Passwords are stored as one-way hashes and are
          never accessible in plain text to us.
        </p>
        <p>
          No method of transmission or storage is completely secure. While we work to protect
          your information using reasonable safeguards, we cannot guarantee absolute security.
        </p>

        <h2 style={h2Style}>5. Sharing of Information</h2>
        <p>We do not sell your personal information. We share it only:</p>
        <ul>
          <li><strong>Within your school</strong> — administrators of your school can see records that belong to your school.</li>
          <li><strong>With service providers</strong> — third parties that host our infrastructure or process payments on our behalf, bound by data-processing agreements.</li>
          <li><strong>For legal reasons</strong> — when required by law, court order, or to protect rights, property, or safety.</li>
          <li><strong>In a business transfer</strong> — if we are involved in a merger, acquisition, or sale of assets, with notice to you and an option to delete your data.</li>
        </ul>

        <h2 style={h2Style}>6. Data Retention</h2>
        <p>
          We retain your information for as long as your account is active, or as long as
          needed to provide the Service and comply with legal obligations. Inactive accounts
          and their data may be deleted after a reasonable period.
        </p>
        <p>
          Google account tokens are retained only while you keep your Google account
          connected to the Service. When you disconnect, the tokens are deleted.
        </p>

        <h2 style={h2Style}>7. Your Rights</h2>
        <p>You may, at any time:</p>
        <ul>
          <li><strong>Access</strong> the personal information we hold about you;</li>
          <li><strong>Correct</strong> inaccurate or incomplete information;</li>
          <li><strong>Delete</strong> your account and your associated data, subject to legal retention obligations;</li>
          <li>
            <strong>Revoke Google access</strong> — disconnect the Service from your Google
            account at any time via{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              myaccount.google.com/permissions
            </a>
            . This immediately stops our ability to access your Google data.
          </li>
        </ul>
        <p>
          To exercise any of these rights, email us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>.
        </p>

        <h2 style={h2Style}>8. Children's Privacy</h2>
        <p>
          The Service is designed for use by kindergarten administrators, teachers, and the
          parents or guardians of enrolled children. Records about children are entered and
          managed by their school's authorised staff. We do not knowingly collect personal
          information directly from children under the age of 13.
        </p>

        <h2 style={h2Style}>9. International Transfers</h2>
        <p>
          The Service is operated from {COMPANY_ADDRESS}. If you access the Service from
          outside this jurisdiction, your information may be transferred to, stored in, and
          processed in {COMPANY_ADDRESS}.
        </p>

        <h2 style={h2Style}>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material
          changes by posting the updated policy on this page and updating the "Last updated"
          date above. Continued use of the Service after changes take effect constitutes
          acceptance of the revised policy.
        </p>

        <h2 style={h2Style}>11. Contact Us</h2>
        <p>
          For any questions about this Privacy Policy or our handling of your data, contact
          us at:
        </p>
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
const h3Style: React.CSSProperties = {
  marginTop: 18,
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 700,
  color: '#334155',
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
