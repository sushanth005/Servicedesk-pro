// Business-hours arithmetic without external libs. The organisation timezone is a fixed UTC offset in minutes.
const MIN = 60000, DAY = 86400000;
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };

function cfgOf(org) {
  const b = org?.businessHours || {};
  return {
    enabled: b.enabled !== false,
    start: toMin(b.start || '09:00'), end: toMin(b.end || '18:00'),
    days: b.days || [1, 2, 3, 4, 5], offset: org?.tzOffsetMinutes || 0,
    holidays: new Set(org?.holidays || []),
  };
}
const isWorkday = (dayStartLocal, c) => {
  const d = new Date(dayStartLocal);
  return c.days.includes(d.getUTCDay()) && !c.holidays.has(d.toISOString().slice(0, 10));
};

function addBusinessMinutes(start, minutes, org) {
  const c = cfgOf(org);
  if (!c.enabled) return new Date(start.getTime() + minutes * MIN);
  let cur = start.getTime() + c.offset * MIN, rem = minutes * MIN;
  for (let i = 0; i < 800; i++) {
    const dayStart = Math.floor(cur / DAY) * DAY;
    if (isWorkday(dayStart, c)) {
      const open = dayStart + c.start * MIN, close = dayStart + c.end * MIN;
      if (cur < open) cur = open;
      if (cur < close) {
        const avail = close - cur;
        if (rem <= avail) return new Date(cur + rem - c.offset * MIN);
        rem -= avail;
      }
    }
    cur = dayStart + DAY;
  }
  return new Date(start.getTime() + minutes * MIN);
}

function businessMinutesBetween(a, b, org) {
  const c = cfgOf(org);
  if (b <= a) return 0;
  if (!c.enabled) return (b - a) / MIN;
  let cur = a.getTime() + c.offset * MIN;
  const end = b.getTime() + c.offset * MIN;
  let total = 0;
  for (let i = 0; i < 800 && cur < end; i++) {
    const dayStart = Math.floor(cur / DAY) * DAY;
    if (isWorkday(dayStart, c)) {
      const s = Math.max(cur, dayStart + c.start * MIN), e = Math.min(end, dayStart + c.end * MIN);
      if (e > s) total += e - s;
    }
    cur = dayStart + DAY;
  }
  return total / MIN;
}
const ALWAYS_ON = { businessHours: { enabled: false } };
module.exports = { addBusinessMinutes, businessMinutesBetween, ALWAYS_ON };
