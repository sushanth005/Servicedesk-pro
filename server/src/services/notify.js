const { Notification, User } = require('../models');
const { idOf } = require('../utils/http');

async function notify(userIds, { title, message, link, type = 'info' }, excludeId) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(idOf))].filter((i) => i !== idOf(excludeId));
  if (!ids.length) return;
  await Notification.insertMany(ids.map((user) => ({ user, title, message, link, type })));
}
// Managers/admins who may act on a ticket's department.
async function managersFor(ticket, roles = ['manager', 'admin']) {
  const q = { organization: ticket.organization, role: { $in: roles }, active: true };
  const dep = idOf(ticket.department);
  q.$or = dep ? [{ scopeDepartments: { $size: 0 } }, { scopeDepartments: dep }] : [{ scopeDepartments: { $size: 0 } }];
  return (await User.find(q).select('_id').lean()).map((u) => u._id);
}
const logActivity = (ticket, by, action, detail) => ticket.activity.push({ action, by, detail, at: new Date() });
module.exports = { notify, managersFor, logActivity };
