const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const { ApiError } = require('../middleware/errorHandler');
const { seedForUser } = require('../seed');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Usernames: 3–30 chars, letters/numbers and . _ - (no spaces).
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

// Short-lived access token (JWT) + long-lived rotating refresh token (opaque).
const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Issue a fresh access token and a new refresh token (stored hashed). Returns
 * both to the caller. The plaintext refresh token is only ever seen by the client.
 */
async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { accessToken, refreshToken };
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
  // characters. No complexity rules. Password capped at 72 (bcrypt's limit).
  if (!USERNAME_RE.test(username)) {
    throw new ApiError(400, 'Username must be 3–30 characters (letters, numbers, . _ - only)');
  }
  if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
  if (password.length > 72) throw new ApiError(400, 'Password must be at most 72 characters');

  const existing = await User.findOne({ username });
  if (existing) throw new ApiError(409, 'That username is already taken');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, passwordHash });

  await seedForUser(user._id);

  const tokens = await issueTokens(user);
  res.status(201).json({ ...tokens, user: user.toJSON() });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { username, password } = readCredentials(req.body);
  if (!username || !password) throw new ApiError(400, 'Username and password are required');

  const user = await User.findOne({ username });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new ApiError(401, 'Invalid username or password');

  const tokens = await issueTokens(user);
  res.json({ ...tokens, user: user.toJSON() });
});

// POST /api/auth/refresh — rotate: consume the presented refresh token and
// issue a brand-new access + refresh pair. A reused/expired token is rejected.
const refresh = asyncHandler(async (req, res) => {
  const presented = typeof req.body.refreshToken === 'string' ? req.body.refreshToken : '';
  if (!presented) throw new ApiError(401, 'Refresh token required');

  const stored = await RefreshToken.findOne({ tokenHash: hashToken(presented) });
  if (!stored) throw new ApiError(401, 'Invalid or expired session');

  // Consume the old token (rotation) regardless of what happens next.
  await stored.deleteOne();
  if (stored.expiresAt < new Date()) throw new ApiError(401, 'Invalid or expired session');

  const user = await User.findById(stored.userId);
  if (!user) throw new ApiError(401, 'Invalid or expired session');

  const tokens = await issueTokens(user);
  res.json({ ...tokens, user: user.toJSON() });
});

// POST /api/auth/logout — revoke the given refresh token.
const logout = asyncHandler(async (req, res) => {
  const presented = typeof req.body.refreshToken === 'string' ? req.body.refreshToken : '';
  if (presented) {
    await RefreshToken.deleteOne({ tokenHash: hashToken(presented) });
  }
  res.status(204).end();
});

// GET /api/auth/me  (requires auth)
const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(401, 'Account not found');
  res.json({ user: user.toJSON() });
});

module.exports = { register, login, refresh, logout, me };
