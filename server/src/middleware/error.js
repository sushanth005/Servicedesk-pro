const config = require('../config');
module.exports = (err, req, res, next) => { // eslint-disable-line
  let status = err.status || 500, message = err.message, details = err.details;
  if (err.name === 'ValidationError' && err.errors) { status = 422; message = 'Validation failed'; details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })); }
  else if (err.name === 'CastError') { status = 400; message = `Invalid value for ${err.path}`; }
  else if (err.code === 11000) { status = 409; message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(', ')}`; }
  else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') { status = 401; message = 'Session expired. Please sign in again.'; }
  else if (err.name === 'MulterError') { status = 400; message = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 5 MB' : err.message; }
  if (status >= 500) { console.error(err); if (config.env === 'production') message = 'Internal server error'; }
  res.status(status).json({ message, details });
};
