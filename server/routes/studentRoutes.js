import express from 'express';
import db, { createNotification, logAudit } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { computeExplainableMatch } from '../services/matchingService.js';

const router = express.Router();
router.use(requireAuth, requireRole('student', 'admin'));

function getOrCreateProfile(user) {
  let profile = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(user.id);
  if (!profile) {
    db.prepare(
      `INSERT INTO student_profiles (user_id, university, degree, year_of_study, skills_json, interests_json, experience_summary, availability_hours, city, consent_industry_share)
       VALUES (?, ?, 'B.Tech', '2nd Year', '[]', '[]', '', 10, ?, 0)`
    ).run(user.id, user.institution_or_org || 'GLA University, Mathura', user.city || 'Mathura');
    profile = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(user.id);
  }
  return profile;
}

router.get('/dashboard', (req, res) => {
  const profile = getOrCreateProfile(req.user);
  const challenges = db
    .prepare(
      `SELECT ch.*, d.name AS department_name
       FROM civic_challenges ch
       LEFT JOIN departments d ON ch.department_id = d.id
       WHERE ch.approval_status = 'Approved'
       ORDER BY ch.created_at DESC`
    )
    .all();

  const recommendations = challenges
    .map((ch) => ({
      ...ch,
      skillsRequired: safeParse(ch.skills_required_json, []),
      deliverables: safeParse(ch.deliverables_json, []),
      match: computeExplainableMatch(profile, req.user, ch),
    }))
    .sort((a, b) => b.match.overallScore - a.match.overallScore);

  const myTeams = db
    .prepare(
      `SELECT t.*, tm.project_role
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = ?`
    )
    .all(req.user.id);

  const invitations = db
    .prepare(
      `SELECT ti.*, t.name AS team_name, u.name AS invited_by_name
       FROM team_invitations ti
       JOIN teams t ON ti.team_id = t.id
       JOIN users u ON ti.invited_by = u.id
       WHERE ti.invited_user_id = ? AND ti.status = 'Pending'`
    )
    .all(req.user.id);

  const activeProjects = db
    .prepare(
      `SELECT p.*, ch.title AS challenge_title, ch.challenge_code, t.name AS team_name
       FROM projects p
       JOIN civic_challenges ch ON p.challenge_id = ch.id
       JOIN teams t ON p.team_id = t.id
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = ?`
    )
    .all(req.user.id);

  const applications = db
    .prepare(
      `SELECT ca.*, ch.title AS challenge_title, ch.challenge_code
       FROM challenge_applications ca
       JOIN civic_challenges ch ON ca.challenge_id = ch.id
       WHERE ca.applicant_user_id = ?
       ORDER BY ca.created_at DESC`
    )
    .all(req.user.id);

  const passportCount = db
    .prepare('SELECT COUNT(*) AS c FROM contribution_records WHERE student_id = ? AND verified_at IS NOT NULL')
    .get(req.user.id).c;

  return res.json({
    profile: {
      ...profile,
      skills: safeParse(profile.skills_json, []),
      interests: safeParse(profile.interests_json, []),
      consentIndustryShare: Boolean(profile.consent_industry_share),
    },
    recommendations: recommendations.slice(0, 4),
    myTeams,
    invitations,
    activeProjects,
    applications,
    passportCount,
  });
});

router.get('/profile', (req, res) => {
  const profile = getOrCreateProfile(req.user);
  return res.json({
    user: req.user,
    profile: {
      ...profile,
      skills: safeParse(profile.skills_json, []),
      interests: safeParse(profile.interests_json, []),
      consentIndustryShare: Boolean(profile.consent_industry_share),
    },
  });
});

router.put('/profile', (req, res) => {
  getOrCreateProfile(req.user);
  const {
    university = '',
    degree = '',
    yearOfStudy = '',
    skills = [],
    interests = [],
    experienceSummary = '',
    availabilityHours = 10,
    city = 'Mathura',
    consentIndustryShare = false,
  } = req.body || {};

  db.prepare(
    `UPDATE student_profiles
     SET university = ?, degree = ?, year_of_study = ?, skills_json = ?,
         interests_json = ?, experience_summary = ?, availability_hours = ?,
         city = ?, consent_industry_share = ?, updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(
    String(university).trim(),
    String(degree).trim(),
    String(yearOfStudy).trim(),
    JSON.stringify(Array.isArray(skills) ? skills : []),
    JSON.stringify(Array.isArray(interests) ? interests : []),
    String(experienceSummary).trim(),
    Math.min(40, Math.max(1, Number(availabilityHours) || 10)),
    String(city).trim(),
    consentIndustryShare ? 1 : 0,
    req.user.id
  );

  logAudit(req.user.id, req.user.role, 'UPDATE_STUDENT_PROFILE', 'student_profiles', req.user.id, {
    consentIndustryShare: Boolean(consentIndustryShare),
  });

  return res.json({ message: 'Student profile and consent preference saved.' });
});

router.get('/challenges', (req, res) => {
  const profile = getOrCreateProfile(req.user);
  const challenges = db
    .prepare(
      `SELECT ch.*, d.name AS department_name, c.tracking_code AS source_complaint_code
       FROM civic_challenges ch
       LEFT JOIN departments d ON ch.department_id = d.id
       LEFT JOIN complaints c ON ch.complaint_id = c.id
       WHERE ch.approval_status = 'Approved'
       ORDER BY ch.created_at DESC`
    )
    .all();

  const savedRows = db.prepare('SELECT challenge_id FROM saved_challenges WHERE user_id = ?').all(req.user.id);
  const savedSet = new Set(savedRows.map((s) => s.challenge_id));

  const appliedRows = db.prepare('SELECT challenge_id, status FROM challenge_applications WHERE applicant_user_id = ?').all(req.user.id);
  const appliedMap = new Map(appliedRows.map((a) => [a.challenge_id, a.status]));

  const list = challenges
    .map((ch) => ({
      ...ch,
      skillsRequired: safeParse(ch.skills_required_json, []),
      deliverables: safeParse(ch.deliverables_json, []),
      saved: savedSet.has(ch.id),
      applicationStatus: appliedMap.get(ch.id) || null,
      match: computeExplainableMatch(profile, req.user, ch),
    }))
    .sort((a, b) => b.match.overallScore - a.match.overallScore);

  return res.json({ challenges: list });
});

router.post('/challenges/:id/save', (req, res) => {
  const challengeId = Number(req.params.id);
  const exists = db.prepare('SELECT 1 FROM saved_challenges WHERE user_id = ? AND challenge_id = ?').get(req.user.id, challengeId);
  if (exists) {
    db.prepare('DELETE FROM saved_challenges WHERE user_id = ? AND challenge_id = ?').run(req.user.id, challengeId);
    return res.json({ saved: false });
  }
  db.prepare('INSERT INTO saved_challenges (user_id, challenge_id) VALUES (?, ?)').run(req.user.id, challengeId);
  return res.json({ saved: true });
});

router.post('/challenges/:id/apply', (req, res) => {
  const challengeId = Number(req.params.id);
  const { teamId = null, proposalSummary = '' } = req.body || {};

  if (!proposalSummary || String(proposalSummary).trim().length < 20) {
    return res.status(400).json({ error: 'Please write at least 20 characters explaining your technical approach.' });
  }

  const challenge = db.prepare("SELECT * FROM civic_challenges WHERE id = ? AND approval_status = 'Approved'").get(challengeId);
  if (!challenge) return res.status(404).json({ error: 'Approved challenge not found.' });

  // Prevent duplicate applications
  const duplicateApp = db
    .prepare('SELECT id FROM challenge_applications WHERE challenge_id = ? AND applicant_user_id = ?')
    .get(challengeId, req.user.id);
  if (duplicateApp) {
    return res.status(409).json({ error: 'You have already applied to this challenge.' });
  }

  if (teamId) {
    const member = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(Number(teamId), req.user.id);
    if (!member) return res.status(403).json({ error: 'You can only apply with a team you belong to.' });
  }

  const profile = getOrCreateProfile(req.user);
  const match = computeExplainableMatch(profile, req.user, challenge);

  const result = db
    .prepare(
      `INSERT INTO challenge_applications (challenge_id, applicant_user_id, team_id, proposal_summary, status, match_score, match_breakdown_json)
       VALUES (?, ?, ?, ?, 'Pending Review', ?, ?)`
    )
    .run(challengeId, req.user.id, teamId ? Number(teamId) : null, String(proposalSummary).trim(), match.overallScore, JSON.stringify(match.breakdown));

  const govUsers = db.prepare("SELECT id FROM users WHERE role = 'government' AND deleted_at IS NULL").all();
  for (const g of govUsers) {
    createNotification(
      g.id,
      `New Proposal for ${challenge.challenge_code}`,
      `${req.user.name} submitted a challenge proposal (${match.overallScore}% skill match).`,
      '/government/challenges'
    );
  }

  return res.status(201).json({
    applicationId: result.lastInsertRowid,
    matchScore: match.overallScore,
    message: 'Application submitted for government & faculty review.',
  });
});

// Student Contribution Passport (platform-verified record, not a government credential)
router.get('/passport', (req, res) => {
  const profile = getOrCreateProfile(req.user);
  const records = db
    .prepare(
      `SELECT cr.*, p.title AS project_title, ch.challenge_code, ch.title AS challenge_title,
              f.name AS verifier_name, fp.institution AS verifier_institution
       FROM contribution_records cr
       JOIN projects p ON cr.project_id = p.id
       JOIN civic_challenges ch ON p.challenge_id = ch.id
       LEFT JOIN users f ON cr.verified_by_faculty_id = f.id
       LEFT JOIN faculty_profiles fp ON f.id = fp.user_id
       WHERE cr.student_id = ?
       ORDER BY cr.created_at DESC`
    )
    .all(req.user.id);

  return res.json({
    disclaimer: 'FixGrid AI Contribution Passport is a platform-verified portfolio record, not an official government-issued credential.',
    student: {
      name: req.user.name,
      institution: profile.university,
      degree: profile.degree,
      yearOfStudy: profile.year_of_study,
      skills: safeParse(profile.skills_json, []),
    },
    records: records.map((r) => ({
      ...r,
      skillsDemonstrated: safeParse(r.skills_json, []),
    })),
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
