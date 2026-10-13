import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateRequest } from '../dist/nodes/Wan/shared/create.js';
import { baseInput } from './helpers.mjs';

test('1080P defaults, explicit watermark/audio, no seed or empty media', () => {
	const { payload } = buildCreateRequest(baseInput());
	assert.deepEqual(payload.parameters, {
		resolution: '1080P',
		ratio: 'adaptive',
		duration: 5,
		audio: true,
		prompt_extend: true,
		watermark: false,
	});
	assert.equal(payload.model, 'wan3.0-video');
	assert.equal('media' in payload.input, false);
	assert.equal(payload.input.prompt, 'A robot waves.');
});
test('seed zero is preserved; invalid integers fail locally', () => {
	assert.equal(
		buildCreateRequest(baseInput({ seed: 0 })).payload.parameters.seed,
		0,
	);
	for (const seed of [NaN, 0.5, -2, 2147483648])
		assert.throws(() => buildCreateRequest(baseInput({ seed })), /种子/);
	for (const duration of [0, 1, 31, NaN, 3.5])
		assert.throws(() => buildCreateRequest(baseInput({ duration })), /时长/);
	for (const duration of [-1, 2, 30])
		assert.equal(
			buildCreateRequest(baseInput({ duration })).payload.parameters.duration,
			duration,
		);
});
test('empty text, missing first/last and incompatible media fail locally', () => {
	assert.throws(() => buildCreateRequest(baseInput({ prompt: '' })), /提示词/);
	assert.throws(
		() => buildCreateRequest(baseInput({ mode: 'firstFrame' })),
		/首帧/,
	);
	assert.throws(
		() =>
			buildCreateRequest(
				baseInput({
					mode: 'firstLastFrame',
					media: [{ type: 'first_frame', url: 'https://x.test/i' }],
				}),
			),
		/首尾帧/,
	);
	assert.throws(
		() =>
			buildCreateRequest(
				baseInput({
					mode: 'multimodal',
					media: [{ type: 'last_frame', url: 'https://x.test/i' }],
				}),
			),
		/混用/,
	);
});
test('extension sends total duration, preserves media order, selects per-type video number', () => {
	const media = [
		{ type: 'reference_image', url: 'https://x.test/i' },
		{ type: 'reference_video', url: 'https://x.test/v1' },
		{ type: 'reference_video', url: 'https://x.test/v2' },
	];
	const { payload, requestSummary } = buildCreateRequest(
		baseInput({
			mode: 'multimodal',
			intent: 'extend',
			direction: 'forward',
			targetVideoIndex: 2,
			duration: 8,
			media,
		}),
	);
	assert.equal(payload.parameters.duration, 8);
	assert.match(payload.input.prompt, /视频2向前延长/);
	assert.ok(payload.input.prompt.endsWith('A robot waves.'));
	assert.deepEqual(payload.input.media, media);
	assert.equal(requestSummary.originalPrompt, 'A robot waves.');
	assert.throws(
		() =>
			buildCreateRequest(
				baseInput({ mode: 'multimodal', intent: 'edit', media }),
			),
		/目标参考视频/,
	);
	assert.throws(
		() =>
			buildCreateRequest(
				baseInput({
					mode: 'multimodal',
					intent: 'extend',
					targetVideoIndex: 1,
					media,
					ratio: '16:9',
				}),
			),
		/自适应/,
	);
});
test('single target auto selection and no binary leak in request summary', () => {
	const { requestSummary } = buildCreateRequest(
		baseInput({
			mode: 'multimodal',
			intent: 'edit',
			duration: -1,
			media: [
				{ type: 'reference_image', url: 'data:image/png;base64,PRIVATE' },
				{ type: 'reference_video', url: 'https://x.test/v' },
			],
		}),
	);
	assert.equal(requestSummary.targetVideoIndex, 1);
	assert.equal(JSON.stringify(requestSummary).includes('PRIVATE'), false);
});
test('media count and final prompt bounds include generated instruction', () => {
	assert.throws(
		() =>
			buildCreateRequest(
				baseInput({
					mode: 'multimodal',
					media: Array.from({ length: 11 }, () => ({
						type: 'reference_image',
						url: 'https://x.test/i',
					})),
				}),
			),
		/最多/,
	);
	assert.throws(
		() => buildCreateRequest(baseInput({ prompt: 'a'.repeat(20001) })),
		/20000/,
	);
	assert.throws(
		() =>
			buildCreateRequest(
				baseInput({
					mode: 'multimodal',
					intent: 'edit',
					prompt: 'a'.repeat(20000),
					media: [{ type: 'reference_video', url: 'https://x.test/v' }],
				}),
			),
		/20000/,
	);
});
