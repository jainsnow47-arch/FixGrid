import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';

import { checkDatabaseHealth, closeDatabase } from './server/config/db.js';
import { uploadsDir } from './server/middleware/upload.js';
import authRoutes from './server/routes/authRoutes.js';
import publicRoutes from './server/routes/publicRoutes.js';
import complaintRoutes from './server/routes/complaintRoutes.js';
import governmentRoutes from './server/routes/governmentRoutes.js';
import studentRoutes from './server/routes/studentRoutes.js';
import teamRoutes from './server/routes/teamRoutes.js';
import projectRoutes from './server/routes/projectRoutes.js';
import facultyRoutes from './server/routes/facultyRoutes.js';
import industryRoutes from './server/routes/industryRoutes.js';
import adminRoutes from './server/routes/adminRoutes.js';
import notificationRoutes from './server/routes/notificationRoutes.js';

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Safely serve uploaded citizen/project media with nosniff header
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    },
    express.static(uploadsDir)
  );

  // REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/complaints', complaintRoutes);
  app.use('/api/government', governmentRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/faculty', facultyRoutes);
  app.use('/api/industry', industryRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'FixGrid AI Server' });
  });

  app.get('/api/health/db', (_req, res) => {
    const health = checkDatabaseHealth();
    if (health.connected) {
      return res.status(200).json({
        success: true,
        database: 'connected',
        engine: 'sqlite',
        foreignKeysEnabled: health.foreignKeysEnabled,
        tablesCount: health.tablesCount,
        message: 'SQLite database connection is healthy',
      });
    }
    return res.status(503).json({
      success: false,
      database: 'disconnected',
      engine: 'sqlite',
      message: 'SQLite database connection check failed',
    });
  });

  // Centralized API error handler (handles Multer errors & JSON errors cleanly)
  app.use('/api', (err, _req, res, _next) => {
    if (err?.name === 'MulterError') {
      return res.status(400).json({ error: err.message || 'Invalid file upload.' });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON request payload.' });
    }
    const status = Number.isInteger(err?.status) ? err.status : 500;
    if (status >= 500) {
      console.error('Unhandled API error:', err?.message || err);
      return res.status(status).json({ error: 'An internal server error occurred.' });
    }
    return res.status(status).json({ error: err?.message || 'Request failed.' });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`FixGrid AI server running at http://localhost:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start FixGrid AI server:', err);
  process.exit(1);
});
