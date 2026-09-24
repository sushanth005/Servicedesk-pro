const r = require('express').Router();
const { Asset, User, Ticket, Counter } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const v = require('../validators');
const { AppError, asyncHandler, escapeRegex, idOf } = require('../utils/http');
const { notify, logActivity } = require('../services/notify');
const { sendExport } = require('../utils/exporter');
r.use(protect);
const MANAGE = ['admin', 'asset_manager'], TECH = ['admin', 'asset_manager', 'technician'];
const POP = [{ path: 'vendor', select: 'name' }, { path: 'assignedTo', select: 'name email' }, { path: 'department', select: 'name' }, { path: 'replacedBy', select: 'assetTag name' }];

function buildFilter(user, q) {
  const f = { organization: user.organization };
  if (user.role === 'employee' || user.role === 'manager') f.assignedTo = user._id; // employees & managers see only their own; staff below see all
  if (['admin', 'asset_manager', 'technician'].includes(user.role)) delete f.assignedTo;
  ['status', 'type', 'category', 'department', 'assignedTo'].forEach((k) => { if (q[k] && ['admin', 'asset_manager', 'technician'].includes(user.role)) f[k] = q[k]; });
  if (q.expiring === 'true') { const d = new Date(Date.now() + 60 * 86400000); f.status = { $nin: ['retired', 'disposed'] }; f.$or = [{ warrantyExpiry: { $lte: d } }, { licenseExpiry: { $lte: d } }]; }
  if (q.q) { const rx = new RegExp(escapeRegex(q.q), 'i'); f.$and = [{ $or: [{ name: rx }, { assetTag: rx }, { serialNumber: rx }, { brand: rx }, { model: rx }] }]; }
  return f;
}
r.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, +req.query.page || 1), limit = Math.min(200, +req.query.limit || 20), f = buildFilter(req.user, req.query);
  const [items, total] = await Promise.all([Asset.find(f).populate(POP).sort(req.query.sort || '-updatedAt').skip((page - 1) * limit).limit(limit), Asset.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));
r.get('/export', authorize(...TECH, 'manager'), asyncHandler(async (req, res) => {
  const items = await Asset.find(buildFilter(req.user, req.query)).populate(POP).sort('assetTag').limit(5000).lean();
  const d = (x) => (x ? new Date(x).toISOString().slice(0, 10) : '');
  sendExport(res, req.query.format, {
    filename: 'assets', title: 'IT asset register', rows: items,
    columns: [{ label: 'Tag', key: 'assetTag' }, { label: 'Name', key: 'name', width: 3 }, { label: 'Type', key: 'type' }, { label: 'Category', key: 'category' }, { label: 'Status', key: 'status' }, { label: 'Assigned to', get: (a) => a.assignedTo?.name, width: 1.6 }, { label: 'Serial', key: 'serialNumber', width: 1.6 }, { label: 'Vendor', get: (a) => a.vendor?.name, width: 1.4 }, { label: 'Cost', key: 'purchaseCost' }, { label: 'Warranty end', get: (a) => d(a.warrantyExpiry) }],
  });
}));
r.get('/:id', asyncHandler(async (req, res) => {
  const a = await Asset.findOne({ ...buildFilter(req.user, {}), _id: req.params.id }).populate([...POP, { path: 'history.by', select: 'name' }]);
  if (!a) throw new AppError('Asset not found', 404);
  const tickets = ['admin', 'manager', 'technician', 'asset_manager'].includes(req.user.role) ? await Ticket.find({ asset: a._id, organization: req.user.organization }).select('number title status createdAt').sort('-createdAt').limit(10).lean() : [];
  res.json({ asset: a, tickets });
}));
r.post('/', authorize(...MANAGE), validate(v.asset), asyncHandler(async (req, res) => {
  const b = { ...req.body };
  if (!b.assetTag) b.assetTag = `AST-${String(await Counter.next(`${req.user.organization}:asset`)).padStart(4, '0')}`;
  const a = await Asset.create({ ...b, organization: req.user.organization, history: [{ action: 'created', to: 'procurement', by: req.user._id, note: 'Asset registered' }] });
  res.locals.entityId = a._id; res.status(201).json(await Asset.findById(a._id).populate(POP));
}));
r.put('/:id', authorize(...TECH), validate(v.asset.partial()), asyncHandler(async (req, res) => {
  const a = await Asset.findOne({ _id: req.params.id, organization: req.user.organization }); if (!a) throw new AppError('Asset not found', 404);
  let body = req.body;
  if (req.user.role === 'technician') body = { location: body.location, notes: body.notes }; // technicians: limited fields
  a.set(body); if (body.warrantyExpiry || body.licenseExpiry) a.expiryNotified = false;
  a.history.push({ action: 'updated', by: req.user._id, note: 'Details updated' }); await a.save();
  res.json(await Asset.findById(a._id).populate(POP));
}));
r.delete('/:id', authorize(...MANAGE), asyncHandler(async (req, res) => {
  const a = await Asset.findOne({ _id: req.params.id, organization: req.user.organization }); if (!a) throw new AppError('Asset not found', 404);
  if (a.status !== 'procurement' && a.status !== 'disposed') throw new AppError('Only assets in procurement or disposed can be deleted. Retire it instead.', 409);
  if (await Ticket.exists({ asset: a._id })) throw new AppError('Asset is linked to tickets. Retire it instead.', 409);
  await a.deleteOne(); res.json({ ok: true });
}));

// Lifecycle: procurement -> in_stock -> assigned <-> in_repair -> retired -> disposed
r.post('/:id/transition', authorize(...TECH), validate(v.assetTransition), asyncHandler(async (req, res) => {
  const a = await Asset.findOne({ _id: req.params.id, organization: req.user.organization }); if (!a) throw new AppError('Asset not found', 404);
  const { action, assignedTo, replacementAssetId, ticketId, note } = req.body, u = req.user, from = a.status;
  if (u.role === 'technician' && !['send_repair', 'complete_repair'].includes(action)) throw new AppError('Technicians can only send assets to repair and complete repairs', 403);
  const bad = (msg) => { throw new AppError(msg, 409); };
  const hist = (to, extra = '') => a.history.push({ action, from, to, by: u._id, note: [note, extra].filter(Boolean).join(' | ') || undefined });
  const ticket = ticketId ? await Ticket.findOne({ _id: ticketId, organization: u.organization }) : null;
  switch (action) {
    case 'receive': if (from !== 'procurement') bad('Only assets in procurement can be received'); a.status = 'in_stock'; hist('in_stock'); break;
    case 'assign': {
      if (from !== 'in_stock') bad('Only assets in stock can be assigned'); if (!assignedTo) throw new AppError('Choose who to assign this asset to', 422, [{ message: 'assignedTo: is required' }]);
      const p = await User.findOne({ _id: assignedTo, organization: u.organization, active: true }); if (!p) throw new AppError('User not found', 404);
      a.status = 'assigned'; a.assignedTo = p._id; a.department = p.department; hist('assigned', `to ${p.name}`);
      await notify([p._id], { title: `Asset assigned: ${a.assetTag}`, message: a.name, link: '/assets', type: 'info' }, u._id); break;
    }
    case 'unassign': if (from !== 'assigned') bad('Asset is not assigned'); a.status = 'in_stock'; a.assignedTo = undefined; hist('in_stock', 'returned'); break;
    case 'send_repair': if (!['assigned', 'in_stock'].includes(from)) bad('Only assigned or in-stock assets can go to repair'); a.status = 'in_repair'; hist('in_repair'); break;
    case 'complete_repair': if (from !== 'in_repair') bad('Asset is not in repair'); a.status = a.assignedTo ? 'assigned' : 'in_stock'; hist(a.status); break;
    case 'replace': {
      if (!['assigned', 'in_repair'].includes(from)) bad('Only assigned or in-repair assets can be replaced');
      if (!replacementAssetId) throw new AppError('Choose the replacement asset', 422, [{ message: 'replacementAssetId: is required' }]);
      const n = await Asset.findOne({ _id: replacementAssetId, organization: u.organization }); if (!n) throw new AppError('Replacement asset not found', 404);
      if (n.status !== 'in_stock') bad('Replacement must be an in-stock asset');
      n.status = 'assigned'; n.assignedTo = a.assignedTo; n.department = a.department; n.history.push({ action: 'replace', from: 'in_stock', to: 'assigned', by: u._id, note: `Replaces ${a.assetTag}` }); await n.save();
      a.replacedBy = n._id; a.status = 'retired'; a.assignedTo = undefined; hist('retired', `replaced by ${n.assetTag}`); break;
    }
    case 'retire': if (!['in_stock', 'assigned', 'in_repair'].includes(from)) bad('Asset cannot be retired from its current status'); a.status = 'retired'; a.assignedTo = undefined; hist('retired'); break;
    case 'dispose': if (from !== 'retired') bad('Only retired assets can be disposed'); a.status = 'disposed'; hist('disposed'); break;
  }
  await a.save();
  if (ticket) { logActivity(ticket, u._id, 'asset_action', `${a.assetTag}: ${action.replace('_', ' ')}`); await ticket.save(); }
  res.json(await Asset.findById(a._id).populate([...POP, { path: 'history.by', select: 'name' }]));
}));
module.exports = r;
