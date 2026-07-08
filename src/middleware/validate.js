const { ApiError } = require('./errorHandler');

/**
 * Normalises a dog name (breed or sub-breed): must be a non-empty string
 * containing only letters (and optional spaces/hyphens). Returned lowercased + trimmed.
 * Throws ApiError(400) on invalid input.
 */
function normaliseName(value, label = 'name') {
  if (typeof value !== 'string') {
    throw new ApiError(400, `${label} is required and must be a string`);
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) {
    throw new ApiError(400, `${label} must not be empty`);
  }
  if (trimmed.length > 50) {
    throw new ApiError(400, `${label} must be 50 characters or fewer`);
  }
  if (!/^[a-z][a-z \-]*$/.test(trimmed)) {
    throw new ApiError(400, `${label} may only contain letters, spaces and hyphens`);
  }
  return trimmed;
}

/**
 * Normalise + de-duplicate a list of sub-breed names.
 */
function normaliseSubBreeds(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'subBreeds must be an array of strings');
  }
  const cleaned = value.map((s) => normaliseName(s, 'sub-breed'));
  return [...new Set(cleaned)];
}

module.exports = { normaliseName, normaliseSubBreeds };
