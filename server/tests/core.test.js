const test = require('node:test'), assert = require('node:assert/strict');
const { addBusinessMinutes, businessMinutesBetween, ALWAYS_ON } = require('../src/utils/businessTime');
const { heuristicClassify } = require('../src/services/ai');
const v = require('../src/validators');

const org = { tzOffsetMinutes: 0, businessHours: { enabled: true, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] }, holidays: [] };

test('SLA clock skips the weekend', () => {
  const fri = new Date('2026-09-25T17:00:00Z'); // Friday 17:00
  assert.equal(addBusinessMinutes(fri, 120, org).toISOString(), '2026-09-28T10:00:00.000Z');
});
test('SLA clock respects timezone offset (IST)', () => {
  const ist = { ...org, tzOffsetMinutes: 330 };
  const start = new Date('2026-09-24T03:30:00Z'); // 09:00 IST Thursday
  assert.equal(addBusinessMinutes(start, 60, ist).toISOString(), '2026-09-24T04:30:00.000Z');
});
test('holidays are skipped', () => {
  const h = { ...org, holidays: ['2026-09-28'] };
  assert.equal(addBusinessMinutes(new Date('2026-09-25T17:30:00Z'), 60, h).toISOString(), '2026-09-29T09:30:00.000Z');
});
test('24x7 policies ignore business hours', () => {
  assert.equal(addBusinessMinutes(new Date('2026-09-26T10:00:00Z'), 240, ALWAYS_ON).toISOString(), '2026-09-26T14:00:00.000Z');
});
test('businessMinutesBetween counts only working time', () => {
  assert.equal(businessMinutesBetween(new Date('2026-09-25T16:00:00Z'), new Date('2026-09-28T10:00:00Z'), org), 180);
});
test('heuristic classifier picks category and urgency', () => {
  const cats = [{ name: 'Network & VPN', keywords: ['vpn', 'wifi'] }, { name: 'Printing', keywords: ['printer'] }];
  const pris = [{ name: 'Critical', level: 1 }, { name: 'High', level: 2 }, { name: 'Medium', level: 3 }, { name: 'Low', level: 4 }];
  const r = heuristicClassify('VPN down for all users\nnobody can connect', cats, pris);
  assert.equal(r.category, 'Network & VPN'); assert.equal(r.priority, 'Critical');
});
test('ticket validation rejects short input and accepts good input', () => {
  assert.equal(v.ticketCreate.safeParse({ title: 'abc', description: 'short' }).success, false);
  assert.equal(v.ticketCreate.safeParse({ title: 'Printer offline', description: 'Cannot print on floor 2', category: '' }).success, true);
});
test('SLA policy validation enforces resolution >= response', () => {
  const p = '64b7f0f0f0f0f0f0f0f0f0f0';
  assert.equal(v.sla.safeParse({ name: 'x1', priority: p, responseMinutes: 60, resolutionMinutes: 30 }).success, false);
});
