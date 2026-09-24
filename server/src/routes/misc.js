const r = require('express').Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { Notification, SavedFilter, AuditLog, Asset, User } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const v = require('../validators');
const { AppError, asyncHandler, escapeRegex } = require('../utils/http');
const { classifyTicket, suggestSolutions } = require('../services/ai');
const { dashboard, technicianWorkload, overview } = require('../services/analytics');
const { runSlaSweep } = require('../services/sla');
const { sendExport } = require('../utils/exporter');
r.use(protect);

// Notifications
r.get('/notifications', asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([Notification.find({ user: req.user._id }).sort('-createdAt').limit(+req.query.limit || 30), Notification.countDocuments({ user: req.user._id, read: false })]);
  res.json({ items, unread });
}));
r.post('/notifications/read-all', asyncHandler(async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ ok: true }); }));
r.put('/notifications/:id/read', asyncHandler(async (req, res) => { await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true }); res.json({ ok: true }); }));

// Saved filters
r.get('/saved-filters', asyncHandler(async (req, res) => res.json(await SavedFilter.find({ user: req.user._id, entity: 'tickets' }).sort('name'))));
r.post('/saved-filters', validate(v.savedFilter), asyncHandler(async (req, res) => res.status(201).json(await SavedFilter.create({ ...req.body, user: req.user._id }))));
r.delete('/saved-filters/:id', asyncHandler(async (req, res) => { await SavedFilter.deleteOne({ _id: req.params.id, user: req.user._id }); res.json({ ok: true }); }));

// AI
const aiLimit = rateLimit({ windowMs: 60000, max: 30, message: { message: 'AI rate limit reached. Try again in a minute.' } });
r.get('/ai/status', (req, res) => res.json({ provider: 'groq', enabled: !!config.groqKey, model: config.groqModel }));
r.post('/ai/classify', aiLimit, validate(v.aiText), asyncHandler(async (req, res) => res.json(await classifyTicket(req.user.organization, req.body))));
r.post('/ai/suggest', aiLimit, validate(v.aiText), asyncHandler(async (req, res) => {
  const out = await suggestSolutions(req.user.organization, req.body);
  if (!['admin', 'manager', 'technician'].includes(req.user.role)) { out.similarTickets = []; out.suggestedReply = null; } // self-service: articles only
  res.json(out);
}));

// Dashboards, reports, SLA
r.get('/reports/dashboard', asyncHandler(async (req, res) => res.json(await dashboard(req.user))));
r.get('/reports/workload', authorize('admin', 'manager', 'technician'), asyncHandler(async (req, res) => res.json(await technicianWorkload(req.user))));
r.get('/reports/overview', authorize('admin', 'manager'), asyncHandler(async (req, res) => res.json(await overview(req.user, Math.min(365, +req.query.days || 30)))));
r.post('/sla/sweep', authorize('admin', 'manager'), asyncHandler(async (req, res) => res.json(await runSlaSweep())));

// Audit trail
r.get('/audit', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const page = Math.max(1, +req.query.page || 1), limit = Math.min(100, +req.query.limit || 25);
  const f = { organization: req.user.organization };
  if (req.query.entity) f.entity = req.query.entity; if (req.query.user) f.user = req.query.user;
  if (req.query.q) { const rx = new RegExp(escapeRegex(req.query.q), 'i'); f.$or = [{ userName: rx }, { action: rx }]; }
  if (req.query.format) {
    const rows = await AuditLog.find(f).sort('-createdAt').limit(5000).lean();
    return sendExport(res, req.query.format, { filename: 'audit-log', title: 'Audit trail', rows, columns: [{ label: 'Time', get: (a) => new Date(a.createdAt).toISOString().slice(0, 19).replace('T', ' '), width: 1.6 }, { label: 'User', key: 'userName', width: 1.4 }, { label: 'Role', key: 'role' }, { label: 'Action', key: 'action', width: 3 }, { label: 'Entity', key: 'entity' }, { label: 'IP', key: 'ip' }] });
  }
  const [items, total] = await Promise.all([AuditLog.find(f).sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(), AuditLog.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));
r.get('/users-export', authorize('admin'), asyncHandler(async (req, res) => {
  const rows = await User.find({ organization: req.user.organization }).populate('department', 'name').lean();
  sendExport(res, req.query.format, { filename: 'users', title: 'User directory', rows, columns: [{ label: 'Name', key: 'name', width: 2 }, { label: 'Email', key: 'email', width: 3 }, { label: 'Role', key: 'role' }, { label: 'Department', get: (u) => u.department?.name }, { label: 'Active', get: (u) => (u.active ? 'Yes' : 'No') }] });
}));
module.exports = r;
