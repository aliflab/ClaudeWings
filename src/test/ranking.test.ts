import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeUsage, formatReset, pickBest } from '../ranking';
import { UsageInfo } from '../usage';

const ok = (session: number, weekly: number, sessionResetsAt?: string): UsageInfo => ({
  status: 'ok',
  session,
  weekly,
  sessionResetsAt,
  checkedAt: 0,
});

test('pickBest chooses the account with the most usage left', () => {
  const best = pickBest([
    { email: 'a', usage: ok(80, 10) },
    { email: 'b', usage: ok(20, 30) },
    { email: 'c', usage: ok(5, 95) },
  ]);
  assert.equal(best?.email, 'b');
});

test('pickBest skips expired and unchecked accounts', () => {
  const best = pickBest([
    { email: 'a', usage: { status: 'expired', checkedAt: 0 } },
    { email: 'b' },
    { email: 'c', usage: ok(99, 99) },
  ]);
  assert.equal(best?.email, 'c');
  assert.equal(pickBest([{ email: 'a', usage: { status: 'error', checkedAt: 0 } }]), undefined);
});

test('pickBest breaks ties by earliest session reset', () => {
  const best = pickBest([
    { email: 'late', usage: ok(40, 40, '2030-01-01T05:00:00Z') },
    { email: 'early', usage: ok(40, 40, '2030-01-01T01:00:00Z') },
  ]);
  assert.equal(best?.email, 'early');
});

test('formatReset and describeUsage', () => {
  const now = Date.parse('2030-01-01T00:00:00Z');
  assert.equal(formatReset('2030-01-01T00:30:00Z', now), 'resets in 30m');
  assert.equal(formatReset('2030-01-01T02:15:00Z', now), 'resets in 2h 15m');
  assert.equal(formatReset('2030-01-03T03:00:00Z', now), 'resets in 2d 3h');
  assert.equal(formatReset(undefined, now), '');
  assert.equal(describeUsage(ok(42, 7)), 'session 42% · weekly 7%');
  assert.equal(describeUsage({ status: 'expired', checkedAt: 0 }), 'log in again and re-save');
});
