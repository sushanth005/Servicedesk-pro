const { Schema, model } = require('mongoose');
const { TICKET_STATUS } = require('../constants');
const ref = (r, extra = {}) => ({ type: Schema.Types.ObjectId, ref: r, ...extra });
const s = new Schema({
  organization: ref('Organization', { required: true, index: true }),
  number: String, seq: Number,
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 8000 },
  type: { type: String, enum: ['incident', 'request'], default: 'incident' },
  requester: ref('User', { required: true, index: true }),
  department: ref('Department'), category: ref('Category'), priority: ref('Priority'),
  status: { type: String, enum: TICKET_STATUS, default: 'new', index: true },
  assignee: ref('User', { index: true }), asset: ref('Asset'), tags: [String],
  aiClassification: {
    category: String, priority: String, probableIssue: String, confidence: Number, reasoning: String,
    source: String, classifiedAt: Date, applied: Boolean,
  },
  approval: {
    status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    approver: ref('User'), note: String, decidedAt: Date,
  },
  sla: {
    policy: ref('SlaPolicy'), responseDue: Date, resolutionDue: Date, respondedAt: Date,
    responseBreached: { type: Boolean, default: false }, resolutionBreached: { type: Boolean, default: false },
    escalationLevel: { type: Number, default: 0 }, onHoldAt: Date,
  },
  attachments: [{ filename: String, originalName: String, mimetype: String, size: Number, uploadedBy: ref('User'), uploadedAt: { type: Date, default: Date.now } }],
  resolution: { summary: String, resolvedAt: Date, resolvedBy: ref('User'), article: ref('Article') },
  resolvedAt: Date, closedAt: Date, reopenCount: { type: Number, default: 0 },
  activity: [{ action: String, by: ref('User'), at: { type: Date, default: Date.now }, detail: String }],
}, { timestamps: true });
s.index({ organization: 1, number: 1 }, { unique: true });
s.index({ 'sla.resolutionDue': 1, status: 1 });
s.index({ title: 'text', description: 'text', 'resolution.summary': 'text' }, { weights: { title: 6, description: 2, 'resolution.summary': 3 } });
module.exports = model('Ticket', s);
