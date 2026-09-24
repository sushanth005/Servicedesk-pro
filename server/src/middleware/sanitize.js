// Strip Mongo operator injection ($where, $ne ...) from user input.
const clean = (o) => {
  if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (k.startsWith('$') || k.includes('.')) delete o[k]; else clean(o[k]); }
  return o;
};
module.exports = (req, res, next) => { clean(req.body); clean(req.query); clean(req.params); next(); };
