export const ROLES = [
  'citizen',
  'government',
  'student',
  'faculty',
  'industry',
  'admin',
];

export const ROLE_LABELS = {
  citizen: 'Citizen',
  government: 'Government Official',
  student: 'Student Innovator',
  faculty: 'Faculty Mentor',
  industry: 'Industry / CSR Partner',
  admin: 'Platform Administrator',
};

export const ISSUE_CATEGORIES = [
  'Pothole',
  'Damaged road',
  'Garbage accumulation',
  'Water leakage',
  'Drainage problem',
  'Broken streetlight',
  'Waterlogging',
  'Damaged public infrastructure',
  'Other civic issues',
];

export const SEVERITY_LEVELS = ['Critical', 'High', 'Medium', 'Low'];

export const COMPLAINT_STATUSES = [
  'Submitted',
  'AI analysis completed',
  'Awaiting official validation',
  'Assigned',
  'In progress',
  'Escalated',
  'Resolved',
  'Reopened',
  'Rejected',
];

export const DEFAULT_SLA_RULES = [
  { severity: 'Critical', targetHours: 4, escalationTarget: 'Municipal Commissioner & Rapid Response Cell' },
  { severity: 'High', targetHours: 12, escalationTarget: 'Zonal Executive Engineer' },
  { severity: 'Medium', targetHours: 48, escalationTarget: 'Department Nodal Officer' },
  { severity: 'Low', targetHours: 96, escalationTarget: 'Ward Supervisor' },
];

export const DEFAULT_MATCH_WEIGHTS = {
  skills: 35,
  domain: 25,
  experience: 15,
  availability: 15,
  proximity: 10,
};

export const CATEGORY_MARKER_COLORS = {
  'Pothole': '#F07832',
  'Damaged road': '#D95D24',
  'Garbage accumulation': '#245B45',
  'Water leakage': '#2B7A9E',
  'Drainage problem': '#3D6E70',
  'Broken streetlight': '#C4841D',
  'Waterlogging': '#3B6EA5',
  'Damaged public infrastructure': '#A94442',
  'Other civic issues': '#55665F',
};
