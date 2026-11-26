import express from 'express';
import db, { logAudit } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('industry', 'admin'));

router.get('/dashboard', (req, res) => {
  let profile = db.prepare('SELECT * FROM industry_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) {
    db.prepare(
      `INSERT INTO industry_profiles (user_id, organization_name, sector, csr_focus, verified)
       VALUES (?, ?, 'Civic Technology', 'Student Prototypes', 1)`
    ).run(req.user.id, req.user.institution_or_org || 'Partner Organization');
    profile = db.prepare('SELECT * FROM industry_profiles WHERE user_id = ?').get(req.user.id);
  }

  const challenges = db
    .prepare(
      `SELECT ch.*, d.name AS department_name
       FROM civic_challenges ch
       LEFT JOIN departments d ON ch.department_id = d.id
       WHERE ch.approval_status = 'Approved'
       ORDER BY ch.created_at DESC`
    )
    .all()
    .map((c) => ({ ...c, skillsRequired: safeParse(c.skills_required_json, []) }));

  // Consent-based student team visibility: ONLY expose student details when consent_industry_share = 1
  const teams = db
    .prepare(
      `SELECT t.*, ch.title AS challenge_title, ch.challenge_code,
              p.id AS project_id, p.title AS project_title, p.pilot_approved
       FROM teams t
       LEFT JOIN civic_challenges ch ON t.challenge_id = ch.id
       LEFT JOIN projects p ON p.team_id = t.id
       ORDER BY t.created_at DESC`
    )
    .all()
    .map((t) => {
      const members = db
        .prepare(
          `SELECT tm.project_role, u.name, sp.university, sp.degree, sp.skills_json, sp.consent_industry_share
           FROM team_members tm
           JOIN users u ON tm.user_id = u.id
           LEFT JOIN student_profiles sp ON u.id = sp.user_id
           WHERE tm.team_id = ?`
        )
        .all(t.id)
        .map((m) => {
          if (!m.consent_industry_share) {
            return {
              project_role: m.project_role,
              name: 'Student Member (Profile Private — Consent Not Granted)',
              university: 'Consent Required',
              skills: [],
              consented: false,
            };
          }
          return {
            project_role: m.project_role,
            name: m.name,
            university: m.university,
            degree: m.degree,
            skills: safeParse(m.skills_json, []),
            consented: true,
          };
        });
      return { ...t, members };
    });

  const myInterests = db
    .prepare(
      `SELECT ii.*, ch.title AS challenge_title, p.title AS project_title
       FROM industry_interests ii
       LEFT JOIN civic_challenges ch ON ii.challenge_id = ch.id
       LEFT JOIN projects p ON ii.project_id = p.id
       WHERE ii.partner_id = ?
       ORDER BY ii.created_at DESC`
    )
    .all(req.user.id);

  return res.json({ profile, challenges, teams, myInterests });
});

router.put('/profile', (req, res) => {
  const { organizationName = '', sector = '', csrFocus = '', website = '' } = req.body || {};
  db.prepare(
    `UPDATE industry_profiles SET organization_name = ?, sector = ?, csr_focus = ?, website = ? WHERE user_id = ?`
  ).run(String(organizationName).trim(), String(sector).trim(), String(csrFocus).trim(), String(website).trim(), req.user.id);
  return res.json({ message: 'Partner profile updated.' });
});

router.post('/interests', (req, res) => {
  const { challengeId = null, projectId = null, supportType, message } = req.body || {};
  if (!supportType || !message || String(message).trim().length < 10) {
    return res.status(400).json({ error: 'Support type and a clear message (min 10 chars) are required.' });
  }

  let parsedChallengeId = null;
  if (challengeId !== null && challengeId !== undefined && challengeId !== '') {
    parsedChallengeId = Number(challengeId);
    if (!Number.isInteger(parsedChallengeId) || parsedChallengeId <= 0) {
      return res.status(400).json({ error: 'Invalid challenge ID.' });
    }
    const ch = db.prepare("SELECT id FROM civic_challenges WHERE id = ? AND approval_status = 'Approved'").get(parsedChallengeId);
    if (!ch) return res.status(404).json({ error: 'Approved challenge not found.' });
  }

  let parsedProjectId = null;
  if (projectId !== null && projectId !== undefined && projectId !== '') {
    parsedProjectId = Number(projectId);
    if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
      return res.status(400).json({ error: 'Invalid project ID.' });
    }
    const proj = db.prepare('SELECT id FROM projects WHERE id = ?').get(parsedProjectId);
    if (!proj) return res.status(404).json({ error: 'Project not found.' });
  }

  const result = db
    .prepare(
      `INSERT INTO industry_interests (partner_id, challenge_id, project_id, support_type, message, status)
       VALUES (?, ?, ?, ?, ?, 'Submitted')`
    )
    .run(req.user.id, parsedChallengeId, parsedProjectId, String(supportType).trim(), String(message).trim());

  logAudit(req.user.id, req.user.role, 'EXPRESS_CSR_INTEREST', 'industry_interests', result.lastInsertRowid, {
    supportType,
    challengeId: parsedChallengeId,
    projectId: parsedProjectId,
  });

  return res.status(201).json({ message: 'Partnership support offer recorded. Public-sector pilots remain subject to official government approval.' });
});

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default router;
