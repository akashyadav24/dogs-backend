const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { ApiError } = require('../middleware/errorHandler');
const { seedForUser } = require('../seed');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Usernames: 3–30 chars, letters/numbers and . _ - (no spaces).
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const TOKEN_TTL = '7d';

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Normalise username + password from a request body.
function readCredentials(body) {
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  return { username, password };
}

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { username, password } = readCredentials(req.body);

  // Registration validation: a valid username + a password of at least 6
  // characters. No complexity rules (no required uppercase/number/symbol).
  // Password is capped at 72 — bcrypt silently ignores bytes beyond that.
  if (!USERNAME_RE.test(username)) {
    throw new ApiError(400, 'Username must be 3–30 characters (letters, numbers, . _ - only)');
  }
  if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
  if (password.length > 72) throw new ApiError(400, 'Password must be at most 72 characters');

  const existing = await User.findOne({ username });
  if (existing) throw new ApiError(409, 'That username is already taken');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash });

  // Give the new user their own copy of the base breeds.
  await seedForUser(user._id);

  res.status(201).json({ token: signToken(user), user: user.toJSON() });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { username, password } = readCredentials(req.body);

  // Login only checks presence; any mismatch is a generic 401 (don't leak which
  // part was wrong, and don't apply the registration rules).
  if (!username || !password) throw new ApiError(400, 'Username and password are required');

  const user = await User.findOne({ username });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new ApiError(401, 'Invalid username or password');

  res.json({ token: signToken(user), user: user.toJSON() });
});

// GET /api/auth/me  (requires auth)
const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(401, 'Account not found');
  res.json({ user: user.toJSON() });
});

module.exports = { register, login, me };
