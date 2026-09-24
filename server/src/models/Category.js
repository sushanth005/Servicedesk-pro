const { Schema, model } = require('mongoose');
const s = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true }, description: String,
  keywords: [{ type: String, lowercase: true, trim: true }],
  requiresApproval: { type: Boolean, default: false }, active: { type: Boolean, default: true },
}, { timestamps: true });
s.index({ organization: 1, name: 1 }, { unique: true });
module.exports = model('Category', s);
