const { Schema, model } = require('mongoose');
module.exports = model('AuditLog', new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' }, userName: String, role: String,
  action: String, entity: String, entityId: String, ip: String, status: Number, summary: String,
}, { timestamps: { createdAt: true, updatedAt: false } }));
