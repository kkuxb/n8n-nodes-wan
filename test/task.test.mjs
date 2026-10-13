import test from 'node:test';
import assert from 'node:assert/strict';
import { mapTaskResponse } from '../dist/nodes/Wan/shared/task.js';
import { complete } from './helpers.mjs';
test('real Maibao schema and task_id precedence', () => {
	const value = mapTaskResponse({ ...complete, id: 'other' });
	assert.equal(value.taskId, 'task_1');
	assert.equal(value.status, 'succeeded');
	assert.equal(value.providerStatus, 'completed');
	assert.equal(value.videoUrl, complete.metadata.url);
	assert.equal(value.isSuccess, true);
	assert.equal(value.shouldPoll, false);
});
test('unknown is not task failure; progress alone does not settle task', () => {
	const running = mapTaskResponse(
		{ status: 'in_progress', progress: 100 },
		'task_1',
	);
	assert.equal(running.status, 'running');
	assert.equal(running.isSuccess, false);
	assert.equal(running.shouldPoll, true);
	const unknown = mapTaskResponse({ status: 'unknown' }, 'task_1');
	assert.equal(unknown.isFailure, false);
	assert.equal(unknown.isTerminal, false);
});
test('failures, missing URL and mismatched ID remain explicit', () => {
	assert.equal(
		mapTaskResponse({
			status: 'failed',
			error: { code: 'policy', message: 'rejected' },
		}).isFailure,
		true,
	);
	assert.equal(
		mapTaskResponse({ status: 'completed' }).resultError.code,
		'MISSING_VIDEO_URL',
	);
	assert.throws(() => mapTaskResponse(complete, 'other'), /不一致/);
});
