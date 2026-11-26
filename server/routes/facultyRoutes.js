import express from 'express';
import db, { createNotification, logAudit } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('faculty', 'admin'));

router.get('/dashboard', (req, res) => {
  let profile = db.prepare('SELECT * FROM faculty_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) {
    db.prepare(
      `INSERT INTO faculty_profiles (user_id, institution, department, specialization, bio, verified)
       VALUES (?, ?, 'Civic Engineering', 'Smart Urban Systems', '', 1)`
    ).run(req.user.id, req.user.institution_or_org || 'GLA University, Mathura');
    profile = db.prepare('SELECT * FROM faculty_profiles WHERE user_id = ?').get(req.user.id);
  }

  const requests = db
    .prepare(
      `SELECT ma.*, p.title AS project_title, t.name AS team_name, ch.challenge_code
       FROM mentor_assignments ma
       JOIN projects p ON ma.project_id = p.id
       JOIN teams t ON p.team_id = t.id
       JOIN civic_challenges ch ON p.challenge_id = ch.id
       WHERE ma.faculty_id = ?
       ORDER BY ma.created_at DESC`
    )
    .all(req.user.id);

  const projects = db
    .prepare(
      `SELECT p.*, ch.title AS challenge_title, ch.challenge_code, t.name AS team_name
       FROM projects p
       JOIN civic_challenges ch ON p.challenge_id = ch.id
       JOIN teams t ON p.team_id = t.id
       ORDER BY p.created_at DESC`
    )
    .all()
    .map((proj) => {
      const members = db
        .prepare(
          `SELECT tm.user_id, tm.project_role, u.name, sp.skills_json
           FROM team_members tm
           JOIN users u ON tm.user_id = u.id
           LEFT JOIN student_profiles sp ON u.id = sp.user_id
           WHERE tm.team_id = ?`
        )
        .all(proj.team_id)
        .map((m) => ({ ...m, skills: safeParse(m.skills_json, []) }));
      const milestones = db.prepare('SELECT * FROM project_milestones WHERE project_id = ?').all(proj.id);
      const deliverables = db.prepare('SELECT * FROM project_deliverables WHERE project_id = ?').all(proj.id);
      const contributions = db.prepare('SELECT * FROM contribution_records WHERE project_id = ?').all(proj.id);
      return { ...proj, members, milestones, deliverables, contributions };
    });

  return res.json({ profile, requests, projects });
});

router.put('/profile', (req, res) => {
  const { institution = '', department = '', specialization = '', bio = '' } = req.body || {};
  db.prepare(
    `UPDATE faculty_profiles SET institution = ?, department = ?, specialization = ?, bio = ? WHERE user_id = ?`
  ).run(String(institution).trim(), String(department).trim(), String(specialization).trim(), String(bio).trim(), req.user.id);
  return res.json({ message: 'Faculty mentor profile updated.' });
});

router.patch('/mentorship/:id', (req, res) => {
  const assignmentId = Number(req.params.id);
  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return res.status(400).json({ error: 'Invalid mentorship request ID.' });
  }
  const { status } = req.body || {};
  if (!['Accepted', 'Declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid decision.' });
  }
  const assignment = db
    .prepare(
      `SELECT ma.*, p.title AS project_title, t.leader_id
       FROM mentor_assignments ma
       LEFT JOIN projects p ON ma.project_id = p.id
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE ma.id = ? AND ma.faculty_id = ?`
    )
    .get(assignmentId, req.user.id);
  if (!assignment) {
    return res.status(404).json({ error: 'Mentorship request not found.' });
  }
  db.prepare('UPDATE mentor_assignments SET status = ? WHERE id = ? AND faculty_id = ?').run(
    status,
    assignmentId,
    req.user.id
  );
  if (assignment.leader_id) {
    createNotification(
      assignment.leader_id,
      `Mentorship Request ${status}`,
      `${req.user.name} ${status.toLowerCase()} your mentorship request for ${assignment.project_title || 'your project'}.`,
      '/student/projects'
    );
  }
  return res.json({ message: `Mentorship request ${status.toLowerCase()}.` });
});

router.post('/projects/:projectId/feedback', (req, res) => {
  const projectId = Number(req.params.projectId);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({ error: 'Invalid project ID.' });
  }
  const { comment } = req.body || {};
  if (!comment || String(comment).trim().length < 3) {
    return res.status(400).json({ error: 'Feedback comment cannot be empty.' });
  }
  const project = db.prepare('SELECT id, title, team_id FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  db.prepare('INSERT INTO mentor_feedback (project_id, author_id, comment) VALUES (?, ?, ?)').run(
    projectId,
    req.user.id,
    String(comment).trim()
  );

  return res.status(201).json({ message: 'Deliverable feedback posted.' });
});

router.patch('/milestones/:milestoneId/evaluate', (req, res) => {
  const milestoneId = Number(req.params.milestoneId);
  if (!Number.isInteger(milestoneId) || milestoneId <= 0) {
    return res.status(400).json({ error: 'Invalid milestone ID.' });
  }
  const { status = 'Verified', evaluation = '' } = req.body || {};
  if (!['In Progress', 'Submitted', 'Verified', 'Needs Revision'].includes(status)) {
    return res.status(400).json({ error: 'Invalid milestone status.' });
  }
  const milestone = db.prepare('SELECT id FROM project_milestones WHERE id = ?').get(milestoneId);
  if (!milestone) return res.status(404).json({ error: 'Milestone not found.' });

  db.prepare(
    `UPDATE project_milestones
     SET status = ?, faculty_evaluation = ?, evaluated_by = ?, evaluated_at = datetime('now')
     WHERE id = ?`
  ).run(status, String(evaluation).trim(), req.user.id, milestoneId);

  logAudit(req.user.id, req.user.role, 'EVALUATE_MILESTONE', 'project_milestones', milestoneId, { status });
  return res.json({ message: 'Milestone evaluation recorded.' });
});

// Verify a student's contribution for the Student Contribution Passport
router.post('/verify-contribution', (req, res) => {
  const {
    studentId,
    projectId,
    roleHeld,
    responsibilities,
    skills = [],
    tasksCompleted = 1,
    deliverablesSummary = '',
    verificationNote = '',
  } = req.body || {};

  if (!studentId || !projectId || !roleHeld || !responsibilities) {
    return res.status(400).json({ error: 'Student, project, role, and responsibilities are required.' });
  }

  const parsedStudentId = Number(studentId);
  const parsedProjectId = Number(projectId);
  if (!Number.isInteger(parsedStudentId) || parsedStudentId <= 0 || !Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    return res.status(400).json({ error: 'Valid student and project IDs are required.' });
  }

  const studentExists = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student' AND deleted_at IS NULL").get(parsedStudentId);
  if (!studentExists) return res.status(404).json({ error: 'Student account not found.' });

  const projectExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(parsedProjectId);
  if (!projectExists) return res.status(404).json({ error: 'Project not found.' });

  const result = db
    .prepare(
      `INSERT INTO contribution_records (
        student_id, project_id, role_held, responsibilities, skills_json,
        tasks_completed, deliverables_summary, verified_by_faculty_id, verification_note, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      parsedStudentId,
      parsedProjectId,
      String(roleHeld).trim(),
      String(responsibilities).trim(),
      JSON.stringify(Array.isArray(skills) ? skills : []),
      Math.max(1, Number(tasksCompleted) || 1),
      String(deliverablesSummary).trim(),
      req.user.id,
      String(verificationNote).trim() || 'Verified by Faculty Mentor.'
    );

  createNotification(
    parsedStudentId,
    'Contribution Passport Updated',
    `${req.user.name} verified your project contribution (${roleHeld}).`,
    '/student/passport'
  );

  logAudit(req.user.id, req.user.role, 'VERIFY_CONTRIBUTION', 'contribution_records', result.lastInsertRowid, {
    studentId: parsedStudentId,
    projectId: parsedProjectId,
  });

  return res.status(201).json({ message: 'Student contribution verified and added to Passport.' });
});

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default router;
