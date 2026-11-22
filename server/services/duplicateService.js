import db from '../config/db.js';

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tokenize(text) {
  return new Set(
    (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(textA, textB) {
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return null;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < vecA.length; i += 1) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Finds potential duplicate civic complaints without deleting originals.
 * Combines semantic similarity (Gemini embedding cosine or token Jaccard),
 * category match, Haversine geographic proximity, and a 30-day time window.
 */
export function findPotentialDuplicates({
  excludeId = null,
  title,
  description,
  category,
  latitude,
  longitude,
  embedding = null,
}) {
  const candidates = db
    .prepare(
      `SELECT id, tracking_code, title, description, category, status, address,
              latitude, longitude, embedding_json, created_at
       FROM complaints
       WHERE deleted_at IS NULL
         AND datetime(created_at) >= datetime('now', '-30 days')`
    )
    .all();

  const matches = [];
  const inputText = `${title || ''} ${description || ''}`;

  for (const item of candidates) {
    if (excludeId && item.id === excludeId) continue;

    const distanceMeters = Math.round(
      haversineMeters(Number(latitude), Number(longitude), Number(item.latitude), Number(item.longitude))
    );

    // Filter out distant reports (> 600 meters) unless exact category & high text match
    if (distanceMeters > 800) continue;

    let textScore = jaccardSimilarity(inputText, `${item.title} ${item.description}`);
    let method = 'text-token-jaccard';

    if (embedding && item.embedding_json) {
      try {
        const parsedVec = JSON.parse(item.embedding_json);
        const cos = cosineSimilarity(embedding, parsedVec);
        if (typeof cos === 'number') {
          textScore = Math.max(textScore, cos);
          method = 'gemini-embedding-cosine';
        }
      } catch {
        // Ignore malformed JSON embedding
      }
    }

    const categoryMatch = item.category === category ? 0.25 : 0;
    const proximityScore = distanceMeters <= 100 ? 0.35 : distanceMeters <= 300 ? 0.22 : 0.1;
    const combinedScore = Number(Math.min(0.99, textScore * 0.45 + categoryMatch + proximityScore).toFixed(2));

    if (combinedScore >= 0.48 || (item.category === category && distanceMeters <= 150)) {
      matches.push({
        complaintId: item.id,
        trackingCode: item.tracking_code,
        title: item.title,
        category: item.category,
        status: item.status,
        address: item.address,
        distanceMeters,
        similarityScore: combinedScore,
        method,
        reason: `Category ${item.category === category ? 'matches' : 'differs'}, ${distanceMeters}m apart, semantic overlap ${(textScore * 100).toFixed(0)}%.`,
      });
    }
  }

  return matches.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);
}
