const { Schema, model } = require('mongoose');
module.exports = model('Notification', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: String, message: String, link: String,
  type: { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
  read: { type: Boolean, default: false },
}, { timestamps: true }));
