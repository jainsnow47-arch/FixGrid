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

export function buildSuggestedAction(category = 'Other civic issues', severity = 'Medium', departmentName = 'Municipal Engineering Team') {
  const isUrgent = severity === 'Critical' || severity === 'High';
  const actions = {
    'Broken streetlight': isUrgent
      ? 'Dispatch electrical safety crew immediately to isolate any exposed wiring, secure the pole, and restore street lighting.'
      : 'Schedule electrical maintenance team to inspect pole wiring and replace the damaged lamp fixture.',
    'Water leakage': isUrgent
      ? 'Deploy rapid-response waterworks unit to isolate pipeline valve pressure and clamp the leaking main.'
      : 'Schedule plumbing inspection crew to seal minor joint seepage and check nearby line pressure.',
    'Waterlogging': isUrgent
      ? 'Deploy storm-drain suction pumps and clear choked roadside inlets to restore safe traffic passage.'
      : 'Assign drainage clearance crew to flush surface inlets and inspect slope runoff.',
    'Drainage problem': isUrgent
      ? 'Send sanitation & drainage crew immediately to desilt blocked chambers and secure open manhole hazards.'
      : 'Schedule routine culvert desilting and drain cover inspection with sanitation staff.',
    'Pothole': isUrgent
      ? 'Place reflective safety cones around the cavity and dispatch asphalt patching crew to restore road surface.'
      : 'Queue road maintenance team for cold-mix pothole filling and surface leveling.',
    'Damaged road': isUrgent
      ? 'Cordon unsafe road stretch and assign civil engineering unit for sub-base repair and resurfacing.'
      : 'Include road segment in scheduled resurfacing and pavement maintenance cycle.',
    'Garbage accumulation': isUrgent
      ? 'Dispatch tipper truck and sanitation sweepers urgently to clear waste buildup and sanitize the perimeter.'
      : 'Route municipal waste collection vehicle for scheduled bin clearance and street sweeping.',
    'Damaged public infrastructure': isUrgent
      ? 'Secure damaged public structure to prevent pedestrian injury and dispatch civil repair team.'
      : 'Log structural inspection and schedule routine carpentry/masonry restoration.',
  };

  return (
    actions[category] ||
    `Assign field inspection officer from ${departmentName || 'the relevant municipal department'} to verify site conditions and initiate repair.`
  );
}

const RAW_ERROR_PATTERNS = [
  /RESOURCE_EXHAUSTED/i,
  /PERMISSION_DENIED/i,
  /API_KEY_INVALID/i,
  /Fallback used:/i,
  /fallback triggered/i,
  /Quota exceeded/i,
  /generativelanguage\.googleapis\.com/i,
  /ai\.google\.dev/i,
  /retryDelay/i,
  /retry in \d+/i,
  /\{\s*"error"\s*:/i,
  /ApiError/i,
  /status\s*:\s*4\d\d/i,
];

export function hasRawErrorContent(text) {
  if (!text || typeof text !== 'string') return false;
  return RAW_ERROR_PATTERNS.some((re) => re.test(text));
}

export function sanitizeAiExplanation(text, { category = 'Other civic issues', severity = 'Medium', departmentName = 'Municipal Engineering Department' } = {}) {
  if (!text || typeof text !== 'string' || !text.trim() || hasRawErrorContent(text)) {
    return `Classified under ${category} with ${severity} priority based on complaint details and location context. Recommended routing: ${departmentName}.`;
  }
  return text.trim();
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
  let severityReason = 'Standard civic impact estimated from complaint details and context.';

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
  const suggestedAction = buildSuggestedAction(predictedCategory, severity, dept.departmentName);

  const mediaNote = imageMetadata
    ? ` Media metadata reviewed (${imageMetadata.resolutionLabel || imageMetadata.mediaKind}${imageMetadata.hasExifGps ? ', EXIF GPS verified' : ''}${imageMetadata.recencyLabel ? `, ${imageMetadata.recencyLabel.toLowerCase()}` : ''}).`
    : '';

  return {
    predictedCategory,
    summary: summary || `${predictedCategory} reported near ${address || 'Mathura'}.`,
    recommendedSeverity: severity,
    priorityReason: severityReason,
    suggestedAction,
    keywords: Array.from(new Set([...matchedWords, ...tokens])).slice(0, 6),
    suggestedDepartmentId: dept.departmentId,
    suggestedDepartmentName: dept.departmentName,
    explanation: `${severityReason}${mediaNote} Recommended routing: ${dept.departmentName}.`,
    confidence,
    signals,
    assessmentType: 'Automated Assessment',
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

Return structured JSON predicting category, concise 1-sentence summary, priority level (recommendedSeverity), brief priorityReason, concise suggestedAction for the municipal team, up to 6 keywords, confidence (0.4 to 0.99), and a concise explanation of why you predicted this category and priority from the text and media signals.`;

    parts.push({ text: promptText });

    const config = {
      systemInstruction:
        'Return factual, cautious civic triage JSON. Weigh both user text and image metadata clues (filename hints, resolution, capture recency, EXIF GPS). Keep explanation and suggestedAction concise and transparent.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          predictedCategory: { type: Type.STRING },
          summary: { type: Type.STRING },
          recommendedSeverity: { type: Type.STRING },
          priorityReason: { type: Type.STRING },
          suggestedAction: { type: Type.STRING },
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

    const rawText = (response.text || '').trim();
    if (!rawText) {
      throw new Error('Empty response from Gemini model');
    }

    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid structured response from Gemini model');
    }

    const predictedCategory = ISSUE_CATEGORIES.includes(parsed.predictedCategory)
      ? parsed.predictedCategory
      : (ISSUE_CATEGORIES.includes(userCategory) ? userCategory : 'Other civic issues');
    const recommendedSeverity = SEVERITY_LEVELS.includes(parsed.recommendedSeverity)
      ? parsed.recommendedSeverity
      : 'Medium';
    const dept = findDepartmentForCategory(predictedCategory);
    const signals = buildSignals({ title, description, address, imageMetadata, hasVisualImage });
    const suggestedAction =
      typeof parsed.suggestedAction === 'string' && parsed.suggestedAction.trim().length >= 8
        ? parsed.suggestedAction.trim()
        : buildSuggestedAction(predictedCategory, recommendedSeverity, dept.departmentName);

    return {
      predictedCategory,
      summary: parsed.summary || title || `${predictedCategory} report`,
      recommendedSeverity,
      priorityReason: parsed.priorityReason || parsed.explanation || 'Assessed from text and media context.',
      suggestedAction,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
      suggestedDepartmentId: dept.departmentId,
      suggestedDepartmentName: dept.departmentName,
      explanation: sanitizeAiExplanation(parsed.explanation, {
        category: predictedCategory,
        severity: recommendedSeverity,
        departmentName: dept.departmentName,
      }),
      confidence: typeof parsed.confidence === 'number' ? Math.min(0.99, Math.max(0.4, parsed.confidence)) : 0.88,
      signals,
      assessmentType: 'AI Assessment',
      provider: 'gemini-4-hydrogen',
      isFallback: false,
    };
  } catch (err) {
    console.warn('Gemini AI analysis fallback triggered:', err?.status || err?.code || err?.message || 'Unknown error');
    return ruleBasedAnalyze({ title, description, userCategory, address, imageMetadata, hasVisualImage });
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

function cleanSpokenTranscript(raw = '') {
  const trimmed = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function extractLocationHints(transcript = '') {
  const wardMatch = transcript.match(/\bward\s*(?:no\.?|number)?\s*(\d{1,3})\b/i);
  const ward = wardMatch ? `Ward ${wardMatch[1]}` : '';

  const knownAreas = [
    'Krishna Nagar',
    'Holi Gate',
    'Dampier Nagar',
    'Govind Nagar',
    'Vrindavan Road',
    'Civil Lines',
    'Masani',
    'Bhuteshwar',
    'Chhatikara',
    'Radha Puram',
  ];
  const matchedArea = knownAreas.find((area) => transcript.toLowerCase().includes(area.toLowerCase()));

  const phraseMatch = transcript.match(
    /\b(?:near|at|outside|beside|opposite|behind|in front of|on)\s+([A-Za-z0-9\s,'-]{4,55}?)(?=(?:,|\.|and\s|it\s|which\s|where\s|causing\s|for\s|$))/i
  );

  let address = '';
  if (phraseMatch && phraseMatch[1]) {
    address = phraseMatch[1].trim().replace(/\s+/g, ' ');
    if (matchedArea && !address.toLowerCase().includes(matchedArea.toLowerCase())) {
      address = `${address}, ${matchedArea}`;
    }
    if (!address.toLowerCase().includes('mathura')) {
      address = `${address}, Mathura`;
    }
  } else if (matchedArea) {
    address = `${matchedArea}, Mathura`;
  }

  return {
    address,
    ward: ward && matchedArea ? `${ward} (${matchedArea})` : ward || (matchedArea ? matchedArea : ''),
  };
}

function buildSmartTitle(description, predictedCategory, addressHint) {
  const firstClause = description
    .split(/[.!?]|\band\b|\bcausing\b/i)[0]
    .replace(/^(hi|hello|there is|there's|i want to report|please fix)\s+/i, '')
    .trim();

  if (firstClause.length >= 10 && firstClause.length <= 72) {
    return firstClause.charAt(0).toUpperCase() + firstClause.slice(1);
  }
  if (firstClause.length > 72) {
    return `${firstClause.slice(0, 69).trim()}...`;
  }
  const shortLoc = addressHint ? ` near ${addressHint.split(',')[0]}` : '';
  return `${predictedCategory}${shortLoc}`;
}

export async function extractIssueFromVoice({
  transcript = '',
  audioBuffer = null,
  audioMimeType = '',
  currentAddress = '',
  currentWard = '',
}) {
  const ai = getGenAIClient();
  let finalTranscript = String(transcript || '').trim();
  const hasAudio = Boolean(audioBuffer && audioBuffer.length > 0);

  // Step 1: If audio stream is present and Gemini is configured, transcribe accurately using gemini-3.5-transcribe
  if (ai && hasAudio) {
    try {
      const cleanMime = String(audioMimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
      const transcriptionRes = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: audioBuffer.toString('base64'),
              },
            },
            {
              text: finalTranscript
                ? `Transcribe this civic issue voice recording accurately. Browser speech recognition draft for reference: "${finalTranscript}". Return only the clean transcript text.`
                : 'Transcribe this civic issue voice recording accurately into clean text. Return only the transcript.',
            },
          ],
        },
      });
      const transcribedText = (transcriptionRes.text || '').trim();
      if (transcribedText.length >= 3) {
        finalTranscript = transcribedText;
      }
    } catch (err) {
      console.warn('Gemini audio transcription fallback to Web Speech transcript:', err.message);
    }
  }

  if (!finalTranscript || finalTranscript.length < 3) {
    throw new Error('No speech was detected in your microphone input. Please speak clearly and try again.');
  }

  // Step 2: Structured AI extraction into report form fields
  if (ai) {
    try {
      const prompt = `You are a civic intake assistant for FixGrid AI in Mathura, India.
Convert the citizen's spoken civic issue description into structured issue report form fields.
Allowed categories: ${ISSUE_CATEGORIES.join(', ')}.
Allowed severities: ${SEVERITY_LEVELS.join(', ')}.

Spoken Transcript: "${finalTranscript}"
Existing Map Address Context: ${currentAddress || 'Not specified'}
Existing Ward Context: ${currentWard || 'Not specified'}

Return JSON with:
- title: concise 5-10 word report headline
- description: clear, polite 1-3 sentence issue description preserving all factual details and landmarks
- category: exact match from allowed categories
- recommendedSeverity: exact match from allowed severities
- extractedAddress: specific street/landmark mentioned in speech (or empty string if none mentioned)
- extractedWard: specific ward/locality mentioned in speech (or empty string if none mentioned)
- priorityReason: brief reason for the priority level
- keywords: up to 6 keywords
- explanation: concise reasoning for category and priority
- confidence: number between 0.5 and 0.99`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Extract clean civic issue form fields strictly from the citizen transcript without inventing unmentioned locations or facts.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { type: Type.STRING },
              recommendedSeverity: { type: Type.STRING },
              extractedAddress: { type: Type.STRING },
              extractedWard: { type: Type.STRING },
              priorityReason: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              explanation: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: ['title', 'description', 'category', 'recommendedSeverity', 'explanation'],
          },
        },
      });

      const rawVoiceText = (response.text || '').trim();
      if (!rawVoiceText) {
        throw new Error('Empty response from Gemini model');
      }
      const parsed = JSON.parse(rawVoiceText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid voice extraction payload');
      }

      const predictedCategory = ISSUE_CATEGORIES.includes(parsed.category)
        ? parsed.category
        : 'Other civic issues';
      const recommendedSeverity = SEVERITY_LEVELS.includes(parsed.recommendedSeverity)
        ? parsed.recommendedSeverity
        : 'Medium';
      const dept = findDepartmentForCategory(predictedCategory);
      const signals = ['Web Speech voice transcript'];
      if (hasAudio) signals.push('Microphone audio stream');
      if (parsed.extractedAddress) signals.push('Spoken location landmark');
      const suggestedAction = buildSuggestedAction(predictedCategory, recommendedSeverity, dept.departmentName);

      return {
        extracted: {
          transcript: finalTranscript,
          title: (parsed.title || buildSmartTitle(finalTranscript, predictedCategory, parsed.extractedAddress)).trim(),
          description: cleanSpokenTranscript(parsed.description || finalTranscript),
          category: predictedCategory,
          address: (parsed.extractedAddress || '').trim(),
          ward: (parsed.extractedWard || '').trim(),
        },
        analysis: {
          predictedCategory,
          summary: cleanSpokenTranscript(parsed.description || finalTranscript),
          recommendedSeverity,
          priorityReason: parsed.priorityReason || parsed.explanation || 'Assessed from spoken issue details.',
          suggestedAction,
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
          suggestedDepartmentId: dept.departmentId,
          suggestedDepartmentName: dept.departmentName,
          explanation: sanitizeAiExplanation(parsed.explanation, {
            category: predictedCategory,
            severity: recommendedSeverity,
            departmentName: dept.departmentName,
          }),
          confidence: typeof parsed.confidence === 'number' ? Math.min(0.99, Math.max(0.5, parsed.confidence)) : 0.9,
          signals,
          assessmentType: 'AI Assessment',
          provider: 'gemini-4-hydrogen',
          isFallback: false,
        },
      };
    } catch (err) {
      console.warn('Gemini voice extraction fallback triggered:', err?.status || err?.code || err?.message || 'Unknown error');
    }
  }

  // Rule-based intelligent extraction fallback
  const cleanedDesc = cleanSpokenTranscript(finalTranscript);
  const locHints = extractLocationHints(cleanedDesc);
  const triage = ruleBasedAnalyze({
    title: cleanedDesc.slice(0, 80),
    description: cleanedDesc,
    userCategory: '',
    address: locHints.address || currentAddress,
  });

  const signals = ['Web Speech voice transcript'];
  if (hasAudio) signals.push('Microphone audio stream');
  if (locHints.address) signals.push('Spoken location landmark');

  triage.signals = signals;

  return {
    extracted: {
      transcript: finalTranscript,
      title: buildSmartTitle(cleanedDesc, triage.predictedCategory, locHints.address),
      description: cleanedDesc,
      category: triage.predictedCategory,
      address: locHints.address,
      ward: locHints.ward,
    },
    analysis: triage,
  };
}
