import fs from 'node:fs';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import db from '../config/db.js';
import { ISSUE_CATEGORIES, SEVERITY_LEVELS } from '../config/constants.js';

function getValidApiKey() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return key;
}

function getGenAIClient() {
  const apiKey = getValidApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function getAIStatus() {
  const configured = Boolean(getValidApiKey());
  return {
    geminiConfigured: configured,
    model: configured ? 'gemini-4-hydrogen' : 'rule-based-fallback',
    embeddingModel: configured ? 'gemini-embedding-2' : 'token-jaccard-fallback',
    modeLabel: configured
      ? 'Connected to Gemini AI (gemini-4-hydrogen)'
      : 'Rule-based Fallback Mode (GEMINI_API_KEY not configured)',
  };
}

function findDepartmentForCategory(categoryName) {
  const catRow = db
    .prepare(
      `SELECT ic.name, ic.default_severity, d.id AS dept_id, d.name AS dept_name
       FROM issue_categories ic
       LEFT JOIN departments d ON ic.default_department_id = d.id
       WHERE ic.name = ? AND ic.active = 1`
    )
    .get(categoryName);

  if (catRow && catRow.dept_id) {
    return { departmentId: catRow.dept_id, departmentName: catRow.dept_name, defaultSeverity: catRow.default_severity };
  }

  const fallbackDept = db.prepare('SELECT id, name FROM departments WHERE active = 1 ORDER BY id ASC LIMIT 1').get();
  return {
    departmentId: fallbackDept ? fallbackDept.id : null,
    departmentName: fallbackDept ? fallbackDept.name : 'Municipal Road & Engineering Department',
    defaultSeverity: 'Medium',
  };
}

function summarizeImageMetadata(imageMetadata) {
  if (!imageMetadata || typeof imageMetadata !== 'object') {
    return { summaryText: 'No media attached yet.', signals: [], hintText: '' };
  }

  const parts = [];
  const signals = [];

  if (imageMetadata.fileName) {
    parts.push(`Filename: ${imageMetadata.fileName}`);
  }
  if (imageMetadata.mimeType) {
    parts.push(`Format: ${imageMetadata.mimeType}`);
  }
  if (imageMetadata.resolutionLabel) {
    parts.push(`Resolution: ${imageMetadata.resolutionLabel} (${imageMetadata.orientation || 'Standard'})`);
    signals.push(`Image metadata (${imageMetadata.resolutionLabel})`);
  } else if (imageMetadata.mediaKind) {
    signals.push(`Attached ${imageMetadata.mediaKind} metadata`);
  }
  if (imageMetadata.sizeLabel) {
    parts.push(`Size: ${imageMetadata.sizeLabel}`);
  }
  if (imageMetadata.recencyLabel) {
    parts.push(`Capture timing: ${imageMetadata.recencyLabel}`);
  }
  if (imageMetadata.cameraLabel) {
    parts.push(`Device: ${imageMetadata.cameraLabel}`);
  }
  if (imageMetadata.hasExifGps && imageMetadata.exifGps) {
    parts.push(`EXIF GPS: ${imageMetadata.exifGps.lat}, ${imageMetadata.exifGps.lng}`);
    signals.push('EXIF GPS coordinates');
  }
  if (Array.isArray(imageMetadata.filenameHints) && imageMetadata.filenameHints.length > 0) {
    parts.push(`Filename hints: ${imageMetadata.filenameHints.join(', ')}`);
    signals.push(`Filename clues (${imageMetadata.filenameHints.slice(0, 3).join(', ')})`);
  }

  const hintText = [
    imageMetadata.fileName || '',
    ...(Array.isArray(imageMetadata.filenameHints) ? imageMetadata.filenameHints : []),
  ]
    .join(' ')
    .replace(/[_-]+/g, ' ')
    .trim();

  return {
    summaryText: parts.length > 0 ? parts.join(' | ') : 'Media metadata attached.',
    signals,
    hintText,
  };
}

function buildSignals({ title, description, address, imageMetadata, hasVisualImage }) {
  const signals = [];
  const textLen = `${title || ''} ${description || ''}`.trim().length;
  if (textLen > 0) {
    signals.push(textLen >= 20 ? 'Title & description text' : 'Draft headline text');
  }
  if (address && address.trim().length > 4) {
    signals.push('Location & ward context');
  }
  if (hasVisualImage) {
    signals.push('Uploaded image pixels');
  }
  const metaSummary = summarizeImageMetadata(imageMetadata);
  for (const s of metaSummary.signals) {
    if (!signals.includes(s)) signals.push(s);
  }
  return signals;
}

function ruleBasedAnalyze({ title, description, userCategory, address, imageMetadata, hasVisualImage = false }) {
  const metaSummary = summarizeImageMetadata(imageMetadata);
  const combinedText = `${title || ''} ${description || ''} ${metaSummary.hintText || ''}`.toLowerCase();

  const keywordMap = [
    { category: 'Waterlogging', words: ['waterlogging', 'waterlog', 'flood', 'flooded', 'knee-deep', 'submerged', 'stagnant water', 'rainwater'] },
    { category: 'Water leakage', words: ['water leak', 'leakage', 'leaking', 'pipe burst', 'pipeline', 'ruptured', 'drinking water', 'tap'] },
    { category: 'Drainage problem', words: ['drain', 'drainage', 'culvert', 'sewer', 'manhole', 'choked', 'overflowing drain', 'gutter'] },
    { category: 'Broken streetlight', words: ['streetlight', 'street light', 'lamp', 'pole', 'dark', 'unlit', 'bulb', 'wire', 'light'] },
    { category: 'Garbage accumulation', words: ['garbage', 'trash', 'waste', 'bin', 'dump', 'litter', 'sanitation', 'rubbish'] },
    { category: 'Pothole', words: ['pothole', 'crater', 'pit', 'hole in road'] },
    { category: 'Damaged road', words: ['road', 'asphalt', 'pavement', 'crack', 'broken road', 'highway', 'street'] },
    { category: 'Damaged public infrastructure', words: ['bench', 'railing', 'bus stop', 'footpath', 'bridge', 'signage', 'wall', 'park'] },
  ];

  let predictedCategory = userCategory && ISSUE_CATEGORIES.includes(userCategory) ? userCategory : 'Other civic issues';
  let matchedWords = [];

  for (const entry of keywordMap) {
    const hits = entry.words.filter((w) => combinedText.includes(w));
    if (hits.length > matchedWords.length) {
      matchedWords = hits;
      predictedCategory = entry.category;
    }
  }

  const urgentTerms = ['exposed wire', 'electrical', 'electric', 'live wire', 'collapse', 'deep', 'major', 'hospital', 'school', 'flood', 'flooded', 'burst', 'blocking traffic', 'accident', 'emergency', 'sparks'];
  const highTerms = ['large', 'heavy', 'ruptured', 'broken', 'overflowing', 'dangerous', 'two-wheeler', 'unlit', 'dark', 'night', 'pothole', 'manhole'];
  const lowTerms = ['minor', 'small', 'slight', 'cosmetic', 'faded'];

  let severity = 'Medium';
  let severityReason = 'Standard civic impact estimated from current text and context.';

  if (urgentTerms.some((t) => combinedText.includes(t))) {
    severity = 'Critical';
    severityReason = 'Urgent safety-risk cues (such as electrical hazard, flooding, pipe burst, or severe obstruction) indicate Critical priority.';
  } else if (highTerms.some((t) => combinedText.includes(t)) || predictedCategory === 'Water leakage' || predictedCategory === 'Pothole') {
    severity = 'High';
    severityReason = 'Significant commuter disruption or public safety risk detected in report details and media cues.';
  } else if (lowTerms.some((t) => combinedText.includes(t))) {
    severity = 'Low';
    severityReason = 'Minor localized maintenance issue indicated; routine scheduled priority recommended.';
  }

  const hasHighResPhoto = Boolean(imageMetadata?.width >= 800 || imageMetadata?.sizeBytes >= 150000);
  const hasExifGps = Boolean(imageMetadata?.hasExifGps);
  let confidence = matchedWords.length > 0 ? 0.78 : 0.6;
  if (matchedWords.length >= 2) confidence += 0.06;
  if (hasHighResPhoto) confidence += 0.05;
  if (hasExifGps) confidence += 0.04;
  confidence = Number(Math.min(0.95, confidence).toFixed(2));

  const tokens = combinedText
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);

  const dept = findDepartmentForCategory(predictedCategory);
  const summarySource = (description || title || metaSummary.hintText || '').trim();
  const summary = summarySource.length > 135 ? `${summarySource.slice(0, 132)}...` : summarySource;
  const signals = buildSignals({ title, description, address, imageMetadata, hasVisualImage });

  const mediaNote = imageMetadata
    ? ` Media metadata reviewed (${imageMetadata.resolutionLabel || imageMetadata.mediaKind}${imageMetadata.hasExifGps ? ', EXIF GPS verified' : ''}${imageMetadata.recencyLabel ? `, ${imageMetadata.recencyLabel.toLowerCase()}` : ''}).`
    : '';

  return {
    predictedCategory,
    summary: summary || `${predictedCategory} reported near ${address || 'Mathura'}.`,
    recommendedSeverity: severity,
    priorityReason: severityReason,
    keywords: Array.from(new Set([...matchedWords, ...tokens])).slice(0, 6),
    suggestedDepartmentId: dept.departmentId,
    suggestedDepartmentName: dept.departmentName,
    explanation: `Predicted ${predictedCategory} (${severity} priority): ${severityReason}${mediaNote} Suggested routing: ${dept.departmentName}.`,
    confidence,
    signals,
    provider: 'rule-based-fallback',
    isFallback: true,
  };
}

export async function analyzeCivicIssue({
  title,
  description,
  userCategory,
  address,
  imagePath,
  imageMimeType,
  imageMetadata = null,
  fastMode = false,
}) {
  const hasVisualImage = Boolean(
    imagePath && fs.existsSync(imagePath) && imageMimeType && imageMimeType.startsWith('image/')
  );
  const ai = getGenAIClient();
  if (!ai) {
    return ruleBasedAnalyze({ title, description, userCategory, address, imageMetadata, hasVisualImage });
  }

  try {
    const parts = [];
    if (hasVisualImage) {
      const base64Data = fs.readFileSync(imagePath).toString('base64');
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: base64Data,
        },
      });
    }

    const metaSummary = summarizeImageMetadata(imageMetadata);

    const promptText = `You are a real-time civic triage assistant for FixGrid AI in Mathura, India.
Predict the most accurate civic issue category and priority level using ALL available signals: text input, location, attached image (if provided), and image metadata.
Allowed categories: ${ISSUE_CATEGORIES.join(', ')}.
Allowed severities (priorities): ${SEVERITY_LEVELS.join(', ')}.

Report Title: ${title || 'Not entered yet'}
User-selected Category: ${userCategory || 'Not specified'}
Location: ${address || 'Mathura area'}
Description: ${description || 'Not entered yet'}
Image Metadata: ${metaSummary.summaryText}

Return structured JSON predicting category, concise 1-sentence summary, priority level (recommendedSeverity), brief priorityReason, up to 6 keywords, confidence (0.4 to 0.99), and a concise explanation of why you predicted this category and priority from the text and media signals.`;

    parts.push({ text: promptText });

    const config = {
      systemInstruction:
        'Return factual, cautious civic triage JSON. Weigh both user text and image metadata clues (filename hints, resolution, capture recency, EXIF GPS). Keep explanation concise and transparent.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          predictedCategory: { type: Type.STRING },
          summary: { type: Type.STRING },
          recommendedSeverity: { type: Type.STRING },
          priorityReason: { type: Type.STRING },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
        },
        required: ['predictedCategory', 'summary', 'recommendedSeverity', 'keywords', 'explanation'],
      },
    };

    if (fastMode) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config,
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    const predictedCategory = ISSUE_CATEGORIES.includes(parsed.predictedCategory)
      ? parsed.predictedCategory
      : (ISSUE_CATEGORIES.includes(userCategory) ? userCategory : 'Other civic issues');
    const recommendedSeverity = SEVERITY_LEVELS.includes(parsed.recommendedSeverity)
      ? parsed.recommendedSeverity
      : 'Medium';
    const dept = findDepartmentForCategory(predictedCategory);
    const signals = buildSignals({ title, description, address, imageMetadata, hasVisualImage });

    return {
      predictedCategory,
      summary: parsed.summary || title || `${predictedCategory} report`,
      recommendedSeverity,
      priorityReason: parsed.priorityReason || parsed.explanation || 'Assessed from text and media context.',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
      suggestedDepartmentId: dept.departmentId,
      suggestedDepartmentName: dept.departmentName,
      explanation: parsed.explanation || 'Assessed from report text and image metadata.',
      confidence: typeof parsed.confidence === 'number' ? Math.min(0.99, Math.max(0.4, parsed.confidence)) : 0.88,
      signals,
      provider: 'gemini-4-hydrogen',
      isFallback: false,
    };
  } catch (err) {
    console.warn('Gemini AI analysis fallback triggered:', err.message);
    const fallback = ruleBasedAnalyze({ title, description, userCategory, address, imageMetadata, hasVisualImage });
    fallback.explanation = `${fallback.explanation} (Fallback used: ${err.message})`;
    return fallback;
  }
}

export async function generateEmbedding(text) {
  const ai = getGenAIClient();
  if (!ai || !text) return null;
  try {
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
    });
    const values = res?.embeddings?.[0]?.values || res?.embedding?.values;
    return Array.isArray(values) ? values : null;
  } catch {
    return null;
  }
}
