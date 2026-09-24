const r = require('express').Router();
const rateLimit = require('express-rate-limit');
const { User, Organization, AuditLog } = require('../models');
const { protect, signToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const v = require('../validators');
const { AppError, asyncHandler } = require('../utils/http');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Try again in a few minutes.' } });
const withDept = (id) => User.findById(id).populate('department', 'name code');

r.post('/login', limiter, validate(v.login), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  if (!user || !(await user.matches(req.body.password))) throw new AppError('Incorrect email or password', 401);
  if (!user.active) throw new AppError('This account is disabled. Contact your administrator.', 403);
  user.lastLogin = new Date(); await user.save();
  await AuditLog.create({ organization: user.organization, user: user._id, userName: user.name, role: user.role, action: 'LOGIN', entity: 'auth', ip: req.ip, status: 200 });
  res.json({ token: signToken(user), user: await withDept(user._id) });
}));

r.post('/register', limiter, validate(v.register), asyncHandler(async (req, res) => {
  const org = await Organization.findOne({ code: req.body.orgCode.toUpperCase(), active: true });
  if (!org) throw new AppError('Organisation code not recognised', 404);
  const { name, email, password, department } = req.body;
  const user = await User.create({ organization: org._id, name, email, password, department, role: 'employee' }); // self-signup is always Employee
  res.status(201).json({ token: signToken(user), user: await withDept(user._id) });
}));

r.get('/me', protect, (req, res) => res.json(req.user));
r.put('/profile', protect, validate(v.profile), asyncHandler(async (req, res) => {
  req.user.set(req.body); await req.user.save(); res.json(await withDept(req.user._id));
}));
r.put('/password', protect, validate(v.changePassword), asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).select('+password');
  if (!(await u.matches(req.body.current))) throw new AppError('Current password is incorrect', 400);
  u.password = req.body.next; await u.save(); res.json({ ok: true });
}));
module.exports = r;
