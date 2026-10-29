// Catalog of every automated test in both projects, shown on the
// Admin → Test Catalog page (TestCatalogPage.tsx, Admin + Superadmin).
//
// KEEP IN SYNC: whenever a test is added, renamed or removed — in either
// kindercore-frontend or kindercore-backend — update this file in the same
// change. `name` must match the test's it('…') string exactly.
// tests/unit/testCatalog.test.ts fails if a FRONTEND test is missing here
// (or listed here but gone); backend entries can't be checked from this
// repo in CI, so they rely on the rule in CLAUDE.md.

export type Project = 'Frontend' | 'Backend';
export type Kind = 'Unit' | 'Integration';

export interface TestCase {
  /** Exactly the it('…') name in the test file. */
  name: string;
  /** Plain-English: what this proves, and why it matters. */
  explains: string;
}

export interface TestSuite {
  id: string;
  project: Project;
  kind: Kind;
  /** Path inside the project. */
  file: string;
  /** Feature area, as a person would name it. */
  area: string;
  /** What this file covers and why it's worth having. */
  summary: string;
  /** Set when the suite does NOT actually guard app code — shown as a warning. */
  caveat?: string;
  /** With a caveat: the concrete fix, for the copy-to-developer message. */
  fix?: string;
  cases: TestCase[];
}

export const RUN_COMMANDS: Record<Project, string> = {
  Frontend: 'cd kindercore-frontend && npm run test:unit',
  Backend: 'cd kindercore-backend && npm test   # needs the docker DB running',
};

export const TEST_SUITES: TestSuite[] = [
  // ── Backend ────────────────────────────────────────────────────────────
  {
    id: 'be-operating-cost',
    project: 'Backend',
    kind: 'Integration',
    file: 'src/tests/integration/operatingCost.service.test.ts',
    area: 'Operating cost — monthly totals & forecast',
    summary:
      'Runs the real monthly operating-cost calculation against a real MySQL test database loaded with fixed test data. ' +
      'These figures feed Finance, profit-share and the Analysis pages, so a wrong total here silently skews profit everywhere.',
    cases: [
      { name: 'counts an entry whose amount equals its category preset', explains: 'Rent recorded at exactly its preset (RM 4,200) is still counted. A past bug threw these rows away, hiding the largest cost and overstating profit.' },
      { name: 'does not treat a month of preset-valued entries as an empty month', explains: 'A month holding only preset-valued entries counts as a real recorded month — it is not overwritten by the average.' },
      { name: 'sums every category within a month', explains: 'All categories recorded in the same month add up into that month\'s total.' },
      { name: 'only counts entries for the requested year', explains: 'Asking for 2026 never includes 2025 spend in the totals.' },
      { name: 'projects a month with no entries from the average of the months that have them', explains: 'A month nobody has recorded yet is projected from the average of recorded months, while its raw figure stays RM 0.' },
      { name: 'keeps an empty past month out of the average rather than dragging it toward zero', explains: 'Unrecorded months are skipped when averaging, so a forgotten month doesn\'t make the forecast look artificially cheap.' },
      { name: 'marks months after the current one as forecast', explains: 'Months after this month are flagged as forecast; this month and earlier are actuals.' },
      { name: 'moves an entry marked out of the sum into excludedCost', explains: 'A single entry marked "exclude" leaves the operating cost total but is still reported as excluded spend — never silently lost.' },
      { name: 'excludes every entry of a category marked out, even if the entry says include', explains: 'Excluding a whole category (e.g. Capex) excludes all its entries, whatever each entry says.' },
      { name: 'excludes every entry under a group marked out, even if its category says include', explains: 'Excluding a whole group (e.g. One-off) excludes everything under it — the exclusion cascades down.' },
      { name: 'keeps excluded spend out of the projection average', explains: 'A big one-off excluded purchase doesn\'t inflate the forecast for future months.' },
      { name: 'treats a month with only excluded spend as having no operating cost data', explains: 'A month whose only spend is excluded is projected like an empty month, but its excluded amount is still shown.' },
      { name: 'reports zero — not a projection — for a year with no entries at all', explains: 'A year with nothing recorded shows RM 0 everywhere instead of inventing a projection.' },
    ],
  },
  {
    id: 'be-security-auth',
    project: 'Backend',
    kind: 'Integration',
    file: 'src/tests/integration/security.authMiddleware.test.ts',
    area: 'Security — sign-in and admin checks',
    summary:
      'The two gatekeepers in front of every protected endpoint: "is this a genuine signed-in user whose account is still active?" and "is that user an admin?". Includes the classic attacks — forged, edited, unsigned and expired login tokens — and checks that demoting or removing someone takes effect immediately.',
    cases: [
      { name: 'lets a request with a valid login token through, as that user', explains: 'A genuine login token is accepted and identifies the right person.' },
      { name: 'refuses a request with no token', explains: 'Calling a protected endpoint without logging in is refused.' },
      { name: 'refuses a token not sent as "Bearer …"', explains: 'A token sent in the wrong format is refused.' },
      { name: 'refuses garbage instead of a token', explains: 'Random text pretending to be a token is refused.' },
      { name: 'refuses a token signed with someone else\'s secret', explains: 'A token an attacker made themselves is refused — only the server can issue valid ones.' },
      { name: 'refuses an expired token', explains: 'An old login stops working once it expires.' },
      { name: 'refuses a token whose contents were edited to claim admin', explains: 'Editing your own token to say "ADMIN" doesn\'t work — the tampering is detected.' },
      { name: 'refuses an unsigned token (algorithm "none")', explains: 'A well-known trick — a token with no signature at all — is refused.' },
      { name: 'refuses a still-valid token once the account has been deleted', explains: 'Deleting someone locks them out straight away, even if they were logged in.' },
      { name: 'refuses a still-valid token once the account has been deactivated', explains: 'Deactivating an account locks it out straight away.' },
      { name: 'uses the account\'s current role, not the role written in the token', explains: 'Demoting an Admin removes their admin access immediately — not 8 hours later when their login expires.' },
      { name: 'uses the account\'s current teacher link, not the one in the token', explains: 'Re-linking an account to a different teacher takes effect immediately.' },
      { name: 'lets an Admin through', explains: 'Admins can use admin-only endpoints.' },
      { name: 'lets a Superadmin through', explains: 'Superadmins can use admin-only endpoints.' },
      { name: 'refuses a regular user with 403', explains: 'Regular staff are blocked from admin-only endpoints.' },
      { name: 'refuses a request that never signed in', explains: 'An anonymous request can\'t reach admin-only endpoints.' },
      { name: 'does not accept look-alike roles', explains: '"admin", "Admin " and similar near-misses don\'t count as Admin.' },
    ],
  },
  {
    id: 'be-security-reader-key',
    project: 'Backend',
    kind: 'Integration',
    file: 'src/tests/integration/security.readerKey.test.ts',
    area: 'Security — attendance scanner key',
    summary:
      'The door RFID readers have no user login, so they prove themselves with a secret reader key; staff using the app\'s manual scan use their login instead. Anyone else is refused, so attendance can\'t be faked and children\'s names can\'t be fished out.',
    cases: [
      { name: 'lets a reader with the correct key record a scan', explains: 'A reader sending the right key can record attendance.' },
      { name: 'refuses a wrong key', explains: 'A guessed or wrong key is refused.' },
      { name: 'refuses a key that only partly matches', explains: 'Almost-right keys (one character short or extra) are refused.' },
      { name: 'refuses a caller with neither a key nor a login', explains: 'An anonymous request to the scanner is refused.' },
      { name: 'lets signed-in staff use the app\'s manual scan without the reader key', explains: 'Staff can still test or back-fill a tap from the student page.' },
      { name: 'refuses a forged login used instead of the key', explains: 'A fake login token doesn\'t get around the reader key.' },
      { name: 'stays open until the key is configured, so readers keep working during roll-out', explains: 'Deploying this doesn\'t switch the readers off before they\'ve been given the key.' },
    ],
  },
  {
    id: 'be-security-reader-key-settings',
    project: 'Backend',
    kind: 'Integration',
    file: 'src/tests/integration/security.readerKeySettings.test.ts',
    area: 'Security — reader key from Settings',
    summary:
      'Settings → Attendance Reader lets an admin generate the door readers\' key in the app. Checks the key is strong, is stored only as a one-way hash, actually locks the scanner, can be replaced or turned off — and can\'t be read or overwritten through the general settings.',
    cases: [
      { name: 'generates a long random key and reports protection as on', explains: 'Generating a key gives a long, unguessable value and turns protection on.' },
      { name: 'never stores the key itself — only a one-way hash', explains: 'The database only keeps a scrambled fingerprint; reading the database doesn\'t reveal the key.' },
      { name: 'makes the scanner accept the new key and refuse anything else', explains: 'Once generated, only readers sending this key can record taps.' },
      { name: 'stops the old key working when a new one is generated', explains: 'Generating a new key immediately retires the old one — useful if a key leaks.' },
      { name: 'turning the key off returns the scanner to open mode', explains: 'Turning protection off really does switch it off.' },
      { name: 'shows status without ever revealing the key again', explains: 'After the first display, the page only shows the last 4 characters.' },
      { name: 'keeps the stored key out of the settings every signed-in user can read', explains: 'Regular staff loading the app\'s settings never receive the stored key data.' },
      { name: 'refuses to overwrite the key through the general settings editor', explains: 'The key can only be changed from its own page, not slipped in through another settings screen.' },
      { name: 'defers to a key set in the server environment, which can\'t be changed from the page', explains: 'If a key is configured on the server itself, the page shows that and leaves it alone.' },
    ],
  },
  {
    id: 'be-security-access-rules',
    project: 'Backend',
    kind: 'Unit',
    file: 'src/tests/unit/security.accessRules.test.ts',
    area: 'Security — every area limited to the right role',
    summary:
      'Checks all of the server\'s endpoints: each one that needs a login must also say WHO may use it (Admin, a module like HR or Finance, or "the teacher\'s own record"), unless it\'s on a short approved list of read-only reference data. Before this, 183 endpoints let any logged-in account in.',
    cases: [
      { name: 'every signed-in endpoint has a role/module/ownership rule, or an approved reason not to', explains: 'A new endpoint can\'t ship open to every staff member by accident.' },
      { name: 'the approved list has nothing stale', explains: 'The approved list stays accurate as endpoints change.' },
      { name: 'nothing open to every signed-in user can change data, except filing a bug report or a guide proposal', explains: 'Everything any staff member can reach is read-only, apart from reporting bugs and suggesting guide improvements.' },
      { name: 'only Admins can invite users, see the user list or delete users', explains: 'Nobody else can create accounts (including Admin accounts) or see pending invite links.' },
      { name: 'pay data is limited to HR / Finance / Analysis, or the teacher\'s own record', explains: 'Salaries, payroll and allowances are only visible to the right teams — and each teacher sees only their own.' },
      { name: 'granting and editing points is HR-only; a teacher\'s own points are theirs or HR\'s', explains: 'Teachers can\'t give themselves points, and can only see their own balance and history.' },
      { name: 'job applicants\' details and resumes are HR-only', explains: 'Applicants\' personal details and CVs are restricted to HR.' },
      { name: 'settings-type templates (reward catalog, rules, positions, cost categories) are Admin-only to change', explains: 'The catalogs and templates in Settings can only be changed by Admins.' },
    ],
  },
  {
    id: 'be-security-ownership',
    project: 'Backend',
    kind: 'Integration',
    file: 'src/tests/integration/security.ownership.test.ts',
    area: 'Security — your own record, not someone else\'s',
    summary:
      'Runs against the test database with test staff: a teacher can open their own points, rewards, career and pay — but not a colleague\'s by changing the id in the address. Also checks the staff list hides colleagues\' pay and personal details, and that Planner staff can\'t change pay.',
    cases: [
      { name: 'lets a teacher open their own record', explains: 'Teachers can see their own points, rewards, career and pay.' },
      { name: 'stops a teacher opening another teacher\'s record by changing the id', explains: 'Editing the address to another teacher\'s id is refused.' },
      { name: 'lets HR staff open any teacher\'s record', explains: 'HR can see every teacher\'s record.' },
      { name: 'refuses someone with no teacher record and no HR access', explains: 'An account with neither a teacher record nor HR access is refused.' },
      { name: 'lets Admins open any record', explains: 'Admins can see every record.' },
      { name: 'allows staff holding any one of the listed modules', explains: 'Shared areas (e.g. Finance data used by Analysis) open for staff in either team.' },
      { name: 'refuses staff holding none of them', explains: 'Staff outside those teams are refused.' },
      { name: 'shows a teacher only names of colleagues — no salary, phone or date of birth', explains: 'The staff list a teacher\'s app loads no longer includes colleagues\' salary, phone or birthday.' },
      { name: 'still gives a teacher their own full record', explains: 'A teacher still gets all of their own details.' },
      { name: 'gives HR staff everyone\'s full record', explains: 'HR still sees full staff records.' },
      { name: 'lets Planner (Tools) staff change a teacher\'s schedule', explains: 'Planner staff can still set teachers\' working days, subjects and classrooms.' },
      { name: 'stops Planner (Tools) staff changing pay', explains: 'Planner staff can\'t change salary, rate, position or personal details — only HR can.' },
      { name: 'does not block a form that re-sends unchanged pay values', explains: 'Saving a schedule that includes the existing pay values (unchanged) still works.' },
      { name: 'lets HR change pay', explains: 'HR can change pay as before.' },
      { name: 'stops HR staff granting points to their own teacher account', explains: 'An HR staff member who is also a teacher can\'t give themselves points.' },
      { name: 'still lets HR staff grant points to someone else', explains: 'HR can still grant points to other teachers.' },
      { name: 'shows a redemption only to its owner (or HR / Admin)', explains: 'A teacher can\'t look up another teacher\'s claimed rewards.' },
    ],
  },
  {
    id: 'be-security-permissions',
    project: 'Backend',
    kind: 'Integration',
    file: 'src/tests/integration/security.permissions.test.ts',
    area: 'Security — module & view permissions',
    summary:
      'For non-admin staff, access to each area (HR, Finance…) and to specific actions comes from their access role — given directly or through their teaching position. Runs against the test database with test staff accounts.',
    cases: [
      { name: 'allows a user whose own access role has the module', explains: 'Staff given an access role directly can open the areas it includes.' },
      { name: 'allows a teacher whose position\'s access role has the module', explains: 'A teacher gets the access that comes with their position.' },
      { name: 'refuses a module the user\'s access role does not have, with 403', explains: 'Staff can\'t open an area their role doesn\'t include.' },
      { name: 'refuses a user with no access role at all', explains: 'Someone with no access role is refused everywhere that needs one.' },
      { name: 'combines a direct role and a position role rather than one replacing the other', explains: 'Someone with both a direct role and a position gets the access from both.' },
      { name: 'refuses a user who no longer exists', explains: 'A deleted account\'s leftover login gets no module access.' },
      { name: 'lets Admins and Superadmins through without any access role', explains: 'Admins can open every area without needing a role.' },
      { name: 'takes effect immediately when a module is revoked — no re-login needed', explains: 'Removing an area from a role blocks access straight away, not at next login.' },
      { name: 'takes effect immediately when a teacher moves to a position without access', explains: 'Moving a teacher to a different position changes their access straight away.' },
      { name: 'allows a user whose access role has the view', explains: 'Staff whose role includes a specific action (e.g. approving guides) can do it.' },
      { name: 'refuses a user whose role has the module but not the specific view', explains: 'Being allowed into an area doesn\'t mean being allowed every action in it.' },
      { name: 'does not treat having a module as having every view in it', explains: 'Area access and action permissions are kept separate.' },
      { name: 'lets Admins through without the view', explains: 'Admins can perform every action.' },
    ],
  },
  {
    id: 'be-security-public-endpoints',
    project: 'Backend',
    kind: 'Unit',
    file: 'src/tests/unit/security.publicEndpoints.test.ts',
    area: 'Security — no endpoint accidentally public',
    summary:
      'Checks every one of the server\'s endpoints. Anything reachable without logging in must be on an approved list with a written reason — so a developer forgetting the sign-in check on a new endpoint is caught before it reaches test.',
    caveat:
      'The attendance scanner (POST /api/attendance/scan) is only locked once a reader key is set. Until then it stays open: anyone who can send a card number can record attendance and get the child\'s name back. The fix is built and tested — it just needs switching on.',
    fix:
      'On each environment (test, then production): Settings → Attendance Reader → Generate key, then enter it on every RFID reader as the X-Reader-Key header (the page shows the exact URL and steps). The app\'s own manual scan keeps working via the staff login. The server logs a [SECURITY] warning at startup until a key is set. Remove this caveat once production has one.',
    cases: [
      { name: 'every endpoint without a sign-in check is on the approved list', explains: 'Any endpoint open to the public must be deliberately approved, with a reason.' },
      { name: 'the approved list has nothing stale — each entry is still a real public endpoint', explains: 'The approved list stays accurate as endpoints change.' },
      { name: 'every admin-only endpoint also checks sign-in first', explains: 'Admin endpoints always confirm who you are before checking you\'re an admin.' },
      { name: 'every module/view-restricted endpoint also checks sign-in first', explains: 'Area-restricted endpoints always confirm who you are first.' },
      { name: 'destructive admin tools (reset / seed) are admin-only', explains: 'The "reset all data" and "seed dummy data" tools can only be used by Admins.' },
    ],
  },
  {
    id: 'be-db-schema-endpoint',
    project: 'Backend',
    kind: 'Integration',
    file: 'src/tests/integration/dbSchema.endpoint.test.ts',
    area: 'Database Design page — reading the live structure',
    summary:
      'Runs the real endpoint behind Admin → Database Design against the test database, checking it reports every table, column and link accurately.',
    cases: [
      { name: 'lists every table in the database', explains: 'Every table that exists in the database appears on the page — none missing, none extra.' },
      { name: 'reports which database it read and when', explains: 'The page says which database it is showing and when it was read.' },
      { name: 'describes each column\'s type, nullability and primary key', explains: 'Each column shows its real type, whether it\'s required, and whether it\'s the table\'s key.' },
      { name: 'keeps columns in their defined order', explains: 'Columns are listed in the order the table defines them.' },
      { name: 'includes the foreign keys MySQL enforces', explains: 'Links the database itself enforces (e.g. Student → Package) are shown.' },
      { name: 'includes links inferred from column names', explains: 'Links that only exist by naming (e.g. OperatingCost.categoryId → OperatingCostCategory) are shown too.' },
      { name: 'only links to tables that exist', explains: 'No link on the page points at a table that isn\'t there.' },
    ],
  },
  {
    id: 'be-db-schema-infer',
    project: 'Backend',
    kind: 'Unit',
    file: 'src/tests/unit/dbSchema.inferRelations.test.ts',
    area: 'Database Design page — guessing links from column names',
    summary:
      'Most tables link through plain "…Id" columns the database doesn\'t enforce. These check the naming rules that turn those columns into the links drawn on the page.',
    cases: [
      { name: 'links an xxxId column to the table named Xxx', explains: 'teacherId links to the Teacher table.' },
      { name: 'points at the target table\'s real key column, not always "id"', explains: 'positionId links to Position\'s own key column (positionId), not a non-existent "id".' },
      { name: 'finds the table from the last words of a longer name', explains: 'reportedByUserId links to User.' },
      { name: 'picks the matching table that shares the longest name prefix with the owner', explains: 'OperatingCost.categoryId links to OperatingCostCategory, not the unrelated SopCategory.' },
      { name: 'does not treat a table\'s own key named after itself as a link', explains: 'Department.departmentId is Department\'s own key, not a link to itself.' },
      { name: 'still links a primary key that points at a different table', explains: 'TeacherRewardGoal is keyed by teacherId, which still links to Teacher.' },
      { name: 'uses the known-links list for columns whose name does not say where they point', explains: 'rewardId links to PointsRewardItem via a short hand-kept list.' },
      { name: 'leaves ids from outside systems unlinked', explains: 'Google calendar ids and similar aren\'t mistaken for links.' },
      { name: 'does not duplicate a link that a real foreign key already covers', explains: 'A link the database already enforces isn\'t listed twice.' },
    ],
  },
  {
    id: 'be-architecture',
    project: 'Backend',
    kind: 'Unit',
    file: 'src/tests/unit/architecture.test.ts',
    area: 'Backend Architecture page — reading the code',
    summary:
      'The Backend Architecture page is generated by reading the server\'s own code. These check that reading is accurate, and that the published graph matches the current code — so it can never show an out-of-date design.',
    cases: [
      { name: 'maps each Drizzle table export to its real table name', explains: 'Code names like "users" are shown as the real table name "User".' },
      { name: 'reads named imports, including multi-name and renamed ones', explains: 'Imports are read correctly even when several are listed or one is renamed.' },
      { name: 'builds each endpoint\'s full path from where its router is mounted', explains: 'Each endpoint shows its full web address, e.g. /api/leads/:id.' },
      { name: 'keeps each endpoint\'s middleware in order, including multi-line definitions', explains: 'The access checks on each endpoint (sign-in, admin, module) are captured in order.' },
      { name: 'links each endpoint to the controller module its handler is imported from', explains: 'Each endpoint is traced to the controller that handles it.' },
      { name: 'marks an inline handler as such, with no controller', explains: 'An endpoint handled inline in the route file is shown as such, not linked to a wrong controller.' },
      { name: 'ignores commented-out routes', explains: 'Routes that are commented out don\'t appear.' },
      { name: 'records which services and tables each controller uses', explains: 'Each controller\'s services and database tables are captured.' },
      { name: 'resolves a renamed table import and a controller-to-controller import', explains: 'A table imported under another name still maps to the right table; controller-to-controller use is captured.' },
      { name: 'records which tables each service uses', explains: 'Each shared service\'s database tables are captured.' },
      { name: 'parses router-wide middleware into every endpoint of that router', explains: 'An access check applied to a whole route file is shown on every endpoint in it.' },
      { name: 'matches the current code (run `npm run arch:gen` if this fails)', explains: 'Fails if someone changed the server but didn\'t regenerate the graph — so the page can\'t go stale on test.' },
    ],
  },
  {
    id: 'be-lead-validation',
    project: 'Backend',
    kind: 'Unit',
    file: 'src/tests/unit/lead.test.ts',
    area: 'Leads — public enquiry form validation',
    summary:
      'Checks the rules the server applies to every enquiry submitted from the public website form, before it becomes a lead.',
    cases: [
      { name: 'accepts a valid lead submission', explains: 'A complete enquiry (child name, phone, date of birth, enrolment year) is accepted.' },
      { name: 'rejects submission when honeypot field is filled', explains: 'Spam bots that fill the hidden "company" field are rejected.' },
      { name: 'accepts an empty honeypot field', explains: 'Real parents (who leave the hidden field empty) are not blocked by the spam check.' },
      { name: 'rejects missing required fields', explains: 'An enquiry without the required details is refused.' },
      { name: 'rejects a date of birth not in YYYY-MM-DD form', explains: 'Dates like 15/03/2022 are refused, so ages and class placement are calculated from a reliable date.' },
      { name: 'rejects an enrolment year before 2020', explains: 'Obviously wrong enrolment years are refused.' },
    ],
  },
  {
    id: 'be-appointment-rounding',
    project: 'Backend',
    kind: 'Unit',
    file: 'src/tests/unit/appointment.test.ts',
    area: 'Appointments — round up to the next half hour',
    summary: 'Intended to check that booking times are rounded up to the next :00 or :30.',
    caveat:
      'Tests a copy of the rounding function written inside the test file, not the app\'s booking code — if the real code broke, these would still pass.',
    fix:
      'Delete the local copy of roundUpTo30Min in the test and import the real one instead — it is already exported from src/controllers/leads.controller.ts.',
    cases: [
      { name: 'rounds 14:17 up to 14:30', explains: 'Times between slots round up to the next half hour.' },
      { name: 'rounds 14:37 up to 15:00', explains: 'Times past the half hour round up to the next full hour.' },
      { name: 'keeps 14:30 unchanged (already on boundary)', explains: 'A time already on :30 is left alone.' },
      { name: 'keeps 14:00 unchanged (already on boundary)', explains: 'A time already on :00 is left alone.' },
      { name: 'rounds 23:59 up to 00:00 next day', explains: 'Rounding just before midnight correctly rolls over to the next day.' },
    ],
  },
  {
    id: 'be-auth-login',
    project: 'Backend',
    kind: 'Integration',
    file: 'src/tests/integration/auth.login.test.ts',
    area: 'Login & account activation',
    summary:
      'Runs the real login and "set your password from an invite" code against the test database with test accounts. ' +
      'Guards who can get into the system — a mistake here either locks staff out or lets the wrong person in.',
    cases: [
      { name: 'logs in with the correct email and password', explains: 'The right email + password signs in and returns the user\'s name and role.' },
      { name: 'issues a signed token carrying the user\'s id, role and teacher link, valid for 8 hours', explains: 'The login token is genuinely signed, says who the user is and what role they have, and expires after 8 hours.' },
      { name: 'never sends the password hash back to the browser', explains: 'The stored (hashed) password is never included in the login response.' },
      { name: 'rejects a wrong password', explains: 'A wrong password is refused and no token is issued.' },
      { name: 'gives the same answer for an unknown email as for a wrong password', explains: 'Someone can\'t use the login form to find out which email addresses have accounts.' },
      { name: 'matches the email regardless of letter case', explains: 'Typing Admin@… instead of admin@… still signs in.' },
      { name: 'treats the password as case-sensitive', explains: 'The password must match exactly — "abc" is not "ABC".' },
      { name: 'refuses an invited account that has not set a password yet', explains: 'An invited person who hasn\'t finished setup can\'t log in with any password, not even an empty one.' },
      { name: 'rejects a malformed email before checking any password', explains: 'Something that isn\'t an email address is refused straight away.' },
      { name: 'rejects a password shorter than 8 characters', explains: 'Too-short passwords are refused at login.' },
      { name: 'rejects an empty submission', explains: 'Submitting the form empty is refused.' },
      { name: 'stores the new password hashed, never as plain text', explains: 'When a new staff member sets their password, only a scrambled (hashed) version is saved in the database.' },
      { name: 'lets the new account log in with the password chosen at activation', explains: 'After setting up from an invite, the person can sign in with the password they chose.' },
      { name: 'cannot be used twice with the same invite link', explains: 'Once an invite link has been used, nobody else can use it to take over the account.' },
      { name: 'refuses an expired invite link', explains: 'Invite links stop working after they expire.' },
      { name: 'refuses a password shorter than 8 characters', explains: 'Setup refuses a too-short password and leaves the account inactive.' },
    ],
  },

  // ── Frontend ───────────────────────────────────────────────────────────
  {
    id: 'fe-operating-cost-model',
    project: 'Frontend',
    kind: 'Unit',
    file: 'src/tests/unit/operatingCostModel.test.ts',
    area: 'Analysis — Operating Cost page calculations',
    summary:
      'Checks the maths behind the Operating Cost analysis page: monthly totals, budget vs. actual, year-on-year, group roll-ups, outlier flags and cost ratios.',
    cases: [
      { name: 'sums each month and leaves unrecorded months at zero', explains: 'Monthly totals add up correctly and unrecorded months show 0.' },
      { name: 'buckets by category into dense 12-slot arrays', explains: 'Each category gets a full Jan–Dec series for the charts.' },
      { name: 'ignores rows with an out-of-range month rather than corrupting the array', explains: 'A bad month number in the data is skipped instead of breaking the charts.' },
      { name: 'counts only months that are both recorded and not in the future', explains: '"Months elapsed" counts only real, past, recorded months.' },
      { name: 'excludes future months even when someone has pre-recorded them', explains: 'Costs entered ahead of time for future months don\'t count as elapsed.' },
      { name: 'treats a past year as fully elapsed', explains: 'Looking at last year, all recorded months count.' },
      { name: 'treats a future year as having nothing elapsed', explains: 'Looking at next year, nothing has happened yet.' },
      { name: 'skips gaps — an unfilled month in the middle is not elapsed', explains: 'A forgotten month in the middle isn\'t counted as elapsed.' },
      { name: 'sums spend over the scoped months only', explains: 'Category spend only covers the months currently selected.' },
      { name: 'scales the budget by the number of scoped months', explains: 'A monthly budget is multiplied by the months selected (e.g. 3 months = 3× budget).' },
      { name: 'reports a category exactly on budget as zero variance, not a rounding artefact', explains: 'Spending exactly the budget shows RM 0 over/under — not a tiny rounding error.' },
      { name: 'reports under-budget as a negative variance', explains: 'Spending less than budget shows as a negative (under) variance.' },
      { name: 'keeps "no budget set" as null — never as a budget of zero', explains: 'A category without a budget shows "no budget", not a budget of RM 0 (which would look massively over).' },
      { name: 'scopes to a single month when the scope is a single month', explains: 'Selecting one month shows just that month\'s figures.' },
      { name: 'compares year on year over the same months, and reports null when last year is empty', explains: 'Year-on-year compares like-for-like months, and shows "no data" when last year had none.' },
      { name: 'sums spend across every category in the group', explains: 'A group\'s spend is the total of its categories.' },
      { name: 'builds the budget only from categories that have one', explains: 'A group\'s budget only adds up categories that actually have a budget.' },
      { name: 'measures variance against budgeted spend only, so an unbudgeted category cannot make a group look over', explains: 'Spend in an unbudgeted category can\'t make the whole group look over budget.' },
      { name: 'carries the full 12-month series and last year through to the group', explains: 'Group charts get the full monthly series and last year\'s figures.' },
      { name: 'flags a month that departs from the category\'s own typical spend', explains: 'An unusual month for a category is flagged as an outlier.' },
      { name: 'stays quiet on a steady category', explains: 'A category with steady spend raises no outlier flags.' },
      { name: 'ignores small-money wobble even when the percentage is large', explains: 'A RM 5 → RM 15 change isn\'t flagged just because it\'s +200%.' },
      { name: 'needs at least three recorded months before forming an opinion', explains: 'No outlier flags until there are 3+ months of history to compare against.' },
      { name: 'divides cost by revenue and by headcount', explains: 'Cost-to-revenue and cost-per-head ratios are calculated correctly.' },
      { name: 'returns null rather than dividing by zero', explains: 'With no revenue or no staff, ratios show "—" instead of infinity or an error.' },
      { name: 'survives a missing finance summary', explains: 'If finance data hasn\'t loaded, the page still works.' },
    ],
  },
  {
    id: 'fe-leads-page',
    project: 'Frontend',
    kind: 'Unit',
    file: 'src/tests/unit/LeadsPage.test.tsx',
    area: 'Leads page — loading, errors and table',
    summary: 'Renders the real Leads page with a faked API to check what staff see while loading, on error, and once leads arrive.',
    cases: [
      { name: 'shows loading state while fetch is pending', explains: 'A "Loading…" message shows while leads are being fetched.' },
      { name: 'shows error message when fetch fails', explains: 'If leads can\'t be fetched, an error is shown instead of a blank page.' },
      { name: 'renders leads table after data loads', explains: 'Leads appear in the table, and the phone number links to a WhatsApp chat (with 0 → 60).' },
    ],
  },
  {
    id: 'fe-database-erd',
    project: 'Frontend',
    kind: 'Unit',
    file: 'src/tests/unit/databaseErd.test.ts',
    area: 'Database Design — diagram layout',
    summary:
      'The database diagram is drawn automatically from the live structure. These check the drawing stays readable for any database: every table shown once, nothing overlapping, lines only between real tables.',
    cases: [
      { name: 'draws every table exactly once', explains: 'No table is missing from the diagram or drawn twice.' },
      { name: 'never overlaps two table boxes', explains: 'Table boxes never sit on top of each other.' },
      { name: 'keeps every box inside the drawing area', explains: 'No table is cut off at the edge of the diagram.' },
      { name: 'draws one line per link between two different tables', explains: 'Each link becomes exactly one line, joining two tables that exist.' },
      { name: 'keeps solid vs dashed: enforced links stay foreign keys', explains: 'Links the database enforces are drawn solid; the rest dashed.' },
      { name: 'puts tables with no links in a strip below the diagram', explains: 'Stand-alone tables (like settings) are grouped at the bottom instead of scattered around.' },
      { name: 'treats a table that only links to itself as unlinked', explains: 'A table whose only link is to itself joins the stand-alone strip.' },
    ],
  },
  {
    id: 'fe-backend-architecture-graph',
    project: 'Frontend',
    kind: 'Unit',
    file: 'src/tests/unit/backendArchitectureGraph.test.ts',
    area: 'Backend Architecture — graph & overview',
    summary:
      'Checks the Routes → Controllers → Services → Tables graph is built correctly from the generated data, ordered to keep lines from crossing, and that tracing a box\'s chain highlights the right things.',
    cases: [
      { name: 'puts every route file, controller and service in its own column', explains: 'Each kind of code sits in its own column.' },
      { name: 'only shows tables some code actually uses', explains: 'Tables nothing uses are left out of the graph.' },
      { name: 'draws one line per connection, even when several endpoints share it', explains: 'Ten endpoints to the same controller still draw a single line.' },
      { name: 'connects routes → controllers → services → tables', explains: 'Lines follow the real path a request takes.' },
      { name: 'adds no line for an inline handler with no controller', explains: 'An endpoint handled inline doesn\'t draw a line to nowhere.' },
      { name: 'keeps every box when ordering the columns', explains: 'Rearranging to reduce crossings never loses a box.' },
      { name: 'orders columns so connected boxes line up instead of crossing', explains: 'Related boxes are placed level with each other so lines run straight.' },
      { name: 'traces a box\'s full chain both upstream and downstream', explains: 'Selecting a box finds everything that calls it and everything it reaches — and nothing else.' },
      { name: 'focuses on one chain, leaving everything unrelated out', explains: 'The diagram for a selected box shows only its chain, so it stays small and readable.' },
      { name: 'has one row per route file, sorted by address', explains: 'The overview lists every route file once, in address order.' },
      { name: 'lists the tables reached through a controller\'s services as well as its own', explains: 'A row shows every table its requests can touch — including through shared services.' },
      { name: 'shows a route file handled only inline as having no controller', explains: 'A route file with no controller says so instead of showing a wrong one.' },
      { name: 'counts the endpoints that need no sign-in', explains: 'The "public" badge on a row counts endpoints anyone can call without logging in.' },
    ],
  },
  {
    id: 'fe-test-catalog',
    project: 'Frontend',
    kind: 'Unit',
    file: 'src/tests/unit/testCatalog.test.ts',
    area: 'This catalog — kept complete',
    summary: 'Fails the build if this Test Catalog page falls out of date with the frontend\'s actual tests.',
    cases: [
      { name: 'lists every frontend test', explains: 'Any frontend test missing from this page fails the check.' },
      { name: 'lists no frontend test that no longer exists', explains: 'A test that was deleted or renamed can\'t linger on this page.' },
    ],
  },
];
