const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { AppError, asyncHandler, escapeRegex } = require('./http');

// Generic organisation-scoped CRUD router with RBAC, validation, search and pagination.
module.exports = function crud(Model, o = {}) {
  const { read = ['admin', 'manager', 'technician', 'employee', 'asset_manager'], write = ['admin'], search = [], populate = [], schema, sort = '-createdAt', filters = [], inUse } = o;
  const r = express.Router();
  r.use(protect);
  r.get('/', authorize(...read), asyncHandler(async (req, res) => {
    const page = Math.max(1, +req.query.page || 1), limit = Math.min(200, +req.query.limit || 50);
    const f = { organization: req.user.organization };
    filters.forEach((k) => { if (req.query[k] !== undefined && req.query[k] !== '') f[k] = req.query[k]; });
    if (req.query.q && search.length) f.$or = search.map((k) => ({ [k]: new RegExp(escapeRegex(req.query.q), 'i') }));
    const [items, total] = await Promise.all([Model.find(f).populate(populate).sort(req.query.sort || sort).skip((page - 1) * limit).limit(limit), Model.countDocuments(f)]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }));
  r.get('/:id', authorize(...read), asyncHandler(async (req, res) => {
    const doc = await Model.findOne({ _id: req.params.id, organization: req.user.organization }).populate(populate);
    if (!doc) throw new AppError('Not found', 404); res.json(doc);
  }));
  r.post('/', authorize(...write), schema ? validate(schema) : (q, s, n) => n(), asyncHandler(async (req, res) => {
    const doc = await Model.create({ ...req.body, organization: req.user.organization });
    res.locals.entityId = doc._id; res.status(201).json(await Model.findById(doc._id).populate(populate));
  }));
  r.put('/:id', authorize(...write), schema ? validate(schema.partial ? schema.partial() : schema) : (q, s, n) => n(), asyncHandler(async (req, res) => {
    const doc = await Model.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!doc) throw new AppError('Not found', 404);
    doc.set(req.body); await doc.save(); res.json(await Model.findById(doc._id).populate(populate));
  }));
  r.delete('/:id', authorize(...write), asyncHandler(async (req, res) => {
    const doc = await Model.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!doc) throw new AppError('Not found', 404);
    if (inUse && (await inUse(doc))) throw new AppError('This record is in use and cannot be deleted. Deactivate it instead.', 409);
    await doc.deleteOne(); res.json({ ok: true });
  }));
  return r;
};
