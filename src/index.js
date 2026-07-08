const path = require('path');
// Load the repo-root .env regardless of the current working directory.
// In production there is no .env file and dotenv falls back to real env vars.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createApp } = require('./app');
const { connectDB } = require('./db');
const { seedIfEmpty } = require('./seed');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

async function start() {
  try {
    await connectDB(MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await seedIfEmpty();
    if (result.seeded) {
      console.log(`Seeded database with ${result.count} breeds from dogs.json`);
    } else {
      console.log(`Database already has ${result.count} breeds — skipping seed`);
    }

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
