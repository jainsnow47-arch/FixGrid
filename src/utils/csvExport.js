const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

export function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (FORMULA_PREFIX_RE.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsvRow(cells) {
  return cells.map(escapeCsvCell).join(',');
}

function slugifySegment(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function buildCivicAnalyticsCsv({
  data,
  granularity = 'day',
  category = '',
  ward = '',
  exportedAt = new Date(),
}) {
  const summary = data?.summary || {};
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const categoryBreakdown = Array.isArray(data?.categoryBreakdown) ? data.categoryBreakdown : [];
  const wardBreakdown = Array.isArray(data?.wardBreakdown) ? data.wardBreakdown : [];

  const rows = [];

  // Metadata
  rows.push(toCsvRow(['FixGrid AI — Civic Improvement Trends Export']));
  rows.push(toCsvRow(['Generated At (UTC)', exportedAt.toISOString()]));
  rows.push(toCsvRow(['Time Granularity', granularity === 'hour' ? '4-Hour Window' : 'Daily Trend']));
  rows.push(toCsvRow(['Category Filter', category || 'All Categories']));
  rows.push(toCsvRow(['Ward Filter', ward || 'All Wards']));
  rows.push('');

  // Summary KPIs
  rows.push(toCsvRow(['Summary Metrics', 'Value']));
  rows.push(toCsvRow(['Total Submitted', summary.totalSubmitted ?? 0]));
  rows.push(toCsvRow(['Resolved Issues', summary.resolvedCount ?? 0]));
  rows.push(toCsvRow(['In Progress', summary.inProgressCount ?? 0]));
  rows.push(toCsvRow(['Escalated / Overdue', summary.escalatedCount ?? 0]));
  rows.push(toCsvRow(['Resolution Rate (%)', summary.resolutionRatePct ?? 0]));
  rows.push(toCsvRow(['On-Time SLA Rate (%)', summary.slaCompliancePct ?? 100]));
  rows.push(
    toCsvRow([
      'Avg. Resolution Time (Hours)',
      summary.avgResolutionHours !== null && summary.avgResolutionHours !== undefined
        ? summary.avgResolutionHours
        : 'N/A',
    ])
  );
  rows.push('');

  // Time-series trend data
  rows.push(toCsvRow(['Civic Trend Timeline']));
  rows.push(
    toCsvRow([
      'Timestamp (UTC)',
      'Interval Label',
      'Submitted in Interval',
      'Resolved in Interval',
      'Cumulative Submitted',
      'Cumulative Resolved',
      'Cumulative Active',
      'Cumulative Escalated',
      'Cumulative Resolution Rate (%)',
    ])
  );
  for (const point of timeline) {
    rows.push(
      toCsvRow([
        point.timestamp || '',
        point.label || '',
        point.submittedInBucket ?? 0,
        point.resolvedInBucket ?? 0,
        point.cumulativeSubmitted ?? 0,
        point.cumulativeResolved ?? 0,
        point.cumulativeActive ?? 0,
        point.cumulativeEscalated ?? 0,
        point.resolutionRatePct ?? 0,
      ])
    );
  }
  rows.push('');

  // Category Breakdown
  rows.push(toCsvRow(['Category Resolution Progress']));
  rows.push(
    toCsvRow([
      'Category',
      'Total',
      'Resolved',
      'In Progress',
      'Awaiting Review',
      'Escalated',
      'Resolution Rate (%)',
    ])
  );
  for (const cat of categoryBreakdown) {
    rows.push(
      toCsvRow([
        cat.category || '',
        cat.total ?? 0,
        cat.resolved ?? 0,
        cat.active ?? 0,
        cat.pending ?? 0,
        cat.escalated ?? 0,
        cat.resolutionRatePct ?? 0,
      ])
    );
  }
  rows.push('');

  // Ward Breakdown
  rows.push(toCsvRow(['Ward Improvement Breakdown']));
  rows.push(
    toCsvRow([
      'Ward / Locality',
      'Submitted',
      'Resolved',
      'Open',
      'Escalated',
      'Resolution Rate (%)',
    ])
  );
  for (const w of wardBreakdown) {
    rows.push(
      toCsvRow([
        w.ward || '',
        w.total ?? 0,
        w.resolved ?? 0,
        w.open ?? 0,
        w.escalated ?? 0,
        w.resolutionRatePct ?? 0,
      ])
    );
  }

  return rows.join('\r\n');
}

export function buildAnalyticsCsvFilename({ granularity = 'day', category = '', ward = '', exportedAt = new Date() }) {
  const datePart = exportedAt.toISOString().slice(0, 10);
  const parts = ['fixgrid-civic-trends', granularity === 'hour' ? '4hr' : 'daily'];
  if (category) parts.push(slugifySegment(category));
  if (ward) parts.push(slugifySegment(ward));
  parts.push(datePart);
  return `${parts.filter(Boolean).join('-')}.csv`;
}

export function downloadCsvFile(csvContent, filename) {
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
