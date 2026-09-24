class AppError extends Error {
  constructor(message, status = 400, details) { super(message); this.status = status; this.details = details; }
}
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idOf = (x) => String(x?._id || x || '');
module.exports = { AppError, asyncHandler, escapeRegex, idOf };
