const { Schema, model } = require('mongoose');
module.exports = model('Organization', new Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  domain: { type: String, trim: true },
  active: { type: Boolean, default: true },
  tzOffsetMinutes: { type: Number, default: 0 }, // e.g. 330 for IST
  businessHours: {
    enabled: { type: Boolean, default: true },
    start: { type: String, default: '09:00' }, end: { type: String, default: '18:00' },
    days: { type: [Number], default: [1, 2, 3, 4, 5] },
  },
  holidays: [String], // YYYY-MM-DD
  autoCloseDays: { type: Number, default: 3 },
}, { timestamps: true }));
