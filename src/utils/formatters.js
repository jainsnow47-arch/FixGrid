export const ROLE_HOME = {
  citizen: '/citizen/dashboard',
  government: '/government/dashboard',
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  industry: '/industry/dashboard',
  admin: '/admin/dashboard',
};

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

export const COMPLAINT_STATUSES = [
  'Submitted',
  'AI analysis completed',
  'Awaiting official validation',
  'Assigned',
  'In progress',
  'Escalated',
  'Resolved',
  'Reopened',
];

export const CATEGORY_COLORS = {
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

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatSlaRemaining(deadlineIso, status) {
  if (status === 'Resolved') return { label: 'Resolved within lifecycle', overdue: false };
  if (!deadlineIso) return { label: 'Target pending validation', overdue: false };
  const diffMs = new Date(deadlineIso).getTime() - Date.now();
  const absHrs = Math.floor(Math.abs(diffMs) / 3600000);
  const absMins = Math.floor((Math.abs(diffMs) % 3600000) / 60000);
  if (diffMs < 0) {
    return { label: `Overdue by ${absHrs}h ${absMins}m`, overdue: true };
  }
  return { label: `${absHrs}h ${absMins}m remaining`, overdue: false };
}

export function isSafeHttpUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
