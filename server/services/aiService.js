import fs from 'node:fs';
import { GoogleGenAI, Type } from '@google/genai';
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

function ruleBasedAnalyze({ title, description, userCategory, address }) {
  const text = `${title || ''} ${description || ''}`.toLowerCase();

  const keywordMap = [
    { category: 'Waterlogging', words: ['waterlogging', 'flood', 'flooded', 'knee-deep', 'submerged', 'stagnant water'] },
    { category: 'Water leakage', words: ['water leak', 'pipe burst', 'pipeline', 'ruptured', 'leaking water', 'drinking water'] },
    { category: 'Drainage problem', words: ['drain', 'culvert', 'sewer', 'manhole', 'choked', 'overflowing drain'] },
    { category: 'Broken streetlight', words: ['streetlight', 'street light', 'lamp', 'pole', 'dark', 'unlit', 'bulb', 'wire'] },
    { category: 'Garbage accumulation', words: ['garbage', 'trash', 'waste', 'bin', 'dump', 'litter', 'sanitation'] },
    { category: 'Pothole', words: ['pothole', 'crater', 'pit', 'hole in road'] },
    { category: 'Damaged road', words: ['road', 'asphalt', 'pavement', 'crack', 'broken road', 'highway'] },
    { category: 'Damaged public infrastructure', words: ['bench', 'railing', 'bus stop', 'footpath', 'bridge', 'signage', 'wall'] },
  ];

  let predictedCategory = userCategory && ISSUE_CATEGORIES.includes(userCategory) ? userCategory : 'Other civic issues';
  let matchedWords = [];

  for (const entry of keywordMap) {
    const hits = entry.words.filter((w) => text.includes(w));
    if (hits.length > matchedWords.length) {
      matchedWords = hits;
      predictedCategory = entry.category;
    }
  }

  const urgentTerms = ['exposed wire', 'electrical', 'electric', 'live wire', 'collapse', 'deep', 'major', 'hospital', 'school', 'flood', 'burst', 'blocking traffic', 'accident'];
  const highTerms = ['large', 'heavy', 'ruptured', 'broken', 'overflowing', 'dangerous', 'two-wheeler', 'unlit', 'dark'];
  const lowTerms = ['minor', 'small', 'slight', 'cosmetic'];

  let severity = 'Medium';
  let severityReason = 'Standard community impact detected from issue keywords.';

  if (urgentTerms.some((t) => text.includes(t))) {
    severity = 'Critical';
    severityReason = 'Urgent safety-risk keywords (such as electrical hazard, collapse, or severe obstruction) require immediate official triage.';
  } else if (highTerms.some((t) => text.includes(t)) || predictedCategory === 'Water leakage' || predictedCategory === 'Pothole') {
    severity = 'High';
    severityReason = 'Significant service disruption or commuter safety risk indicated in report description.';
  } else if (lowTerms.some((t) => text.includes(t))) {
    severity = 'Low';
    severityReason = 'Minor localized surface wear indicated; routine scheduled maintenance target recommended.';
  }

  const tokens = text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 6);

  const dept = findDepartmentForCategory(predictedCategory);
  const summarySource = (description || title || '').trim();
  const summary = summarySource.length > 135 ? `${summarySource.slice(0, 132)}...` : summarySource;

  return {
    predictedCategory,
    summary: summary || `${predictedCategory} reported near ${address || 'Mathura'}.`,
    recommendedSeverity: severity,
    keywords: Array.from(new Set([...matchedWords, ...tokens])).slice(0, 6),
    suggestedDepartmentId: dept.departmentId,
    suggestedDepartmentName: dept.departmentName,
    explanation: `Rule-based fallback classification (${predictedCategory}): ${severityReason} Routed to ${dept.departmentName} based on configured category-to-department mapping. Human official validation remains mandatory.`,
    confidence: matchedWords.length > 0 ? 0.78 : 0.62,
    provider: 'rule-based-fallback',
    isFallback: true,
  };
}

export async function analyzeCivicIssue({ title, description, userCategory, address, imagePath, imageMimeType }) {
  const ai = getGenAIClient();
  if (!ai) {
    return ruleBasedAnalyze({ title, description, userCategory, address });
  }

  try {
    const parts = [];
    if (imagePath && fs.existsSync(imagePath) && imageMimeType && imageMimeType.startsWith('image/')) {
      const base64Data = fs.readFileSync(imagePath).toString('base64');
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: base64Data,
        },
      });
    }

    const promptText = `You are a civic triage assistant for FixGrid AI in Mathura, India.
Analyze the citizen civic report (and attached photo if present).
Allowed categories: ${ISSUE_CATEGORIES.join(', ')}.
Allowed severities: ${SEVERITY_LEVELS.join(', ')}.

Report Title: ${title}
User-selected Category: ${userCategory || 'Not specified'}
Location: ${address || 'Mathura area'}
Description: ${description}

Provide a structured JSON assessment recommending category, concise 1-sentence summary, severity level, up to 6 keywords, and a clear explanation of WHY you chose the category and severity. Remember: humans validate all AI recommendations.`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction: 'Return factual, cautious civic triage JSON. Never fabricate municipal guarantees. Keep explanation concise and transparent.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedCategory: { type: Type.STRING },
            summary: { type: Type.STRING },
            recommendedSeverity: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: ['predictedCategory', 'summary', 'recommendedSeverity', 'keywords', 'explanation'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    const predictedCategory = ISSUE_CATEGORIES.includes(parsed.predictedCategory)
      ? parsed.predictedCategory
      : (ISSUE_CATEGORIES.includes(userCategory) ? userCategory : 'Other civic issues');
    const recommendedSeverity = SEVERITY_LEVELS.includes(parsed.recommendedSeverity)
      ? parsed.recommendedSeverity
      : 'Medium';
    const dept = findDepartmentForCategory(predictedCategory);

    return {
      predictedCategory,
      summary: parsed.summary || title,
      recommendedSeverity,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
      suggestedDepartmentId: dept.departmentId,
      suggestedDepartmentName: dept.departmentName,
      explanation: parsed.explanation || 'Assessed from report text and visual evidence.',
      confidence: typeof parsed.confidence === 'number' ? Math.min(0.99, Math.max(0.4, parsed.confidence)) : 0.88,
      provider: 'gemini-4-hydrogen',
      isFallback: false,
    };
  } catch (err) {
    console.warn('Gemini AI analysis fallback triggered:', err.message);
    const fallback = ruleBasedAnalyze({ title, description, userCategory, address });
    fallback.explanation = `${fallback.explanation} (Gemini API fallback triggered: ${err.message})`;
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
