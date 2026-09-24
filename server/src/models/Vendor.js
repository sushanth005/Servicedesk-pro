const { Schema, model } = require('mongoose');
module.exports = model('Vendor', new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true }, type: { type: String, default: 'Hardware' },
  contactName: String, email: String, phone: String, website: String, address: String,
  contractEnd: Date, notes: String, active: { type: Boolean, default: true },
}, { timestamps: true }));
