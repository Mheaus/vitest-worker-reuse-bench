import { appendFileSync } from 'node:fs';
import { threadId } from 'node:worker_threads';
import { expect, test } from 'vitest';
import { sum } from '../src/sum.js';

appendFileSync(process.env.WORKER_LOG, `${process.pid}:${threadId}\n`);

test('adds two numbers', () => {
  expect(sum(1, 2)).toBe(3);
});
