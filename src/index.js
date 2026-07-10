const path = require('path');
// Load the repo-root .env regardless of the current working directory.
// In production there is no .env file and dotenv falls back to real env vars.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createApp } = require('./app');
const { connectDB } = require('./db');
const User = require('./models/user');
const Breed = require('./models/breed');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('Failed to start server: JWT_SECRET is not set.');
    process.exit(1);
  }

  try {
    await connectDB(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Reconcile indexes with the current schemas. This migrates any legacy
    // global unique index on breed name to the per-user compound index.
    await Promise.all([User.syncIndexes(), Breed.syncIndexes()]);

    // Breeds are seeded per-user on registration (see controllers/auth), so
    // there is no global seed step at startup.

    const app = createApp();
    app.listen(PORT, () => {
      console.log(`Dogs Web API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
