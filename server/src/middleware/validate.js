const { AppError } = require('../utils/http');
exports.validate = (schema, src = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[src] || {});
  if (!r.success) {
    return next(new AppError('Validation failed', 422, r.error.issues.map((i) => ({ path: i.path.join('.'), message: `${i.path.join('.') || 'value'}: ${i.message}` }))));
  }
  req[src] = r.data; next();
};
