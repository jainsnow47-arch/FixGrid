import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import db, { getAdminBootstrapStatus, logAudit } from '../config/db.js';
import { ROLES } from '../config/constants.js';
import { rateLimit, requireAuth, signToken } from '../middleware/auth.js';

const router = express.Router();
router.use(rateLimit({ windowMs: 60000, max: 50 }));

const PUBLIC_REGISTER_ROLES = ['citizen', 'student', 'faculty', 'industry'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    accountStatus: row.account_status || 'active',
    createdAt: row.created_at,
  };
}

function hashActivationCode(code) {
  return crypto.createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');
}

function verifyActivationCode(code, storedHash) {
  if (!code || !storedHash) return false;
  const candidate = Buffer.from(hashActivationCode(code), 'hex');
  const expected = Buffer.from(String(storedHash), 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

router.post('/register', (req, res) => {
  const { name, email, password, role = 'citizen', institutionOrOrg = '', city = 'Mathura', ward = '' } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Please provide a valid full name.' });
  }
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : 'citizen';

  // Strictly block public registration for Government Official and Platform Admin accounts
  if (normalizedRole === 'government' || normalizedRole === 'admin') {
    return res.status(403).json({
      error: 'Government and administrative accounts are created or authorized by the FixGrid platform administrator.',
    });
  }

  if (!PUBLIC_REGISTER_ROLES.includes(normalizedRole)) {
    return res.status(400).json({ error: 'Invalid account role selected.' });
  }

  const cleanOrg = String(institutionOrOrg || '').trim();
  if (normalizedRole === 'faculty' && cleanOrg.length < 2) {
    return res.status(400).json({
      error: 'Please provide your University or Academic Institution name for institutional verification.',
    });
  }
  if (normalizedRole === 'industry' && cleanOrg.length < 2) {
    return res.status(400).json({
      error: 'Please provide your Organization or CSR Foundation name for organization verification.',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const autoVerified = normalizedRole === 'citizen' || normalizedRole === 'student' ? 1 : 0;

  const createAccount = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, institution_or_org, city, ward, verified, account_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      )
      .run(
        name.trim(),
        cleanEmail,
        passwordHash,
        normalizedRole,
        cleanOrg,
        String(city || 'Mathura').trim(),
        String(ward || '').trim(),
        autoVerified
      );

    const userId = result.lastInsertRowid;

    if (normalizedRole === 'student') {
      db.prepare(
        `INSERT INTO student_profiles (user_id, university, degree, year_of_study, skills_json, interests_json, experience_summary, availability_hours, city, consent_industry_share)
         VALUES (?, ?, 'Undergraduate', '2nd Year', '[]', '[]', '', 10, ?, 0)`
      ).run(userId, cleanOrg || 'Local University', String(city || 'Mathura').trim());
    } else if (normalizedRole === 'faculty') {
      db.prepare(
        `INSERT INTO faculty_profiles (user_id, institution, department, specialization, bio, verified)
         VALUES (?, ?, 'Engineering & Civic Systems', 'Civic Infrastructure', '', 0)`
      ).run(userId, cleanOrg);
    } else if (normalizedRole === 'industry') {
      db.prepare(
        `INSERT INTO industry_profiles (user_id, organization_name, sector, csr_focus, verified)
         VALUES (?, ?, 'Technology & Infrastructure', 'Community Innovation', 0)`
      ).run(userId, cleanOrg);
    }

    return userId;
  });

  const userId = createAccount();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  logAudit(userId, normalizedRole, 'USER_REGISTER', 'users', userId, {
    role: normalizedRole,
    verified: Boolean(autoVerified),
  });

  let note;
  if (normalizedRole === 'faculty') {
    note = 'Account created. Institutional verification is pending administrator review.';
  } else if (normalizedRole === 'industry') {
    note = 'Account created. Organization verification is pending administrator review.';
  }

  return res.status(201).json({
    token: signToken(user),
    user: sanitizeUser(user),
    note,
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .get(String(email).trim().toLowerCase());

  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.account_status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended by the platform administrator.' });
  }
  if (user.account_status === 'invited') {
    return res.status(403).json({
      error: 'Account activation is required before signing in. Use the Government Official activation tab with your invite code.',
    });
  }
  if (user.role === 'government' && !user.verified) {
    return res.status(403).json({
      error: 'Your Government Official account is awaiting verification by the FixGrid platform administrator.',
    });
  }

  logAudit(user.id, user.role, 'USER_LOGIN', 'users', user.id, { method: 'password' });
  return res.json({
    token: signToken(user),
    user: sanitizeUser(user),
  });
});

// Dedicated Government Official login endpoint
router.post('/government/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Authorized official email and password are required.' });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .get(String(email).trim().toLowerCase());

  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid official email or password.' });
  }

  if (user.role !== 'government') {
    return res.status(403).json({
      error: 'This portal is restricted to authorized Government Officials. Please use the standard Sign In tab.',
    });
  }

  if (user.account_status === 'suspended') {
    return res.status(403).json({ error: 'This Government Official account has been suspended by the platform administrator.' });
  }

  if (user.account_status === 'invited') {
    return res.status(403).json({
      error: 'Please activate your invited Government Official account first using your administrator invitation code.',
    });
  }

  if (!user.verified) {
    return res.status(403).json({
      error: 'Your Government Official account requires administrator verification before accessing municipal operations.',
    });
  }

  logAudit(user.id, user.role, 'GOV_LOGIN', 'users', user.id, { method: 'government-portal' });
  return res.json({
    token: signToken(user),
    user: sanitizeUser(user),
  });
});

// Activate an admin-invited Government Official account using one-time code + new password
router.post('/government/activate', (req, res) => {
  const { email, activationCode, password } = req.body || {};
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: 'Please enter your authorized government email address.' });
  }
  if (!activationCode || String(activationCode).trim().length < 6) {
    return res.status(400).json({ error: 'Please enter the activation code provided by your platform administrator.' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Please choose a password of at least 8 characters.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = db
    .prepare("SELECT * FROM users WHERE email = ? AND role = 'government' AND deleted_at IS NULL")
    .get(cleanEmail);

  if (!user || user.account_status !== 'invited' || !user.activation_token_hash) {
    return res.status(400).json({ error: 'No pending Government Official invitation was found for this email.' });
  }

  if (user.activation_expires_at && new Date(user.activation_expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'This activation code has expired. Ask the platform administrator to issue a new invite.' });
  }

  if (!verifyActivationCode(activationCode, user.activation_token_hash)) {
    return res.status(401).json({ error: 'Invalid activation code. Please check the code provided by the administrator.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    `UPDATE users
     SET password_hash = ?, verified = 1, account_status = 'active',
         activation_token_hash = NULL, activation_expires_at = NULL
     WHERE id = ?`
  ).run(passwordHash, user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  logAudit(user.id, 'government', 'GOV_ACCOUNT_ACTIVATED', 'users', user.id, {
    email: cleanEmail,
    invitedBy: user.invited_by || null,
  });

  return res.json({
    token: signToken(updated),
    user: sanitizeUser(updated),
    message: 'Government Official account activated and verified.',
  });
});

// Admin bootstrap status & one-time claim (only active when ADMIN_PASSWORD env var is unset and unclaimed)
router.get('/admin/status', (_req, res) => {
  return res.json(getAdminBootstrapStatus());
});

router.post('/admin/claim', (req, res) => {
  const status = getAdminBootstrapStatus();
  if (!status.canClaimAdminSetup) {
    return res.status(403).json({
      error: 'Administrator credentials are already configured. Please sign in with your administrator email and password.',
    });
  }

  const { name = 'Platform Administrator', email, password } = req.body || {};
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Please provide a valid administrator email address.' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Administrator password must be at least 8 characters.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = String(name || 'Platform Administrator').trim();
  const passwordHash = bcrypt.hashSync(password, 10);

  const claimTx = db.transaction(() => {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    let adminId;
    if (existing) {
      db.prepare(
        `UPDATE users
         SET name = ?, password_hash = ?, role = 'admin', verified = 1, account_status = 'active', deleted_at = NULL
         WHERE id = ?`
      ).run(cleanName, passwordHash, existing.id);
      adminId = existing.id;
    } else {
      adminId = db
        .prepare(
          `INSERT INTO users (name, email, password_hash, role, institution_or_org, city, ward, verified, account_status)
           VALUES (?, ?, ?, 'admin', 'FixGrid Platform Governance', 'Mathura', 'Platform HQ', 1, 'active')`
        )
        .run(cleanName, cleanEmail, passwordHash).lastInsertRowid;
    }

    db.prepare(
      `INSERT INTO platform_settings (key, value_json, updated_at)
       VALUES ('admin_bootstrap_claimed', 'true', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value_json = 'true', updated_at = datetime('now')`
    ).run();

    return adminId;
  });

  const adminId = claimTx();
  const adminUser = db.prepare('SELECT * FROM users WHERE id = ?').get(adminId);
  logAudit(adminId, 'admin', 'ADMIN_BOOTSTRAP_CLAIMED', 'users', adminId, { email: cleanEmail });

  return res.status(201).json({
    token: signToken(adminUser),
    user: sanitizeUser(adminUser),
    message: 'Platform Administrator account initialized securely.',
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

  const user = db
    .prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL AND (account_status IS NULL OR account_status = 'active')")
    .get(demoEmails[role]);
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
