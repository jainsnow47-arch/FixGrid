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

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default router;
