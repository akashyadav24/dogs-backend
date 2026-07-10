const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const breedsRouter = require('./routes/breeds');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Permissive CORS so the separately-hosted frontend can call this API.
  app.use(cors());
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
