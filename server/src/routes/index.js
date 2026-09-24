const r = require('express').Router();
const crud = require('../utils/crud');
const v = require('../validators');
const { Department, Category, Priority, SlaPolicy, Vendor, User, Ticket, Asset, Article } = require('../models');

r.get('/health', (req, res) => res.json({ ok: true, time: new Date() }));
r.use('/auth', require('./auth'));
r.use('/users', require('./users'));
r.use('/organizations', require('./organizations'));
r.use('/tickets', require('./tickets'));
r.use('/assets', require('./assets'));
r.use('/articles', require('./articles'));
r.use('/departments', crud(Department, { schema: v.department, search: ['name', 'code'], sort: 'name', populate: [{ path: 'head', select: 'name' }], inUse: async (d) => (await User.exists({ department: d._id })) || (await Ticket.exists({ department: d._id })) }));
r.use('/categories', crud(Category, { schema: v.category, search: ['name'], sort: 'name', filters: ['active'], inUse: async (c) => (await Ticket.exists({ category: c._id })) || (await Article.exists({ category: c._id })) }));
r.use('/priorities', crud(Priority, { schema: v.priority, sort: 'level', inUse: async (p) => (await Ticket.exists({ priority: p._id })) || (await SlaPolicy.exists({ priority: p._id })) }));
r.use('/sla-policies', crud(SlaPolicy, { schema: v.sla, sort: 'name', populate: [{ path: 'priority', select: 'name level color' }] }));
r.use('/vendors', crud(Vendor, { schema: v.vendor, search: ['name', 'contactName', 'email'], sort: 'name', read: ['admin', 'manager', 'technician', 'asset_manager'], write: ['admin', 'asset_manager'], inUse: async (x) => !!(await Asset.exists({ vendor: x._id })) }));
r.use('/', require('./misc'));
module.exports = r;
