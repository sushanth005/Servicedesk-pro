const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../constants');
const s = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  password: { type: String, required: true, select: false, minlength: 8 },
  role: { type: String, enum: ROLES, default: 'employee' },
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  scopeDepartments: [{ type: Schema.Types.ObjectId, ref: 'Department' }], // departments a staff member may serve (empty = all)
  skills: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
  phone: String, jobTitle: String, capacity: { type: Number, default: 10 },
  active: { type: Boolean, default: true }, lastLogin: Date,
}, { timestamps: true });
s.pre('save', async function () { if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10); });
s.methods.matches = function (p) { return bcrypt.compare(p, this.password); };
s.set('toJSON', { transform: (d, r) => { delete r.password; delete r.__v; return r; } });
module.exports = model('User', s);
