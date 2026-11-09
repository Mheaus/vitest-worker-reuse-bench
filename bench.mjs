// Calls `vitest.start()` RUNS times on one test file with one Vitest instance, as a mutation
// testing tool does (StrykerJS calls it once per mutant). Prints the duration of each call and
// the number of distinct workers that ran the test file.
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createVitest } from 'vitest/node';

const RUNS = Number(process.env.RUNS ?? 50);
const pool = process.argv[2] ?? 'threads';
const isolate = process.argv[3] !== 'no-isolate';
const workerLog = path.join(tmpdir(), `vitest-worker-log-${process.pid}`);
process.env.WORKER_LOG = workerLog;

const vitest = await createVitest('test', {
  pool,
  isolate,
  maxWorkers: 1,
  watch: false,
  reporters: [],
});
const file = path.resolve('tests/sum.test.js');
const durations = [];
for (let i = 0; i < RUNS; i++) {
  vitest.state.filesMap.clear();
  const start = performance.now();
  await vitest.start([file]);
  durations.push(performance.now() - start);
  const failed = vitest.state.getFiles().some((f) => f.result?.state !== 'pass');
  if (failed) throw new Error(`run ${i} failed`);
}
await vitest.close();

const lines = readFileSync(workerLog, "utf8").trim().split("\n");
const workers = new Set(lines);
rmSync(workerLog);
const sorted = [...durations].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
console.log(
  `pool=${pool} isolate=${isolate} runs=${RUNS} file-evaluations=${lines.length} workers=${workers.size} ` +
    `median=${median.toFixed(1)}ms min=${sorted[0].toFixed(1)}ms max=${sorted.at(-1).toFixed(1)}ms`,
);
console.log(`  each run (ms): ${durations.map((d) => d.toFixed(0)).join(' ')}`);
