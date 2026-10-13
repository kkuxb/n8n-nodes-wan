import test from 'node:test';
import assert from 'node:assert/strict';
import {
	createWanTask,
	getWanTask,
	downloadWanVideo,
} from '../dist/nodes/Wan/shared/transport.js';
import { buildCreateRequest } from '../dist/nodes/Wan/shared/create.js';
import { executor, baseInput } from './helpers.mjs';

test('native routes, explicit headers, encoded task ID', async () => {
	const { context, requests } = executor();
	await createWanTask(context, buildCreateRequest(baseInput()).payload);
	await getWanTask(context, 'a/b?c');
	assert.equal(
		requests[0].url,
		'https://api.example.test/api/v1/services/aigc/video-generation/video-synthesis',
	);
	assert.equal(requests[0].headers['X-DashScope-Async'], 'enable');
	assert.equal(requests[0].headers.Authorization, 'Bearer private-test-key');
	assert.equal(requests[0].disableFollowRedirect, true);
	assert.equal(requests[0].timeout, 180000);
	assert.equal(
		requests[1].url,
		'https://api.example.test/api/v1/tasks/a%2Fb%3Fc',
	);
});
test('ambiguous creation failure is never retried and credential is redacted', async () => {
	const { context, requests } = executor({}, async () => {
		throw new Error('ETIMEDOUT private-test-key');
	});
	await assert.rejects(
		createWanTask(context, buildCreateRequest(baseInput()).payload),
		(e) =>
			/未自动重发/.test(e.message) && !e.message.includes('private-test-key'),
	);
	assert.equal(requests.length, 1);
});
test('download carries no API authentication, uses prepareBinaryData', async () => {
	const { context, requests } = executor({}, async () => ({
		body: Buffer.from('video'),
		headers: { 'content-type': 'video/mp4' },
	}));
	const binary = await downloadWanVideo(
		context,
		'https://media.example.test/video',
		'id/unsafe',
	);
	assert.deepEqual(requests[0].headers, {});
	assert.equal(requests[0].sendCredentialsOnCrossOriginRedirect, false);
	assert.equal(binary.fileName, 'wan-id_unsafe.mp4');
	assert.equal(binary.data, Buffer.from('video').toString('base64'));
});
test('empty or HTML download rejected', async () => {
	for (const response of [
		{ body: Buffer.alloc(0), headers: {} },
		{ body: Buffer.from('<html>'), headers: { 'content-type': 'text/html' } },
	]) {
		await assert.rejects(
			downloadWanVideo(
				executor({}, async () => response).context,
				'https://media.example.test/v',
				'task_1',
			),
		);
	}
});
