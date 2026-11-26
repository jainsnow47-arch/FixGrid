import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import {
  DEFAULT_MATCH_WEIGHTS,
  DEFAULT_SLA_RULES,
  ISSUE_CATEGORIES,
} from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const dataDir = path.join(projectRoot, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'fixgrid.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      institution_or_org TEXT DEFAULT '',
      city TEXT DEFAULT 'Mathura',
      ward TEXT DEFAULT '',
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      university TEXT NOT NULL DEFAULT '',
      degree TEXT NOT NULL DEFAULT '',
      year_of_study TEXT NOT NULL DEFAULT '',
      skills_json TEXT NOT NULL DEFAULT '[]',
      interests_json TEXT NOT NULL DEFAULT '[]',
      experience_summary TEXT NOT NULL DEFAULT '',
      availability_hours INTEGER NOT NULL DEFAULT 10,
      city TEXT NOT NULL DEFAULT 'Mathura',
      consent_industry_share INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS faculty_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      institution TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      specialization TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      verified INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS industry_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      organization_name TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '',
      csr_focus TEXT NOT NULL DEFAULT '',
      website TEXT DEFAULT '',
      verified INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      jurisdiction TEXT NOT NULL DEFAULT 'Mathura Demo Municipal Zone',
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issue_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      default_department_id INTEGER REFERENCES departments(id),
      default_severity TEXT NOT NULL DEFAULT 'Medium',
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sla_configurations (
      severity TEXT PRIMARY KEY,
      target_hours INTEGER NOT NULL,
      escalation_target TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_code TEXT NOT NULL UNIQUE,
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      user_selected_category TEXT NOT NULL,
      ai_predicted_category TEXT,
      ai_summary TEXT,
      severity TEXT NOT NULL,
      ai_recommended_severity TEXT,
      ai_explanation TEXT,
      ai_keywords_json TEXT NOT NULL DEFAULT '[]',
      ai_provider TEXT NOT NULL DEFAULT 'rule-based-fallback',
      ai_confidence REAL NOT NULL DEFAULT 0.72,
      embedding_json TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT NOT NULL,
      location_source TEXT NOT NULL DEFAULT 'user-supplied',
      ward TEXT DEFAULT 'Mathura Central',
      status TEXT NOT NULL DEFAULT 'Submitted',
      department_id INTEGER REFERENCES departments(id),
      assigned_official_name TEXT DEFAULT 'Pending Validation',
      sla_deadline_at TEXT,
      escalation_level INTEGER NOT NULL DEFAULT 0,
      is_overdue INTEGER NOT NULL DEFAULT 0,
      resolution_notes TEXT DEFAULT '',
      resolution_evidence_url TEXT DEFAULT '',
      citizen_feedback_rating INTEGER,
      citizen_feedback_comment TEXT DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
    CREATE INDEX IF NOT EXISTS idx_complaints_reporter ON complaints(reporter_id);

    CREATE TABLE IF NOT EXISTS complaint_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      file_url TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'image',
      original_name TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaint_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      actor_id INTEGER REFERENCES users(id),
      actor_role TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaint_duplicate_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      primary_complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      duplicate_complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      similarity_score REAL NOT NULL,
      distance_meters REAL NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending review',
      reviewed_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaint_votes (
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (complaint_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS complaint_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS escalation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      from_level INTEGER NOT NULL,
      to_level INTEGER NOT NULL,
      reason TEXT NOT NULL,
      triggered_by TEXT NOT NULL DEFAULT 'SLA Engine',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS civic_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_code TEXT NOT NULL UNIQUE,
      complaint_id INTEGER REFERENCES complaints(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      background TEXT NOT NULL,
      expected_outcome TEXT NOT NULL,
      skills_required_json TEXT NOT NULL DEFAULT '[]',
      deliverables_json TEXT NOT NULL DEFAULT '[]',
      deadline TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'Intermediate',
      department_id INTEGER REFERENCES departments(id),
      approval_status TEXT NOT NULL DEFAULT 'Pending',
      created_by INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      pilot_status TEXT NOT NULL DEFAULT 'None',
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_challenges (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_id INTEGER NOT NULL REFERENCES civic_challenges(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, challenge_id)
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      challenge_id INTEGER REFERENCES civic_challenges(id),
      leader_id INTEGER NOT NULL REFERENCES users(id),
      max_members INTEGER NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_role TEXT NOT NULL DEFAULT 'Contributor',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS team_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invited_by INTEGER NOT NULL REFERENCES users(id),
      proposed_role TEXT NOT NULL DEFAULT 'Contributor',
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS challenge_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL REFERENCES civic_challenges(id) ON DELETE CASCADE,
      applicant_user_id INTEGER NOT NULL REFERENCES users(id),
      team_id INTEGER REFERENCES teams(id),
      proposal_summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending Review',
      match_score INTEGER NOT NULL DEFAULT 0,
      match_breakdown_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL REFERENCES civic_challenges(id),
      team_id INTEGER NOT NULL REFERENCES teams(id),
      title TEXT NOT NULL,
      objectives TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active',
      pilot_approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Todo',
      assignee_id INTEGER REFERENCES users(id),
      priority TEXT NOT NULL DEFAULT 'Medium',
      due_date TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'In Progress',
      faculty_evaluation TEXT DEFAULT '',
      evaluated_by INTEGER REFERENCES users(id),
      evaluated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS project_deliverables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      file_url TEXT NOT NULL DEFAULT '',
      submitted_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mentor_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      challenge_id INTEGER REFERENCES civic_challenges(id),
      faculty_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'Requested',
      message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mentor_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id),
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contribution_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER NOT NULL REFERENCES projects(id),
      role_held TEXT NOT NULL,
      responsibilities TEXT NOT NULL,
      skills_json TEXT NOT NULL DEFAULT '[]',
      tasks_completed INTEGER NOT NULL DEFAULT 0,
      deliverables_summary TEXT NOT NULL DEFAULT '',
      verified_by_faculty_id INTEGER REFERENCES users(id),
      verification_note TEXT DEFAULT '',
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS industry_interests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL REFERENCES users(id),
      challenge_id INTEGER REFERENCES civic_challenges(id),
      project_id INTEGER REFERENCES projects(id),
      support_type TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Submitted',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER REFERENCES users(id),
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seedDemoData() {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount > 0) return;

  const demoPass = process.env.DEMO_DEFAULT_PASSWORD || 'FixGridDemo#2026';
  const passHash = bcrypt.hashSync(demoPass, 10);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, institution_or_org, city, ward, verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const citizenId = insertUser.run('Aarav Sharma', 'aarav@citizen.demo', passHash, 'citizen', 'Resident — Krishna Nagar', 'Mathura', 'Ward 14 (Krishna Nagar)', 1).lastInsertRowid;
  const govId = insertUser.run('Priya Verma', 'priya.ias@mathura.demo', passHash, 'government', 'Mathura Municipal Demo Cell', 'Mathura', 'Central Zone', 1).lastInsertRowid;
  const studentId = insertUser.run('Rohan Deshmukh', 'rohan.cs@gla.demo', passHash, 'student', 'GLA University, Mathura', 'Mathura', 'Chaumuhan', 1).lastInsertRowid;
  const student2Id = insertUser.run('Ananya Tiwari', 'ananya.iot@gla.demo', passHash, 'student', 'GLA University, Mathura', 'Mathura', 'Dampier Nagar', 1).lastInsertRowid;
  const student3Id = insertUser.run('Devendra Rajput', 'dev.civil@sanskriti.demo', passHash, 'student', 'Sanskriti University, Mathura', 'Mathura', 'Chhata', 1).lastInsertRowid;
  const facultyId = insertUser.run('Dr. Meera Kulkarni', 'dr.mehta@gla.demo', passHash, 'faculty', 'GLA University — Civil & Urban Systems', 'Mathura', 'Chaumuhan', 1).lastInsertRowid;
  const industryId = insertUser.run('Kavita Nair', 'kavita.csr@brijtech.demo', passHash, 'industry', 'Brij Infra & CSR Foundation (Demo)', 'Mathura', 'Industrial Area', 1).lastInsertRowid;
  const adminId = insertUser.run('Vikramaditya Rao', 'admin@fixgrid.demo', passHash, 'admin', 'FixGrid Platform Governance', 'Mathura', 'Platform HQ', 1).lastInsertRowid;

  const insertStudentProfile = db.prepare(`
    INSERT INTO student_profiles (user_id, university, degree, year_of_study, skills_json, interests_json, experience_summary, availability_hours, city, consent_industry_share)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStudentProfile.run(
    studentId,
    'GLA University, Mathura',
    'B.Tech Computer Science & Engineering',
    '3rd Year',
    JSON.stringify(['IoT Sensors', 'Computer Vision', 'React', 'Node.js', 'GIS Mapping', 'Data Analytics']),
    JSON.stringify(['Pothole', 'Damaged road', 'Waterlogging', 'Broken streetlight']),
    'Built a low-cost ultrasonic water-level logger for campus storm drains and a mobile road-surface tagger during a civic innovation field sprint.',
    16,
    'Mathura',
    1
  );
  insertStudentProfile.run(
    student2Id,
    'GLA University, Mathura',
    'B.Tech Electronics & Communication',
    '3rd Year',
    JSON.stringify(['Embedded Systems', 'LoRaWAN', 'Solar Power', 'PCB Design', 'Smart Lighting']),
    JSON.stringify(['Broken streetlight', 'Water leakage', 'Drainage problem']),
    'Designed solar smart-dimming LED controller prototypes with automated fault telemetry.',
    14,
    'Mathura',
    1
  );
  insertStudentProfile.run(
    student3Id,
    'Sanskriti University, Mathura',
    'B.Tech Civil Engineering',
    '4th Year',
    JSON.stringify(['Pavement Engineering', 'Drainage Design', 'AutoCAD', 'GIS Mapping', 'Material Testing']),
    JSON.stringify(['Pothole', 'Damaged road', 'Drainage problem', 'Damaged public infrastructure']),
    'Conducted permeable asphalt aggregate testing and urban stormwater runoff modeling.',
    12,
    'Mathura',
    0
  );

  db.prepare(`
    INSERT INTO faculty_profiles (user_id, institution, department, specialization, bio, verified)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    facultyId,
    'GLA University, Mathura',
    'Department of Civil & Smart Urban Systems',
    'Urban Drainage, GIS & Civic Infrastructure',
    'Faculty coordinator supervising student civic engineering pilots and verifying community contribution portfolios.',
    1
  );

  db.prepare(`
    INSERT INTO industry_profiles (user_id, organization_name, sector, csr_focus, website, verified)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    industryId,
    'Brij Infra & CSR Foundation (Demo Partner)',
    'Urban Mobility & Clean Water Tech',
    'Smart drainage sensors, solar street illumination, and student field lab grants',
    'https://example.org/brij-csr-demo',
    1
  );

  const insertDept = db.prepare(`
    INSERT INTO departments (name, code, jurisdiction, description)
    VALUES (?, ?, ?, ?)
  `);
  const deptRoad = insertDept.run('Municipal Road & Engineering Department', 'MRED', 'Mathura Urban Limits (Demo)', 'Road resurfacing, potholes, footpaths, and public civil structures.').lastInsertRowid;
  const deptSanitation = insertDept.run('Sanitation & Solid Waste Department', 'SSWD', 'Mathura Urban Limits (Demo)', 'Door-to-door collection, bin clearance, and market sanitation.').lastInsertRowid;
  const deptWater = insertDept.run('Water Supply & Pipeline Department', 'WSPD', 'Mathura Urban Limits (Demo)', 'Potable water distribution lines, valve leaks, and pressure management.').lastInsertRowid;
  const deptDrainage = insertDept.run('Stormwater & Drainage Department', 'SWDD', 'Mathura Urban Limits (Demo)', 'Culverts, open drains, desilting, and monsoon waterlogging mitigation.').lastInsertRowid;
  const deptElectrical = insertDept.run('Electrical & Streetlight Department', 'ESLD', 'Mathura Urban Limits (Demo)', 'Municipal LED poles, feeder pillars, and night-safety lighting.').lastInsertRowid;

  const deptByCategory = {
    'Pothole': { id: deptRoad, severity: 'High' },
    'Damaged road': { id: deptRoad, severity: 'High' },
    'Garbage accumulation': { id: deptSanitation, severity: 'Medium' },
    'Water leakage': { id: deptWater, severity: 'High' },
    'Drainage problem': { id: deptDrainage, severity: 'High' },
    'Broken streetlight': { id: deptElectrical, severity: 'Medium' },
    'Waterlogging': { id: deptDrainage, severity: 'Critical' },
    'Damaged public infrastructure': { id: deptRoad, severity: 'High' },
    'Other civic issues': { id: deptRoad, severity: 'Low' },
  };

  const insertCat = db.prepare(`
    INSERT INTO issue_categories (name, default_department_id, default_severity, description)
    VALUES (?, ?, ?, ?)
  `);
  for (const cat of ISSUE_CATEGORIES) {
    const map = deptByCategory[cat] || { id: deptRoad, severity: 'Medium' };
    insertCat.run(cat, map.id, map.severity, `Demo routing rule for ${cat} incidents.`);
  }

  const insertSla = db.prepare(`
    INSERT INTO sla_configurations (severity, target_hours, escalation_target)
    VALUES (?, ?, ?)
  `);
  for (const rule of DEFAULT_SLA_RULES) {
    insertSla.run(rule.severity, rule.targetHours, rule.escalationTarget);
  }

  db.prepare(`INSERT INTO platform_settings (key, value_json) VALUES (?, ?)`).run(
    'skill_match_weights',
    JSON.stringify(DEFAULT_MATCH_WEIGHTS)
  );

  const now = Date.now();
  const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();
  const hoursFromNow = (h) => new Date(now + h * 3600 * 1000).toISOString();

  const insertComplaint = db.prepare(`
    INSERT INTO complaints (
      tracking_code, reporter_id, title, description, category, user_selected_category,
      ai_predicted_category, ai_summary, severity, ai_recommended_severity, ai_explanation,
      ai_keywords_json, ai_provider, ai_confidence, latitude, longitude, address,
      location_source, ward, status, department_id, assigned_official_name,
      sla_deadline_at, escalation_level, is_overdue, resolution_notes, is_demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const c1 = insertComplaint.run(
    'FG-MTR-2026-101',
    citizenId,
    'Deep rainwater-filled pothole near Krishna Nagar Market turn',
    'A deep circular pothole roughly 1.2m wide near Krishna Nagar main intersection is trapping two-wheelers and causing traffic bottlenecks during school hours.',
    'Pothole',
    'Pothole',
    'Pothole',
    'Large water-filled asphalt pothole obstructing two-wheeler lane near Krishna Nagar Market.',
    'High',
    'High',
    'Detected heavy arterial road obstruction near a busy market turn with rainwater pooling that obscures depth.',
    JSON.stringify(['pothole', 'krishna nagar', 'traffic', 'two-wheeler', 'asphalt']),
    'rule-based-demo-seed',
    0.91,
    27.4924,
    77.6737,
    'Krishna Nagar Main Road, near Market Crossing, Mathura (Demo)',
    'map-pin',
    'Ward 14 (Krishna Nagar)',
    'In progress',
    deptRoad,
    'Er. R.K. Upadhyay (Road Div-II)',
    hoursFromNow(5),
    0,
    0,
    '',
    hoursAgo(7),
    hoursAgo(2)
  ).lastInsertRowid;

  const c2 = insertComplaint.run(
    'FG-MTR-2026-102',
    citizenId,
    'Tilted broken LED streetlight pole along Holi Gate approach lane',
    'Streetlight pole #HG-19 has a shattered LED housing and exposed wires hanging near pedestrian height, leaving a 90-meter stretch pitch dark after 6:30 PM.',
    'Broken streetlight',
    'Broken streetlight',
    'Broken streetlight',
    'Damaged streetlight pole with shattered fixture and potential exposed wiring hazard at Holi Gate.',
    'Critical',
    'Critical',
    'Exposed electrical wiring at pedestrian height coupled with zero night illumination indicates urgent safety triage.',
    JSON.stringify(['streetlight', 'exposed wire', 'holi gate', 'darkness', 'electrical hazard']),
    'rule-based-demo-seed',
    0.94,
    27.5012,
    77.6845,
    'Holi Gate Inner Approach Road, Mathura (Demo)',
    'gps-verified',
    'Ward 08 (Holi Gate)',
    'Escalated',
    deptElectrical,
    'S.K. Srivastava (Electrical Cell)',
    hoursAgo(3),
    1,
    1,
    '',
    hoursAgo(10),
    hoursAgo(1)
  ).lastInsertRowid;

  const c3 = insertComplaint.run(
    'FG-MTR-2026-103',
    studentId,
    'Ruptured municipal water supply main flooding Dampier Nagar curb',
    'Continuous high-pressure clean water jetting out of a cracked cast-iron joint beside Dampier Nagar Park, wasting potable water and eroding pavement base.',
    'Water leakage',
    'Water leakage',
    'Water leakage',
    'Pressurized municipal water pipeline rupture causing potable water loss and pavement erosion.',
    'High',
    'High',
    'Active pressurized pipeline leak requires rapid valve isolation and joint clamp repair to prevent water loss.',
    JSON.stringify(['water main', 'pipeline leak', 'dampier nagar', 'potable water']),
    'rule-based-demo-seed',
    0.92,
    27.4865,
    77.6812,
    'Dampier Nagar Park Edge Road, Mathura (Demo)',
    'gps-verified',
    'Ward 19 (Dampier Nagar)',
    'Assigned',
    deptWater,
    'A.K. Dixit (Water Works)',
    hoursFromNow(8),
    0,
    0,
    '',
    hoursAgo(4),
    hoursAgo(3)
  ).lastInsertRowid;

  const c4 = insertComplaint.run(
    'FG-MTR-2026-104',
    citizenId,
    'Overflowing municipal waste bin outside Vishram Ghat lane',
    'Community waste bin has not been cleared in 48 hours; stray cattle are scattering organic waste across the pedestrian walkway.',
    'Garbage accumulation',
    'Garbage accumulation',
    'Garbage accumulation',
    'Overflowing solid waste container spilling onto pedestrian path near Vishram Ghat.',
    'Medium',
    'Medium',
    'Sanitation spill affects pedestrian access and public hygiene; scheduled for routine rapid-clearance crew.',
    JSON.stringify(['garbage', 'waste bin', 'vishram ghat', 'sanitation']),
    'rule-based-demo-seed',
    0.89,
    27.5055,
    77.6879,
    'Vishram Ghat Approach Lane, Mathura (Demo)',
    'user-supplied',
    'Ward 04 (Vishram Ghat)',
    'Awaiting official validation',
    deptSanitation,
    'Pending Validation',
    hoursFromNow(40),
    0,
    0,
    '',
    hoursAgo(8),
    hoursAgo(8)
  ).lastInsertRowid;

  const c5 = insertComplaint.run(
    'FG-MTR-2026-105',
    student2Id,
    'Severe road cratering and storm waterlogging at Govardhan Chauraha',
    'Choked storm drain culvert is causing knee-deep waterlogging every morning along the Govardhan Chauraha service lane.',
    'Waterlogging',
    'Waterlogging',
    'Waterlogging',
    'Blocked drainage culvert causing recurring service-lane waterlogging at Govardhan Chauraha.',
    'High',
    'High',
    'Recurring transit-corridor flooding degrades asphalt sub-base and requires desilting + culvert inspection.',
    JSON.stringify(['waterlogging', 'culvert', 'govardhan chauraha', 'storm drain']),
    'rule-based-demo-seed',
    0.88,
    27.4792,
    77.6584,
    'Govardhan Chauraha Service Road, Mathura (Demo)',
    'map-pin',
    'Ward 27 (Govardhan Chauraha)',
    'Resolved',
    deptDrainage,
    'Er. M.L. Chauhan (Drainage Cell)',
    hoursAgo(12),
    0,
    0,
    'Culvert desilted with suction jetting unit and temporary gravel shoulder patched. Monitored for 24h.',
    hoursAgo(72),
    hoursAgo(14)
  ).lastInsertRowid;

  // Intentional nearby potential duplicate of c1 (within ~65 meters in Krishna Nagar)
  const c6 = insertComplaint.run(
    'FG-MTR-2026-106',
    student3Id,
    'Large road depression filled with muddy water near Krishna Nagar turn',
    'Asphalt collapsed right before Krishna Nagar Market crossing, almost impossible for e-rickshaws to pass safely.',
    'Pothole',
    'Pothole',
    'Pothole',
    'Road surface collapse near Krishna Nagar Market crossing affecting e-rickshaw passage.',
    'High',
    'High',
    'Matches high-priority road defect criteria and sits ~65m from active report FG-MTR-2026-101.',
    JSON.stringify(['road depression', 'krishna nagar', 'market crossing', 'e-rickshaw']),
    'rule-based-demo-seed',
    0.87,
    27.4928,
    77.6741,
    'Krishna Nagar Crossing East Side, Mathura (Demo)',
    'map-pin',
    'Ward 14 (Krishna Nagar)',
    'Awaiting official validation',
    deptRoad,
    'Pending Validation',
    hoursFromNow(10),
    0,
    0,
    '',
    hoursAgo(2),
    hoursAgo(2)
  ).lastInsertRowid;

  const insertMedia = db.prepare(`
    INSERT INTO complaint_media (complaint_id, file_url, media_type, original_name, size_bytes)
    VALUES (?, ?, 'image', ?, 240000)
  `);
  insertMedia.run(c1, '/src/assets/images/issue_pothole_road_1795357361430.jpg', 'krishna_nagar_pothole.jpg');
  insertMedia.run(c2, '/src/assets/images/issue_streetlight_dark_1795357359241.jpg', 'holi_gate_streetlight.jpg');
  insertMedia.run(c3, '/src/assets/images/issue_water_leakage_1795357359811.jpg', 'dampier_nagar_leak.jpg');
  insertMedia.run(c4, '/src/assets/images/issue_garbage_accumulation_1795357360384.jpg', 'vishram_ghat_waste.jpg');
  insertMedia.run(c5, '/src/assets/images/issue_pothole_road_1795357361430.jpg', 'govardhan_waterlogging.jpg');
  insertMedia.run(c6, '/src/assets/images/issue_pothole_road_1795357361430.jpg', 'krishna_nagar_east_pothole.jpg');

  const insertHistory = db.prepare(`
    INSERT INTO complaint_status_history (complaint_id, status, note, actor_id, actor_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertHistory.run(c1, 'Submitted', 'Citizen report logged with photograph and map coordinates.', citizenId, 'citizen', hoursAgo(7));
  insertHistory.run(c1, 'AI analysis completed', 'Classified as Pothole (High severity) and routed to Municipal Road & Engineering.', null, 'system', hoursAgo(7));
  insertHistory.run(c1, 'Assigned', 'Official validated report and assigned Road Div-II crew.', govId, 'government', hoursAgo(5));
  insertHistory.run(c1, 'In progress', 'Cold-mix asphalt repair team dispatched to Krishna Nagar.', govId, 'government', hoursAgo(2));

  insertHistory.run(c2, 'Submitted', 'Reported tilted pole with exposed electrical fixture.', citizenId, 'citizen', hoursAgo(10));
  insertHistory.run(c2, 'AI analysis completed', 'Flagged Critical severity due to exposed wiring hazard.', null, 'system', hoursAgo(10));
  insertHistory.run(c2, 'Assigned', 'Assigned to Electrical & Streetlight Department.', govId, 'government', hoursAgo(9));
  insertHistory.run(c2, 'Escalated', 'SLA 4h deadline breached; escalated to Municipal Commissioner & Rapid Response Cell.', null, 'system', hoursAgo(1));

  insertHistory.run(c3, 'Submitted', 'Reported pressurized potable water pipe leakage.', studentId, 'student', hoursAgo(4));
  insertHistory.run(c3, 'Assigned', 'Assigned to Water Works maintenance squad.', govId, 'government', hoursAgo(3));

  insertHistory.run(c4, 'Submitted', 'Citizen logged sanitation bin overflow.', citizenId, 'citizen', hoursAgo(8));
  insertHistory.run(c4, 'Awaiting official validation', 'AI recommended Medium severity; queued for municipal review.', null, 'system', hoursAgo(8));

  insertHistory.run(c5, 'Submitted', 'Logged stormwater culvert flooding at Govardhan Chauraha.', student2Id, 'student', hoursAgo(72));
  insertHistory.run(c5, 'Resolved', 'Culvert desilted and verified clear during morning peak hours.', govId, 'government', hoursAgo(14));

  insertHistory.run(c6, 'Submitted', 'Report submitted near Krishna Nagar Market crossing.', student3Id, 'student', hoursAgo(2));
  insertHistory.run(c6, 'Awaiting official validation', 'Flagged as possible duplicate of FG-MTR-2026-101 (62m apart).', null, 'system', hoursAgo(2));

  db.prepare(`
    INSERT INTO complaint_duplicate_links (primary_complaint_id, duplicate_complaint_id, similarity_score, distance_meters, reason, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    c1,
    c6,
    0.84,
    62,
    'Same category (Pothole), 62m proximity in Krishna Nagar Ward 14, and overlapping road-collapse keywords.',
    'Pending review'
  );

  db.prepare(`
    INSERT INTO escalation_history (complaint_id, from_level, to_level, reason, triggered_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    c2,
    0,
    1,
    'Critical severity SLA target (4 hours) exceeded without field resolution.',
    'SLA Escalation Rule Engine',
    hoursAgo(1)
  );

  const insertVote = db.prepare(`INSERT INTO complaint_votes (complaint_id, user_id) VALUES (?, ?)`);
  insertVote.run(c1, citizenId);
  insertVote.run(c1, studentId);
  insertVote.run(c1, student2Id);
  insertVote.run(c2, citizenId);
  insertVote.run(c2, studentId);
  insertVote.run(c3, student2Id);

  const insertComment = db.prepare(`INSERT INTO complaint_comments (complaint_id, user_id, body, created_at) VALUES (?, ?, ?, ?)`);
  insertComment.run(c1, studentId, 'Two-wheelers are swerving into oncoming traffic here every morning at 8:30 AM.', hoursAgo(4));
  insertComment.run(c2, citizenId, 'Please isolate the dangling wire before evening rain starts.', hoursAgo(6));

  // Civic Innovation Challenges
  const insertChallenge = db.prepare(`
    INSERT INTO civic_challenges (
      challenge_code, complaint_id, title, description, category, location,
      background, expected_outcome, skills_required_json, deliverables_json,
      deadline, difficulty, department_id, approval_status, created_by, approved_by, pilot_status, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const ch1 = insertChallenge.run(
    'FG-CH-2026-01',
    c5,
    'Low-Cost Ultrasonic Storm Drain Silt & Flood Early-Warning Sensor',
    'Design an autonomous, solar-assisted drain water-level and siltation alert node for flood-prone junctions like Govardhan Chauraha.',
    'Waterlogging',
    'Govardhan Chauraha & Krishna Nagar Culverts, Mathura (Demo)',
    'Recurring monsoon waterlogging stems from invisible silt buildup inside covered culverts before surface overflow occurs.',
    'Working sensor prototype + telemetry dashboard alerting Drainage Cell 2 hours prior to curb overflow.',
    JSON.stringify(['IoT Sensors', 'Embedded Systems', 'LoRaWAN', 'Data Analytics', 'React']),
    JSON.stringify(['Hardware Sensor Node Schematic', 'Live Alert Dashboard Prototype', 'Field Calibration Report']),
    '2026-12-20',
    'Intermediate',
    deptDrainage,
    'Approved',
    govId,
    govId,
    'Under Pilot Review'
  ).lastInsertRowid;

  const ch2 = insertChallenge.run(
    'FG-CH-2026-02',
    c1,
    'Dashcam & Two-Wheeler Computer Vision Pothole Severity Mapper',
    'Build a lightweight edge vision pipeline that maps asphalt craters with GPS coordinates and estimates surface area from smartphone dashcams.',
    'Pothole',
    'Krishna Nagar & Arterial Roads, Mathura (Demo)',
    'Manual road audits miss rapidly widening monsoon potholes on high-density market corridors.',
    'Verified GPS-tagged road defect heat layer exportable to Municipal Road & Engineering maintenance queues.',
    JSON.stringify(['Computer Vision', 'GIS Mapping', 'React', 'Node.js', 'Pavement Engineering']),
    JSON.stringify(['Annotated Mathura Road Dataset', 'Inference Web Service', 'GeoJSON Export Module']),
    '2027-01-15',
    'Advanced',
    deptRoad,
    'Approved',
    govId,
    govId,
    'None'
  ).lastInsertRowid;

  const ch3 = insertChallenge.run(
    'FG-CH-2026-03',
    c2,
    'Smart Solar LED Pole Tilt & Wire-Fault Telemetry Retrofits',
    'Create a retrofittable tilt-and-current fault sensor module for municipal streetlight poles to detect knockdowns and power outages automatically.',
    'Broken streetlight',
    'Holi Gate & Old City Lanes, Mathura (Demo)',
    'Damaged streetlight poles often remain unreported until nightfall, creating electrical and pedestrian safety hazards.',
    'Fault-detection retrofit module with instant location ping to Electrical Cell.',
    JSON.stringify(['Smart Lighting', 'Solar Power', 'IoT Sensors', 'PCB Design', 'Embedded Systems']),
    JSON.stringify(['Circuit & Enclosure Design', 'Fault Trigger Firmware', 'Pilot Cost Estimate']),
    '2027-01-30',
    'Intermediate',
    deptElectrical,
    'Approved',
    govId,
    govId,
    'None'
  ).lastInsertRowid;

  // Team + Active Project + Tasks + Milestones + Passport
  const team1 = db.prepare(`
    INSERT INTO teams (name, description, challenge_id, leader_id, max_members)
    VALUES (?, ?, ?, ?, 5)
  `).run(
    'Brij Grid Innovators',
    'Multidisciplinary GLA & Sanskriti student squad building urban drainage & GIS civic tools.',
    ch1,
    studentId
  ).lastInsertRowid;

  db.prepare(`INSERT INTO team_members (team_id, user_id, project_role) VALUES (?, ?, ?)`).run(team1, studentId, 'Lead Full-Stack & GIS Engineer');
  db.prepare(`INSERT INTO team_members (team_id, user_id, project_role) VALUES (?, ?, ?)`).run(team1, student2Id, 'IoT & Power Systems Lead');

  // Pending invitation to student3 so team invitation UI works immediately
  db.prepare(`
    INSERT INTO team_invitations (team_id, invited_user_id, invited_by, proposed_role, status)
    VALUES (?, ?, ?, ?, 'Pending')
  `).run(team1, student3Id, studentId, 'Civil & Drainage Modeling Advisor');

  db.prepare(`
    INSERT INTO challenge_applications (challenge_id, applicant_user_id, team_id, proposal_summary, status, match_score, match_breakdown_json)
    VALUES (?, ?, ?, ?, 'Approved', 91, ?)
  `).run(
    ch1,
    studentId,
    team1,
    'Deploying IP67 ultrasonic depth sensors coupled with solar-rechargeable LoRa nodes and a municipal alert portal.',
    JSON.stringify({ skills: 32, domain: 24, experience: 13, availability: 13, proximity: 9 })
  );

  const proj1 = db.prepare(`
    INSERT INTO projects (challenge_id, team_id, title, objectives, status, pilot_approved)
    VALUES (?, ?, ?, ?, 'Active', 0)
  `).run(
    ch1,
    team1,
    'JalDrishti — Culvert Silt & Flood Telemetry Node',
    'Build, bench-test, and field-calibrate an ultrasonic culvert monitoring node for Govardhan Chauraha drainage inspections.'
  ).lastInsertRowid;

  const insertTask = db.prepare(`
    INSERT INTO project_tasks (project_id, title, description, status, assignee_id, priority, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertTask.run(proj1, 'Calibrate JSN-SR04T waterproof ultrasonic probe', 'Verify millimeter accuracy against turbid water samples in campus tank.', 'Done', student2Id, 'High', '2026-11-28');
  insertTask.run(proj1, 'Build municipal drainage alert threshold API', 'Trigger warning thresholds at 70% and 90% culvert capacity.', 'In Progress', studentId, 'High', '2026-12-03');
  insertTask.run(proj1, 'Design weatherproof PVC mounting bracket', 'Non-invasive clamp for concrete storm drain walls.', 'Review', student2Id, 'Medium', '2026-12-05');
  insertTask.run(proj1, 'Prepare pilot safety checklist for Municipal Drainage Cell', 'Document non-interference protocol before requesting field pilot.', 'Todo', studentId, 'Medium', '2026-12-10');

  const insertMilestone = db.prepare(`
    INSERT INTO project_milestones (project_id, title, description, due_date, status, faculty_evaluation, evaluated_by, evaluated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMilestone.run(
    proj1,
    'Milestone 1: Sensor Bench Calibration & Enclosure Spec',
    'Deliver error margin curves and waterproof housing blueprint.',
    '2026-11-30',
    'Verified',
    'Solid empirical calibration curves across 15cm–180cm depth range. Ready for telemetry integration.',
    facultyId,
    hoursAgo(20)
  );
  insertMilestone.run(
    proj1,
    'Milestone 2: Live Alert Web Dashboard & Pilot Proposal',
    'Complete REST telemetry ingest and municipal pilot review packet.',
    '2026-12-15',
    'In Progress',
    '',
    null,
    null
  );

  db.prepare(`
    INSERT INTO project_deliverables (project_id, title, description, file_url, submitted_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    proj1,
    'Bench Calibration Report & Node Schematic v1',
    'Includes power budget calculation for 14-day cloudy weather autonomy.',
    '/src/assets/images/hero_civic_mathura_1795357360477.jpg',
    studentId
  );

  db.prepare(`
    INSERT INTO mentor_assignments (project_id, challenge_id, faculty_id, status, message)
    VALUES (?, ?, ?, 'Accepted', ?)
  `).run(proj1, ch1, facultyId, 'Supervising sensor calibration and civil culvert mounting safety standards.');

  db.prepare(`
    INSERT INTO mentor_feedback (project_id, author_id, comment)
    VALUES (?, ?, ?)
  `).run(proj1, facultyId, 'Ensure the ultrasonic sensor mount stays at least 25cm above peak silt line to prevent false readings.');

  db.prepare(`
    INSERT INTO contribution_records (
      student_id, project_id, role_held, responsibilities, skills_json,
      tasks_completed, deliverables_summary, verified_by_faculty_id, verification_note, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studentId,
    proj1,
    'Lead Full-Stack & GIS Engineer',
    'Architected telemetry threshold endpoints, culvert GIS overlay, and milestone documentation.',
    JSON.stringify(['Node.js', 'React', 'GIS Mapping', 'Data Analytics']),
    4,
    'Delivered API threshold alerts and GIS culvert risk visualization.',
    facultyId,
    'Verified contribution to Milestone 1 and municipal telemetry architecture.',
    hoursAgo(18)
  );

  db.prepare(`
    INSERT INTO industry_interests (partner_id, challenge_id, project_id, support_type, message, status)
    VALUES (?, ?, ?, 'Hardware & Lab Grant', ?, 'Under Review')
  `).run(
    industryId,
    ch1,
    proj1,
    'Willing to sponsor 4 waterproof LoRa sensor kits for campus testing pending official municipal pilot consent.'
  );

  // Notifications for demo users
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, title, message, link)
    VALUES (?, ?, ?, ?)
  `);
  insertNotif.run(citizenId, 'Complaint FG-MTR-2026-101 In Progress', 'Municipal Road & Engineering crew has been dispatched to Krishna Nagar Market turn.', '/citizen/my-complaints');
  insertNotif.run(govId, 'SLA Escalation Alert: FG-MTR-2026-102', 'Holi Gate broken streetlight crossed 4h Critical SLA target and escalated to Level 1.', '/government/complaints');
  insertNotif.run(studentId, 'Contribution Verified by Dr. Meera Kulkarni', 'Your JalDrishti Milestone 1 contribution was verified in your Student Contribution Passport.', '/student/passport');
  insertNotif.run(facultyId, 'Milestone 2 Pending Review', 'Brij Grid Innovators uploaded a calibration deliverable for JalDrishti.', '/faculty/reviews');
  insertNotif.run(industryId, 'New Approved Civic Challenge', 'Dashcam Pothole Severity Mapper (FG-CH-2026-02) is open for technical mentorship.', '/industry/challenges');
  insertNotif.run(adminId, 'Audit Log Active', 'Platform RBAC, SLA thresholds, and Gemini AI status checks are operational.', '/admin/audit-logs');

  db.prepare(`
    INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details_json)
    VALUES (?, 'government', 'APPROVE_CHALLENGE', 'civic_challenges', ?, ?)
  `).run(govId, String(ch1), JSON.stringify({ note: 'Approved challenge conversion from FG-MTR-2026-105 (Demo Seed)' }));
}

function migrateSchema() {
  const existingColumns = db
    .prepare('PRAGMA table_info(users)')
    .all()
    .map((col) => col.name);

  if (!existingColumns.includes('account_status')) {
    db.exec("ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'");
  }
  if (!existingColumns.includes('activation_token_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN activation_token_hash TEXT');
  }
  if (!existingColumns.includes('activation_expires_at')) {
    db.exec('ALTER TABLE users ADD COLUMN activation_expires_at TEXT');
  }
  if (!existingColumns.includes('invited_by')) {
    db.exec('ALTER TABLE users ADD COLUMN invited_by INTEGER REFERENCES users(id)');
  }
}

export function ensureAdminProvisioned() {
  const rawEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const rawPassword = (process.env.ADMIN_PASSWORD || '').trim();
  const rawName = (process.env.ADMIN_NAME || '').trim() || 'Platform Administrator';

  if (!rawPassword || rawPassword.length < 8) {
    return false;
  }

  const adminEmail = rawEmail || 'admin@fixgrid.local';
  const existing = db.prepare('SELECT id, password_hash, role, verified, account_status FROM users WHERE email = ?').get(adminEmail);

  if (existing) {
    const matchesExisting = existing.password_hash ? bcrypt.compareSync(rawPassword, existing.password_hash) : false;
    const nextHash = matchesExisting ? existing.password_hash : bcrypt.hashSync(rawPassword, 10);
    db.prepare(
      `UPDATE users
       SET name = ?, password_hash = ?, role = 'admin', verified = 1, account_status = 'active', deleted_at = NULL
       WHERE id = ?`
    ).run(rawName, nextHash, existing.id);
  } else {
    const passwordHash = bcrypt.hashSync(rawPassword, 10);
    db.prepare(
      `INSERT INTO users (name, email, password_hash, role, institution_or_org, city, ward, verified, account_status)
       VALUES (?, ?, ?, 'admin', 'FixGrid Platform Governance', 'Mathura', 'Platform HQ', 1, 'active')`
    ).run(rawName, adminEmail, passwordHash);
  }
  return true;
}

export function getAdminBootstrapStatus() {
  const envPass = (process.env.ADMIN_PASSWORD || '').trim();
  const adminProvisionedByEnv = envPass.length >= 8;
  const claimedRow = db
    .prepare("SELECT value_json FROM platform_settings WHERE key = 'admin_bootstrap_claimed'")
    .get();
  const claimed = claimedRow?.value_json === 'true';
  return {
    adminProvisionedByEnv,
    canClaimAdminSetup: !adminProvisionedByEnv && !claimed,
  };
}

function ensureRealIssueChallenges() {
  const govUser = db
    .prepare("SELECT id FROM users WHERE role = 'government' AND deleted_at IS NULL ORDER BY id ASC LIMIT 1")
    .get();
  const govId = govUser ? govUser.id : null;

  const findComplaintId = (code) => {
    if (!code) return null;
    const row = db.prepare('SELECT id FROM complaints WHERE tracking_code = ? AND deleted_at IS NULL').get(code);
    return row ? row.id : null;
  };

  const findDeptId = (code) => {
    const row = db.prepare('SELECT id FROM departments WHERE code = ?').get(code);
    return row ? row.id : null;
  };

  const existsStmt = db.prepare('SELECT id FROM civic_challenges WHERE challenge_code = ?');
  const insertStmt = db.prepare(`
    INSERT INTO civic_challenges (
      challenge_code, complaint_id, title, description, category, location,
      background, expected_outcome, skills_required_json, deliverables_json,
      deadline, difficulty, department_id, approval_status, created_by, approved_by, pilot_status, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved', ?, ?, 'None', 1)
  `);

  const additionalChallenges = [
    {
      code: 'FG-CH-2026-04',
      complaintCode: 'FG-MTR-2026-103',
      title: 'Acoustic & Pressure-Transient Potable Water Pipe Leak Detector',
      description:
        'Build a clamp-on acoustic vibration and pressure-drop telemetry node to detect cracked cast-iron water mains like the Dampier Nagar Park curb rupture before potable water floods roads.',
      category: 'Water leakage',
      location: 'Dampier Nagar Park Edge Road & Ward 19 Lines, Mathura (Demo)',
      background:
        'Pressurized cast-iron distribution joints crack unnoticed until high-pressure water jets onto streets, wasting clean water and eroding road sub-bases.',
      expectedOutcome:
        'Non-invasive acoustic leak sensor prototype + Water Works valve isolation alert feed pinpointing leaks within 25 meters.',
      skills: ['IoT Sensors', 'Embedded Systems', 'Data Analytics', 'LoRaWAN', 'React'],
      deliverables: ['Clamp-On Acoustic Sensor Proof', 'Leak Signature Dataset', 'Water Works Alert UI'],
      deadline: '2027-02-10',
      difficulty: 'Advanced',
      deptCode: 'WSPD',
    },
    {
      code: 'FG-CH-2026-05',
      complaintCode: 'FG-MTR-2026-104',
      title: 'Smart Heritage-Zone Waste Bin Fill-Level & Dynamic Collection Router',
      description:
        'Design an ultrasonic bin-capacity monitor and route optimizer to prevent 48-hour waste overflows and stray-cattle scattering along high-footfall Vishram Ghat walkways.',
      category: 'Garbage accumulation',
      location: 'Vishram Ghat Approach Lane & Ward 04, Mathura (Demo)',
      background:
        'Fixed waste pickup schedules fail during market peaks and pilgrimage weekends, leaving communal bins overflowing across narrow pedestrian lanes.',
      expectedOutcome:
        'Solar ultrasonic fill-level unit + Sanitation & Solid Waste dispatch route planner prioritizing bins above 80% capacity.',
      skills: ['IoT Sensors', 'GIS Mapping', 'Node.js', 'React', 'Data Analytics'],
      deliverables: ['Ultrasonic Bin Unit Schematic', 'Dynamic Tipper Routing API', 'Ward 04 Pilot Report'],
      deadline: '2027-02-18',
      difficulty: 'Intermediate',
      deptCode: 'SSWD',
    },
    {
      code: 'FG-CH-2026-06',
      complaintCode: 'FG-MTR-2026-106',
      title: 'Citizen Geo-Cluster & Sub-Base Moisture Risk Scorer for Repeat Potholes',
      description:
        'Develop a spatial analytics and road-vibration scoring tool linking overlapping citizen reports (FG-MTR-2026-101 & FG-MTR-2026-106) to identify underlying pavement base failure at Krishna Nagar crossings.',
      category: 'Pothole',
      location: 'Krishna Nagar Market Crossing East & Ward 14, Mathura (Demo)',
      background:
        'Multiple overlapping pothole reports within 65 meters show that cold-mix surface patches fail rapidly without diagnosing sub-base water saturation.',
      expectedOutcome:
        'Geo-clustered repair priority index combining citizen photos, e-rickshaw accelerometer bumps, and drainage runoff overlays.',
      skills: ['GIS Mapping', 'Computer Vision', 'Pavement Engineering', 'Data Analytics', 'React'],
      deliverables: ['Duplicate-Cluster Heat Map', 'Sub-Base Risk Scoring Model', 'MRED Repair Priority Export'],
      deadline: '2027-02-25',
      difficulty: 'Intermediate',
      deptCode: 'MRED',
    },
    {
      code: 'FG-CH-2026-07',
      complaintCode: 'FG-MTR-2026-105',
      title: 'Automated Open-Drain Blockage & Culvert Clog Vision Classifier',
      description:
        'Create a low-power edge camera and turbidity check workflow that flags plastic/silt chokepoints in roadside culverts before monsoon storms trigger street waterlogging.',
      category: 'Drainage problem',
      location: 'Govardhan Chauraha Service Road & Ward 27 Culverts, Mathura (Demo)',
      background:
        'Open storm drains clog rapidly with plastic litter and silt between scheduled sweeps, turning minor showers into knee-deep road blockages.',
      expectedOutcome:
        'Annotated culvert blockage detector + Stormwater & Drainage desilting dispatch checklist.',
      skills: ['Computer Vision', 'Drainage Design', 'GIS Mapping', 'Embedded Systems', 'AutoCAD'],
      deliverables: ['Drain Blockage Classifier Model', 'Culvert Inspection CAD Note', 'Pre-Monsoon Alert Feed'],
      deadline: '2027-03-05',
      difficulty: 'Intermediate',
      deptCode: 'SWDD',
    },
    {
      code: 'FG-CH-2026-08',
      complaintCode: 'FG-MTR-2026-101',
      title: 'Accessible Footpath, Guardrail & Bus-Shelter Structural Audit App',
      description:
        'Build a mobile-friendly structural inspection web tool helping municipal teams log broken footpaths, damaged railings, and unsafe market curbs with automated material quantity estimates.',
      category: 'Damaged public infrastructure',
      location: 'Krishna Nagar & Central Market Corridors, Mathura (Demo)',
      background:
        'Cracked pedestrian kerbs, missing drain covers, and damaged bus-stop railings lack standardized bill-of-quantities estimates at intake.',
      expectedOutcome:
        'Photo-guided damage grading checklist generating concrete/steel repair estimates for civil engineers.',
      skills: ['Pavement Engineering', 'Material Testing', 'React', 'Node.js', 'GIS Mapping'],
      deliverables: ['Structural Audit Checklist UI', 'Material Quantity Estimator', 'Field Accessibility Report'],
      deadline: '2027-03-12',
      difficulty: 'Beginner',
      deptCode: 'MRED',
    },
    {
      code: 'FG-CH-2026-09',
      complaintCode: 'FG-MTR-2026-103',
      title: 'Smart Ward Water-Audit & Potable Distribution Loss Telemetry Dashboard',
      description:
        'Build an interactive balance-sheet dashboard pairing ward inlet flow readings with active citizen pipe-leakage reports to pinpoint high-loss municipal water corridors.',
      category: 'Water leakage',
      location: 'Dampier Nagar & Adjoining Municipal Zones, Mathura (Demo)',
      background:
        'Unaccounted-for potable water loss across aging municipal pipelines lowers tail-end household pressure and damages adjacent roads.',
      expectedOutcome:
        'Ward-level water loss correlation dashboard flagging suspected underground seepage segments for Water Works.',
      skills: ['Data Analytics', 'Node.js', 'React', 'GIS Mapping', 'IoT Sensors'],
      deliverables: ['Flow-vs-Report Correlation Engine', 'Interactive Zone Map', 'Water Conservation Brief'],
      deadline: '2027-03-20',
      difficulty: 'Intermediate',
      deptCode: 'WSPD',
    },
  ];

  const seedTx = db.transaction(() => {
    for (const item of additionalChallenges) {
      if (existsStmt.get(item.code)) continue;
      insertStmt.run(
        item.code,
        findComplaintId(item.complaintCode),
        item.title,
        item.description,
        item.category,
        item.location,
        item.background,
        item.expectedOutcome,
        JSON.stringify(item.skills),
        JSON.stringify(item.deliverables),
        item.deadline,
        item.difficulty,
        findDeptId(item.deptCode),
        govId,
        govId
      );
    }
  });

  seedTx();
}

createSchema();
migrateSchema();
seedDemoData();
ensureAdminProvisioned();
ensureRealIssueChallenges();

export function logAudit(actorId, actorRole, action, entityType, entityId, details = {}) {
  db.prepare(`
    INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actorId || null, actorRole || 'system', action, entityType, String(entityId), JSON.stringify(details));
}

export function createNotification(userId, title, message, link = '') {
  if (!userId) return;
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, link)
    VALUES (?, ?, ?, ?)
  `).run(userId, title, message, link);
}

export function checkDatabaseHealth() {
  try {
    const row = db.prepare('SELECT 1 AS ok').get();
    return { connected: Boolean(row && row.ok === 1) };
  } catch (err) {
    console.error('SQLite health check failed:', err?.message || 'Unknown error');
    return { connected: false };
  }
}

export function closeDatabase() {
  try {
    if (db.open) {
      db.close();
    }
  } catch (err) {
    console.error('Error closing SQLite database:', err?.message || 'Unknown error');
  }
}

export default db;
