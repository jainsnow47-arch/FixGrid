import express from 'express';
import db, { createNotification, logAudit } from '../config/db.js';
import { ISSUE_CATEGORIES } from '../config/constants.js';
import { optionalAuth, rateLimit, requireAuth } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { analyzeCivicIssue, generateEmbedding } from '../services/aiService.js';
import { findPotentialDuplicates } from '../services/duplicateService.js';
import { computeSlaDeadline } from '../services/slaService.js';

const router = express.Router();

function parseMetadataField(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

// Fast real-time AI suggestion engine (text + client-extracted image metadata before submission)
router.post('/live-suggest', requireAuth, rateLimit({ windowMs: 60000, max: 90 }), async (req, res) => {
  try {
    const {
      title = '',
      description = '',
      category = '',
      address = '',
      latitude = 27.4924,
      longitude = 77.6737,
      imageMetadata = null,
    } = req.body || {};

    const combinedLen = `${title} ${description}`.trim().length;
    const parsedMeta = parseMetadataField(imageMetadata);

    if (combinedLen < 3 && !parsedMeta) {
      return res.status(400).json({ error: 'Enter at least 3 characters or attach an image for live AI suggestions.' });
    }

    const aiResult = await analyzeCivicIssue({
      title: String(title).trim(),
      description: String(description).trim(),
      userCategory: category,
      address: String(address || '').trim(),
      imageMetadata: parsedMeta,
      fastMode: true,
    });

    const duplicates = findPotentialDuplicates({
      title: String(title),
      description: String(description),
      category: aiResult.predictedCategory,
      latitude: Number(latitude),
      longitude: Number(longitude),
      embedding: null,
    });

    return res.json({
      analysis: aiResult,
      duplicates,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Live AI suggestion failed.' });
  }
});

// Pre-analyze draft complaint (Multimodal Photo + AI Civic Intelligence + Embedding Duplicate Detection preview)
router.post('/analyze-draft', requireAuth, rateLimit({ windowMs: 60000, max: 30 }), uploadMiddleware.single('media'), async (req, res) => {
  try {
    const {
      title = '',
      description = '',
      category = '',
      address = '',
      latitude = 27.4924,
      longitude = 77.6737,
      imageMetadata = null,
    } = req.body || {};
    const parsedMeta = parseMetadataField(imageMetadata);
    if ((!description || description.trim().length < 5) && !req.file && !parsedMeta) {
      return res.status(400).json({ error: 'Please enter a short description or attach a photo for AI analysis.' });
    }

    const aiResult = await analyzeCivicIssue({
      title,
      description,
      userCategory: category,
      address,
      imagePath: req.file?.path,
      imageMimeType: req.file?.mimetype,
      imageMetadata: parsedMeta,
    });

    const embedding = await generateEmbedding(`${title} ${description} ${aiResult.predictedCategory}`);
    const duplicates = findPotentialDuplicates({
      title,
      description,
      category: aiResult.predictedCategory,
      latitude: Number(latitude),
      longitude: Number(longitude),
      embedding,
    });

    return res.json({
      analysis: aiResult,
      duplicates,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
});

// Submit a new civic complaint (Multipart photo/video + GPS + AI + Duplicate Link + SLA)
router.post('/', requireAuth, uploadMiddleware.array('media', 3), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      latitude,
      longitude,
      address,
      locationSource = 'user-supplied',
      ward = 'Mathura Central',
      imageMetadata = null,
    } = req.body || {};

    if (!title || String(title).trim().length < 5) {
      return res.status(400).json({ error: 'Complaint title must be at least 5 characters.' });
    }
    if (!description || String(description).trim().length < 15) {
      return res.status(400).json({ error: 'Complaint description must be at least 15 characters.' });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Valid GPS or map coordinates are required.' });
    }

    const userCategory = ISSUE_CATEGORIES.includes(category) ? category : 'Other civic issues';
    const firstImage = (req.files || []).find((f) => f.mimetype.startsWith('image/'));
    const parsedMeta = parseMetadataField(imageMetadata);

    const aiResult = await analyzeCivicIssue({
      title: String(title).trim(),
      description: String(description).trim(),
      userCategory,
      address: String(address || 'Mathura Area').trim(),
      imagePath: firstImage?.path,
      imageMimeType: firstImage?.mimetype,
      imageMetadata: parsedMeta,
    });

    const finalCategory = ISSUE_CATEGORIES.includes(userCategory) && category ? userCategory : aiResult.predictedCategory;
    const embedding = await generateEmbedding(`${title} ${description} ${finalCategory}`);

    // Lookup configured department for final category
    const catMapping = db
      .prepare('SELECT default_department_id FROM issue_categories WHERE name = ?')
      .get(finalCategory);
    const departmentId = catMapping?.default_department_id || aiResult.suggestedDepartmentId;

    const slaDeadline = computeSlaDeadline(aiResult.recommendedSeverity);
    const countRow = db.prepare('SELECT COUNT(*) AS count FROM complaints').get();
    const trackingCode = `FG-MTR-2026-${101 + countRow.count}`;

    const insertRes = db
      .prepare(
        `INSERT INTO complaints (
          tracking_code, reporter_id, title, description, category, user_selected_category,
          ai_predicted_category, ai_summary, severity, ai_recommended_severity, ai_explanation,
          ai_keywords_json, ai_provider, ai_confidence, embedding_json, latitude, longitude,
          address, location_source, ward, status, department_id, assigned_official_name,
          sla_deadline_at, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Awaiting official validation', ?, 'Awaiting Nodal Review', ?, 0)`
      )
      .run(
        trackingCode,
        req.user.id,
        String(title).trim(),
        String(description).trim(),
        finalCategory,
        userCategory,
        aiResult.predictedCategory,
        aiResult.summary,
        aiResult.recommendedSeverity,
        aiResult.recommendedSeverity,
        aiResult.explanation,
        JSON.stringify(aiResult.keywords || []),
        aiResult.provider,
        aiResult.confidence,
        embedding ? JSON.stringify(embedding) : null,
        lat,
        lng,
        String(address || `Coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`).trim(),
        locationSource,
        String(ward).trim(),
        departmentId,
        slaDeadline
      );

    const complaintId = insertRes.lastInsertRowid;

    // Save uploaded media files
    for (const file of req.files || []) {
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      db.prepare(
        `INSERT INTO complaint_media (complaint_id, file_url, media_type, original_name, size_bytes)
         VALUES (?, ?, ?, ?, ?)`
      ).run(complaintId, `/uploads/${file.filename}`, mediaType, file.originalname, file.size);
    }

    // Status timeline entries
    db.prepare(
      `INSERT INTO complaint_status_history (complaint_id, status, note, actor_id, actor_role)
       VALUES (?, 'Submitted', 'Citizen submitted civic issue report.', ?, ?)`
    ).run(complaintId, req.user.id, req.user.role);

    db.prepare(
      `INSERT INTO complaint_status_history (complaint_id, status, note, actor_id, actor_role)
       VALUES (?, 'AI analysis completed', ?, NULL, 'system')`
    ).run(
      complaintId,
      `AI (${aiResult.provider}) predicted ${aiResult.predictedCategory} with ${aiResult.recommendedSeverity} severity.`
    );

    db.prepare(
      `INSERT INTO complaint_status_history (complaint_id, status, note, actor_id, actor_role)
       VALUES (?, 'Awaiting official validation', ?, NULL, 'system')`
    ).run(complaintId, `Auto-routed to ${aiResult.suggestedDepartmentName} for human validation.`);

    // Duplicate detection — NEVER delete original complaints! Only create link records for review.
    const duplicates = findPotentialDuplicates({
      excludeId: complaintId,
      title,
      description,
      category: finalCategory,
      latitude: lat,
      longitude: lng,
      embedding,
    });

    for (const dup of duplicates.slice(0, 2)) {
      db.prepare(
        `INSERT INTO complaint_duplicate_links (primary_complaint_id, duplicate_complaint_id, similarity_score, distance_meters, reason, status)
         VALUES (?, ?, ?, ?, ?, 'Pending review')`
      ).run(dup.complaintId, complaintId, dup.similarityScore, dup.distanceMeters, dup.reason);
    }

    // Notify government officials
    const govUsers = db.prepare("SELECT id FROM users WHERE role = 'government' AND deleted_at IS NULL").all();
    for (const g of govUsers) {
      createNotification(
        g.id,
        `New Report ${trackingCode} (${aiResult.recommendedSeverity})`,
        `${finalCategory} reported at ${address || ward}. Human validation required.`,
        '/government/complaints'
      );
    }

    createNotification(
      req.user.id,
      `Report Registered: ${trackingCode}`,
      `Your complaint has been analyzed and routed to ${aiResult.suggestedDepartmentName} for official validation.`,
      '/citizen/my-complaints'
    );

    logAudit(req.user.id, req.user.role, 'CREATE_COMPLAINT', 'complaints', complaintId, {
      trackingCode,
      category: finalCategory,
      aiProvider: aiResult.provider,
    });

    return res.status(201).json({
      complaintId,
      trackingCode,
      aiAnalysis: aiResult,
      duplicatesFound: duplicates,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to submit complaint.' });
  }
});

// Citizen's own complaints
router.get('/my', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, d.name AS department_name,
              (SELECT file_url FROM complaint_media m WHERE m.complaint_id = c.id ORDER BY m.id ASC LIMIT 1) AS primary_image,
              (SELECT COUNT(*) FROM complaint_votes v WHERE v.complaint_id = c.id) AS vote_count
       FROM complaints c
       LEFT JOIN departments d ON c.department_id = d.id
       WHERE c.reporter_id = ? AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`
    )
    .all(req.user.id);

  return res.json({ complaints: rows });
});

// Full complaint details (timeline, media, comments, duplicate links)
router.get('/:id', optionalAuth, (req, res) => {
  const complaintId = Number(req.params.id);
  const complaint = db
    .prepare(
      `SELECT c.id, c.tracking_code, c.reporter_id, c.title, c.description, c.category,
              c.user_selected_category, c.ai_predicted_category, c.ai_summary, c.severity,
              c.ai_recommended_severity, c.ai_explanation, c.ai_keywords_json, c.ai_provider,
              c.ai_confidence, c.latitude, c.longitude, c.address, c.location_source, c.ward,
              c.status, c.department_id, c.assigned_official_name, c.sla_deadline_at,
              c.escalation_level, c.is_overdue, c.resolution_notes, c.resolution_evidence_url,
              c.citizen_feedback_rating, c.citizen_feedback_comment, c.is_demo, c.created_at, c.updated_at,
              d.name AS department_name, d.code AS department_code,
              u.name AS reporter_display_name
       FROM complaints c
       LEFT JOIN departments d ON c.department_id = d.id
       LEFT JOIN users u ON c.reporter_id = u.id
       WHERE c.id = ? AND c.deleted_at IS NULL`
    )
    .get(complaintId);

  if (!complaint) {
    return res.status(404).json({ error: 'Complaint not found.' });
  }

  const media = db.prepare('SELECT id, file_url, media_type, original_name FROM complaint_media WHERE complaint_id = ?').all(complaintId);
  const timeline = db
    .prepare(
      `SELECT h.*, u.name AS actor_name
       FROM complaint_status_history h
       LEFT JOIN users u ON h.actor_id = u.id
       WHERE h.complaint_id = ?
       ORDER BY h.created_at ASC, h.id ASC`
    )
    .all(complaintId);

  const comments = db
    .prepare(
      `SELECT cm.id, cm.body, cm.created_at, u.name AS author_name, u.role AS author_role
       FROM complaint_comments cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.complaint_id = ? AND cm.is_hidden = 0
       ORDER BY cm.created_at ASC`
    )
    .all(complaintId);

  const duplicateLinks = db
    .prepare(
      `SELECT dl.*, p.tracking_code AS primary_code, p.title AS primary_title,
              s.tracking_code AS duplicate_code, s.title AS duplicate_title
       FROM complaint_duplicate_links dl
       JOIN complaints p ON dl.primary_complaint_id = p.id
       JOIN complaints s ON dl.duplicate_complaint_id = s.id
       WHERE dl.primary_complaint_id = ? OR dl.duplicate_complaint_id = ?`
    )
    .all(complaintId, complaintId);

  const escalations = db
    .prepare('SELECT * FROM escalation_history WHERE complaint_id = ? ORDER BY created_at DESC')
    .all(complaintId);

  const voteCount = db.prepare('SELECT COUNT(*) AS c FROM complaint_votes WHERE complaint_id = ?').get(complaintId).c;
  const userHasVoted = req.user
    ? Boolean(db.prepare('SELECT 1 FROM complaint_votes WHERE complaint_id = ? AND user_id = ?').get(complaintId, req.user.id))
    : false;

  const linkedChallenge = db
    .prepare("SELECT id, challenge_code, title, approval_status FROM civic_challenges WHERE complaint_id = ? AND approval_status = 'Approved' LIMIT 1")
    .get(complaintId);

  return res.json({
    complaint: {
      ...complaint,
      keywords: safeParse(complaint.ai_keywords_json, []),
      voteCount,
      userHasVoted,
    },
    media,
    timeline,
    comments,
    duplicateLinks,
    escalations,
    linkedChallenge: linkedChallenge || null,
  });
});

// Toggle community support / upvote (prevents repeated upvotes per account)
router.post('/:id/vote', requireAuth, (req, res) => {
  const complaintId = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM complaints WHERE id = ? AND deleted_at IS NULL').get(complaintId);
  if (!exists) return res.status(404).json({ error: 'Complaint not found.' });

  const already = db
    .prepare('SELECT 1 FROM complaint_votes WHERE complaint_id = ? AND user_id = ?')
    .get(complaintId, req.user.id);

  if (already) {
    db.prepare('DELETE FROM complaint_votes WHERE complaint_id = ? AND user_id = ?').run(complaintId, req.user.id);
  } else {
    db.prepare('INSERT INTO complaint_votes (complaint_id, user_id) VALUES (?, ?)').run(complaintId, req.user.id);
  }

  const voteCount = db.prepare('SELECT COUNT(*) AS c FROM complaint_votes WHERE complaint_id = ?').get(complaintId).c;
  return res.json({ voted: !already, voteCount });
});

// Add community comment
router.post('/:id/comments', requireAuth, (req, res) => {
  const complaintId = Number(req.params.id);
  const { body } = req.body || {};
  if (!body || String(body).trim().length < 2) {
    return res.status(400).json({ error: 'Comment cannot be empty.' });
  }
  const exists = db.prepare('SELECT id FROM complaints WHERE id = ? AND deleted_at IS NULL').get(complaintId);
  if (!exists) return res.status(404).json({ error: 'Complaint not found.' });

  db.prepare('INSERT INTO complaint_comments (complaint_id, user_id, body) VALUES (?, ?, ?)').run(
    complaintId,
    req.user.id,
    String(body).trim()
  );

  return res.status(201).json({ message: 'Comment added.' });
});

// Citizen post-resolution feedback & reopen option
router.post('/:id/feedback', requireAuth, (req, res) => {
  const complaintId = Number(req.params.id);
  const { rating, comment = '', reopen = false } = req.body || {};
  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ? AND deleted_at IS NULL').get(complaintId);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
  if (complaint.reporter_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the original reporter can submit post-resolution feedback.' });
  }

  const numRating = Math.min(5, Math.max(1, Number(rating) || 5));

  if (reopen && complaint.status === 'Resolved') {
    db.prepare(
      `UPDATE complaints
       SET status = 'Reopened', citizen_feedback_rating = ?, citizen_feedback_comment = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(numRating, String(comment).trim(), complaintId);

    db.prepare(
      `INSERT INTO complaint_status_history (complaint_id, status, note, actor_id, actor_role)
       VALUES (?, 'Reopened', ?, ?, ?)`
    ).run(complaintId, `Citizen reopened complaint: ${String(comment).trim() || 'Issue persists'}`, req.user.id, req.user.role);
  } else {
    db.prepare(
      `UPDATE complaints
       SET citizen_feedback_rating = ?, citizen_feedback_comment = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(numRating, String(comment).trim(), complaintId);
  }

  return res.json({ message: reopen ? 'Complaint reopened and feedback saved.' : 'Feedback recorded.' });
});

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default router;
