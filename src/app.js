const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const breedsRouter = require('./routes/breeds');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Restrict CORS to the known frontend origin(s) when CORS_ORIGIN is set
  // (comma-separated). Trailing slashes are stripped so the value matches the
  // browser's Origin header. If unset (e.g. local dev), allow any origin.
  const allowed = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.use(cors({ origin: allowed.length ? allowed : true }));
  app.use(express.json());

  // Health check (used by the host's health check and for uptime probes).
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Public auth routes (register / login).
  app.use('/api/auth', authRouter);

  // Breed routes: reads are public, writes require auth (see routes/breeds.js).
  app.use('/api/breeds', breedsRouter);

  // Unknown routes -> 404, then central error handler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
