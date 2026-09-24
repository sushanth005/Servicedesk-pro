const { Schema, model } = require('mongoose');
const s = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  body: { type: String, required: true },
  category: { type: Schema.Types.ObjectId, ref: 'Category' },
  tags: [{ type: String, lowercase: true, trim: true }],
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  sourceTicket: { type: Schema.Types.ObjectId, ref: 'Ticket' },
  views: { type: Number, default: 0 }, helpful: { type: Number, default: 0 }, notHelpful: { type: Number, default: 0 },
}, { timestamps: true });
s.index({ title: 'text', body: 'text', tags: 'text' }, { weights: { title: 8, tags: 5, body: 1 } });
module.exports = model('Article', s);
