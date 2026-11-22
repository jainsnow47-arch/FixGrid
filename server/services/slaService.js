import db, { createNotification, logAudit } from '../config/db.js';

export function computeSlaDeadline(severity, fromDate = new Date()) {
  const row = db.prepare('SELECT target_hours FROM sla_configurations WHERE severity = ?').get(severity);
  const hours = row ? row.target_hours : 48;
  return new Date(fromDate.getTime() + hours * 3600 * 1000).toISOString();
}

export function checkAndTriggerOverdueEscalations(actorId = null, actorRole = 'system') {
  const nowIso = new Date().toISOString();
  const overdueComplaints = db
    .prepare(
      `SELECT id, tracking_code, title, severity, status, escalation_level, sla_deadline_at, reporter_id
       FROM complaints
       WHERE deleted_at IS NULL
         AND status NOT IN ('Resolved')
         AND sla_deadline_at IS NOT NULL
         AND sla_deadline_at < ?
         AND (is_overdue = 0 OR escalation_level = 0)`
    )
    .all(nowIso);

  const escalated = [];

  for (const c of overdueComplaints) {
    const slaRule = db.prepare('SELECT target_hours, escalation_target FROM sla_configurations WHERE severity = ?').get(c.severity);
    const nextLevel = (c.escalation_level || 0) + 1;
    const reason = `${c.severity} SLA target (${slaRule?.target_hours || 48}h) breached. Escalated to ${slaRule?.escalation_target || 'Senior Review Cell'}.`;

    db.prepare(
      `UPDATE complaints
       SET is_overdue = 1, escalation_level = ?, status = 'Escalated', updated_at = datetime('now')
       WHERE id = ?`
    ).run(nextLevel, c.id);

    db.prepare(
      `INSERT INTO escalation_history (complaint_id, from_level, to_level, reason, triggered_by)
       VALUES (?, ?, ?, ?, ?)`
    ).run(c.id, c.escalation_level || 0, nextLevel, reason, actorRole === 'government' ? 'Official SLA Sweep' : 'Automated SLA Engine');

    db.prepare(
      `INSERT INTO complaint_status_history (complaint_id, status, note, actor_id, actor_role)
       VALUES (?, 'Escalated', ?, ?, ?)`
    ).run(c.id, reason, actorId, actorRole);

    createNotification(
      c.reporter_id,
      `SLA Escalation: ${c.tracking_code}`,
      `Your complaint "${c.title}" crossed its SLA deadline and was escalated to Level ${nextLevel}.`,
      '/citizen/my-complaints'
    );

    logAudit(actorId, actorRole, 'SLA_ESCALATE', 'complaints', c.id, {
      trackingCode: c.tracking_code,
      fromLevel: c.escalation_level || 0,
      toLevel: nextLevel,
    });

    escalated.push({ id: c.id, trackingCode: c.tracking_code, level: nextLevel, reason });
  }

  return escalated;
}
