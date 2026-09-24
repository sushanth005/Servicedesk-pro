const { AuditLog } = require('../models');
// Automatic audit trail for every successful mutating API call.
module.exports = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.user) return;
    const url = req.originalUrl.split('?')[0];
    const parts = url.replace(/^\/api\//, '').split('/');
    if (['notifications', 'saved-filters', 'ai'].includes(parts[0])) return; // high-volume, non-business events
    const idMatch = parts.find((p) => /^[a-f\d]{24}$/i.test(p));
    AuditLog.create({
      organization: req.user.organization, user: req.user._id, userName: req.user.name, role: req.user.role,
      action: `${req.method} /${parts.map((p) => (/^[a-f\d]{24}$/i.test(p) ? ':id' : p)).join('/')}`,
      entity: parts[0], entityId: idMatch, ip: req.ip, status: res.statusCode, summary: res.locals.auditSummary,
    }).catch(() => {});
  });
  next();
};
