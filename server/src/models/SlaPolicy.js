const { Schema, model } = require('mongoose');
const { ESCALATION_ACTIONS } = require('../constants');
const s = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  priority: { type: Schema.Types.ObjectId, ref: 'Priority', required: true },
  responseMinutes: { type: Number, required: true, min: 1 },
  resolutionMinutes: { type: Number, required: true, min: 1 },
  useBusinessHours: { type: Boolean, default: true },
  escalationRules: [{ _id: false, thresholdPct: { type: Number, min: 1, max: 300 }, action: { type: String, enum: ESCALATION_ACTIONS } }],
  active: { type: Boolean, default: true },
}, { timestamps: true });
s.index({ organization: 1, priority: 1 }, { unique: true });
module.exports = model('SlaPolicy', s);
