const { Schema, model } = require('mongoose');
module.exports = model('Comment', new Schema({
  ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, maxlength: 5000 },
  internal: { type: Boolean, default: false },
}, { timestamps: true }));
