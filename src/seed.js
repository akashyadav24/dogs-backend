const fs = require('fs');
const path = require('path');
const Breed = require('./models/breed');

// dogs.json lives at the repository root (one level up from src/).
const SEED_FILE = path.join(__dirname, '..', 'dogs.json');

/** Load and normalise the base breed list from dogs.json. */
function loadSeedBreeds() {
  const raw = fs.readFileSync(SEED_FILE, 'utf-8');
  const data = JSON.parse(raw);
  return Object.entries(data).map(([name, subBreeds]) => ({
    name: name.toLowerCase().trim(),
    subBreeds: Array.isArray(subBreeds) ? subBreeds.map((s) => s.toLowerCase().trim()) : [],
  }));
}

/**
 * Give a user their own copy of the base breeds — but only if they have none
 * yet. Called on registration so every user starts from the same data, then
 * edits their own private copy.
 */
async function seedForUser(userId) {
  const count = await Breed.countDocuments({ userId });
  if (count > 0) {
    return { seeded: false, count };
  }

  const docs = loadSeedBreeds().map((b) => ({ ...b, userId }));
  await Breed.insertMany(docs, { ordered: false });
  return { seeded: true, count: docs.length };
}

module.exports = { seedForUser, loadSeedBreeds, SEED_FILE };
