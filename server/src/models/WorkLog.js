const { Schema, model } = require('mongoose');
module.exports = model('WorkLog', new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
  ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
  technician: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  minutes: { type: Number, required: true, min: 1, max: 1440 },
  description: { type: String, required: true, maxlength: 2000 },
  date: { type: Date, default: Date.now },
}, { timestamps: true }));
