import test from 'node:test';
import assert from 'node:assert/strict';
import { executor, complete } from './helpers.mjs';
import { Wan } from '../dist/nodes/Wan/Wan.node.js';

const successHttp = async (config) =>
	config.method === 'POST'
		? { task_id: 'task_1', status: 'queued' }
		: config.url.includes('/api/v1/')
			? complete
			: {
					body: Buffer.from('video'),
					headers: { 'content-type': 'video/mp4' },
				};
test('default creation submits once at 1080P, waits and downloads', async () => {
	const e = executor({ prompt: 'A robot waves.' }, successHttp);
	const [[out]] = await e.execute();
	assert.equal(e.requests.filter((r) => r.method === 'POST').length, 1);
	assert.equal(e.requests[0].body.parameters.resolution, '1080P');
	assert.equal(out.json.isSuccess, true);
	assert.equal(out.json.downloaded, true);
	assert.ok(out.binary.video);
	assert.deepEqual(out.pairedItem, { item: 0 });
});
test('creation without waiting only submits, independent single query can download', async () => {
	const e = executor(
		{ prompt: 'A robot waves.', waitForCompletion: false },
		successHttp,
	);
	const [[out]] = await e.execute();
	assert.equal(e.requests.length, 1);
	assert.equal(out.json.status, 'queued');
	const query = executor(
		{ operation: 'get', taskId: out.json.taskId, waitForCompletion: false },
		successHttp,
	);
	const [[done]] = await query.execute();
	assert.ok(done.binary.video);
	assert.equal(
		query.requests.some((r) => r.method === 'POST'),
		false,
	);
});
test('download failure keeps successful task and supports query-only recovery', async () => {
	const e = executor(
		{ operation: 'get', taskId: 'task_1', waitForCompletion: false },
		async (config) => {
			if (!config.url.includes('/api/v1/'))
				throw new Error('download interrupted');
			return complete;
		},
	);
	const [[out]] = await e.execute();
	assert.equal(out.json.isSuccess, true);
	assert.equal(out.json.downloaded, false);
	assert.equal(out.json.downloadError.code, 'DOWNLOAD_FAILED');
	assert.equal(out.json.videoUrl, complete.metadata.url);
});
test('multi-item isolation and continueOnFail preserve item pairing', async () => {
	const e = executor(
		[{ prompt: '' }, { prompt: 'A robot waves.', waitForCompletion: false }],
		successHttp,
		{ items: [{ json: {} }, { json: {} }], continueOnFail: true },
	);
	const [out] = await e.execute();
	assert.ok(out[0].json.error);
	assert.deepEqual(out[0].pairedItem, { item: 0 });
	assert.deepEqual(out[1].pairedItem, { item: 1 });
	assert.equal(e.requests.length, 1);
});
test('missing created task ID and preflight errors never repeat POST', async () => {
	const e = executor({ prompt: 'A robot waves.' }, async () => ({
		status: 'queued',
	}));
	await assert.rejects(e.execute(), /未返回/);
	assert.equal(e.requests.length, 1);
	const invalid = executor(
		{ prompt: 'text', waitTimeoutMinutes: 0 },
		successHttp,
	);
	await assert.rejects(invalid.execute());
	assert.equal(invalid.requests.length, 0);
});
test('editing defaults auto duration, respects target and records submitted prompt', async () => {
	const e = executor(
		{
			mode: 'multimodal',
			intent: 'edit',
			prompt: 'Change background to pink.',
			references: {
				items: [
					{
						type: 'reference_video',
						url: 'https://media.example.test/source.mp4',
					},
				],
			},
			waitForCompletion: false,
		},
		successHttp,
	);
	const [[out]] = await e.execute();
	assert.equal(e.requests[0].body.parameters.duration, -1);
	assert.match(out.json.requestSummary.submittedPrompt, /编辑视频1/);
});
test('download remains visible for single query and interface defaults are correct', () => {
	const properties = new Wan().description.properties;
	for (const [name, value] of [
		['resolution', '1080P'],
		['waitForCompletion', true],
		['downloadVideo', true],
	])
		assert.equal(properties.find((p) => p.name === name).default, value);
	assert.equal(
		properties.find((p) => p.name === 'downloadVideo').displayOptions,
		undefined,
	);
});

test('unknown creation without waiting returns resumable polling context', async () => {
	const e = executor(
		{ prompt: 'A robot waves.', waitForCompletion: false },
		async () => ({ task_id: 'task_1', status: 'unknown' }),
	);
	const [[out]] = await e.execute();
	assert.equal(out.json.shouldPoll, true);
	assert.equal(out.json.pollingContext.taskId, 'task_1');
	assert.ok(out.json.pollingContext.firstUnknownAt > 0);
	assert.equal(e.requests.length, 1);
});
