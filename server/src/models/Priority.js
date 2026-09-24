const { Schema, model } = require('mongoose');
const s = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  level: { type: Number, required: true, min: 1, max: 9 }, // 1 = most urgent
  color: { type: String, default: '#f59f00' }, description: String,
}, { timestamps: true });
s.index({ organization: 1, level: 1 }, { unique: true });
module.exports = model('Priority', s);
