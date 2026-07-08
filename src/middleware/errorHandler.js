/**
 * A small operational error type so controllers can throw meaningful HTTP errors,
 * e.g. `throw new ApiError(404, 'Breed not found')`.
 */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// 404 handler for unknown routes.
function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Central error handler — turns thrown errors into a consistent JSON envelope.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  // Mongo duplicate-key error (unique index on `name`).
  if (err.code === 11000) {
    status = 409;
    message = 'A breed with that name already exists';
  }

  // Mongoose validation error.
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  if (status >= 500) {
    // Log server-side faults; client only sees a generic message.
    console.error(err);
  }

  res.status(status).json({ error: { message } });
}

module.exports = { ApiError, notFound, errorHandler };
