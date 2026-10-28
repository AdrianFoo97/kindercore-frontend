// Plain-English notes for the Admin → Database Design page.
//
// The STRUCTURE on that page (tables, columns, links) is read live from the
// database, so it never needs updating by hand. These notes only add what
// the database can't say: which area a table belongs to and what it's for.
// A table missing from here still appears on the page — under "Other",
// flagged "No description yet" — so add a line when you add a table.

export type Domain =
  | 'Accounts & access'
  | 'Leads & marketing'
  | 'Students'
  | 'Staff & HR'
  | 'Recruitment'
  | 'Pay & allowances'
  | 'Career & appraisals'
  | 'Points & rewards'
  | 'How-to guides (SOPs)'
  | 'Finance'
  | 'Planner & timetable'
  | 'System'
  | 'Other';

export const DOMAIN_ORDER: Domain[] = [
  'Leads & marketing', 'Students', 'Staff & HR', 'Recruitment', 'Pay & allowances',
  'Career & appraisals', 'Points & rewards', 'How-to guides (SOPs)', 'Finance',
  'Planner & timetable', 'Accounts & access', 'System', 'Other',
];

export const TABLE_NOTES: Record<string, { domain: Domain; about: string }> = {
  // Accounts & access
  User: { domain: 'Accounts & access', about: 'A login account (email + hashed password, role). Can be linked to a Teacher and given an access role.' },
  AuthRole: { domain: 'Accounts & access', about: 'An access role — a named bundle of what a non-admin user may open (e.g. "Class Teacher").' },
  AuthRoleModule: { domain: 'Accounts & access', about: 'Which top-level modules (Marketing, HR, Finance…) each access role has switched on.' },
  AuthRoleView: { domain: 'Accounts & access', about: 'Which individual views/permissions each access role has been granted.' },
  AuthView: { domain: 'Accounts & access', about: 'The catalog of grantable views — the permission keys checked in code.' },
  AuthViewModule: { domain: 'Accounts & access', about: 'Which module(s) each view belongs to, so it is offered under the right module.' },
  GoogleConnection: { domain: 'Accounts & access', about: 'A connected Google account (tokens) used to create calendar events for visits and interviews.' },

  // Leads & marketing
  Lead: { domain: 'Leads & marketing', about: 'A parent enquiry — child details, contact, pipeline status, visit appointment and outcome.' },
  LeadLabel: { domain: 'Leads & marketing', about: 'An admin-named tag (e.g. VIP, Needs Callback) that can be put on leads.' },
  LeadLabelAssignment: { domain: 'Leads & marketing', about: 'Which labels are on which lead (a lead can carry several).' },
  MarketingCampaign: { domain: 'Leads & marketing', about: 'A campaign with a promo code parents can enter on the enquiry form, valid between its start and end dates.' },

  // Students
  Student: { domain: 'Students', about: 'An enrolled child — profile, class details, current package and monthly fee.' },
  StudentEnrollment: { domain: 'Students', about: 'Enrolment history per student (package + fee over time). The source of truth for fees.' },
  StudentAttendance: { domain: 'Students', about: 'Attendance log — one row per RFID card tap at the reader.' },
  SpeechClip: { domain: 'Students', about: 'The spoken greeting clip played when a student taps in (one per student).' },
  Package: { domain: 'Students', about: 'A fee package (programme + price) a student can be enrolled on.' },

  // Staff & HR
  Teacher: { domain: 'Staff & HR', about: 'A staff member — personal details, position, salary and employment dates.' },
  Department: { domain: 'Staff & HR', about: 'A department staff positions belong to.' },
  Position: { domain: 'Staff & HR', about: 'A job position (e.g. Assistant Teacher) — its department, salary band and default access role.' },
  SopObservation: { domain: 'Staff & HR', about: 'One observation of a teacher performing a how-to guide, through trainer and assessor sign-off.' },
  SopObservationStepResult: { domain: 'Staff & HR', about: 'Per-step pass/fail results for one practice observation.' },

  // Recruitment
  Candidate: { domain: 'Recruitment', about: 'A job applicant — application details, pipeline status, interview slot and outcome.' },

  // Pay & allowances
  AllowanceType: { domain: 'Pay & allowances', about: 'A kind of allowance (can be grouped under a parent type).' },
  TeacherAllowance: { domain: 'Pay & allowances', about: 'An allowance amount a specific teacher receives.' },
  LevelIncentive: { domain: 'Pay & allowances', about: 'Incentive amounts per position level.' },

  // Career & appraisals
  CareerRecord: { domain: 'Career & appraisals', about: 'A teacher\'s position history — each move, promotion or start date.' },
  CareerMission: { domain: 'Career & appraisals', about: 'A career mission teachers complete towards promotion, per position.' },
  MissionCategory: { domain: 'Career & appraisals', about: 'Categories that group career missions and drive the achievement badges.' },
  TeacherMissionProgress: { domain: 'Career & appraisals', about: 'A teacher\'s progress on one mission (kept even if the mission is later removed).' },
  TeacherMissionFocus: { domain: 'Career & appraisals', about: 'Not used by the app — no code reads or writes it (not even in schema.ts). Likely left over from a removed feature; candidate for clean-up.' },
  TeacherAppraisal: { domain: 'Career & appraisals', about: 'Monthly appraisal score per teacher; the recent average feeds the promotion gate.' },

  // Points & rewards
  PointsEarningRule: { domain: 'Points & rewards', about: 'A grant template ("Perfect attendance month = 50 pts") supervisors pick from.' },
  PointsRewardItem: { domain: 'Points & rewards', about: 'A reward in the catalog teachers can redeem points for.' },
  PointsTransaction: { domain: 'Points & rewards', about: 'The points ledger — every grant (+) and redemption/adjustment (−) with the running balance.' },
  RewardRedemption: { domain: 'Points & rewards', about: 'A reward a teacher has claimed: redeemed → pending (applied to use) → delivered.' },
  TeacherRewardGoal: { domain: 'Points & rewards', about: 'The one reward a teacher has pinned as their goal.' },

  // How-to guides (SOPs)
  SopTemplate: { domain: 'How-to guides (SOPs)', about: 'A how-to guide (standard operating procedure) in the shared library.' },
  SopStep: { domain: 'How-to guides (SOPs)', about: 'The steps of one how-to guide.' },
  SopSection: { domain: 'How-to guides (SOPs)', about: 'Section names steps can be grouped under (e.g. Pre-shift Preparation).' },
  SopCategory: { domain: 'How-to guides (SOPs)', about: 'Shared labels for organising how-to guides.' },
  SopTemplateCategory: { domain: 'How-to guides (SOPs)', about: 'Which labels are on which guide.' },
  SopTemplateRevision: { domain: 'How-to guides (SOPs)', about: 'A proposed change or new guide, awaiting review in the Improvement Inbox.' },

  // Finance
  OperatingCost: { domain: 'Finance', about: 'One recorded operating cost — a category\'s spend for one month.' },
  OperatingCostCategory: { domain: 'Finance', about: 'A cost category (e.g. Rental, Petrol) with its preset amount and monthly budget.' },
  OperatingCostCategoryGroup: { domain: 'Finance', about: 'A group of cost categories; can be excluded from the operating cost total.' },

  // Planner & timetable
  PlannerTask: { domain: 'Planner & timetable', about: 'A task in the operations planner.' },
  ScheduleBlock: { domain: 'Planner & timetable', about: 'A block on the timetable — who teaches what, where, when.' },
  Classroom: { domain: 'Planner & timetable', about: 'A classroom timetable blocks can be placed in.' },
  Subject: { domain: 'Planner & timetable', about: 'A subject that can be scheduled.' },
  SavedTimetable: { domain: 'Planner & timetable', about: 'A saved snapshot of a timetable.' },

  // System
  SystemSetting: { domain: 'System', about: 'App-wide settings as key/value pairs — thresholds, finance ratios, message templates, etc.' },
  BugReport: { domain: 'System', about: 'A bug report submitted from the app, triaged by an admin.' },
};
