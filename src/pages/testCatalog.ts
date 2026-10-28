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
    area: 'Backend Architecture — graph',
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
      { name: 'traces a box\'s full chain both upstream and downstream', explains: 'Selecting a box highlights everything that calls it and everything it reaches — and nothing else.' },
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
