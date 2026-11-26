import express from 'express';
import db, { createNotification, logAudit } from '../config/db.js';
import { COMPLAINT_STATUSES, ISSUE_CATEGORIES, SEVERITY_LEVELS } from '../config/constants.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { checkAndTriggerOverdueEscalations, computeSlaDeadline } from '../services/slaService.js';
import { buildSuggestedAction, hasRawErrorContent, sanitizeAiExplanation } from '../services/aiService.js';

const router = express.Router();
router.use(requireAuth, requireRole('government', 'admin'));

function parsePositiveId(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function generateUniqueChallengeCode() {
  const maxRow = db.prepare('SELECT COALESCE(MAX(id), 0) AS maxId FROM civic_challenges').get();
  let seq = Number(maxRow?.maxId || 0) + 1;
  while (db.prepare('SELECT 1 FROM civic_challenges WHERE challenge_code = ?').get(`FG-CH-2026-${String(seq).padStart(2, '0')}`)) {
    seq += 1;
  }
  return `FG-CH-2026-${String(seq).padStart(2, '0')}`;
}

router.get('/dashboard', (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM complaints WHERE deleted_at IS NULL').get().c;
  const pendingValidation = db.prepare("SELECT COUNT(*) AS c FROM complaints WHERE deleted_at IS NULL AND status IN ('Submitted', 'AI analysis completed', 'Awaiting official validation')").get().c;
  const escalated = db.prepare("SELECT COUNT(*) AS c FROM complaints WHERE deleted_at IS NULL AND (is_overdue = 1 OR status = 'Escalated')").get().c;
  const resolved = db.prepare("SELECT COUNT(*) AS c FROM complaints WHERE deleted_at IS NULL AND status = 'Resolved'").get().c;
  const pendingDuplicates = db.prepare("SELECT COUNT(*) AS c FROM complaint_duplicate_links WHERE status = 'Pending review'").get().c;
  const pendingPilotRequests = db.prepare("SELECT COUNT(*) AS c FROM projects WHERE pilot_approved = 0").get().c;

  const departments = db
    .prepare(
      `SELECT d.*,
              (SELECT COUNT(*) FROM complaints c WHERE c.department_id = d.id AND c.deleted_at IS NULL) AS total_assigned,
              (SELECT COUNT(*) FROM complaints c WHERE c.department_id = d.id AND c.deleted_at IS NULL AND c.status != 'Resolved') AS active_open
       FROM departments d
       ORDER BY d.id ASC`
    )
    .all();

  const statusBreakdown = db
    .prepare(
      `SELECT status, COUNT(*) AS count
       FROM complaints
       WHERE deleted_at IS NULL
       GROUP BY status`
    )
    .all();

  const recentEscalations = db
    .prepare(
      `SELECT eh.*, c.tracking_code, c.title
       FROM escalation_history eh
       JOIN complaints c ON eh.complaint_id = c.id
       ORDER BY eh.created_at DESC
       LIMIT 10`
    )
    .all();

  return res.json({
    kpis: { total, pendingValidation, escalated, resolved, pendingDuplicates, pendingPilotRequests },
    departments,
    statusBreakdown,
    recentEscalations,
  });
});

router.get('/complaints', (req, res) => {
  const { status = '', severity = '', departmentId = '' } = req.query;
  let sql = `
    SELECT c.*, d.name AS department_name,
           (SELECT COUNT(*) FROM complaint_votes v WHERE v.complaint_id = c.id) AS vote_count,
           (SELECT COUNT(*) FROM complaint_duplicate_links dl WHERE (dl.primary_complaint_id = c.id OR dl.duplicate_complaint_id = c.id) AND dl.status = 'Pending review') AS pending_duplicates
    FROM complaints c
    LEFT JOIN departments d ON c.department_id = d.id
    WHERE c.deleted_at IS NULL
  `;
  const params = [];
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  if (severity) {
    sql += ' AND c.severity = ?';
    params.push(severity);
  }
  if (departmentId) {
    sql += ' AND c.department_id = ?';
    params.push(Number(departmentId));
  }
  sql += ' ORDER BY c.is_overdue DESC, c.created_at DESC';

  const rawComplaints = db.prepare(sql).all(...params);
  const complaints = rawComplaints.map((c) => {
    const predictedCat = c.ai_predicted_category || c.category;
    const predictedPriority = c.ai_recommended_severity || c.severity;
    const deptName = c.department_name || 'Municipal Engineering Department';
    const wasRawError = hasRawErrorContent(c.ai_explanation);
    const isGemini = String(c.ai_provider || '').startsWith('gemini') && !wasRawError;
    return {
      ...c,
      ai_explanation: sanitizeAiExplanation(c.ai_explanation, {
        category: predictedCat,
        severity: predictedPriority,
        departmentName: deptName,
      }),
      ai_assessment_type: isGemini ? 'AI Assessment' : 'Automated Assessment',
      ai_is_fallback: !isGemini && (c.ai_provider === 'rule-based-fallback' || wasRawError),
      ai_suggested_action: buildSuggestedAction(predictedCat, predictedPriority, deptName),
    };
  });
  const departments = db.prepare('SELECT * FROM departments WHERE active = 1 ORDER BY name ASC').all();
  const duplicateLinks =
    db
      .prepare(
        `SELECT dl.*, p.tracking_code AS primary_code, p.title AS primary_title,
                s.tracking_code AS duplicate_code, s.title AS duplicate_title
         FROM complaint_duplicate_links dl
         JOIN complaints p ON dl.primary_complaint_id = p.id
         JOIN complaints s ON dl.duplicate_complaint_id = s.id
         ORDER BY dl.created_at DESC`
      )
      .all();

  return res.json({ complaints, departments, duplicateLinks });
});

// Validate / override AI classification, severity, department, and status
router.patch('/complaints/:id', (req, res) => {
  const complaintId = parsePositiveId(req.params.id);
  if (!complaintId) return res.status(400).json({ error: 'Invalid complaint ID.' });
  const existing = db.prepare('SELECT * FROM complaints WHERE id = ? AND deleted_at IS NULL').get(complaintId);
  if (!existing) return res.status(404).json({ error: 'Complaint not found.' });

  const {
    category = existing.category,
    severity = existing.severity,
    departmentId = existing.department_id,
    status = existing.status,
    assignedOfficialName = existing.assigned_official_name,
    resolutionNotes = existing.resolution_notes,
    note = '',
  } = req.body || {};

  let resolvedDeptId = existing.department_id;
  if (departmentId !== undefined && departmentId !== null && departmentId !== '') {
    const parsedDeptId = parsePositiveId(departmentId);
    if (!parsedDeptId) return res.status(400).json({ error: 'Invalid department ID.' });
    const deptExists = db.prepare('SELECT id FROM departments WHERE id = ?').get(parsedDeptId);
    if (!deptExists) return res.status(400).json({ error: 'Selected department does not exist.' });
    resolvedDeptId = parsedDeptId;
  }

  const safeCategory = ISSUE_CATEGORIES.includes(category) ? category : existing.category;
  const safeSeverity = SEVERITY_LEVELS.includes(severity) ? severity : existing.severity;
  const safeStatus = COMPLAINT_STATUSES.includes(status) ? status : existing.status;

  const newDeadline = safeSeverity !== existing.severity ? computeSlaDeadline(safeSeverity, new Date(existing.created_at)) : existing.sla_deadline_at;

  db.prepare(
    `UPDATE complaints
     SET category = ?, severity = ?, department_id = ?, status = ?,
         assigned_official_name = ?, resolution_notes = ?, sla_deadline_at = ?,
         is_overdue = CASE WHEN ? = 'Resolved' THEN 0 ELSE is_overdue END,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    safeCategory,
    safeSeverity,
    resolvedDeptId,
    safeStatus,
    String(assignedOfficialName || req.user.name).trim(),
    String(resolutionNotes || '').trim(),
    newDeadline,
    safeStatus,
    complaintId
  );

  const changeNotes = [];
  if (safeCategory !== existing.category) changeNotes.push(`Category adjusted to ${safeCategory}`);
  if (safeSeverity !== existing.severity) changeNotes.push(`Severity adjusted to ${safeSeverity}`);
  if (safeStatus !== existing.status) changeNotes.push(`Status updated to ${safeStatus}`);
  if (note) changeNotes.push(note);

  db.prepare(
    `INSERT INTO complaint_status_history (complaint_id, status, note, actor_id, actor_role)
     VALUES (?, ?, ?, ?, ?)`
  ).run(complaintId, safeStatus, changeNotes.join('. ') || 'Official review recorded.', req.user.id, req.user.role);

  createNotification(
    existing.reporter_id,
    `Update on ${existing.tracking_code}: ${safeStatus}`,
    changeNotes.join('. ') || `Official ${req.user.name} updated your report status to ${safeStatus}.`,
    '/citizen/my-complaints'
  );

  logAudit(req.user.id, req.user.role, 'VALIDATE_UPDATE_COMPLAINT', 'complaints', complaintId, {
    trackingCode: existing.tracking_code,
    status: safeStatus,
    severity: safeSeverity,
    category: safeCategory,
  });

  return res.json({ message: 'Complaint updated and logged.' });
});

// Confirm or reject duplicate complaint relationship (never deletes original!)
router.patch('/duplicates/:linkId', (req, res) => {
  const linkId = parsePositiveId(req.params.linkId);
  if (!linkId) return res.status(400).json({ error: 'Invalid duplicate link ID.' });
  const { decision } = req.body || {};
  if (!['Confirmed', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be Confirmed or Rejected.' });
  }

  const link = db.prepare('SELECT * FROM complaint_duplicate_links WHERE id = ?').get(linkId);
  if (!link) return res.status(404).json({ error: 'Duplicate link not found.' });

  db.prepare('UPDATE complaint_duplicate_links SET status = ?, reviewed_by = ? WHERE id = ?').run(
    decision,
    req.user.id,
    linkId
  );

  logAudit(req.user.id, req.user.role, 'REVIEW_DUPLICATE_LINK', 'complaint_duplicate_links', linkId, {
    decision,
    primaryComplaintId: link.primary_complaint_id,
    duplicateComplaintId: link.duplicate_complaint_id,
  });

  return res.json({ message: `Duplicate relationship marked as ${decision}. Both original reports remain preserved.` });
});

// Trigger SLA sweep
router.post('/sla/run-escalation', (req, res) => {
  const escalated = checkAndTriggerOverdueEscalations(req.user.id, req.user.role);
  return res.json({
    escalatedCount: escalated.length,
    escalated,
  });
});

// Convert validated complaint to Civic Innovation Challenge (Government approval required)
router.post('/challenges/convert', (req, res) => {
  const {
    complaintId,
    title,
    description,
    background,
    expectedOutcome,
    skillsRequired = [],
    deliverables = [],
    deadline = '2027-02-15',
    difficulty = 'Intermediate',
  } = req.body || {};

  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ? AND deleted_at IS NULL').get(Number(complaintId));
  if (!complaint) return res.status(404).json({ error: 'Source complaint not found.' });
  if (!title || !description) {
    return res.status(400).json({ error: 'Challenge title and description are required.' });
  }

  const challengeCode = generateUniqueChallengeCode();

  const result = db
    .prepare(
      `INSERT INTO civic_challenges (
        challenge_code, complaint_id, title, description, category, location,
        background, expected_outcome, skills_required_json, deliverables_json,
        deadline, difficulty, department_id, approval_status, created_by, approved_by, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved', ?, ?, 0)`
    )
    .run(
      challengeCode,
      complaint.id,
      String(title).trim(),
      String(description).trim(),
      complaint.category,
      complaint.address,
      String(background || complaint.description).trim(),
      String(expectedOutcome || 'Scalable civic prototype for official departmental evaluation.').trim(),
      JSON.stringify(Array.isArray(skillsRequired) ? skillsRequired : []),
      JSON.stringify(Array.isArray(deliverables) ? deliverables : ['Working Prototype', 'Field Validation Report']),
      deadline,
      difficulty,
      complaint.department_id,
      req.user.id,
      req.user.id
    );

  createNotification(
    complaint.reporter_id,
    `Report Converted to Civic Challenge ${challengeCode}`,
    `Your report ${complaint.tracking_code} inspired an official student innovation challenge.`,
    '/challenges'
  );

  logAudit(req.user.id, req.user.role, 'CONVERT_COMPLAINT_TO_CHALLENGE', 'civic_challenges', result.lastInsertRowid, {
    challengeCode,
    complaintCode: complaint.tracking_code,
  });

  return res.status(201).json({
    challengeId: result.lastInsertRowid,
    challengeCode,
    message: 'Complaint converted into approved Civic Innovation Challenge.',
  });
});

// Challenge & Application / Pilot review
router.get('/challenges-review', (_req, res) => {
  const challenges = db
    .prepare(
      `SELECT ch.*, d.name AS department_name, c.tracking_code AS source_complaint_code
       FROM civic_challenges ch
       LEFT JOIN departments d ON ch.department_id = d.id
       LEFT JOIN complaints c ON ch.complaint_id = c.id
       ORDER BY ch.created_at DESC`
    )
    .all();

  const applications = db
    .prepare(
      `SELECT ca.*, ch.title AS challenge_title, ch.challenge_code, u.name AS applicant_name, t.name AS team_name
       FROM challenge_applications ca
       JOIN civic_challenges ch ON ca.challenge_id = ch.id
       JOIN users u ON ca.applicant_user_id = u.id
       LEFT JOIN teams t ON ca.team_id = t.id
       ORDER BY ca.created_at DESC`
    )
    .all();

  const projects = db
    .prepare(
      `SELECT p.*, ch.title AS challenge_title, ch.challenge_code, t.name AS team_name
       FROM projects p
       JOIN civic_challenges ch ON p.challenge_id = ch.id
       JOIN teams t ON p.team_id = t.id
       ORDER BY p.created_at DESC`
    )
    .all();

  return res.json({ challenges, applications, projects });
});

router.patch('/applications/:id', (req, res) => {
  const appId = Number(req.params.id);
  const { status } = req.body || {};
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  const appRow = db.prepare('SELECT * FROM challenge_applications WHERE id = ?').get(appId);
  if (!appRow) return res.status(404).json({ error: 'Application not found.' });

  db.prepare('UPDATE challenge_applications SET status = ? WHERE id = ?').run(status, appId);

  // If approved and has a team (or create solo team), spin up project workspace if none exists
  if (status === 'Approved') {
    let teamId = appRow.team_id;
    if (!teamId) {
      const challenge = db.prepare('SELECT title FROM civic_challenges WHERE id = ?').get(appRow.challenge_id);
      const teamRes = db
        .prepare('INSERT INTO teams (name, description, challenge_id, leader_id, max_members) VALUES (?, ?, ?, ?, 4)')
        .run(`Solo Innovator Squad #${appId}`, `Individual innovation workspace for ${challenge?.title || 'Challenge'}`, appRow.challenge_id, appRow.applicant_user_id);
      teamId = teamRes.lastInsertRowid;
      db.prepare('INSERT INTO team_members (team_id, user_id, project_role) VALUES (?, ?, ?)').run(teamId, appRow.applicant_user_id, 'Solo Lead');
      db.prepare('UPDATE challenge_applications SET team_id = ? WHERE id = ?').run(teamId, appId);
    }

    const existingProj = db.prepare('SELECT id FROM projects WHERE challenge_id = ? AND team_id = ?').get(appRow.challenge_id, teamId);
    if (!existingProj) {
      const challenge = db.prepare('SELECT title, expected_outcome FROM civic_challenges WHERE id = ?').get(appRow.challenge_id);
      const projRes = db
        .prepare('INSERT INTO projects (challenge_id, team_id, title, objectives, status) VALUES (?, ?, ?, ?, ?)')
        .run(appRow.challenge_id, teamId, `${challenge?.title || 'Civic'} — Prototype`, challenge?.expected_outcome || 'Build working civic prototype', 'Active');

      db.prepare('INSERT INTO project_tasks (project_id, title, description, status, assignee_id, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        projRes.lastInsertRowid,
        'Draft initial architecture & field safety plan',
        'Outline hardware/software stack and municipal non-interference checklist.',
        'Todo',
        appRow.applicant_user_id,
        'High',
        '2026-12-28'
      );
      db.prepare('INSERT INTO project_milestones (project_id, title, description, due_date, status) VALUES (?, ?, ?, ?, ?)').run(
        projRes.lastInsertRowid,
        'Milestone 1: Working Prototype & Test Metrics',
        'Demonstrate end-to-end prototype readiness for faculty review.',
        '2027-01-10',
        'In Progress'
      );
    }
  }

  createNotification(
    appRow.applicant_user_id,
    `Challenge Application ${status}`,
    `Government review updated your innovation proposal status to ${status}.`,
    '/student/projects'
  );
  logAudit(req.user.id, req.user.role, 'REVIEW_APPLICATION', 'challenge_applications', appId, { status });

  return res.json({ message: `Application ${status}.` });
});

router.patch('/projects/:id/pilot', (req, res) => {
  const projectId = parsePositiveId(req.params.id);
  if (!projectId) return res.status(400).json({ error: 'Invalid project ID.' });
  const { pilotApproved } = req.body || {};
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  const approvedInt = pilotApproved ? 1 : 0;
  db.prepare('UPDATE projects SET pilot_approved = ? WHERE id = ?').run(approvedInt, projectId);
  db.prepare('UPDATE civic_challenges SET pilot_status = ? WHERE id = ?').run(
    pilotApproved ? 'Approved Public-Sector Pilot' : 'None',
    project.challenge_id
  );

  const team = db.prepare('SELECT leader_id FROM teams WHERE id = ?').get(project.team_id);
  if (team?.leader_id) {
    createNotification(
      team.leader_id,
      pilotApproved ? `Pilot Approved: ${project.title}` : `Pilot Status Updated: ${project.title}`,
      pilotApproved
        ? 'Government officials approved your project for a public-sector field pilot.'
        : 'Public-sector pilot approval was withdrawn by government review.',
      '/student/projects'
    );
  }

  logAudit(req.user.id, req.user.role, 'APPROVE_PILOT', 'projects', projectId, { pilotApproved: Boolean(pilotApproved) });
  return res.json({ message: pilotApproved ? 'Public-sector pilot approved.' : 'Pilot approval withdrawn.' });
});

export default router;
