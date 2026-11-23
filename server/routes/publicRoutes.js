import express from 'express';
import db from '../config/db.js';
import { ISSUE_CATEGORIES } from '../config/constants.js';
import { getAIStatus } from '../services/aiService.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', (_req, res) => {
  const totalComplaints = db.prepare('SELECT COUNT(*) AS c FROM complaints WHERE deleted_at IS NULL').get().c;
  const resolvedComplaints = db.prepare("SELECT COUNT(*) AS c FROM complaints WHERE deleted_at IS NULL AND status = 'Resolved'").get().c;
  const escalatedCount = db.prepare("SELECT COUNT(*) AS c FROM complaints WHERE deleted_at IS NULL AND (is_overdue = 1 OR status = 'Escalated')").get().c;
  const approvedChallenges = db.prepare("SELECT COUNT(*) AS c FROM civic_challenges WHERE approval_status = 'Approved'").get().c;
  const activeProjects = db.prepare("SELECT COUNT(*) AS c FROM projects WHERE status = 'Active'").get().c;
  const verifiedContributions = db.prepare('SELECT COUNT(*) AS c FROM contribution_records WHERE verified_at IS NOT NULL').get().c;

  const byCategory = db
    .prepare(
      `SELECT category, COUNT(*) AS count
       FROM complaints
       WHERE deleted_at IS NULL
       GROUP BY category
       ORDER BY count DESC`
    )
    .all();

  const byWard = db
    .prepare(
      `SELECT ward, COUNT(*) AS count
       FROM complaints
       WHERE deleted_at IS NULL
       GROUP BY ward
       ORDER BY count DESC`
    )
    .all();

  return res.json({
    isDemoDataset: true,
    datasetLabel: 'Mathura Civic Demo Dataset (Sample Demonstration Records)',
    metrics: {
      totalComplaints,
      resolvedComplaints,
      escalatedCount,
      approvedChallenges,
      activeProjects,
      verifiedContributions,
    },
    byCategory,
    byWard,
    aiStatus: getAIStatus(),
    categories: ISSUE_CATEGORIES,
  });
});

// Anonymized public feed (never exposes citizen emails, phone numbers, or sensitive info)
router.get('/feed', optionalAuth, (req, res) => {
  const { category = '', status = '', search = '', location = '' } = req.query;
  let sql = `
    SELECT c.id, c.tracking_code, c.title, c.description, c.category, c.ai_summary,
           c.severity, c.latitude, c.longitude, c.address, c.location_source, c.ward,
           c.status, c.escalation_level, c.is_overdue, c.sla_deadline_at, c.is_demo,
           c.created_at, c.updated_at, c.ai_provider,
           d.name AS department_name,
           (SELECT file_url FROM complaint_media m WHERE m.complaint_id = c.id ORDER BY m.id ASC LIMIT 1) AS primary_image,
           (SELECT COUNT(*) FROM complaint_votes v WHERE v.complaint_id = c.id) AS vote_count,
           (SELECT COUNT(*) FROM complaint_comments cm WHERE cm.complaint_id = c.id AND cm.is_hidden = 0) AS comment_count
    FROM complaints c
    LEFT JOIN departments d ON c.department_id = d.id
    WHERE c.deleted_at IS NULL
  `;
  const params = [];

  if (category) {
    sql += ' AND c.category = ?';
    params.push(category);
  }
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  if (location) {
    sql += ' AND (LOWER(c.address) LIKE ? OR LOWER(c.ward) LIKE ?)';
    params.push(`%${String(location).toLowerCase()}%`, `%${String(location).toLowerCase()}%`);
  }
  if (search) {
    sql += ' AND (LOWER(c.title) LIKE ? OR LOWER(c.description) LIKE ? OR LOWER(c.tracking_code) LIKE ?)';
    const q = `%${String(search).toLowerCase()}%`;
    params.push(q, q, q);
  }

  sql += ' ORDER BY c.created_at DESC';
  const rows = db.prepare(sql).all(...params);

  let userVotedSet = new Set();
  if (req.user) {
    const voted = db.prepare('SELECT complaint_id FROM complaint_votes WHERE user_id = ?').all(req.user.id);
    userVotedSet = new Set(voted.map((v) => v.complaint_id));
  }

  const items = rows.map((row) => ({
    ...row,
    userHasVoted: userVotedSet.has(row.id),
  }));

  return res.json({ items, isDemoDataset: true });
});

router.get('/challenges', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT ch.*, d.name AS department_name, c.tracking_code AS source_complaint_code
       FROM civic_challenges ch
       LEFT JOIN departments d ON ch.department_id = d.id
       LEFT JOIN complaints c ON ch.complaint_id = c.id
       WHERE ch.approval_status = 'Approved'
       ORDER BY ch.created_at DESC`
    )
    .all();

  return res.json({
    challenges: rows.map((r) => ({
      ...r,
      skillsRequired: safeParse(r.skills_required_json, []),
      deliverables: safeParse(r.deliverables_json, []),
    })),
  });
});

// OpenStreetMap Nominatim reverse geocoding helper with honest fallback
router.get('/reverse-geocode', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FixGridAI-CivicDemo/1.0' },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      throw new Error(`Nominatim HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return res.json({
      address: data.display_name || `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)} (Mathura Demo Area)`,
      ward: data.address?.suburb || data.address?.neighbourhood || data.address?.city_district || 'Mathura Urban Zone',
      source: 'openstreetmap-nominatim',
    });
  } catch {
    return res.json({
      address: `Coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)} — Please verify or refine street landmark manually`,
      ward: 'User-Supplied Coordinates',
      source: 'manual-fallback',
    });
  }
});

// Civic Improvement Trends Analytics (real-time SQL aggregation across complaints & status history)
router.get('/analytics', (req, res) => {
  const { category = '', ward = '', granularity = 'day' } = req.query;
  const safeGranularity = granularity === 'hour' ? 'hour' : 'day';

  const allCategories = db
    .prepare('SELECT DISTINCT category FROM complaints WHERE deleted_at IS NULL ORDER BY category ASC')
    .all()
    .map((r) => r.category)
    .filter(Boolean);

  const allWards = db
    .prepare('SELECT DISTINCT ward FROM complaints WHERE deleted_at IS NULL ORDER BY ward ASC')
    .all()
    .map((r) => r.ward)
    .filter(Boolean);

  let whereClause = 'WHERE deleted_at IS NULL';
  const params = [];
  if (category) {
    whereClause += ' AND category = ?';
    params.push(category);
  }
  if (ward) {
    whereClause += ' AND ward = ?';
    params.push(ward);
  }

  const complaints = db
    .prepare(
      `SELECT id, tracking_code, category, severity, status, ward, is_overdue, created_at, updated_at
       FROM complaints
       ${whereClause}
       ORDER BY created_at ASC`
    )
    .all(...params);

  const complaintIds = complaints.map((c) => c.id);
  const resolvedAtMap = new Map();

  if (complaintIds.length > 0) {
    const placeholders = complaintIds.map(() => '?').join(',');
    const resolvedRows = db
      .prepare(
        `SELECT complaint_id, MIN(created_at) AS resolved_at
         FROM complaint_status_history
         WHERE complaint_id IN (${placeholders}) AND status = 'Resolved'
         GROUP BY complaint_id`
      )
      .all(...complaintIds);

    for (const row of resolvedRows) {
      resolvedAtMap.set(row.complaint_id, row.resolved_at);
    }
  }

  const totalSubmitted = complaints.length;
  const resolvedComplaints = complaints.filter((c) => c.status === 'Resolved');
  const resolvedCount = resolvedComplaints.length;
  const inProgressCount = complaints.filter((c) => c.status === 'Assigned' || c.status === 'In progress').length;
  const escalatedCount = complaints.filter((c) => c.status === 'Escalated' || c.is_overdue === 1).length;
  const onTimeCount = complaints.filter((c) => c.is_overdue === 0).length;

  const resolutionRatePct = totalSubmitted > 0 ? Math.round((resolvedCount / totalSubmitted) * 100) : 0;
  const slaCompliancePct = totalSubmitted > 0 ? Math.round((onTimeCount / totalSubmitted) * 100) : 100;

  let resolutionHoursSum = 0;
  let resolutionSamples = 0;
  for (const c of resolvedComplaints) {
    const startMs = new Date(c.created_at).getTime();
    const endMs = new Date(resolvedAtMap.get(c.id) || c.updated_at).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
      resolutionHoursSum += (endMs - startMs) / 3600000;
      resolutionSamples += 1;
    }
  }
  const avgResolutionHours = resolutionSamples > 0 ? Number((resolutionHoursSum / resolutionSamples).toFixed(1)) : null;

  // Build continuous time-series buckets from real timestamps
  const timeline = [];
  if (complaints.length > 0) {
    const timestamps = [];
    for (const c of complaints) {
      timestamps.push(new Date(c.created_at).getTime());
      if (c.status === 'Resolved') {
        timestamps.push(new Date(resolvedAtMap.get(c.id) || c.updated_at).getTime());
      }
    }
    const validTs = timestamps.filter(Number.isFinite);
    const minMs = Math.min(...validTs);
    const maxMs = Math.max(...validTs, Date.now());

    const stepMs = safeGranularity === 'hour' ? 4 * 3600000 : 24 * 3600000;

    const alignToBucket = (ms) => {
      const d = new Date(ms);
      if (safeGranularity === 'hour') {
        const alignedHr = Math.floor(d.getUTCHours() / 4) * 4;
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), alignedHr, 0, 0, 0);
      }
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
    };

    const startBucket =
      safeGranularity === 'hour'
        ? Math.max(alignToBucket(minMs), alignToBucket(maxMs) - 18 * stepMs)
        : alignToBucket(minMs);
    const endBucket = alignToBucket(maxMs);

    const bucketStarts = [];
    for (let t = startBucket; t <= endBucket; t += stepMs) {
      bucketStarts.push(t);
    }

    for (const bucketStart of bucketStarts) {
      const bucketEnd = bucketStart + stepMs;
      let submittedInBucket = 0;
      let resolvedInBucket = 0;
      let cumulativeSubmitted = 0;
      let cumulativeResolved = 0;
      let cumulativeActive = 0;
      let cumulativeEscalated = 0;

      for (const c of complaints) {
        const createdMs = new Date(c.created_at).getTime();
        const resolvedMs =
          c.status === 'Resolved' ? new Date(resolvedAtMap.get(c.id) || c.updated_at).getTime() : Infinity;

        if (createdMs >= bucketStart && createdMs < bucketEnd) {
          submittedInBucket += 1;
        }
        if (c.status === 'Resolved' && resolvedMs >= bucketStart && resolvedMs < bucketEnd) {
          resolvedInBucket += 1;
        }

        if (createdMs < bucketEnd) {
          cumulativeSubmitted += 1;
          if (c.status === 'Resolved' && resolvedMs < bucketEnd) {
            cumulativeResolved += 1;
          } else if (c.status === 'Escalated' || c.is_overdue === 1) {
            cumulativeEscalated += 1;
          } else if (c.status === 'Assigned' || c.status === 'In progress') {
            cumulativeActive += 1;
          }
        }
      }

      const d = new Date(bucketStart);
      const label =
        safeGranularity === 'hour'
          ? d.toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', hour12: false, timeZone: 'UTC' })
          : d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit', timeZone: 'UTC' });

      timeline.push({
        timestamp: new Date(bucketStart).toISOString(),
        label,
        submittedInBucket,
        resolvedInBucket,
        cumulativeSubmitted,
        cumulativeResolved,
        cumulativeActive,
        cumulativeEscalated,
        resolutionRatePct: cumulativeSubmitted > 0 ? Math.round((cumulativeResolved / cumulativeSubmitted) * 100) : 0,
      });
    }
  }

  // Category improvement breakdown
  const catMap = new Map();
  for (const c of complaints) {
    const key = c.category || 'Other civic issues';
    const entry = catMap.get(key) || { category: key, total: 0, resolved: 0, active: 0, escalated: 0, pending: 0 };
    entry.total += 1;
    if (c.status === 'Resolved') entry.resolved += 1;
    else if (c.status === 'Escalated' || c.is_overdue === 1) entry.escalated += 1;
    else if (c.status === 'Assigned' || c.status === 'In progress') entry.active += 1;
    else entry.pending += 1;
    catMap.set(key, entry);
  }
  const categoryBreakdown = Array.from(catMap.values())
    .map((item) => ({
      ...item,
      resolutionRatePct: item.total > 0 ? Math.round((item.resolved / item.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Ward improvement breakdown
  const wardMap = new Map();
  for (const c of complaints) {
    const key = c.ward || 'Mathura Central';
    const entry = wardMap.get(key) || { ward: key, total: 0, resolved: 0, open: 0, escalated: 0 };
    entry.total += 1;
    if (c.status === 'Resolved') entry.resolved += 1;
    else {
      entry.open += 1;
      if (c.status === 'Escalated' || c.is_overdue === 1) entry.escalated += 1;
    }
    wardMap.set(key, entry);
  }
  const wardBreakdown = Array.from(wardMap.values())
    .map((w) => ({
      ...w,
      resolutionRatePct: w.total > 0 ? Math.round((w.resolved / w.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return res.json({
    granularity: safeGranularity,
    summary: {
      totalSubmitted,
      resolvedCount,
      inProgressCount,
      escalatedCount,
      resolutionRatePct,
      slaCompliancePct,
      avgResolutionHours,
    },
    timeline,
    categoryBreakdown,
    wardBreakdown,
    filters: {
      categories: allCategories,
      wards: allWards,
    },
  });
});

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default router;
