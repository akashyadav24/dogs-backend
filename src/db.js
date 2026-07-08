const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the given URI.
 * Kept separate from the Express app so tests can supply an in-memory URI.
 */
async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
