// EXPERIMENT ONLY, not a proposed fix. It changes the built pool of Vitest 5.1.0 so that a
// non-isolated runner stays in `sharedRunners` when the queue is empty at the end of a run.
// The next `vitest.start()` then reuses the warm worker. `restore` puts the original file back.
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const chunks = path.resolve('node_modules/vitest/dist/chunks');
const target = readdirSync(chunks)
  .map((name) => path.join(chunks, name))
  .find((file) => readFileSync(file, 'utf8').includes('this.sharedRunners.push(runner)'));
const backup = `${target}.orig`;
const original =
  'if (!task.isolate && !runner.isTerminated && !isMemoryLimitReached && this.queue[0]?.task.isolate === false && isEqualRunner(runner, this.queue[0].task)) {';
const patched =
  'if (!task.isolate && !runner.isTerminated && !isMemoryLimitReached && (this.queue.length === 0 || this.queue[0].task.isolate === false && isEqualRunner(runner, this.queue[0].task))) {';

if (process.argv[2] === 'restore') {
  if (existsSync(backup)) copyFileSync(backup, target);
  console.log(`restored ${path.basename(target)}`);
} else {
  const code = readFileSync(target, 'utf8');
  if (!code.includes(original)) throw new Error(`pattern not found in ${target}`);
  if (!existsSync(backup)) copyFileSync(target, backup);
  writeFileSync(target, code.replace(original, patched));
  console.log(`patched ${path.basename(target)}`);
}
