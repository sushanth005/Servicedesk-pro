exports.ROLES = ['admin', 'manager', 'technician', 'employee', 'asset_manager'];
exports.STAFF = ['admin', 'manager', 'technician'];
exports.TICKET_STATUS = ['new', 'assigned', 'in_progress', 'on_hold', 'resolved', 'closed', 'reopened'];
exports.ACTIVE_STATUS = ['new', 'assigned', 'in_progress', 'reopened']; // SLA clock running
exports.OPEN_STATUS = ['new', 'assigned', 'in_progress', 'on_hold', 'reopened'];
exports.TRANSITIONS = {
  new: ['assigned', 'in_progress', 'on_hold', 'resolved'],
  assigned: ['new', 'in_progress', 'on_hold', 'resolved'],
  in_progress: ['assigned', 'on_hold', 'resolved'],
  on_hold: ['assigned', 'in_progress'],
  resolved: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['assigned', 'in_progress', 'on_hold', 'resolved'],
};
exports.ASSET_STATUS = ['procurement', 'in_stock', 'assigned', 'in_repair', 'retired', 'disposed'];
exports.ESCALATION_ACTIONS = ['notify_assignee', 'notify_manager', 'notify_admin', 'reassign', 'raise_priority'];
