const { z } = require('zod');
const { ROLES, TICKET_STATUS, ESCALATION_ACTIONS } = require('./constants');

const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
// Treat '' / null as "not provided" (multipart forms send empty strings)
const opt = (s) => z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional());
const bool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());
const oidList = z.preprocess((v) => (v === undefined || v === '' ? [] : Array.isArray(v) ? v : [v]), z.array(oid));
const strList = z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v), z.array(z.string().max(60)));
const date = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date().optional());
const password = z.string().min(8, 'must be at least 8 characters').max(100);

exports.oid = oid;
exports.login = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(1) });
exports.register = z.object({
  name: z.string().min(2).max(80), email: z.string().email().toLowerCase(), password,
  orgCode: z.string().min(2).max(20), department: opt(oid),
});
exports.profile = z.object({ name: z.string().min(2).max(80).optional(), phone: opt(z.string().max(30)), jobTitle: opt(z.string().max(80)) });
exports.changePassword = z.object({ current: z.string().min(1), next: password });

exports.user = z.object({
  name: z.string().min(2).max(80), email: z.string().email().toLowerCase(), password: password.optional(),
  role: z.enum(ROLES), department: opt(oid), scopeDepartments: oidList.optional(), skills: oidList.optional(),
  phone: opt(z.string().max(30)), jobTitle: opt(z.string().max(80)), capacity: z.coerce.number().int().min(1).max(100).optional(), active: bool.optional(),
});
exports.department = z.object({ name: z.string().min(2).max(80), code: opt(z.string().max(10)), description: opt(z.string().max(300)), head: opt(oid) });
exports.category = z.object({ name: z.string().min(2).max(80), description: opt(z.string().max(300)), keywords: strList.optional(), requiresApproval: bool.optional(), active: bool.optional() });
exports.priority = z.object({ name: z.string().min(2).max(40), level: z.coerce.number().int().min(1).max(9), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), description: opt(z.string().max(300)) });
exports.sla = z.object({
  name: z.string().min(2).max(80), priority: oid,
  responseMinutes: z.coerce.number().int().min(1), resolutionMinutes: z.coerce.number().int().min(1),
  useBusinessHours: bool.optional(), active: bool.optional(),
  escalationRules: z.array(z.object({ thresholdPct: z.coerce.number().min(1).max(300), action: z.enum(ESCALATION_ACTIONS) })).max(8).optional(),
}).refine((v) => v.resolutionMinutes >= v.responseMinutes, { message: 'resolution time must be >= response time', path: ['resolutionMinutes'] });
exports.vendor = z.object({
  name: z.string().min(2).max(100), type: opt(z.string().max(40)), contactName: opt(z.string().max(80)),
  email: opt(z.string().email()), phone: opt(z.string().max(30)), website: opt(z.string().max(200)), address: opt(z.string().max(300)),
  contractEnd: date, notes: opt(z.string().max(1000)), active: bool.optional(),
});
exports.organization = z.object({
  name: z.string().min(2).max(100), code: z.string().min(2).max(20).optional(), domain: opt(z.string().max(100)),
  tzOffsetMinutes: z.coerce.number().int().min(-720).max(840).optional(), active: bool.optional(),
  businessHours: z.object({ enabled: bool.optional(), start: z.string().regex(/^\d{2}:\d{2}$/).optional(), end: z.string().regex(/^\d{2}:\d{2}$/).optional(), days: z.array(z.coerce.number().min(0).max(6)).optional() }).optional(),
  holidays: strList.optional(), autoCloseDays: z.coerce.number().int().min(0).max(60).optional(),
  adminName: opt(z.string().max(80)), adminEmail: opt(z.string().email()), adminPassword: opt(password),
});
exports.article = z.object({
  title: z.string().min(5).max(200), body: z.string().min(20).max(20000), category: opt(oid),
  tags: strList.optional(), status: z.enum(['draft', 'published']).optional(),
});
exports.asset = z.object({
  assetTag: z.string().min(2).max(40).optional(), name: z.string().min(2).max(120), type: z.enum(['hardware', 'software']).optional(),
  category: opt(z.string().max(40)), brand: opt(z.string().max(60)), model: opt(z.string().max(80)), serialNumber: opt(z.string().max(80)),
  vendor: opt(oid), purchaseDate: date, purchaseCost: opt(z.coerce.number().min(0)), warrantyExpiry: date,
  licenseKey: opt(z.string().max(200)), licenseSeats: opt(z.coerce.number().int().min(1)), licenseExpiry: date,
  department: opt(oid), location: opt(z.string().max(100)), notes: opt(z.string().max(1000)),
});
exports.assetTransition = z.object({
  action: z.enum(['receive', 'assign', 'unassign', 'send_repair', 'complete_repair', 'replace', 'retire', 'dispose']),
  assignedTo: opt(oid), replacementAssetId: opt(oid), ticketId: opt(oid), note: opt(z.string().max(500)),
});

exports.ticketCreate = z.object({
  title: z.string().min(5, 'must be at least 5 characters').max(200), description: z.string().min(10, 'must be at least 10 characters').max(8000),
  type: opt(z.enum(['incident', 'request'])), category: opt(oid), priority: opt(oid), department: opt(oid), asset: opt(oid), requester: opt(oid),
  tags: strList.optional(),
});
exports.ticketUpdate = z.object({
  title: z.string().min(5).max(200).optional(), description: z.string().min(10).max(8000).optional(), type: z.enum(['incident', 'request']).optional(),
  category: opt(oid), priority: opt(oid), department: opt(oid), asset: z.preprocess((v) => (v === '' ? null : v), oid.nullable().optional()), tags: strList.optional(),
});
exports.ticketStatus = z.object({
  status: z.enum(TICKET_STATUS), note: opt(z.string().max(1000)), summary: opt(z.string().min(5).max(3000)), article: opt(oid),
});
exports.assign = z.object({ assignee: z.preprocess((v) => (v === '' ? null : v), oid.nullable()) });
exports.comment = z.object({ body: z.string().min(1).max(5000), internal: bool.optional() });
exports.worklog = z.object({ minutes: z.coerce.number().int().min(1).max(1440), description: z.string().min(3).max(2000), date });
exports.approval = z.object({ decision: z.enum(['approved', 'rejected']), note: opt(z.string().max(500)) });
exports.reason = z.object({ reason: z.string().min(3, 'please add a short reason').max(1000) });
exports.aiText = z.object({ title: z.string().max(200).default(''), description: z.string().max(8000).default('') }).refine((v) => (v.title + v.description).trim().length >= 8, { message: 'Add a bit more detail first' });
exports.savedFilter = z.object({ name: z.string().min(1).max(60), query: z.record(z.any()).default({}) });
