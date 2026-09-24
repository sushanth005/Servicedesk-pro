const { Schema, model } = require('mongoose');
const s = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true }, code: { type: String, trim: true, uppercase: true },
  description: String, head: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
s.index({ organization: 1, name: 1 }, { unique: true });
module.exports = model('Department', s);
