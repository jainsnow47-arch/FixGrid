import db from '../config/db.js';
import { DEFAULT_MATCH_WEIGHTS } from '../config/constants.js';

export function getMatchWeights() {
  const row = db.prepare("SELECT value_json FROM platform_settings WHERE key = 'skill_match_weights'").get();
  if (!row) return DEFAULT_MATCH_WEIGHTS;
  try {
    return { ...DEFAULT_MATCH_WEIGHTS, ...JSON.parse(row.value_json) };
  } catch {
    return DEFAULT_MATCH_WEIGHTS;
  }
}

/**
 * Calculates an explainable skill-based match score between a student profile and a civic challenge.
 * Never produces random percentages: every point maps directly to profile & challenge attributes.
 */
export function computeExplainableMatch(studentProfile, studentUser, challenge) {
  const weights = getMatchWeights();
  const totalWeight =
    weights.skills + weights.domain + weights.experience + weights.availability + weights.proximity || 100;

  const normalize = (w) => w / totalWeight;

  const studentSkills = safeJsonArray(studentProfile?.skills_json).map((s) => s.toLowerCase().trim());
  const requiredSkills = safeJsonArray(challenge.skills_required_json);
  const studentInterests = safeJsonArray(studentProfile?.interests_json).map((s) => s.toLowerCase().trim());

  // 1. Skills match
  const matchedSkills = [];
  const missingSkills = [];
  for (const reqSkill of requiredSkills) {
    const low = reqSkill.toLowerCase().trim();
    const found = studentSkills.some((s) => s.includes(low) || low.includes(s));
    if (found) matchedSkills.push(reqSkill);
    else missingSkills.push(reqSkill);
  }
  const skillRatio = requiredSkills.length > 0 ? matchedSkills.length / requiredSkills.length : 0.5;
  const skillPoints = Math.round(skillRatio * weights.skills);

  // 2. Domain knowledge match
  const challengeCategory = (challenge.category || '').toLowerCase();
  const domainDirect = studentInterests.some((i) => challengeCategory.includes(i) || i.includes(challengeCategory));
  const domainTextHit = (studentProfile?.experience_summary || '').toLowerCase().includes(challengeCategory.split(' ')[0]);
  const domainRatio = domainDirect ? 1 : domainTextHit ? 0.65 : 0.25;
  const domainPoints = Math.round(domainRatio * weights.domain);

  // 3. Prior experience
  const expLength = (studentProfile?.experience_summary || '').trim().length;
  const expRatio = expLength >= 100 ? 0.92 : expLength >= 40 ? 0.72 : expLength > 0 ? 0.45 : 0.15;
  const experiencePoints = Math.round(expRatio * weights.experience);

  // 4. Availability compatibility
  const hours = Number(studentProfile?.availability_hours || 0);
  const requiredHours = challenge.difficulty === 'Advanced' ? 14 : challenge.difficulty === 'Intermediate' ? 10 : 6;
  const availRatio = hours >= requiredHours ? 1 : hours >= requiredHours * 0.6 ? 0.7 : 0.35;
  const availabilityPoints = Math.round(availRatio * weights.availability);

  // 5. Geographic / institutional proximity
  const studentCity = (studentProfile?.city || studentUser?.city || '').toLowerCase();
  const challengeLocation = (challenge.location || '').toLowerCase();
  const sameCity = studentCity && challengeLocation.includes(studentCity);
  const proximityRatio = sameCity ? 1 : studentCity ? 0.5 : 0.3;
  const proximityPoints = Math.round(proximityRatio * weights.proximity);

  const rawScore = skillPoints + domainPoints + experiencePoints + availabilityPoints + proximityPoints;
  const overallScore = Math.min(100, Math.round(rawScore * (100 / totalWeight) * (totalWeight / 100)));

  const explanationParts = [];
  if (matchedSkills.length > 0) {
    explanationParts.push(`Matches ${matchedSkills.length}/${requiredSkills.length} required skills (${matchedSkills.join(', ')}).`);
  } else {
    explanationParts.push(`No direct matches across ${requiredSkills.length} required skills yet.`);
  }
  explanationParts.push(domainDirect ? `Strong domain alignment with ${challenge.category}.` : `Partial domain overlap for ${challenge.category}.`);
  explanationParts.push(`Availability ${hours} hrs/week vs ~${requiredHours} hrs/week recommended.`);
  if (sameCity) {
    explanationParts.push(`Local Mathura proximity supports field testing.`);
  }

  return {
    overallScore,
    weights,
    breakdown: {
      skills: skillPoints,
      domain: domainPoints,
      experience: experiencePoints,
      availability: availabilityPoints,
      proximity: proximityPoints,
    },
    matchedSkills,
    missingSkills,
    availabilityCompatible: hours >= requiredHours,
    relevantExperience: studentProfile?.experience_summary || 'No prior experience summary provided yet.',
    explanation: explanationParts.join(' '),
  };
}

function safeJsonArray(str) {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
