const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');

/**
 * Auth middleware: requires a valid `Authorization: Bearer <token>` header and
 * attaches the authenticated user's id to `req.userId`. Every breed route uses
 * this so users only ever touch their own data.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'Authentication required'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired session. Please sign in again.'));
  }
}

module.exports = { requireAuth };
