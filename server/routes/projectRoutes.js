import fs from 'node:fs';
import express from 'express';
import db, { createNotification } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';

const router = express.Router();
router.use(requireAuth, requireRole('student', 'faculty', 'government', 'industry', 'admin'));

function parsePositiveId(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getProjectWithAccessCheck(projectId, user) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return { errorStatus: 404, error: 'Project not found.' };
  if (user.role === 'admin') return { project };
  const isMember = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(project.team_id, user.id);
  if (!isMember) {
    return { errorStatus: 403, error: 'Only members of this project team can modify project tasks or deliverables.' };
  }
  return { project };
}

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
  const projectId = parsePositiveId(req.params.projectId);
  if (!projectId) return res.status(400).json({ error: 'Invalid project ID.' });

  const access = getProjectWithAccessCheck(projectId, req.user);
  if (access.error) return res.status(access.errorStatus).json({ error: access.error });

  const { title, description = '', priority = 'Medium', dueDate = '', assigneeId = null } = req.body || {};
  if (!title || String(title).trim().length < 3) {
    return res.status(400).json({ error: 'Task title must be at least 3 characters.' });
  }

  const safePriority = ['Low', 'Medium', 'High', 'Critical'].includes(priority) ? priority : 'Medium';
  let resolvedAssigneeId = req.user.id;
  if (assigneeId !== null && assigneeId !== undefined && assigneeId !== '') {
    const parsedAssignee = parsePositiveId(assigneeId);
    if (!parsedAssignee) return res.status(400).json({ error: 'Invalid assignee ID.' });
    const memberExists = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(access.project.team_id, parsedAssignee);
    if (!memberExists) return res.status(400).json({ error: 'Assignee must be a member of the project team.' });
    resolvedAssigneeId = parsedAssignee;
  }

  db.prepare(
    `INSERT INTO project_tasks (project_id, title, description, status, assignee_id, priority, due_date)
     VALUES (?, ?, ?, 'Todo', ?, ?, ?)`
  ).run(projectId, String(title).trim(), String(description).trim(), resolvedAssigneeId, safePriority, String(dueDate || '').trim());

  return res.status(201).json({ message: 'Task added to board.' });
});

router.patch('/tasks/:taskId', (req, res) => {
  const taskId = parsePositiveId(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'Invalid task ID.' });

  const { status } = req.body || {};
  if (!['Todo', 'In Progress', 'Review', 'Done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid Kanban column.' });
  }

  const task = db.prepare('SELECT id, project_id FROM project_tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  const access = getProjectWithAccessCheck(task.project_id, req.user);
  if (access.error) return res.status(access.errorStatus).json({ error: access.error });

  db.prepare('UPDATE project_tasks SET status = ? WHERE id = ?').run(status, taskId);
  return res.json({ message: 'Task moved.' });
});

router.post('/:projectId/deliverables', uploadMiddleware.single('file'), (req, res) => {
  const projectId = parsePositiveId(req.params.projectId);
  if (!projectId) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid project ID.' });
  }

  const access = getProjectWithAccessCheck(projectId, req.user);
  if (access.error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(access.errorStatus).json({ error: access.error });
  }

  const { title, description = '' } = req.body || {};
  if (!title || String(title).trim().length < 3) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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
  const projectId = parsePositiveId(req.params.projectId);
  if (!projectId) return res.status(400).json({ error: 'Invalid project ID.' });

  const access = getProjectWithAccessCheck(projectId, req.user);
  if (access.error) return res.status(access.errorStatus).json({ error: access.error });

  const { facultyId, message = '' } = req.body || {};
  const parsedFacultyId = parsePositiveId(facultyId);
  if (!parsedFacultyId) return res.status(400).json({ error: 'Valid faculty mentor ID is required.' });

  const facultyUser = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'faculty' AND deleted_at IS NULL").get(parsedFacultyId);
  if (!facultyUser) return res.status(404).json({ error: 'Faculty mentor not found.' });

  const project = access.project;
  const existing = db
    .prepare('SELECT id FROM mentor_assignments WHERE project_id = ? AND faculty_id = ?')
    .get(projectId, parsedFacultyId);
  if (existing) return res.status(409).json({ error: 'Mentorship request already sent to this faculty mentor.' });

  db.prepare(
    `INSERT INTO mentor_assignments (project_id, challenge_id, faculty_id, status, message)
     VALUES (?, ?, ?, 'Requested', ?)`
  ).run(projectId, project.challenge_id, parsedFacultyId, String(message).trim());

  createNotification(
    parsedFacultyId,
    `Mentorship Request: ${project.title}`,
    `${req.user.name} requested your faculty mentorship for their civic innovation project.`,
    '/faculty/mentorship'
  );

  return res.status(201).json({ message: 'Mentorship request sent.' });
});

export default router;
