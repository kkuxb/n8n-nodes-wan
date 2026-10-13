import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Wan } from '../dist/nodes/Wan/Wan.node.js';
import { MaibaoWanApi } from '../dist/credentials/MaibaoWanApi.credentials.js';
import { executor } from './helpers.mjs';

const { NodeHelpers } = createRequire(import.meta.url)('n8n-workflow');
const description = new Wan().description;
const shown = (property, values) =>
	NodeHelpers.displayParameter(values, property, null, description);
const referenceFields = (intent) => {
	const matches = description.properties.filter(
		(p) =>
			p.name === 'references' &&
			shown(p, {
				operation: 'create',
				mode: 'multimodal',
				intent,
			}),
	);
	assert.equal(matches.length, 1);
	return matches[0].options[0].values;
};
const resolve = (intent, items) =>
	NodeHelpers.getNodeParameters(
		description.properties,
		{
			operation: 'create',
			mode: 'multimodal',
			intent,
			prompt: 'Edit or extend the video.',
			references: { items },
			waitForCompletion: false,
		},
		true,
		false,
		null,
		description,
	);

test('dedicated credential avoids generic HTTP auth and model has no editable selector', () => {
	const credential = new MaibaoWanApi();
	assert.equal(credential.authenticate, undefined);
	assert.equal(credential.genericAuth, undefined);
	assert.equal(credential.extends, undefined);
	assert.deepEqual(
		credential.properties.map((p) => p.name),
		['baseUrl', 'apiKey'],
	);
	assert.equal(
		description.properties.find((p) => p.name === 'model').type,
		'hidden',
	);
	assert.equal(
		description.properties.find((p) => p.name === 'modelNotice').type,
		'notice',
	);
});

test('reference fields display only relevant inputs in type/source order', () => {
	for (const intent of ['reference', 'edit', 'extend']) {
		const fields = referenceFields(intent);
		for (const [type, source, expected] of [
			['reference_image', 'url', ['type', 'source', 'imageUrl']],
			['reference_image', 'binary', ['type', 'source', 'binaryProperty']],
			['reference_video', 'url', ['type', 'url']],
			['reference_audio', 'binary', ['type', 'url']],
		]) {
			assert.deepEqual(
				fields.filter((p) => shown(p, { type, source })).map((p) => p.name),
				expected,
			);
		}
	}
});

test('n8n defaults new edit/extend rows to video and keeps saved material choices', () => {
	for (const intent of ['reference', 'edit', 'extend']) {
		assert.equal(
			resolve(intent, [{}]).references.items[0].type,
			intent === 'reference' ? 'reference_image' : 'reference_video',
		);
		const saved = [
			{
				type: 'reference_image',
				source: 'url',
				imageUrl: 'https://example.test/image.jpg',
				url: 'stale',
			},
			{
				type: 'reference_video',
				url: 'https://example.test/video.mp4',
				imageUrl: 'stale',
			},
			{
				type: 'reference_audio',
				url: 'https://example.test/audio.mp3',
				binaryProperty: 'stale',
			},
		];
		assert.deepEqual(resolve(intent, saved).references.items, [
			{
				type: 'reference_image',
				source: 'url',
				imageUrl: 'https://example.test/image.jpg',
			},
			{ type: 'reference_video', url: 'https://example.test/video.mp4' },
			{ type: 'reference_audio', url: 'https://example.test/audio.mp3' },
		]);
	}
});

test('mixed material editing/extension retains all inputs and video numbering after n8n filtering', async () => {
	for (const intent of ['edit', 'extend']) {
		const parameters = resolve(intent, [
			{
				type: 'reference_image',
				source: 'url',
				imageUrl: 'https://example.test/image.jpg',
			},
			{ type: 'reference_video', url: 'https://example.test/video.mp4' },
			{ type: 'reference_audio', url: 'https://example.test/audio.mp3' },
		]);
		const e = executor(parameters, async () => ({
			task_id: 'test',
			status: 'queued',
		}));
		await e.execute();
		assert.deepEqual(e.requests[0].body.input.media, [
			{ type: 'reference_image', url: 'https://example.test/image.jpg' },
			{ type: 'reference_video', url: 'https://example.test/video.mp4' },
			{ type: 'reference_audio', url: 'https://example.test/audio.mp3' },
		]);
		assert.match(e.requests[0].body.input.prompt, /视频1/);
	}
});
