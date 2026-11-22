import express from 'express';
import bcrypt from 'bcryptjs';
import db, { logAudit } from '../config/db.js';
import { ROLES } from '../config/constants.js';
import { rateLimit, requireAuth, signToken } from '../middleware/auth.js';

const router = express.Router();
router.use(rateLimit({ windowMs: 60000, max: 50 }));

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    institutionOrOrg: row.institution_or_org,
    city: row.city,
    ward: row.ward,
    verified: Boolean(row.verified),
    createdAt: row.created_at,
  };
}

router.post('/register', (req, res) => {
  const { name, email, password, role, institutionOrOrg = '', city = 'Mathura', ward = '' } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Please provide a valid full name.' });
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  // Self-registration supports Citizen, Student, Faculty, Industry; Admin/Gov require Admin review or Demo mode
  const requestedRole = ROLES.includes(role) ? role : 'citizen';
  const safeRole = ['admin', 'government'].includes(requestedRole) ? 'citizen' : requestedRole;

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, institution_or_org, city, ward, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name.trim(), cleanEmail, passwordHash, safeRole, String(institutionOrOrg).trim(), String(city).trim(), String(ward).trim(), safeRole === 'citizen' ? 1 : 0);

  const userId = result.lastInsertRowid;

  if (safeRole === 'student') {
    db.prepare(
      `INSERT INTO student_profiles (user_id, university, degree, year_of_study, skills_json, interests_json, experience_summary, availability_hours, city, consent_industry_share)
       VALUES (?, ?, 'Undergraduate', '2nd Year', '[]', '[]', '', 10, ?, 0)`
    ).run(userId, String(institutionOrOrg).trim() || 'Local University', String(city).trim() || 'Mathura');
  } else if (safeRole === 'faculty') {
    db.prepare(
      `INSERT INTO faculty_profiles (user_id, institution, department, specialization, bio, verified)
       VALUES (?, ?, 'Engineering & Civic Systems', 'Civic Infrastructure', '', 0)`
    ).run(userId, String(institutionOrOrg).trim() || 'Academic Institution');
  } else if (safeRole === 'industry') {
    db.prepare(
      `INSERT INTO industry_profiles (user_id, organization_name, sector, csr_focus, verified)
       VALUES (?, ?, 'Technology & Infrastructure', 'Community Innovation', 0)`
    ).run(userId, String(institutionOrOrg).trim() || 'Partner Organization');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  logAudit(userId, safeRole, 'USER_REGISTER', 'users', userId, { role: safeRole });

  return res.status(201).json({
    token: signToken(user),
    user: sanitizeUser(user),
    note: requestedRole !== safeRole ? 'Government and Admin accounts are provisioned by Platform Governance; registered as Citizen.' : undefined,
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(String(email).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  logAudit(user.id, user.role, 'USER_LOGIN', 'users', user.id, { method: 'password' });
  return res.json({
    token: signToken(user),
    user: sanitizeUser(user),
  });
});

router.post('/demo-login', (req, res) => {
  if (process.env.DEMO_MODE === 'false') {
    return res.status(403).json({ error: 'Demo login is disabled in this environment.' });
  }
  const { role } = req.body || {};
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid demo role requested.' });
  }

  const demoEmails = {
    citizen: 'aarav@citizen.demo',
    government: 'priya.ias@mathura.demo',
    student: 'rohan.cs@gla.demo',
    faculty: 'dr.mehta@gla.demo',
    industry: 'kavita.csr@brijtech.demo',
    admin: 'admin@fixgrid.demo',
  };

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(demoEmails[role]);
  if (!user) {
    return res.status(404).json({ error: 'Demo account not found.' });
  }

  logAudit(user.id, user.role, 'DEMO_LOGIN', 'users', user.id, { role });
  return res.json({
    token: signToken(user),
    user: sanitizeUser(user),
  });
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

export default router;
