import express from 'express';
import db, { logAudit } from '../config/db.js';
import { ROLES, SEVERITY_LEVELS } from '../config/constants.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getAIStatus } from '../services/aiService.js';
import { getMatchWeights } from '../services/matchingService.js';

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/overview', (_req, res) => {
  const users = db
    .prepare('SELECT id, name, email, role, institution_or_org, city, ward, verified, created_at FROM users WHERE deleted_at IS NULL ORDER BY id ASC')
    .all();
  const departments = db.prepare('SELECT * FROM departments ORDER BY id ASC').all();
  const categories = db
    .prepare(
      `SELECT ic.*, d.name AS department_name
       FROM issue_categories ic
       LEFT JOIN departments d ON ic.default_department_id = d.id
       ORDER BY ic.id ASC`
    )
    .all();
  const slaRules = db.prepare('SELECT * FROM sla_configurations ORDER BY target_hours ASC').all();
  const matchWeights = getMatchWeights();
  const auditLogs = db
    .prepare(
      `SELECT al.*, u.name AS actor_name
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_id = u.id
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT 60`
    )
    .all();
  const comments = db
    .prepare(
      `SELECT cm.*, u.name AS author_name, c.tracking_code
       FROM complaint_comments cm
       JOIN users u ON cm.user_id = u.id
       JOIN complaints c ON cm.complaint_id = c.id
       ORDER BY cm.created_at DESC
       LIMIT 30`
    )
    .all();

  return res.json({
    users,
    departments,
    categories,
    slaRules,
    matchWeights,
    auditLogs,
    comments,
    aiStatus: getAIStatus(),
  });
});

router.patch('/users/:id', (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }
  const { role, verified } = req.body || {};
  const existing = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(targetId);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  const safeRole = ROLES.includes(role) ? role : existing.role;
  const safeVerified = typeof verified === 'boolean' ? (verified ? 1 : 0) : existing.verified;

  db.prepare('UPDATE users SET role = ?, verified = ? WHERE id = ?').run(safeRole, safeVerified, targetId);
  logAudit(req.user.id, req.user.role, 'ADMIN_UPDATE_USER', 'users', targetId, { role: safeRole, verified: Boolean(safeVerified) });
  return res.json({ message: 'User permissions updated.' });
});

router.post('/departments', (req, res) => {
  const { name, code, jurisdiction = 'Mathura Urban Zone (Demo)', description = '' } = req.body || {};
  if (!name || !code) return res.status(400).json({ error: 'Department name and code are required.' });
  try {
    const resDb = db
      .prepare('INSERT INTO departments (name, code, jurisdiction, description) VALUES (?, ?, ?, ?)')
      .run(String(name).trim(), String(code).trim().toUpperCase(), String(jurisdiction).trim(), String(description).trim());
    logAudit(req.user.id, req.user.role, 'ADMIN_CREATE_DEPARTMENT', 'departments', resDb.lastInsertRowid, { name, code });
    return res.status(201).json({ message: 'Department created.' });
  } catch (err) {
    return res.status(409).json({ error: 'Department name or code already exists.' });
  }
});

router.patch('/categories/:id', (req, res) => {
  const catId = Number(req.params.id);
  if (!Number.isInteger(catId) || catId <= 0) return res.status(400).json({ error: 'Invalid category ID.' });
  const { defaultDepartmentId, defaultSeverity, active } = req.body || {};
  const cat = db.prepare('SELECT * FROM issue_categories WHERE id = ?').get(catId);
  if (!cat) return res.status(404).json({ error: 'Category not found.' });

  let resolvedDeptId = cat.default_department_id;
  if (defaultDepartmentId !== undefined && defaultDepartmentId !== null && defaultDepartmentId !== '') {
    const parsedDept = Number(defaultDepartmentId);
    if (!Number.isInteger(parsedDept) || parsedDept <= 0) {
      return res.status(400).json({ error: 'Invalid department ID.' });
    }
    const deptExists = db.prepare('SELECT id FROM departments WHERE id = ?').get(parsedDept);
    if (!deptExists) return res.status(400).json({ error: 'Department not found.' });
    resolvedDeptId = parsedDept;
  }

  const safeSeverity = defaultSeverity && SEVERITY_LEVELS.includes(defaultSeverity) ? defaultSeverity : cat.default_severity;

  db.prepare(
    `UPDATE issue_categories SET default_department_id = ?, default_severity = ?, active = ? WHERE id = ?`
  ).run(
    resolvedDeptId,
    safeSeverity,
    typeof active === 'boolean' ? (active ? 1 : 0) : cat.active,
    catId
  );

  logAudit(req.user.id, req.user.role, 'ADMIN_UPDATE_CATEGORY', 'issue_categories', catId, { defaultDepartmentId: resolvedDeptId, defaultSeverity: safeSeverity });
  return res.json({ message: 'Category routing updated.' });
});

router.put('/sla', (req, res) => {
  const { rules } = req.body || {};
  if (!Array.isArray(rules)) return res.status(400).json({ error: 'SLA rules array required.' });
  const stmt = db.prepare(
    `UPDATE sla_configurations SET target_hours = ?, escalation_target = ?, updated_at = datetime('now') WHERE severity = ?`
  );
  const saveTx = db.transaction((items) => {
    for (const r of items) {
      if (!SEVERITY_LEVELS.includes(r.severity)) continue;
      stmt.run(Math.max(1, Number(r.target_hours) || 24), String(r.escalation_target || 'Nodal Officer').trim(), r.severity);
    }
  });
  saveTx(rules);
  logAudit(req.user.id, req.user.role, 'ADMIN_UPDATE_SLA', 'sla_configurations', 'all', { count: rules.length });
  return res.json({ message: 'SLA thresholds saved.' });
});

router.put('/match-weights', (req, res) => {
  const { skills, domain, experience, availability, proximity } = req.body || {};
  const weights = {
    skills: Number(skills) || 35,
    domain: Number(domain) || 25,
    experience: Number(experience) || 15,
    availability: Number(availability) || 15,
    proximity: Number(proximity) || 10,
  };
  db.prepare(
    `INSERT INTO platform_settings (key, value_json, updated_at) VALUES ('skill_match_weights', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')`
  ).run(JSON.stringify(weights));

  logAudit(req.user.id, req.user.role, 'ADMIN_UPDATE_MATCH_WEIGHTS', 'platform_settings', 'skill_match_weights', weights);
  return res.json({ message: 'Skill matching weights updated.' });
});

router.patch('/comments/:id/moderate', (req, res) => {
  const commentId = Number(req.params.id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return res.status(400).json({ error: 'Invalid comment ID.' });
  }
  const { isHidden } = req.body || {};
  const result = db.prepare('UPDATE complaint_comments SET is_hidden = ? WHERE id = ?').run(isHidden ? 1 : 0, commentId);
  if (result.changes === 0) return res.status(404).json({ error: 'Comment not found.' });
  logAudit(req.user.id, req.user.role, 'MODERATE_COMMENT', 'complaint_comments', commentId, { isHidden: Boolean(isHidden) });
  return res.json({ message: isHidden ? 'Comment hidden.' : 'Comment restored.' });
});

export default router;
