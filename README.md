# Vitest: a new worker for each `vitest.start()`

A tool that drives Vitest through its Node API and calls `vitest.start()` many times on one
instance gets a new worker for each call. The worker never survives the end of a run, also with
`isolate: false` and with the vm pools. Mutation testing does exactly this: StrykerJS calls
`vitest.start()` once per mutant, often thousands of times, and each call runs one or two test
files.

Context: https://github.com/vitest-dev/vitest/issues/11720 (shared runners do not survive between
watch reruns).

## Run it

```bash
npm install
./run-all.sh        # published Vitest, then the experimental patch, then restores the file
node bench.mjs threads              # one configuration
node bench.mjs threads no-isolate
RUNS=200 node bench.mjs vmThreads
```

`bench.mjs` creates one Vitest instance with `maxWorkers: 1` and calls `vitest.start()` 50 times on
`tests/sum.test.js`. The test file appends `pid:threadId` to a log at each evaluation, so the
output shows:

- `file-evaluations`: how many times the test file ran (it must be 50: the test really runs each
  time);
- `workers`: how many distinct workers ran it.

`keep-runner-patch.mjs` is an **experiment, not a proposed fix**. It changes one condition in the
built pool so that a non-isolated runner stays in `sharedRunners` when the queue is empty at the
end of a run. It only shows the cost that a warm worker removes. `node keep-runner-patch.mjs
restore` puts the original file back.

For `vmThreads` and `vmForks`, Vitest forces `isolate: false` internally; the `isolate=true` in the
output is only the option the script passed. Each test file still gets a new vm context.

## Results

Vitest 5.1.0, macOS 27.0.1, Apple M5 Pro, `maxWorkers: 1`, 50 calls per line. Raw output:
[`results.txt`](./results.txt).

Median duration of one `vitest.start()`, and distinct workers over 50 calls:

| pool | isolate | Node 24.22.1 published | patched | Node 26.5.0 published | patched |
| --- | --- | --- | --- | --- | --- |
| threads | true | 38.8 ms, 50 workers | 36.9 ms, 50 workers | 33.3 ms, 50 workers | 33.5 ms, 50 workers |
| threads | false | 38.2 ms, 50 workers | **1.8 ms, 1 worker** | 33.7 ms, 50 workers | **0.8 ms, 1 worker** |
| forks | true | 52.0 ms, 50 workers | 52.9 ms, 50 workers | 49.7 ms, 50 workers | 49.5 ms, 50 workers |
| forks | false | 55.2 ms, 50 workers | **0.8 ms, 1 worker** | 49.7 ms, 50 workers | **0.8 ms, 1 worker** |
| vmThreads | (vm context per file) | 60.3 ms, 50 workers | **8.4 ms, 1 worker** | 52.5 ms, 50 workers | **8.3 ms, 1 worker** |
| vmForks | (vm context per file) | 84.4 ms, 50 workers | **9.0 ms, 1 worker** | 76.4 ms, 50 workers | **8.5 ms, 1 worker** |

The first call of each patched line still starts the worker (the `max` column of `results.txt`).

With `isolate: true` the patch changes nothing, as expected: isolated tasks never share runners.
The vm pools are the interesting case: each file keeps its own vm context, and the warm worker
removes about 85 % of the cost of a call.

## On a real project

On a TypeScript project with 66 test files (691 tests, 1.2 s net for the whole suite), a full
StrykerJS run with `@stryker-mutator/vitest-runner` 10.1.1 takes 7 min 42 s on 4 workers for
6,623 mutants. The tests themselves take a few milliseconds per mutant. With one worker, StrykerJS
spends about 60 ms per mutant on a small test file, close to the floor measured above.
