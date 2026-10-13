import test from 'node:test';
import assert from 'node:assert/strict';
import { pollWanTask } from '../dist/nodes/Wan/shared/polling.js';
import { WanRequestError } from '../dist/nodes/Wan/shared/transport.js';
import { complete } from './helpers.mjs';
const clock = () => {
	let ms = 0;
	return {
		now: () => ms,
		sleep: async (delay) => {
			ms += delay;
		},
	};
};
test('unknown then running then completed succeeds', async () => {
	const sequence = [{ status: 'unknown' }, { status: 'in_progress' }, complete];
	const result = await pollWanTask({
		taskId: 'task_1',
		query: async () => sequence.shift(),
		wait: true,
		timeoutMs: 1200000,
		...clock(),
	});
	assert.equal(result.isSuccess, true);
	assert.equal(result.pollCount, 3);
	assert.equal(result.waitedMs, 40000);
	assert.equal(result.pollingContext.firstUnknownAt, undefined);
});
test('persistent unknown stops within 120 seconds without false task failure', async () => {
	const result = await pollWanTask({
		taskId: 'task_1',
		query: async () => ({ status: 'unknown' }),
		wait: true,
		timeoutMs: 1200000,
		...clock(),
	});
	assert.equal(result.queryError.code, 'UNKNOWN_TIMEOUT');
	assert.equal(result.isFailure, false);
	assert.equal(result.shouldPoll, false);
	assert.equal(result.waitedMs, 120000);
});
test('external single-query loop carries unknown window; wrong task context not reused', async () => {
	const first = await pollWanTask({
		taskId: 'task_1',
		query: async () => ({ status: 'unknown' }),
		wait: false,
		timeoutMs: 1000,
		now: () => 1000,
	});
	const next = await pollWanTask({
		taskId: 'task_1',
		query: async () => ({ status: 'unknown' }),
		wait: false,
		timeoutMs: 1000,
		context: first.pollingContext,
		now: () => 121000,
	});
	assert.equal(next.queryError.code, 'UNKNOWN_TIMEOUT');
	const other = await pollWanTask({
		taskId: 'task_2',
		query: async () => ({ status: 'unknown' }),
		wait: false,
		timeoutMs: 1000,
		context: first.pollingContext,
		now: () => 121000,
	});
	assert.equal(other.shouldPoll, true);
});
test('running timeout stays recoverable, per-request timeout bounded by deadline', async () => {
	const budgets = [];
	const result = await pollWanTask({
		taskId: 'task_1',
		query: async (budget) => {
			budgets.push(budget);
			return { status: 'in_progress' };
		},
		wait: true,
		timeoutMs: 25000,
		...clock(),
	});
	assert.equal(result.timedOut, true);
	assert.equal(result.shouldPoll, true);
	assert.equal(result.isFailure, false);
	assert.deepEqual(budgets, [25000, 5000]);
});
test('401 stops immediately, transient failures have at most three retries', async () => {
	for (const [status, expectedCount] of [
		[401, 1],
		[403, 1],
		[429, 4],
		[503, 4],
		[undefined, 4],
	]) {
		let calls = 0;
		const result = await pollWanTask({
			taskId: 'task_1',
			query: async () => {
				calls++;
				throw new WanRequestError('test failure', status);
			},
			wait: true,
			timeoutMs: 1200000,
			...clock(),
		});
		assert.equal(calls, expectedCount);
		assert.ok(result.queryError);
		assert.equal(result.isFailure, false);
	}
});
test('malformed or unexpected response and cancellation never loop', async () => {
	for (const raw of [{}, { status: 'unrecognized' }]) {
		const result = await pollWanTask({
			taskId: 'task_1',
			query: async () => raw,
			wait: true,
			timeoutMs: 1000,
			...clock(),
		});
		assert.equal(result.queryError.code, 'INVALID_RESPONSE');
		assert.equal(result.pollCount, 1);
	}
	const stopped = await pollWanTask({
		taskId: 'task_1',
		query: async () => {
			throw new Error('must not run');
		},
		wait: true,
		timeoutMs: 1000,
		cancelled: () => true,
	});
	assert.equal(stopped.queryError.code, 'EXECUTION_CANCELLED');
});

test('deadline preserves the most recent query error instead of hiding it', async () => {
	const result = await pollWanTask({
		taskId: 'task_1',
		query: async () => {
			throw new WanRequestError('network disconnected');
		},
		wait: true,
		timeoutMs: 1000,
		...clock(),
	});
	assert.equal(result.timedOut, true);
	assert.match(result.queryError.message, /network disconnected/);
	assert.equal(result.isFailure, false);
});
