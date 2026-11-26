import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    SESSION_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, SESSION_SECRET);
}

export function extractBearerUser(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    const user = db
      .prepare(
        `SELECT id, name, email, role, institution_or_org, city, ward, verified, account_status, created_at
         FROM users
         WHERE id = ? AND deleted_at IS NULL AND (account_status IS NULL OR account_status = 'active')`
      )
      .get(payload.sub);
    return user || null;
  } catch {
    return null;
  }
}

export function optionalAuth(req, _res, next) {
  req.user = extractBearerUser(req);
  next();
}

export function requireAuth(req, res, next) {
  const user = extractBearerUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  req.user = user;
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access restricted. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}

// Simple in-memory rate limiter for auth & AI endpoints
const rateBuckets = new Map();
export function rateLimit({ windowMs = 60000, max = 40 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip || 'local'}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    if (bucket.count > max) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    next();
  };
}
