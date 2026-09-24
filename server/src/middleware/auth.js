const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const { AppError, asyncHandler } = require('../utils/http');

exports.signToken = (user) => jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: config.jwtExpires });

exports.protect = asyncHandler(async (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw new AppError('Authentication required', 401);
  const { id } = jwt.verify(h.slice(7), config.jwtSecret);
  const user = await User.findById(id).populate('department', 'name code');
  if (!user || !user.active) throw new AppError('Account not found or disabled', 401);
  req.user = user; next();
});

exports.authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError('You do not have permission to do this', 403));

// Department-based authorisation: which tickets can this user see?
exports.ticketScope = (u) => {
  const base = { organization: u.organization };
  if (u.role === 'admin') return base;
  if (u.role === 'manager' || u.role === 'technician') {
    const dep = u.scopeDepartments || [];
    if (!dep.length) return base;
    const or = [{ department: { $in: dep } }, { requester: u._id }];
    if (u.role === 'technician') or.push({ assignee: u._id });
    return { ...base, $or: or };
  }
  return { ...base, requester: u._id };
};
