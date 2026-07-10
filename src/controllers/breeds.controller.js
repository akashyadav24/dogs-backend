const Breed = require('../models/breed');
const { ApiError } = require('../middleware/errorHandler');
const { normaliseName, normaliseSubBreeds } = require('../middleware/validate');

// Wrap async handlers so thrown/rejected errors reach the error middleware.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Fetch one of THIS user's breeds by name, or throw a 404. Every query is
// scoped by userId so users can only ever see/modify their own data.
async function findBreedOr404(userId, name) {
  const breed = await Breed.findOne({ userId, name });
  if (!breed) throw new ApiError(404, `Breed not found: ${name}`);
  return breed;
}

// GET /api/breeds?search=
const listBreeds = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const query = { userId: req.userId };

  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    // Match either the breed name or any of its sub-breeds.
    query.$or = [{ name: new RegExp(term, 'i') }, { subBreeds: new RegExp(term, 'i') }];
  }

  const breeds = await Breed.find(query).sort({ name: 1 });
  res.json(breeds);
});

// GET /api/breeds/:name
const getBreed = asyncHandler(async (req, res) => {
  const name = normaliseName(req.params.name, 'breed name');
  const breed = await findBreedOr404(req.userId, name);
  res.json(breed);
});

// POST /api/breeds
const createBreed = asyncHandler(async (req, res) => {
  const name = normaliseName(req.body.name, 'breed name');
  const subBreeds = normaliseSubBreeds(req.body.subBreeds);

  const existing = await Breed.findOne({ userId: req.userId, name });
  if (existing) throw new ApiError(409, `Breed already exists: ${name}`);

  const breed = await Breed.create({ userId: req.userId, name, subBreeds });
  res.status(201).json(breed);
});

// PUT /api/breeds/:name  — rename and/or replace the sub-breed list
const updateBreed = asyncHandler(async (req, res) => {
  const currentName = normaliseName(req.params.name, 'breed name');
  const breed = await findBreedOr404(req.userId, currentName);

  if (req.body.name !== undefined) {
    const newName = normaliseName(req.body.name, 'breed name');
    if (newName !== currentName) {
      const clash = await Breed.findOne({ userId: req.userId, name: newName });
      if (clash) throw new ApiError(409, `Breed already exists: ${newName}`);
      breed.name = newName;
    }
  }

  if (req.body.subBreeds !== undefined) {
    breed.subBreeds = normaliseSubBreeds(req.body.subBreeds);
  }

  await breed.save();
  res.json(breed);
});

// DELETE /api/breeds/:name
const deleteBreed = asyncHandler(async (req, res) => {
  const name = normaliseName(req.params.name, 'breed name');
  const result = await Breed.deleteOne({ userId: req.userId, name });
  if (result.deletedCount === 0) throw new ApiError(404, `Breed not found: ${name}`);
  res.status(204).end();
});

// POST /api/breeds/:name/sub-breeds  — add one sub-breed
const addSubBreed = asyncHandler(async (req, res) => {
  const name = normaliseName(req.params.name, 'breed name');
  const sub = normaliseName(req.body.subBreed, 'sub-breed');
  const breed = await findBreedOr404(req.userId, name);

  if (breed.subBreeds.includes(sub)) {
    throw new ApiError(409, `Sub-breed already exists: ${sub}`);
  }
  breed.subBreeds.push(sub);
  breed.subBreeds.sort();
  await breed.save();
  res.status(201).json(breed);
});

// PUT /api/breeds/:name/sub-breeds/:sub  — rename a sub-breed
const renameSubBreed = asyncHandler(async (req, res) => {
  const name = normaliseName(req.params.name, 'breed name');
  const oldSub = normaliseName(req.params.sub, 'sub-breed');
  const newSub = normaliseName(req.body.subBreed, 'sub-breed');
  const breed = await findBreedOr404(req.userId, name);

  const idx = breed.subBreeds.indexOf(oldSub);
  if (idx === -1) throw new ApiError(404, `Sub-breed not found: ${oldSub}`);
  if (oldSub !== newSub && breed.subBreeds.includes(newSub)) {
    throw new ApiError(409, `Sub-breed already exists: ${newSub}`);
  }
  breed.subBreeds[idx] = newSub;
  breed.subBreeds.sort();
  await breed.save();
  res.json(breed);
});

// DELETE /api/breeds/:name/sub-breeds/:sub  — remove a sub-breed
const deleteSubBreed = asyncHandler(async (req, res) => {
  const name = normaliseName(req.params.name, 'breed name');
  const sub = normaliseName(req.params.sub, 'sub-breed');
  const breed = await findBreedOr404(req.userId, name);

  const idx = breed.subBreeds.indexOf(sub);
  if (idx === -1) throw new ApiError(404, `Sub-breed not found: ${sub}`);
  breed.subBreeds.splice(idx, 1);
  await breed.save();
  res.json(breed);
});

module.exports = {
  listBreeds,
  getBreed,
  createBreed,
  updateBreed,
  deleteBreed,
  addSubBreed,
  renameSubBreed,
  deleteSubBreed,
};
