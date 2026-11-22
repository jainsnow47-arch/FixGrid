import express from 'express';
import db, { createNotification } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('student', 'admin'));

router.get('/', (req, res) => {
  const myTeams = db
    .prepare(
      `SELECT t.*, ch.title AS challenge_title, ch.challenge_code, tm.project_role AS my_role
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       LEFT JOIN civic_challenges ch ON t.challenge_id = ch.id
       WHERE tm.user_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(req.user.id)
    .map((t) => {
      const members = db
        .prepare(
          `SELECT tm.user_id, tm.project_role, u.name, u.institution_or_org, sp.skills_json
           FROM team_members tm
           JOIN users u ON tm.user_id = u.id
           LEFT JOIN student_profiles sp ON u.id = sp.user_id
           WHERE tm.team_id = ?`
        )
        .all(t.id)
        .map((m) => ({ ...m, skills: safeParse(m.skills_json, []) }));
      return { ...t, members };
    });

  const incomingInvitations = db
    .prepare(
      `SELECT ti.*, t.name AS team_name, u.name AS invited_by_name
       FROM team_invitations ti
       JOIN teams t ON ti.team_id = t.id
       JOIN users u ON ti.invited_by = u.id
       WHERE ti.invited_user_id = ?
       ORDER BY ti.created_at DESC`
    )
    .all(req.user.id);

  const peerStudents = db
    .prepare(
      `SELECT u.id, u.name, u.institution_or_org, u.city, sp.degree, sp.year_of_study, sp.skills_json
       FROM users u
       LEFT JOIN student_profiles sp ON u.id = sp.user_id
       WHERE u.role = 'student' AND u.id != ? AND u.deleted_at IS NULL`
    )
    .all(req.user.id)
    .map((s) => ({ ...s, skills: safeParse(s.skills_json, []) }));

  const challenges = db
    .prepare("SELECT id, challenge_code, title FROM civic_challenges WHERE approval_status = 'Approved'")
    .all();

  return res.json({ myTeams, incomingInvitations, peerStudents, challenges });
});

router.post('/', (req, res) => {
  const { name, description = '', challengeId = null, myRole = 'Team Lead' } = req.body || {};
  if (!name || String(name).trim().length < 3) {
    return res.status(400).json({ error: 'Team name must be at least 3 characters.' });
  }

  const result = db
    .prepare('INSERT INTO teams (name, description, challenge_id, leader_id, max_members) VALUES (?, ?, ?, ?, 5)')
    .run(String(name).trim(), String(description).trim(), challengeId ? Number(challengeId) : null, req.user.id);

  const teamId = result.lastInsertRowid;
  db.prepare('INSERT INTO team_members (team_id, user_id, project_role) VALUES (?, ?, ?)').run(
    teamId,
    req.user.id,
    String(myRole).trim()
  );

  return res.status(201).json({ teamId, message: 'Team created.' });
});

router.post('/:teamId/invite', (req, res) => {
  const teamId = Number(req.params.teamId);
  const { invitedUserId, proposedRole = 'Technical Contributor' } = req.body || {};

  const member = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Only team members can invite peers.' });

  const alreadyInTeam = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, Number(invitedUserId));
  if (alreadyInTeam) return res.status(409).json({ error: 'Student is already on this team.' });

  const pendingInvite = db
    .prepare("SELECT id FROM team_invitations WHERE team_id = ? AND invited_user_id = ? AND status = 'Pending'")
    .get(teamId, Number(invitedUserId));
  if (pendingInvite) return res.status(409).json({ error: 'An invitation is already pending for this student.' });

  const team = db.prepare('SELECT name FROM teams WHERE id = ?').get(teamId);
  db.prepare(
    `INSERT INTO team_invitations (team_id, invited_user_id, invited_by, proposed_role, status)
     VALUES (?, ?, ?, ?, 'Pending')`
  ).run(teamId, Number(invitedUserId), req.user.id, String(proposedRole).trim());

  createNotification(
    Number(invitedUserId),
    `Team Invitation: ${team?.name}`,
    `${req.user.name} invited you to join as ${proposedRole}.`,
    '/student/teams'
  );

  return res.status(201).json({ message: 'Invitation sent.' });
});

router.post('/invitations/:invId/respond', (req, res) => {
  const invId = Number(req.params.invId);
  const { decision } = req.body || {};
  if (!['Accepted', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be Accepted or Rejected.' });
  }

  const inv = db.prepare('SELECT * FROM team_invitations WHERE id = ? AND invited_user_id = ?').get(invId, req.user.id);
  if (!inv) return res.status(404).json({ error: 'Invitation not found.' });

  db.prepare('UPDATE team_invitations SET status = ? WHERE id = ?').run(decision, invId);

  if (decision === 'Accepted') {
    const already = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(inv.team_id, req.user.id);
    if (!already) {
      db.prepare('INSERT INTO team_members (team_id, user_id, project_role) VALUES (?, ?, ?)').run(
        inv.team_id,
        req.user.id,
        inv.proposed_role
      );
    }
  }

  createNotification(
    inv.invited_by,
    `Team Invitation ${decision}`,
    `${req.user.name} ${decision.toLowerCase()} your team invitation.`,
    '/student/teams'
  );

  return res.json({ message: `Invitation ${decision.toLowerCase()}.` });
});

router.patch('/:teamId/members/:userId', (req, res) => {
  const teamId = Number(req.params.teamId);
  const targetUserId = Number(req.params.userId);
  const { projectRole } = req.body || {};

  const team = db.prepare('SELECT leader_id FROM teams WHERE id = ?').get(teamId);
  if (!team || team.leader_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the team leader can assign project roles.' });
  }

  db.prepare('UPDATE team_members SET project_role = ? WHERE team_id = ? AND user_id = ?').run(
    String(projectRole || 'Contributor').trim(),
    teamId,
    targetUserId
  );
  return res.json({ message: 'Member role updated.' });
});

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default router;
