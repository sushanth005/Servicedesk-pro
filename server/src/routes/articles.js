const r = require('express').Router();
const { Article, Ticket } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const v = require('../validators');
const { AppError, asyncHandler, escapeRegex, idOf } = require('../utils/http');
r.use(protect);
const STAFF = ['admin', 'manager', 'technician'], POP = [{ path: 'category', select: 'name' }, { path: 'author', select: 'name' }];

r.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, +req.query.page || 1), limit = Math.min(100, +req.query.limit || 12);
  const f = { organization: req.user.organization };
  if (!STAFF.includes(req.user.role)) f.status = 'published'; else if (req.query.status) f.status = req.query.status;
  if (req.query.category) f.category = req.query.category;
  if (req.query.q) { const rx = new RegExp(escapeRegex(req.query.q), 'i'); f.$or = [{ title: rx }, { tags: rx }, { body: rx }]; }
  const [items, total] = await Promise.all([Article.find(f).select('-body').populate(POP).sort(req.query.q ? '-helpful' : '-updatedAt').skip((page - 1) * limit).limit(limit), Article.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));
r.get('/:id', asyncHandler(async (req, res) => {
  const f = { _id: req.params.id, organization: req.user.organization }; if (!STAFF.includes(req.user.role)) f.status = 'published';
  const a = await Article.findOneAndUpdate(f, { $inc: { views: 1 } }, { new: true }).populate(POP);
  if (!a) throw new AppError('Article not found', 404); res.json(a);
}));
r.post('/', authorize(...STAFF), validate(v.article), asyncHandler(async (req, res) => {
  const status = req.user.role === 'technician' ? 'draft' : req.body.status || 'draft'; // technician articles await manager review
  const a = await Article.create({ ...req.body, status, organization: req.user.organization, author: req.user._id });
  res.locals.entityId = a._id; res.status(201).json(await Article.findById(a._id).populate(POP));
}));
r.put('/:id', authorize(...STAFF), validate(v.article.partial()), asyncHandler(async (req, res) => {
  const a = await Article.findOne({ _id: req.params.id, organization: req.user.organization }); if (!a) throw new AppError('Article not found', 404);
  if (req.user.role === 'technician') { if (idOf(a.author) !== idOf(req.user._id)) throw new AppError('You can only edit your own articles', 403); req.body.status = 'draft'; }
  a.set(req.body); await a.save(); res.json(await Article.findById(a._id).populate(POP));
}));
r.delete('/:id', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const a = await Article.findOneAndDelete({ _id: req.params.id, organization: req.user.organization }); if (!a) throw new AppError('Article not found', 404); res.json({ ok: true });
}));
r.post('/:id/feedback', asyncHandler(async (req, res) => {
  const inc = req.body.helpful ? { helpful: 1 } : { notHelpful: 1 };
  const a = await Article.findOneAndUpdate({ _id: req.params.id, organization: req.user.organization, status: 'published' }, { $inc: inc }, { new: true }).select('helpful notHelpful');
  if (!a) throw new AppError('Article not found', 404); res.json(a);
}));
// Turn a resolved ticket into a draft knowledge article
r.post('/from-ticket/:ticketId', authorize(...STAFF), asyncHandler(async (req, res) => {
  const t = await Ticket.findOne({ _id: req.params.ticketId, organization: req.user.organization });
  if (!t || !t.resolution?.summary) throw new AppError('Resolve the ticket first, then create an article from it', 409);
  const a = await Article.create({ organization: req.user.organization, title: t.title, body: `Problem\n${t.description}\n\nSolution\n${t.resolution.summary}`, category: t.category, tags: t.tags, status: 'draft', author: req.user._id, sourceTicket: t._id });
  res.status(201).json(a);
}));
module.exports = r;
