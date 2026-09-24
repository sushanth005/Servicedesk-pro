const r = require('express').Router();
const { User, Ticket } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const v = require('../validators');
const { AppError, asyncHandler, escapeRegex } = require('../utils/http');
r.use(protect);
const POP = [{ path: 'department', select: 'name' }, { path: 'scopeDepartments', select: 'name' }, { path: 'skills', select: 'name' }];

r.get('/', authorize('admin', 'manager', 'technician', 'asset_manager'), asyncHandler(async (req, res) => {
  const page = Math.max(1, +req.query.page || 1), limit = Math.min(200, +req.query.limit || 50);
  const f = { organization: req.user.organization };
  ['role', 'department', 'active'].forEach((k) => { if (req.query[k] !== undefined && req.query[k] !== '') f[k] = req.query[k]; });
  if (req.query.q) { const rx = new RegExp(escapeRegex(req.query.q), 'i'); f.$or = [{ name: rx }, { email: rx }]; }
  const [items, total] = await Promise.all([User.find(f).populate(POP).sort('name').skip((page - 1) * limit).limit(limit), User.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));
r.post('/', authorize('admin'), validate(v.user), asyncHandler(async (req, res) => {
  if (!req.body.password) throw new AppError('Password is required for new users', 422, [{ message: 'password: is required' }]);
  const u = await User.create({ ...req.body, organization: req.user.organization });
  res.locals.entityId = u._id; res.status(201).json(await User.findById(u._id).populate(POP));
}));
r.put('/:id', authorize('admin'), validate(v.user.partial()), asyncHandler(async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, organization: req.user.organization });
  if (!u) throw new AppError('User not found', 404);
  if (String(u._id) === String(req.user._id) && (req.body.active === false || (req.body.role && req.body.role !== 'admin'))) throw new AppError('You cannot demote or disable your own account', 400);
  const { password, ...rest } = req.body; u.set(rest); if (password) u.password = password;
  await u.save(); res.json(await User.findById(u._id).populate(POP));
}));
r.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, organization: req.user.organization });
  if (!u) throw new AppError('User not found', 404);
  if (String(u._id) === String(req.user._id)) throw new AppError('You cannot delete your own account', 400);
  if (await Ticket.exists({ $or: [{ requester: u._id }, { assignee: u._id }] })) throw new AppError('This user has ticket history. Deactivate the account instead.', 409);
  await u.deleteOne(); res.json({ ok: true });
}));
module.exports = r;
