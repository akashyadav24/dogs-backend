const fs = require('fs');
const path = require('path');
const Breed = require('./models/breed');

// dogs.json lives at the repository root (one level up from src/).
const SEED_FILE = path.join(__dirname, '..', 'dogs.json');

/**
 * Seed the database from dogs.json — but ONLY if it is currently empty.
 * This makes startup idempotent: the initial data is loaded once, and user
 * edits are never overwritten on subsequent restarts (satisfies the
 * persistence requirement in the brief).
 */
async function seedIfEmpty() {
  const count = await Breed.estimatedDocumentCount();
  if (count > 0) {
    return { seeded: false, count };
  }

  const raw = fs.readFileSync(SEED_FILE, 'utf-8');
  const data = JSON.parse(raw);

  const docs = Object.entries(data).map(([name, subBreeds]) => ({
    name: name.toLowerCase().trim(),
    subBreeds: Array.isArray(subBreeds) ? subBreeds.map((s) => s.toLowerCase().trim()) : [],
  }));

  await Breed.insertMany(docs, { ordered: false });
  return { seeded: true, count: docs.length };
}

module.exports = { seedIfEmpty, SEED_FILE };
