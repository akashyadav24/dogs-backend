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

/**
 * Optional auth: if a valid token is present, attach req.userId; otherwise
 * continue as an anonymous (public) request. Used on read routes so logged-out
 * visitors can browse the base breed list.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (token) {
    try {
      req.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
    } catch {
      // Ignore an invalid token on public reads — just treat as anonymous.
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
