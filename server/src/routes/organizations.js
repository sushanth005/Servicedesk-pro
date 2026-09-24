const r = require('express').Router();
const { Organization, User } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const v = require('../validators');
const { AppError, asyncHandler } = require('../utils/http');
r.use(protect);
r.get('/current', asyncHandler(async (req, res) => res.json(await Organization.findById(req.user.organization))));
r.use(authorize('admin'));
r.get('/', asyncHandler(async (req, res) => { const items = await Organization.find().sort('name'); res.json({ items, total: items.length, page: 1, pages: 1 }); }));
r.post('/', validate(v.organization), asyncHandler(async (req, res) => {
  const { adminName, adminEmail, adminPassword, ...data } = req.body;
  if (!data.code) throw new AppError('Organisation code is required', 422, [{ message: 'code: is required' }]);
  const org = await Organization.create(data);
  if (adminEmail && adminPassword) await User.create({ organization: org._id, name: adminName || 'Administrator', email: adminEmail, password: adminPassword, role: 'admin' });
  res.locals.entityId = org._id; res.status(201).json(org);
}));
const update = asyncHandler(async (req, res) => {
  const id = req.params.id === 'current' ? req.user.organization : req.params.id;
  const org = await Organization.findById(id); if (!org) throw new AppError('Organisation not found', 404);
  const { adminName, adminEmail, adminPassword, code, ...data } = req.body; // code is immutable
  org.set(data); await org.save(); res.json(org);
});
r.put('/:id', validate(v.organization.partial()), update);
module.exports = r;
