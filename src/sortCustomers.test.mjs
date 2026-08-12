import test from 'node:test';
import assert from 'node:assert/strict';
import { SORT_MODES, sortCustomers, moveCustomer } from './sortCustomers.mjs';

const c = (name, extra = {}) => ({ id: name.toLowerCase().replace(/\W/g, '-'), name, portals: [], ...extra });
const names = (list) => list.map((x) => x.name);

test('custom order is the stored order, untouched', () => {
  const stored = [c('Zebra'), c('Alpha'), c('Milo')];
  assert.deepEqual(names(sortCustomers(stored, 'custom')), ['Zebra', 'Alpha', 'Milo']);
});

test('an unknown or missing mode falls back to stored order', () => {
  const stored = [c('Zebra'), c('Alpha')];
  assert.deepEqual(names(sortCustomers(stored, 'nonsense')), ['Zebra', 'Alpha']);
  assert.deepEqual(names(sortCustomers(stored, undefined)), ['Zebra', 'Alpha']);
});

test('A–Z and Z–A are mirror images', () => {
  const stored = [c('Milo'), c('Zebra'), c('Alpha')];
  assert.deepEqual(names(sortCustomers(stored, 'az')), ['Alpha', 'Milo', 'Zebra']);
  assert.deepEqual(names(sortCustomers(stored, 'za')), ['Zebra', 'Milo', 'Alpha']);
});

test('sorting by name is case-insensitive', () => {
  const stored = [c('beta'), c('Alpha'), c('CHARLIE')];
  assert.deepEqual(names(sortCustomers(stored, 'az')), ['Alpha', 'beta', 'CHARLIE']);
});

test('numbers in names sort numerically, not as text', () => {
  const stored = [c('Customer 10'), c('Customer 2'), c('Customer 1')];
  assert.deepEqual(names(sortCustomers(stored, 'az')), ['Customer 1', 'Customer 2', 'Customer 10']);
});

test('sorting never mutates the array it was given', () => {
  const stored = [c('Zebra'), c('Alpha')];
  const copy = [...stored];
  sortCustomers(stored, 'az');
  sortCustomers(stored, 'most-used');
  assert.deepEqual(stored, copy);
});

test('most used comes first', () => {
  const stored = [
    c('Rarely', { openCount: 1 }),
    c('Often', { openCount: 42 }),
    c('Sometimes', { openCount: 7 })
  ];
  assert.deepEqual(names(sortCustomers(stored, 'most-used')), ['Often', 'Sometimes', 'Rarely']);
});

test('customers never opened rank last, and do not crash the sort', () => {
  const stored = [c('Never'), c('Once', { openCount: 1 })];
  assert.deepEqual(names(sortCustomers(stored, 'most-used')), ['Once', 'Never']);
});

test('equal use falls back to most recently opened, then to name', () => {
  const recent = [
    c('Older', { openCount: 5, lastOpenedAt: 1000 }),
    c('Newer', { openCount: 5, lastOpenedAt: 9000 })
  ];
  assert.deepEqual(names(sortCustomers(recent, 'most-used')), ['Newer', 'Older']);

  const identical = [c('Beta', { openCount: 5 }), c('Alpha', { openCount: 5 })];
  assert.deepEqual(names(sortCustomers(identical, 'most-used')), ['Alpha', 'Beta']);
});

test('every advertised mode is handled', () => {
  const stored = [c('Beta'), c('Alpha')];
  for (const { id } of SORT_MODES) {
    assert.equal(sortCustomers(stored, id).length, 2, `mode ${id} lost a customer`);
  }
});

test('moveCustomer reorders the stored array', () => {
  const stored = [c('A'), c('B'), c('C'), c('D')];
  assert.deepEqual(names(moveCustomer(stored, 'd', 'a')), ['D', 'A', 'B', 'C'], 'last to first');
  assert.deepEqual(names(moveCustomer(stored, 'a', 'c')), ['B', 'C', 'A', 'D'], 'first to third');
  assert.deepEqual(names(moveCustomer(stored, 'b', 'c')), ['A', 'C', 'B', 'D'], 'adjacent swap');
});

test('moveCustomer is a no-op for a self-drop or an unknown id', () => {
  const stored = [c('A'), c('B')];
  assert.deepEqual(names(moveCustomer(stored, 'a', 'a')), ['A', 'B']);
  assert.deepEqual(names(moveCustomer(stored, 'a', 'ghost')), ['A', 'B']);
  assert.deepEqual(names(moveCustomer(stored, 'ghost', 'a')), ['A', 'B']);
});

test('moveCustomer never mutates the array it was given', () => {
  const stored = [c('A'), c('B'), c('C')];
  const copy = [...stored];
  moveCustomer(stored, 'c', 'a');
  assert.deepEqual(stored, copy);
});
