import express from 'express';
import db, { createNotification } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  let projects = [];
  if (req.user.role === 'student') {
    projects = db
      .prepare(
        `SELECT p.*, ch.challenge_code, ch.title AS challenge_title, t.name AS team_name
         FROM projects p
         JOIN civic_challenges ch ON p.challenge_id = ch.id
         JOIN teams t ON p.team_id = t.id
         JOIN team_members tm ON t.id = tm.team_id
         WHERE tm.user_id = ?
         ORDER BY p.created_at DESC`
      )
      .all(req.user.id);
  } else {
    projects = db
      .prepare(
        `SELECT p.*, ch.challenge_code, ch.title AS challenge_title, t.name AS team_name
         FROM projects p
         JOIN civic_challenges ch ON p.challenge_id = ch.id
         JOIN teams t ON p.team_id = t.id
         ORDER BY p.created_at DESC`
      )
      .all();
  }

  const enriched = projects.map((proj) => {
    const members = db
      .prepare(
        `SELECT tm.user_id, tm.project_role, u.name
         FROM team_members tm
         JOIN users u ON tm.user_id = u.id
         WHERE tm.team_id = ?`
      )
      .all(proj.team_id);

    const tasks = db
      .prepare(
        `SELECT pt.*, u.name AS assignee_name
         FROM project_tasks pt
         LEFT JOIN users u ON pt.assignee_id = u.id
         WHERE pt.project_id = ?
         ORDER BY pt.id DESC`
      )
      .all(proj.id);

    const milestones = db
      .prepare(
        `SELECT pm.*, f.name AS evaluator_name
         FROM project_milestones pm
         LEFT JOIN users f ON pm.evaluated_by = f.id
         WHERE pm.project_id = ?
         ORDER BY pm.due_date ASC`
      )
      .all(proj.id);

    const deliverables = db
      .prepare(
        `SELECT pd.*, u.name AS submitter_name
         FROM project_deliverables pd
         JOIN users u ON pd.submitted_by = u.id
         WHERE pd.project_id = ?
         ORDER BY pd.created_at DESC`
      )
      .all(proj.id);

    const feedback = db
      .prepare(
        `SELECT mf.*, u.name AS author_name, u.role AS author_role
         FROM mentor_feedback mf
         JOIN users u ON mf.author_id = u.id
         WHERE mf.project_id = ?
         ORDER BY mf.created_at DESC`
      )
      .all(proj.id);

    const mentors = db
      .prepare(
        `SELECT ma.*, u.name AS faculty_name, fp.department
         FROM mentor_assignments ma
         JOIN users u ON ma.faculty_id = u.id
         LEFT JOIN faculty_profiles fp ON u.id = fp.user_id
         WHERE ma.project_id = ?`
      )
      .all(proj.id);

    return { ...proj, members, tasks, milestones, deliverables, feedback, mentors };
  });

  const facultyList = db
    .prepare(
      `SELECT u.id, u.name, fp.institution, fp.department, fp.specialization
       FROM users u
       JOIN faculty_profiles fp ON u.id = fp.user_id
       WHERE u.role = 'faculty' AND u.deleted_at IS NULL`
    )
    .all();

  return res.json({ projects: enriched, facultyList });
});

router.post('/:projectId/tasks', (req, res) => {
  const projectId = Number(req.params.projectId);
  const { title, description = '', priority = 'Medium', dueDate = '', assigneeId = null } = req.body || {};
  if (!title || String(title).trim().length < 3) {
    return res.status(400).json({ error: 'Task title must be at least 3 characters.' });
  }

  db.prepare(
    `INSERT INTO project_tasks (project_id, title, description, status, assignee_id, priority, due_date)
     VALUES (?, ?, ?, 'Todo', ?, ?, ?)`
  ).run(projectId, String(title).trim(), String(description).trim(), assigneeId || req.user.id, priority, dueDate);

  return res.status(201).json({ message: 'Task added to board.' });
});

router.patch('/tasks/:taskId', (req, res) => {
  const taskId = Number(req.params.taskId);
  const { status } = req.body || {};
  if (!['Todo', 'In Progress', 'Review', 'Done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid Kanban column.' });
  }
  db.prepare('UPDATE project_tasks SET status = ? WHERE id = ?').run(status, taskId);
  return res.json({ message: 'Task moved.' });
});

router.post('/:projectId/deliverables', uploadMiddleware.single('file'), (req, res) => {
  const projectId = Number(req.params.projectId);
  const { title, description = '' } = req.body || {};
  if (!title || String(title).trim().length < 3) {
    return res.status(400).json({ error: 'Deliverable title is required.' });
  }
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : '';
  db.prepare(
    `INSERT INTO project_deliverables (project_id, title, description, file_url, submitted_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(projectId, String(title).trim(), String(description).trim(), fileUrl, req.user.id);

  return res.status(201).json({ message: 'Deliverable submitted.' });
});

router.post('/:projectId/request-mentor', (req, res) => {
  const projectId = Number(req.params.projectId);
  const { facultyId, message = '' } = req.body || {};
  const project = db.prepare('SELECT challenge_id, title FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  const existing = db
    .prepare('SELECT id FROM mentor_assignments WHERE project_id = ? AND faculty_id = ?')
    .get(projectId, Number(facultyId));
  if (existing) return res.status(409).json({ error: 'Mentorship request already sent to this faculty mentor.' });

  db.prepare(
    `INSERT INTO mentor_assignments (project_id, challenge_id, faculty_id, status, message)
     VALUES (?, ?, ?, 'Requested', ?)`
  ).run(projectId, project.challenge_id, Number(facultyId), String(message).trim());

  createNotification(
    Number(facultyId),
    `Mentorship Request: ${project.title}`,
    `${req.user.name} requested your faculty mentorship for their civic innovation project.`,
    '/faculty/mentorship'
  );

  return res.status(201).json({ message: 'Mentorship request sent.' });
});

export default router;
