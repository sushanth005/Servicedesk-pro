const { Schema, model } = require('mongoose');
module.exports = model('SavedFilter', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  entity: { type: String, default: 'tickets' },
  query: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true }));
