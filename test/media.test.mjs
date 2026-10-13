import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMedia, validateUrl } from '../dist/nodes/Wan/shared/media.js';
import { executor } from './helpers.mjs';

test('URL media rejects local paths, asset IDs and embedded credentials', () => {
	for (const value of [
		'asset://a',
		'D:/image.png',
		'file:///image.png',
		'data:image/png;base64,a',
		'https://user:pass@example.test/i',
	])
		assert.throws(() => validateUrl(value));
	assert.equal(
		validateUrl('https://example.test/i?signature=abc'),
		'https://example.test/i?signature=abc',
	);
});
test('binary uses helper storage, item index and actual file signature', async () => {
	const png = Buffer.from(
		'89504e470d0a1a0a0000000d494844520000010000000100',
		'hex',
	);
	const { context } = executor({}, undefined, {
		items: [
			{ json: {} },
			{
				json: {},
				binary: { image: { data: 'filesystem-v2', mimeType: 'wrong/type' } },
			},
		],
		binary: (index, name) => {
			assert.equal(index, 1);
			assert.equal(name, 'image');
			return png;
		},
	});
	const result = await resolveMedia(context, 1, [
		{ type: 'first_frame', source: 'binary', value: 'image' },
	]);
	assert.equal(
		result[0].url,
		`data:image/png;base64,${png.toString('base64')}`,
	);
});
test('binary rejects missing, empty, oversized, unsupported media', async () => {
	const input = [{ type: 'reference_image', source: 'binary', value: 'image' }];
	await assert.rejects(resolveMedia(executor().context, 0, input), /找不到/);
	for (const bytes of [
		Buffer.alloc(0),
		Buffer.alloc(20 * 1024 * 1024 + 1),
		Buffer.from('GIF89a'),
	]) {
		const { context } = executor({}, undefined, {
			items: [{ json: {}, binary: { image: {} } }],
			binary: () => bytes,
		});
		await assert.rejects(resolveMedia(context, 0, input));
	}
	await assert.rejects(
		resolveMedia(executor().context, 0, [
			{ type: 'reference_audio', source: 'binary', value: 'audio' },
		]),
		/仅图片/,
	);
});
