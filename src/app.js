const express = require('express');
const cors = require('cors');

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

  // REST API.
  app.use('/api/breeds', breedsRouter);

  // Unknown routes -> 404, then central error handler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
