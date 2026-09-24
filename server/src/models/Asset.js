const { Schema, model } = require('mongoose');
const { ASSET_STATUS } = require('../constants');
const s = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  assetTag: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['hardware', 'software'], default: 'hardware' },
  category: { type: String, default: 'Laptop' },
  brand: String, model: String, serialNumber: String,
  vendor: { type: Schema.Types.ObjectId, ref: 'Vendor' },
  status: { type: String, enum: ASSET_STATUS, default: 'procurement', index: true },
  purchaseDate: Date, purchaseCost: { type: Number, min: 0 }, warrantyExpiry: Date,
  licenseKey: String, licenseSeats: Number, licenseExpiry: Date,
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  location: String, notes: String,
  replacedBy: { type: Schema.Types.ObjectId, ref: 'Asset' },
  expiryNotified: { type: Boolean, default: false },
  history: [{ _id: false, action: String, from: String, to: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, note: String }],
}, { timestamps: true });
s.index({ organization: 1, assetTag: 1 }, { unique: true });
s.index({ name: 'text', assetTag: 'text', serialNumber: 'text', brand: 'text', model: 'text' });
module.exports = model('Asset', s);
