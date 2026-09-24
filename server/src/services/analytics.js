const { Ticket, Asset, User, WorkLog, Priority, Category } = require('../models');
const { ticketScope } = require('../middleware/auth');
const { OPEN_STATUS } = require('../constants');
const { idOf } = require('../utils/http');
const DAY = 86400000;
const day = (d) => d.toISOString().slice(0, 10);

async function technicianWorkload(user, scopeOverride) {
  const scope = scopeOverride || ticketScope(user);
  const techs = await User.find({ organization: user.organization, role: 'technician', active: true }).select('name capacity skills').lean();
  const ids = techs.map((t) => t._id), now = new Date(), d7 = new Date(now - 7 * DAY);
  const [open, resolved, logs] = await Promise.all([
    Ticket.aggregate([{ $match: { $and: [scope, { assignee: { $in: ids }, status: { $in: OPEN_STATUS } }] } }, { $group: { _id: { a: '$assignee', s: '$status' }, c: { $sum: 1 }, breached: { $sum: { $cond: [{ $or: ['$sla.resolutionBreached', '$sla.responseBreached'] }, 1, 0] } } } }]),
    Ticket.aggregate([{ $match: { $and: [scope, { assignee: { $in: ids }, resolvedAt: { $gte: d7 } }] } }, { $group: { _id: '$assignee', c: { $sum: 1 } } }]),
    WorkLog.aggregate([{ $match: { technician: { $in: ids }, date: { $gte: d7 } } }, { $group: { _id: '$technician', minutes: { $sum: '$minutes' } } }]),
  ]);
  return techs.map((t) => {
    const mine = open.filter((o) => idOf(o._id.a) === idOf(t._id));
    const byStatus = Object.fromEntries(mine.map((o) => [o._id.s, o.c]));
    const total = mine.reduce((n, o) => n + o.c, 0);
    return {
      _id: t._id, name: t.name, capacity: t.capacity, open: total, byStatus,
      breached: mine.reduce((n, o) => n + o.breached, 0),
      resolved7: resolved.find((r) => idOf(r._id) === idOf(t._id))?.c || 0,
      minutes7: logs.find((l) => idOf(l._id) === idOf(t._id))?.minutes || 0,
      utilization: Math.round((total / (t.capacity || 10)) * 100),
    };
  }).sort((a, b) => b.open - a.open);
}

async function dashboard(user) {
  const scope = ticketScope(user), now = new Date();
  const and = (...c) => ({ $and: [scope, ...c] });
  const d30 = new Date(now - 30 * DAY), d14 = new Date(now - 13 * DAY); d14.setUTCHours(0, 0, 0, 0);
  const breachedQ = { $or: [{ 'sla.resolutionBreached': true }, { 'sla.responseBreached': true }] };
  const [total, open, unassigned, breached, atRisk, awaiting, resolved30, mineOpen, statusAgg, prioAgg, catAgg, created, resolvedAgg, sla, perf, priorities, categories, recent, attention, myAssets] = await Promise.all([
    Ticket.countDocuments(scope),
    Ticket.countDocuments(and({ status: { $in: OPEN_STATUS } })),
    Ticket.countDocuments(and({ status: { $in: ['new', 'reopened'] }, assignee: null })),
    Ticket.countDocuments(and({ status: { $in: OPEN_STATUS } }, breachedQ)),
    Ticket.countDocuments(and({ status: { $in: ['new', 'assigned', 'in_progress', 'reopened'] }, 'sla.resolutionBreached': false, 'sla.resolutionDue': { $gte: now, $lte: new Date(+now + 4 * 3600000) } })),
    Ticket.countDocuments(and({ status: 'resolved' })),
    Ticket.countDocuments(and({ resolvedAt: { $gte: d30 } })),
    Ticket.countDocuments({ organization: user.organization, assignee: user._id, status: { $in: OPEN_STATUS } }),
    Ticket.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: and({ status: { $in: OPEN_STATUS } }) }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: and({ createdAt: { $gte: d30 } }) }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: and({ createdAt: { $gte: d14 } }) }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, c: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: and({ resolvedAt: { $gte: d14 } }) }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt' } }, c: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: and({ resolvedAt: { $gte: d30 } }) }, { $group: { _id: null, n: { $sum: 1 }, missed: { $sum: { $cond: ['$sla.resolutionBreached', 1, 0] } }, respMissed: { $sum: { $cond: ['$sla.responseBreached', 1, 0] } } } }]),
    Ticket.aggregate([{ $match: and({ 'sla.respondedAt': { $exists: true }, createdAt: { $gte: d30 } }) }, { $group: { _id: null, avgResp: { $avg: { $subtract: ['$sla.respondedAt', '$createdAt'] } } } }]),
    Priority.find({ organization: user.organization }).lean(), Category.find({ organization: user.organization }).lean(),
    Ticket.find(scope).sort('-createdAt').limit(6).select('number title status createdAt priority requester assignee').populate('priority', 'name color level').populate('requester', 'name').lean(),
    Ticket.find(and({ status: { $in: ['new', 'assigned', 'in_progress', 'reopened'] } }, { $or: [breachedQ.$or[0], breachedQ.$or[1], { 'sla.resolutionDue': { $lte: new Date(+now + 4 * 3600000) } }] })).sort('sla.resolutionDue').limit(6).select('number title status sla priority assignee').populate('priority', 'name color level').populate('assignee', 'name').lean(),
    Asset.countDocuments({ organization: user.organization, assignedTo: user._id, status: { $in: ['assigned', 'in_repair'] } }),
  ]);
  const pName = Object.fromEntries(priorities.map((p) => [idOf(p._id), p])), cName = Object.fromEntries(categories.map((c) => [idOf(c._id), c.name]));
  const days = Array.from({ length: 14 }, (_, i) => day(new Date(+d14 + i * DAY)));
  const cMap = Object.fromEntries(created.map((x) => [x._id, x.c])), rMap = Object.fromEntries(resolvedAgg.map((x) => [x._id, x.c]));
  const s = sla[0] || { n: 0, missed: 0, respMissed: 0 };
  const out = {
    counts: { total, open, unassigned, breached, atRisk, awaiting, resolved30, mineOpen, myAssets },
    byStatus: statusAgg.map((x) => ({ status: x._id, count: x.count })),
    byPriority: prioAgg.map((x) => ({ name: pName[idOf(x._id)]?.name || 'None', color: pName[idOf(x._id)]?.color || '#94a3b8', level: pName[idOf(x._id)]?.level || 9, count: x.count })).sort((a, b) => a.level - b.level),
    byCategory: catAgg.map((x) => ({ name: cName[idOf(x._id)] || 'Uncategorised', count: x.count })).sort((a, b) => b.count - a.count).slice(0, 8),
    trend: days.map((d) => ({ date: d.slice(5), created: cMap[d] || 0, resolved: rMap[d] || 0 })),
    sla: { resolutionCompliance: s.n ? Math.round(((s.n - s.missed) / s.n) * 100) : 100, responseCompliance: s.n ? Math.round(((s.n - s.respMissed) / s.n) * 100) : 100, sample: s.n, avgFirstResponseMin: perf[0] ? Math.round(perf[0].avgResp / 60000) : null },
    recent, attention,
  };
  if (['admin', 'manager', 'technician'].includes(user.role)) out.workload = await technicianWorkload(user, scope);
  if (['admin', 'manager', 'technician', 'asset_manager'].includes(user.role)) out.assets = await assetStats(user.organization);
  return out;
}

async function assetStats(orgId) {
  const now = new Date(), in60 = new Date(+now + 60 * DAY);
  const live = { status: { $nin: ['retired', 'disposed'] } };
  const [byStatus, byCategory, value, warranty, licenses] = await Promise.all([
    Asset.aggregate([{ $match: { organization: orgId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Asset.aggregate([{ $match: { organization: orgId, ...live } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    Asset.aggregate([{ $match: { organization: orgId, ...live } }, { $group: { _id: null, total: { $sum: '$purchaseCost' }, n: { $sum: 1 } } }]),
    Asset.countDocuments({ organization: orgId, ...live, warrantyExpiry: { $lte: in60 } }),
    Asset.countDocuments({ organization: orgId, ...live, licenseExpiry: { $lte: in60 } }),
  ]);
  const st = Object.fromEntries(byStatus.map((x) => [x._id, x.count]));
  return { byStatus: byStatus.map((x) => ({ status: x._id, count: x.count })), byCategory: byCategory.map((x) => ({ name: x._id, count: x.count })), total: byStatus.reduce((n, x) => n + x.count, 0), active: value[0]?.n || 0, totalValue: value[0]?.total || 0, warrantyExpiring: warranty, licenseExpiring: licenses, assigned: st.assigned || 0, inRepair: st.in_repair || 0, inStock: st.in_stock || 0 };
}

// Reports page: SLA by priority, technician performance, category/volume mix over N days.
async function overview(user, days = 30) {
  const scope = ticketScope(user), since = new Date(Date.now() - days * DAY);
  const [prio, perf, cats, trend, priorities, categories, users, logs, breachedList] = await Promise.all([
    Ticket.aggregate([{ $match: { $and: [scope, { createdAt: { $gte: since } }] } }, { $group: { _id: '$priority', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } }, breached: { $sum: { $cond: ['$sla.resolutionBreached', 1, 0] } }, respBreached: { $sum: { $cond: ['$sla.responseBreached', 1, 0] } }, avgRes: { $avg: { $cond: ['$resolvedAt', { $subtract: ['$resolvedAt', '$createdAt'] }, null] } } } }]),
    Ticket.aggregate([{ $match: { $and: [scope, { resolvedAt: { $gte: since }, assignee: { $ne: null } }] } }, { $group: { _id: '$assignee', resolved: { $sum: 1 }, breached: { $sum: { $cond: ['$sla.resolutionBreached', 1, 0] } }, avgRes: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } }]),
    Ticket.aggregate([{ $match: { $and: [scope, { createdAt: { $gte: since } }] } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: { $and: [scope, { createdAt: { $gte: since } }] } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, c: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Priority.find({ organization: user.organization }).lean(), Category.find({ organization: user.organization }).lean(),
    User.find({ organization: user.organization, role: 'technician' }).select('name').lean(),
    WorkLog.aggregate([{ $match: { organization: user.organization, date: { $gte: since } } }, { $group: { _id: '$technician', minutes: { $sum: '$minutes' } } }]),
    Ticket.find({ $and: [scope, { status: { $in: OPEN_STATUS } }, { $or: [{ 'sla.resolutionBreached': true }, { 'sla.responseBreached': true }] }] }).sort('sla.resolutionDue').limit(15).select('number title status sla priority assignee').populate('priority', 'name color').populate('assignee', 'name').lean(),
  ]);
  const P = Object.fromEntries(priorities.map((p) => [idOf(p._id), p])), C = Object.fromEntries(categories.map((c) => [idOf(c._id), c.name])), U = Object.fromEntries(users.map((u) => [idOf(u._id), u.name]));
  return {
    days,
    byPriority: prio.map((x) => ({ name: P[idOf(x._id)]?.name || 'None', color: P[idOf(x._id)]?.color, level: P[idOf(x._id)]?.level || 9, total: x.total, resolved: x.resolved, breached: x.breached, respBreached: x.respBreached, compliance: x.total ? Math.round(((x.total - x.breached) / x.total) * 100) : 100, avgResolutionHours: x.avgRes ? +(x.avgRes / 3600000).toFixed(1) : null })).sort((a, b) => a.level - b.level),
    technicians: perf.map((x) => ({ name: U[idOf(x._id)] || 'Unknown', resolved: x.resolved, breached: x.breached, avgResolutionHours: +(x.avgRes / 3600000).toFixed(1), loggedHours: +(((logs.find((l) => idOf(l._id) === idOf(x._id))?.minutes) || 0) / 60).toFixed(1) })).sort((a, b) => b.resolved - a.resolved),
    byCategory: cats.map((x) => ({ name: C[idOf(x._id)] || 'Uncategorised', count: x.count })).sort((a, b) => b.count - a.count),
    trend: trend.map((x) => ({ date: x._id.slice(5), tickets: x.c })), breached: breachedList,
  };
}
module.exports = { dashboard, technicianWorkload, overview, assetStats };
