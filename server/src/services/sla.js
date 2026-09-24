const { Ticket, Organization, Priority, User } = require('../models');
const { businessMinutesBetween, ALWAYS_ON } = require('../utils/businessTime');
const { ACTIVE_STATUS } = require('../constants');
const { idOf } = require('../utils/http');
const { notify, managersFor, logActivity } = require('./notify');
const { pickTechnician, assignTicket, raisePriority } = require('./ticketService');

const DAY = 86400000;

// Percent of the resolution window consumed (business-hours aware). >100 = overdue.
function pctElapsed(ticket, policy, org, now) {
  const o = policy.useBusinessHours ? org : ALWAYS_ON;
  const due = ticket.sla.resolutionDue;
  if (now >= due) return 100 + (businessMinutesBetween(due, now, o) / policy.resolutionMinutes) * 100;
  return 100 - (businessMinutesBetween(now, due, o) / policy.resolutionMinutes) * 100;
}

async function runSlaSweep() {
  const now = new Date();
  const orgs = new Map((await Organization.find().lean()).map((o) => [idOf(o._id), o]));
  const tickets = await Ticket.find({ status: { $in: ACTIVE_STATUS }, 'sla.resolutionDue': { $exists: true } }).populate('sla.policy').populate('priority', 'name level');
  let breaches = 0, escalations = 0;

  for (const t of tickets) {
    const policy = t.sla.policy; if (!policy) continue;
    const org = orgs.get(idOf(t.organization));
    let dirty = false;
    const mgrs = () => managersFor(t);

    if (!t.sla.respondedAt && !t.sla.responseBreached && t.sla.responseDue < now) {
      t.sla.responseBreached = true; dirty = true; breaches++;
      logActivity(t, null, 'sla_breach', 'First-response SLA breached');
      await notify([...(await mgrs()), t.assignee], { title: `Response SLA breached: ${t.number}`, message: t.title, link: `/tickets/${t._id}`, type: 'danger' });
    }
    if (!t.sla.resolutionBreached && t.sla.resolutionDue < now) {
      t.sla.resolutionBreached = true; dirty = true; breaches++;
      logActivity(t, null, 'sla_breach', 'Resolution SLA breached');
      await notify([...(await mgrs()), t.assignee], { title: `Resolution SLA breached: ${t.number}`, message: t.title, link: `/tickets/${t._id}`, type: 'danger' });
    }

    const rules = [...(policy.escalationRules || [])].sort((a, b) => a.thresholdPct - b.thresholdPct);
    if (rules.length && t.sla.escalationLevel < rules.length) {
      const pct = pctElapsed(t, policy, org, now);
      while (t.sla.escalationLevel < rules.length && pct >= rules[t.sla.escalationLevel].thresholdPct) {
        const rule = rules[t.sla.escalationLevel];
        t.sla.escalationLevel += 1; dirty = true; escalations++;
        const label = `SLA escalation L${t.sla.escalationLevel} at ${rule.thresholdPct}%: ${rule.action.replace('_', ' ')}`;
        logActivity(t, null, 'sla_escalation', label);
        const msg = { title: `${t.number} escalated (${rule.thresholdPct}% of SLA used)`, message: t.title, link: `/tickets/${t._id}`, type: 'warning' };
        if (rule.action === 'notify_assignee') await notify([t.assignee], msg);
        else if (rule.action === 'notify_manager') await notify([...(await mgrs()), t.assignee], msg);
        else if (rule.action === 'notify_admin') await notify(await managersFor(t, ['admin']), { ...msg, type: 'danger' });
        else if (rule.action === 'raise_priority') { const p = await raisePriority(t); if (p) logActivity(t, null, 'priority_changed', `Priority raised to ${p.name} by SLA rule`); await notify([...(await mgrs()), t.assignee], msg); }
        else if (rule.action === 'reassign') {
          const tech = await pickTechnician(t, idOf(t.assignee));
          if (tech) await assignTicket(t, tech._id, null, 'SLA auto-reassign');
          await notify(await mgrs(), msg);
        }
      }
    }
    if (dirty) await t.save();
  }

  // Auto-close resolved tickets that the requester never confirmed.
  let closed = 0;
  for (const org of orgs.values()) {
    if (!org.autoCloseDays) continue;
    const stale = await Ticket.find({ organization: org._id, status: 'resolved', resolvedAt: { $lt: new Date(now - org.autoCloseDays * DAY) } });
    for (const t of stale) {
      t.status = 'closed'; t.closedAt = now; logActivity(t, null, 'auto_closed', `Closed automatically after ${org.autoCloseDays} days without response`);
      await t.save(); closed++;
      await notify([t.requester], { title: `${t.number} was closed`, message: 'No response was received after resolution.', link: `/tickets/${t._id}`, type: 'info' });
    }
  }
  const expiry = await notifyAssetExpiries();
  return { checked: tickets.length, breaches, escalations, autoClosed: closed, assetAlerts: expiry };
}

// Warranty / licence expiry alerts for Asset Managers (once per asset).
async function notifyAssetExpiries() {
  const { Asset } = require('../models');
  const soon = new Date(Date.now() + 30 * DAY);
  const assets = await Asset.find({ expiryNotified: { $ne: true }, status: { $nin: ['retired', 'disposed'] }, $or: [{ warrantyExpiry: { $lte: soon } }, { licenseExpiry: { $lte: soon } }] });
  for (const a of assets) {
    const mgrs = await User.find({ organization: a.organization, role: { $in: ['asset_manager', 'admin'] }, active: true }).select('_id').lean();
    await notify(mgrs.map((m) => m._id), { title: `Expiry approaching: ${a.assetTag}`, message: `${a.name} - warranty/licence ends within 30 days`, link: '/assets', type: 'warning' });
    a.expiryNotified = true; await a.save();
  }
  return assets.length;
}
module.exports = { runSlaSweep, pctElapsed };
