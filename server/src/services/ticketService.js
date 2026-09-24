const { Organization, SlaPolicy, Ticket, User, Counter, Priority } = require('../models');
const { addBusinessMinutes, ALWAYS_ON } = require('../utils/businessTime');
const { OPEN_STATUS } = require('../constants');
const { idOf } = require('../utils/http');
const { notify, logActivity } = require('./notify');

async function nextNumber(orgId) {
  const seq = await Counter.next(`${orgId}:ticket`);
  return { seq, number: `TKT-${String(1000 + seq)}` };
}

// Compute response/resolution due dates from the SLA policy for the ticket priority.
async function applySla(ticket, { from, reset = false } = {}) {
  const [org, policy] = await Promise.all([
    Organization.findById(ticket.organization).lean(),
    SlaPolicy.findOne({ organization: ticket.organization, priority: ticket.priority, active: true }),
  ]);
  if (!policy) { ticket.sla.policy = undefined; ticket.sla.responseDue = undefined; ticket.sla.resolutionDue = undefined; return null; }
  const start = from || ticket.createdAt || new Date();
  const o = policy.useBusinessHours ? org : ALWAYS_ON;
  ticket.sla.policy = policy._id;
  ticket.sla.responseDue = addBusinessMinutes(start, policy.responseMinutes, o);
  ticket.sla.resolutionDue = addBusinessMinutes(start, policy.resolutionMinutes, o);
  if (reset) { ticket.sla.respondedAt = undefined; ticket.sla.responseBreached = false; ticket.sla.resolutionBreached = false; ticket.sla.escalationLevel = 0; }
  return policy;
}

function markResponded(ticket, at = new Date()) {
  if (ticket.sla.respondedAt) return;
  ticket.sla.respondedAt = at;
  if (ticket.sla.responseDue && at > ticket.sla.responseDue) ticket.sla.responseBreached = true;
}

// Least-loaded technician, preferring those with the matching skill and department scope.
async function pickTechnician(ticket, excludeId) {
  const q = { organization: ticket.organization, role: 'technician', active: true };
  if (excludeId) q._id = { $ne: excludeId };
  const techs = await User.find(q).lean();
  const dep = idOf(ticket.department);
  const ok = techs.filter((t) => !t.scopeDepartments?.length || (dep && t.scopeDepartments.some((d) => idOf(d) === dep)));
  if (!ok.length) return null;
  const counts = await Ticket.aggregate([{ $match: { assignee: { $in: ok.map((t) => t._id) }, status: { $in: OPEN_STATUS } } }, { $group: { _id: '$assignee', c: { $sum: 1 } } }]);
  const load = Object.fromEntries(counts.map((c) => [idOf(c._id), c.c]));
  const cat = idOf(ticket.category);
  const skill = (t) => (cat && (t.skills || []).some((s) => idOf(s) === cat) ? 0 : 1);
  ok.sort((a, b) => skill(a) - skill(b) || (load[idOf(a._id)] || 0) - (load[idOf(b._id)] || 0));
  return ok[0];
}

async function assignTicket(ticket, assigneeId, actor, note) {
  const prev = idOf(ticket.assignee);
  ticket.assignee = assigneeId || undefined;
  if (assigneeId) {
    if (['new', 'reopened'].includes(ticket.status)) ticket.status = 'assigned';
    const u = await User.findById(assigneeId).select('name');
    logActivity(ticket, actor?._id, 'assigned', `Assigned to ${u?.name || 'technician'}${note ? ` (${note})` : ''}`);
    if (idOf(assigneeId) !== prev) await notify([assigneeId], { title: `Ticket ${ticket.number} assigned to you`, message: ticket.title, link: `/tickets/${ticket._id}`, type: 'info' }, actor?._id);
    await notify([ticket.requester], { title: `Your ticket ${ticket.number} has a technician`, message: `${u?.name || 'A technician'} is now handling it.`, link: `/tickets/${ticket._id}`, type: 'success' }, actor?._id);
  } else {
    if (ticket.status === 'assigned') ticket.status = 'new';
    logActivity(ticket, actor?._id, 'unassigned', 'Ticket returned to the queue');
  }
}

async function raisePriority(ticket) {
  const cur = await Priority.findById(ticket.priority);
  if (!cur) return null;
  const higher = await Priority.findOne({ organization: ticket.organization, level: { $lt: cur.level } }).sort('-level');
  if (higher) ticket.priority = higher._id;
  return higher;
}
module.exports = { nextNumber, applySla, markResponded, pickTechnician, assignTicket, raisePriority };
