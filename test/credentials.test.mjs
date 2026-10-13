import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { MaibaoWanApi } from '../dist/credentials/MaibaoWanApi.credentials.js';
import {
	createWanTask,
	getWanTask,
} from '../dist/nodes/Wan/shared/transport.js';
import { buildCreateRequest } from '../dist/nodes/Wan/shared/create.js';
import { executor, baseInput } from './helpers.mjs';

const { Expression, NodeHelpers } = createRequire(import.meta.url)(
	'n8n-workflow',
);
const credential = new MaibaoWanApi();
const withDefaults = (saved) =>
	NodeHelpers.getNodeParameters(
		credential.properties,
		saved,
		true,
		false,
		null,
		null,
	);

test('new credentials default to Lmao; saved Maibao credentials keep their host', () => {
	assert.equal(credential.name, 'maibaoWanApi');
	assert.equal(
		withDefaults({ apiKey: 'test' }).baseUrl,
		'https://ai.lmao.net.cn',
	);
	assert.equal(
		withDefaults({ apiKey: 'test', baseUrl: 'https://ai.maibao.chat' }).baseUrl,
		'https://ai.maibao.chat',
	);
});

for (const baseUrl of ['https://ai.maibao.chat', 'https://ai.lmao.net.cn']) {
	test(`${baseUrl}: credential test, creation and query use the selected provider`, async () => {
		const provider = credential.properties.find((p) => p.name === 'baseUrl');
		assert.equal(provider.type, 'options');
		assert.ok(provider.options.some((option) => option.value === baseUrl));
		const saved = withDefaults({ apiKey: 'private-test-key', baseUrl });
		const testHost = new Expression('UTC').resolveSimpleParameterValue(
			credential.test.request.baseURL,
			{ $credentials: saved },
		);
		assert.equal(
			testHost + credential.test.request.url,
			`${baseUrl}/v1/models`,
		);
		assert.equal(
			new Expression('UTC').resolveSimpleParameterValue(
				credential.test.request.headers.Authorization,
				{ $credentials: saved },
			),
			'Bearer private-test-key',
		);
		const { context, requests } = executor({}, undefined, {
			credentials: saved,
		});
		const payload = buildCreateRequest(baseInput()).payload;
		await createWanTask(context, payload);
		await getWanTask(context, 'task/a');
		assert.equal(
			requests[0].url,
			`${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`,
		);
		assert.deepEqual(requests[0].body, payload);
		assert.equal(requests[0].headers['X-DashScope-Async'], 'enable');
		assert.equal(requests[0].headers.Authorization, 'Bearer private-test-key');
		assert.equal(requests[1].url, `${baseUrl}/api/v1/tasks/task%2Fa`);
	});
}

test('transport fallback matches the new credential default', async () => {
	const { context, requests } = executor({}, undefined, {
		credentials: { apiKey: 'test' },
	});
	await getWanTask(context, 'task_1');
	assert.equal(requests[0].url, 'https://ai.lmao.net.cn/api/v1/tasks/task_1');
});
