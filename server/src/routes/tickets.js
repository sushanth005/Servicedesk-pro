const r = require('express').Router();
const path = require('path'), fs = require('fs');
const config = require('../config');
const { Ticket, Comment, WorkLog, User, Asset, Category, Priority, Article } = require('../models');
const { protect, authorize, ticketScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const upload = require('../middleware/upload');
const v = require('../validators');
const { TRANSITIONS, STAFF } = require('../constants');
const { AppError, asyncHandler, escapeRegex, idOf } = require('../utils/http');
const { notify, managersFor, logActivity } = require('../services/notify');
const { nextNumber, applySla, markResponded, pickTechnician, assignTicket, raisePriority } = require('../services/ticketService');
const { classifyTicket, suggestSolutions } = require('../services/ai');
const { sendExport } = require('../utils/exporter');

r.use(protect);
const staffOnly = authorize(...STAFF), managerOnly = authorize('admin', 'manager');
const isStaff = (u) => STAFF.includes(u.role);
const LIST_POP = [{ path: 'requester', select: 'name email' }, { path: 'assignee', select: 'name email' }, { path: 'category', select: 'name' }, { path: 'priority', select: 'name level color' }, { path: 'department', select: 'name' }];
const FULL_POP = [...LIST_POP, { path: 'asset', select: 'assetTag name category status' }, { path: 'sla.policy', select: 'name responseMinutes resolutionMinutes useBusinessHours' }, { path: 'activity.by', select: 'name' }, { path: 'resolution.resolvedBy', select: 'name' }, { path: 'resolution.article', select: 'title' }, { path: 'approval.approver', select: 'name' }, { path: 'attachments.uploadedBy', select: 'name' }];

const loadTicket = async (req, id = req.params.id) => {
  const t = await Ticket.findOne({ $and: [{ _id: id }, ticketScope(req.user)] });
  if (!t) throw new AppError('Ticket not found', 404);
  return t;
};
const reply = async (res, id, extra = {}) => res.json({ ticket: await Ticket.findById(id).populate(FULL_POP), ...extra });
const guardTech = (t, u) => { if (u.role === 'technician' && t.assignee && idOf(t.assignee) !== idOf(u._id)) throw new AppError('This ticket is assigned to another technician', 403); };

function buildFilter(user, q, opts = {}) {
  const and = [ticketScope(user)];
  ['status', 'priority', 'category', 'assignee', 'department', 'type', 'requester'].forEach((k) => {
    if (q[k]) and.push({ [k]: String(q[k]).includes(',') ? { $in: String(q[k]).split(',') } : q[k] });
  });
  if (q.mine === 'true') and.push({ assignee: user._id });
  if (q.unassigned === 'true') and.push({ assignee: null, status: { $in: ['new', 'reopened'] } });
  if (q.open === 'true') and.push({ status: { $in: ['new', 'assigned', 'in_progress', 'on_hold', 'reopened'] } });
  if (q.breached === 'true') and.push({ $or: [{ 'sla.resolutionBreached': true }, { 'sla.responseBreached': true }] });
  if (q.from || q.to) and.push({ createdAt: { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(new Date(q.to).getTime() + 86399999) }) } });
  if (q.q) {
    const s = String(q.q).trim(), rx = new RegExp(escapeRegex(s), 'i');
    if (/^tkt-?\d+$/i.test(s)) and.push({ number: new RegExp(`^${escapeRegex(s.replace(/^tkt-?/i, 'TKT-'))}$`, 'i') });
    else if (opts.regex) and.push({ $or: [{ title: rx }, { description: rx }, { number: rx }] });
    else and.push({ $text: { $search: s } }); // MongoDB full-text index (title, description, resolution)
  }
  return { $and: and };
}
const SORTS = { newest: '-createdAt', oldest: 'createdAt', updated: '-updatedAt', due: 'sla.resolutionDue' };

r.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, +req.query.page || 1), limit = Math.min(100, +req.query.limit || 15);
  const run = (f) => Promise.all([Ticket.find(f).select('-activity -attachments -description').populate(LIST_POP).sort(SORTS[req.query.sort] || '-createdAt').skip((page - 1) * limit).limit(limit).lean(), Ticket.countDocuments(f)]);
  let items = [], total = 0;
  try { [items, total] = await run(buildFilter(req.user, req.query)); } catch (e) { if (!req.query.q) throw e; } // text index not ready yet
  if (req.query.q && !total) [items, total] = await run(buildFilter(req.user, req.query, { regex: true })); // partial-word fallback
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

r.get('/export', asyncHandler(async (req, res) => {
  const items = await Ticket.find(buildFilter(req.user, req.query)).populate(LIST_POP).sort('-createdAt').limit(5000).lean();
  const d = (x) => (x ? new Date(x).toISOString().slice(0, 16).replace('T', ' ') : '');
  sendExport(res, req.query.format, {
    filename: 'tickets', title: 'Ticket report', rows: items,
    columns: [{ label: 'Ticket', key: 'number', width: 1 }, { label: 'Title', key: 'title', width: 4 }, { label: 'Status', key: 'status', width: 1.2 }, { label: 'Priority', get: (t) => t.priority?.name, width: 1 }, { label: 'Category', get: (t) => t.category?.name, width: 1.4 }, { label: 'Requester', get: (t) => t.requester?.name, width: 1.5 }, { label: 'Assignee', get: (t) => t.assignee?.name, width: 1.5 }, { label: 'Created', get: (t) => d(t.createdAt), width: 1.6 }, { label: 'Resolution due', get: (t) => d(t.sla?.resolutionDue), width: 1.6 }, { label: 'SLA breached', get: (t) => (t.sla?.resolutionBreached || t.sla?.responseBreached ? 'Yes' : 'No'), width: 1 }],
  });
}));

r.post('/', upload.array('files', 5), validate(v.ticketCreate), asyncHandler(async (req, res) => {
  const b = req.body, u = req.user;
  let requesterId = u._id;
  if (b.requester && isStaff(u)) {
    if (!(await User.exists({ _id: b.requester, organization: u.organization }))) throw new AppError('Requester not found', 404);
    requesterId = b.requester;
  }
  const requester = await User.findById(requesterId);
  const ai = await classifyTicket(u.organization, b);
  const staffPriority = isStaff(u) && b.priority; // employees never set priority; AI decides
  const category = b.category || ai.categoryId, priority = staffPriority ? b.priority : ai.priorityId;
  if (!priority) throw new AppError('No priorities configured. Ask an administrator to set up priorities.', 400);
  if (b.category && !(await Category.exists({ _id: b.category, organization: u.organization }))) throw new AppError('Category not found', 404);
  if (staffPriority && !(await Priority.exists({ _id: b.priority, organization: u.organization }))) throw new AppError('Priority not found', 404);
  if (b.asset && !(await Asset.exists({ _id: b.asset, organization: u.organization }))) throw new AppError('Asset not found', 404);
  const { seq, number } = await nextNumber(u.organization);
  const t = new Ticket({
    organization: u.organization, seq, number, title: b.title, description: b.description, type: b.type || 'incident',
    requester: requesterId, department: isStaff(u) && b.department ? b.department : requester.department, category, priority, asset: b.asset, tags: b.tags,
    aiClassification: { category: ai.category, priority: ai.priority, probableIssue: ai.probableIssue, confidence: ai.confidence, reasoning: ai.reasoning, source: ai.source, classifiedAt: new Date(), applied: !b.category || idOf(b.category) === idOf(ai.categoryId) },
    attachments: (req.files || []).map((f) => ({ filename: f.filename, originalName: f.originalname, mimetype: f.mimetype, size: f.size, uploadedBy: u._id })),
  });
  const cat = await Category.findById(category);
  if (cat?.requiresApproval) t.approval.status = 'pending';
  logActivity(t, u._id, 'created', `Ticket created${idOf(requesterId) !== idOf(u._id) ? ` on behalf of ${requester.name}` : ''}. AI (${ai.source}) suggested ${ai.category} / ${ai.priority}`);
  await applySla(t);
  await t.save();
  const mgrs = await managersFor(t);
  const hot = (await Priority.findById(priority))?.level <= 2;
  await notify(mgrs, { title: `${hot ? 'Urgent: ' : ''}New ticket ${t.number}`, message: t.title, link: `/tickets/${t._id}`, type: hot ? 'danger' : 'info' }, u._id);
  if (t.approval.status === 'pending') await notify(mgrs, { title: `Approval needed: ${t.number}`, message: `${cat.name} requests need manager approval`, link: `/tickets/${t._id}`, type: 'warning' }, u._id);
  res.locals.entityId = t._id; res.status(201).json(await Ticket.findById(t._id).populate(FULL_POP));
}));

r.get('/:id', asyncHandler(async (req, res) => {
  const t = await loadTicket(req);
  const staff = isStaff(req.user);
  const [ticket, comments, worklogs] = await Promise.all([
    Ticket.findById(t._id).populate(FULL_POP),
    Comment.find({ ticket: t._id, ...(staff ? {} : { internal: false }) }).populate('author', 'name role').sort('createdAt'),
    staff ? WorkLog.find({ ticket: t._id }).populate('technician', 'name').sort('-date') : [],
  ]);
  res.json({ ticket, comments, worklogs });
}));

r.put('/:id', validate(v.ticketUpdate), asyncHandler(async (req, res) => {
  const t = await loadTicket(req), u = req.user, b = req.body;
  if (!isStaff(u)) {
    if (t.status !== 'new') throw new AppError('You can only edit a ticket before it is picked up', 403);
    Object.keys(b).forEach((k) => { if (!['title', 'description'].includes(k)) delete b[k]; });
  } else guardTech(t, u);
  const changes = [];
  if (b.priority && idOf(b.priority) !== idOf(t.priority)) {
    const p = await Priority.findOne({ _id: b.priority, organization: u.organization }); if (!p) throw new AppError('Priority not found', 404);
    t.priority = p._id; changes.push(`priority to ${p.name}`); await applySla(t, { from: t.createdAt });
    await notify([t.assignee, t.requester], { title: `Priority changed on ${t.number}`, message: `Now ${p.name}`, link: `/tickets/${t._id}`, type: 'warning' }, u._id);
  }
  if (b.category && idOf(b.category) !== idOf(t.category)) {
    const c = await Category.findOne({ _id: b.category, organization: u.organization }); if (!c) throw new AppError('Category not found', 404);
    t.category = c._id; changes.push(`category to ${c.name}`);
    if (c.requiresApproval && t.approval.status === 'none') { t.approval.status = 'pending'; changes.push('approval required'); }
  }
  if (b.asset !== undefined && idOf(b.asset) !== idOf(t.asset)) { if (b.asset && !(await Asset.exists({ _id: b.asset, organization: u.organization }))) throw new AppError('Asset not found', 404); t.asset = b.asset || undefined; changes.push('linked asset'); }
  ['title', 'description', 'type', 'department', 'tags'].forEach((k) => { if (b[k] !== undefined && String(b[k]) !== String(t[k])) { t[k] = b[k]; changes.push(k); } });
  if (changes.length) logActivity(t, u._id, 'updated', `Updated ${changes.join(', ')}`);
  await t.save(); await reply(res, t._id);
}));

r.post('/:id/assign', validate(v.assign), asyncHandler(async (req, res) => {
  const t = await loadTicket(req), u = req.user, { assignee } = req.body;
  if (u.role === 'technician') { if (assignee !== idOf(u._id) || (t.assignee && idOf(t.assignee) !== idOf(u._id))) throw new AppError('Technicians can only take unassigned tickets for themselves', 403); }
  else if (!['admin', 'manager'].includes(u.role)) throw new AppError('You do not have permission to do this', 403);
  if (assignee) { const a = await User.findOne({ _id: assignee, organization: u.organization, active: true, role: { $in: ['technician', 'manager', 'admin'] } }); if (!a) throw new AppError('Assignee must be an active technician or manager', 400); }
  if (t.approval.status === 'rejected') throw new AppError('This request was rejected', 409);
  await assignTicket(t, assignee, u); await t.save(); await reply(res, t._id);
}));

r.post('/:id/auto-assign', managerOnly, asyncHandler(async (req, res) => {
  const t = await loadTicket(req);
  const tech = await pickTechnician(t);
  if (!tech) throw new AppError('No available technician matches this ticket\'s department', 404);
  await assignTicket(t, tech._id, req.user, 'auto-assigned by workload and skills'); await t.save(); await reply(res, t._id);
}));

r.post('/:id/status', staffOnly, validate(v.ticketStatus), asyncHandler(async (req, res) => {
  const t = await loadTicket(req), u = req.user, { status, note, summary, article } = req.body;
  guardTech(t, u);
  if (status === t.status) throw new AppError('Ticket is already in that status', 400);
  if (!TRANSITIONS[t.status]?.includes(status)) throw new AppError(`Cannot move a ticket from ${t.status.replace('_', ' ')} to ${status.replace('_', ' ')}`, 409);
  if (['closed', 'reopened'].includes(status) && u.role === 'technician') throw new AppError('Only the requester or a manager can close or reopen', 403);
  if (['in_progress', 'resolved'].includes(status) && ['pending', 'rejected'].includes(t.approval.status)) throw new AppError(`Manager approval is ${t.approval.status}. Work cannot start until it is approved.`, 409);
  if (['in_progress', 'resolved'].includes(status) && !t.assignee) { if (u.role === 'technician') await assignTicket(t, u._id, u); else throw new AppError('Assign a technician first', 409); }
  const from = t.status, now = new Date();
  if (from === 'on_hold' && t.sla.onHoldAt) { const held = now - t.sla.onHoldAt; ['responseDue', 'resolutionDue'].forEach((k) => { if (t.sla[k]) t.sla[k] = new Date(+t.sla[k] + held); }); t.sla.onHoldAt = undefined; }
  if (status === 'on_hold') t.sla.onHoldAt = now;
  if (status === 'in_progress') markResponded(t, now);
  if (status === 'resolved') {
    if (!summary) throw new AppError('Add a resolution summary', 422, [{ message: 'summary: is required to resolve a ticket' }]);
    t.resolution = { summary, resolvedAt: now, resolvedBy: u._id, article: article || undefined }; t.resolvedAt = now; markResponded(t, now);
    if (t.sla.resolutionDue && now > t.sla.resolutionDue) t.sla.resolutionBreached = true;
    await notify([t.requester], { title: `Ticket ${t.number} resolved`, message: 'Please confirm the fix works or reopen the ticket.', link: `/tickets/${t._id}`, type: 'success' }, u._id);
  }
  if (status === 'closed') t.closedAt = now;
  t.status = status;
  logActivity(t, u._id, 'status_changed', `${from.replace('_', ' ')} to ${status.replace('_', ' ')}${note ? `: ${note}` : ''}`);
  await t.save(); await reply(res, t._id);
}));

// Requester confirms the fix -> closed
r.post('/:id/confirm', asyncHandler(async (req, res) => {
  const t = await loadTicket(req), u = req.user;
  if (t.status !== 'resolved') throw new AppError('Only resolved tickets can be confirmed', 409);
  if (idOf(t.requester) !== idOf(u._id) && !['admin', 'manager'].includes(u.role)) throw new AppError('Only the requester can confirm resolution', 403);
  t.status = 'closed'; t.closedAt = new Date(); logActivity(t, u._id, 'confirmed', 'Requester confirmed the resolution');
  await t.save(); await notify([t.assignee], { title: `${t.number} confirmed by requester`, message: t.title, link: `/tickets/${t._id}`, type: 'success' }, u._id);
  await reply(res, t._id);
}));

r.post('/:id/reopen', validate(v.reason), asyncHandler(async (req, res) => {
  const t = await loadTicket(req), u = req.user;
  if (!['resolved', 'closed'].includes(t.status)) throw new AppError('Only resolved or closed tickets can be reopened', 409);
  const requester = idOf(t.requester) === idOf(u._id);
  if (!requester && !['admin', 'manager'].includes(u.role)) throw new AppError('Only the requester or a manager can reopen', 403);
  const ref = t.closedAt || t.resolvedAt;
  if (requester && !isStaff(u) && ref && Date.now() - ref > 7 * 86400000) throw new AppError('Tickets can be reopened within 7 days. Please raise a new ticket.', 409);
  t.status = 'reopened'; t.reopenCount += 1; t.closedAt = undefined; t.resolvedAt = undefined;
  await applySla(t, { from: new Date(), reset: true });
  logActivity(t, u._id, 'reopened', `Reopened: ${req.body.reason}`);
  await Comment.create({ ticket: t._id, author: u._id, body: `Reopened: ${req.body.reason}` });
  await t.save(); await notify([t.assignee, ...(await managersFor(t))], { title: `Ticket ${t.number} was reopened`, message: req.body.reason, link: `/tickets/${t._id}`, type: 'warning' }, u._id);
  await reply(res, t._id);
}));

r.post('/:id/approval', managerOnly, validate(v.approval), asyncHandler(async (req, res) => {
  const t = await loadTicket(req), u = req.user, { decision, note } = req.body;
  if (t.approval.status !== 'pending') throw new AppError('This ticket has no pending approval', 409);
  Object.assign(t.approval, { status: decision, approver: u._id, note, decidedAt: new Date() });
  logActivity(t, u._id, `approval_${decision}`, `Workflow ${decision}${note ? `: ${note}` : ''}`);
  if (decision === 'rejected') { t.status = 'closed'; t.closedAt = new Date(); }
  await t.save();
  await notify([t.requester, t.assignee], { title: `Request ${decision}: ${t.number}`, message: note || t.title, link: `/tickets/${t._id}`, type: decision === 'approved' ? 'success' : 'danger' }, u._id);
  await reply(res, t._id);
}));

r.post('/:id/escalate', staffOnly, validate(v.reason), asyncHandler(async (req, res) => {
  const t = await loadTicket(req), u = req.user;
  if (['resolved', 'closed'].includes(t.status)) throw new AppError('Ticket is already resolved', 409);
  const mgrs = await managersFor(t);
  if (u.role === 'technician') {
    logActivity(t, u._id, 'escalation_requested', `Escalation requested: ${req.body.reason}`);
    await notify(mgrs, { title: `Escalation requested: ${t.number}`, message: req.body.reason, link: `/tickets/${t._id}`, type: 'warning' }, u._id);
  } else {
    const p = await raisePriority(t); t.sla.escalationLevel += 1;
    logActivity(t, u._id, 'escalated', `Escalated${p ? ` to ${p.name}` : ''}: ${req.body.reason}`);
    await notify([t.assignee], { title: `${t.number} escalated`, message: req.body.reason, link: `/tickets/${t._id}`, type: 'danger' }, u._id);
  }
  await t.save(); await reply(res, t._id);
}));

r.post('/:id/comments', validate(v.comment), asyncHandler(async (req, res) => {
  const t = await loadTicket(req), u = req.user;
  const internal = !!req.body.internal;
  if (internal && !isStaff(u)) throw new AppError('Only staff can add internal notes', 403);
  if (t.status === 'closed') throw new AppError('This ticket is closed. Reopen it to continue the conversation.', 409);
  const c = await Comment.create({ ticket: t._id, author: u._id, body: req.body.body, internal });
  if (isStaff(u) && !internal) { markResponded(t); await t.save(); }
  if (internal) await notify([t.assignee], { title: `Internal note on ${t.number}`, message: `${u.name}: ${req.body.body.slice(0, 100)}`, link: `/tickets/${t._id}`, type: 'info' }, u._id);
  else if (isStaff(u)) await notify([t.requester], { title: `New reply on ${t.number}`, message: `${u.name}: ${req.body.body.slice(0, 100)}`, link: `/tickets/${t._id}`, type: 'info' }, u._id);
  else await notify(t.assignee ? [t.assignee] : await managersFor(t), { title: `Requester replied on ${t.number}`, message: req.body.body.slice(0, 100), link: `/tickets/${t._id}`, type: 'info' }, u._id);
  res.status(201).json(await Comment.findById(c._id).populate('author', 'name role'));
}));

r.post('/:id/worklogs', staffOnly, validate(v.worklog), asyncHandler(async (req, res) => {
  const t = await loadTicket(req); guardTech(t, req.user);
  const w = await WorkLog.create({ ...req.body, organization: req.user.organization, ticket: t._id, technician: req.user._id });
  logActivity(t, req.user._id, 'worklog', `Logged ${w.minutes} min: ${w.description.slice(0, 80)}`); await t.save();
  res.status(201).json(await WorkLog.findById(w._id).populate('technician', 'name'));
}));
r.delete('/:id/worklogs/:wid', staffOnly, asyncHandler(async (req, res) => {
  const t = await loadTicket(req); const w = await WorkLog.findOne({ _id: req.params.wid, ticket: t._id });
  if (!w) throw new AppError('Work log not found', 404);
  if (idOf(w.technician) !== idOf(req.user._id) && req.user.role !== 'admin') throw new AppError('You can only delete your own work logs', 403);
  await w.deleteOne(); res.json({ ok: true });
}));

r.post('/:id/attachments', upload.array('files', 5), asyncHandler(async (req, res) => {
  const t = await loadTicket(req);
  if (!req.files?.length) throw new AppError('Choose at least one file', 400);
  t.attachments.push(...req.files.map((f) => ({ filename: f.filename, originalName: f.originalname, mimetype: f.mimetype, size: f.size, uploadedBy: req.user._id })));
  logActivity(t, req.user._id, 'attachment', `Attached ${req.files.map((f) => f.originalname).join(', ')}`); await t.save(); await reply(res, t._id);
}));
r.get('/:id/attachments/:fid', asyncHandler(async (req, res) => {
  const t = await loadTicket(req); const a = t.attachments.id(req.params.fid);
  if (!a) throw new AppError('Attachment not found', 404);
  const file = path.join(config.uploadDir, path.basename(a.filename));
  if (!fs.existsSync(file)) throw new AppError('File is no longer available', 404);
  res.download(file, a.originalName);
}));

// ---- AI ----
r.post('/:id/classify', staffOnly, asyncHandler(async (req, res) => {
  const t = await loadTicket(req), u = req.user;
  const ai = await classifyTicket(u.organization, t);
  t.aiClassification = { category: ai.category, priority: ai.priority, probableIssue: ai.probableIssue, confidence: ai.confidence, reasoning: ai.reasoning, source: ai.source, classifiedAt: new Date(), applied: false };
  if (req.query.apply === 'true') {
    if (ai.categoryId) t.category = ai.categoryId;
    if (ai.priorityId && idOf(ai.priorityId) !== idOf(t.priority)) { t.priority = ai.priorityId; await applySla(t, { from: t.createdAt }); }
    t.aiClassification.applied = true; logActivity(t, u._id, 'ai_applied', `Applied AI classification: ${ai.category} / ${ai.priority}`);
  } else logActivity(t, u._id, 'ai_classified', `AI re-analysed ticket: ${ai.category} / ${ai.priority}`);
  await t.save(); await reply(res, t._id);
}));
r.get('/:id/suggestions', staffOnly, asyncHandler(async (req, res) => {
  const t = await loadTicket(req);
  res.json(await suggestSolutions(req.user.organization, { title: t.title, description: t.description, excludeTicket: t._id }));
}));

r.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const t = await loadTicket(req);
  await Promise.all([Comment.deleteMany({ ticket: t._id }), WorkLog.deleteMany({ ticket: t._id })]);
  t.attachments.forEach((a) => fs.unlink(path.join(config.uploadDir, path.basename(a.filename)), () => {}));
  await t.deleteOne(); res.json({ ok: true });
}));
module.exports = r;
