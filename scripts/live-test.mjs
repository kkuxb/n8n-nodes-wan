// Opt-in paid acceptance runner. Run only with explicit user authorization.
// Requires a local n8n-core installation and a credential helper; neither ships in the package.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { Wan } from '../dist/nodes/Wan/Wan.node.js';

const require = createRequire(import.meta.url);
const corePath = process.env.WAN_N8N_CORE;
const credentialPath = process.env.WAN_CREDENTIAL_HELPER;
if (!corePath || !credentialPath || process.env.WAN_PAID_TEST !== 'authorized')
	throw new Error(
		'Explicit paid-test authorization and local test dependencies are required',
	);
const { httpRequest } = require(
	path.join(
		corePath,
		'dist/execution-engine/node-execution-context/utils/request-helper-functions.js',
	),
);
const credential = spawnSync(
	'python',
	[
		'-c',
		'import sys; sys.path.insert(0,sys.argv[1]); from credential_store import load_key; sys.stdout.write(load_key())',
		credentialPath,
	],
	{ encoding: 'utf8', windowsHide: true },
);
if (credential.status || !credential.stdout.trim())
	throw new Error('Saved credential unavailable');
const apiKey = credential.stdout.trim();
credential.stdout = '';
const root = path.resolve('.local/live');
fs.mkdirSync(root, { recursive: true });
const save = (file, data) => {
	const temp = `${file}.tmp`;
	fs.writeFileSync(temp, JSON.stringify(data, null, 2));
	fs.renameSync(temp, file);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const firstUrl =
	'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260414/welyei/wan2.7-i2v-first-frame.webp';
const lastUrl =
	'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260414/zongha/wan2.7-i2v-last-frame.webp';
const portraitUrl =
	'https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1509667871/p1097184.png';
const audioUrl =
	'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260825/fzebps/wan_man_voice.mp3';

async function run(name, parameters, imageUrl) {
	const folder = path.join(root, name);
	fs.mkdirSync(folder, { recursive: true });
	const resultFile = path.join(folder, 'result.json');
	if (fs.existsSync(path.join(folder, 'video.mp4'))) {
		console.log(JSON.stringify({ name, event: 'already_downloaded' }));
		return;
	}
	let image;
	if (imageUrl?.startsWith('local:')) {
		image = fs.readFileSync(imageUrl.slice(6));
	} else if (imageUrl) {
		const response = await httpRequest({
			method: 'GET',
			url: imageUrl,
			encoding: 'arraybuffer',
			json: false,
		});
		image = Buffer.from(response);
		fs.writeFileSync(path.join(folder, 'reference-image'), image);
	}
	let creating = false;
	const makeExecutor = (params) => ({
		getInputData: () => [
			{
				json: {},
				...(image
					? {
							binary: {
								reference: { data: 'filesystem', mimeType: 'image/png' },
							},
						}
					: {}),
			},
		],
		getNodeParameter: (key, _index, fallback) =>
			Object.hasOwn(params, key) ? params[key] : fallback,
		getCredentials: async () => ({ apiKey, baseUrl: 'https://ai.maibao.chat' }),
		getNode: () => ({
			name: 'Wan acceptance',
			type: 'n8n-nodes-wan.wan',
			typeVersion: 1,
			parameters: params,
			position: [0, 0],
		}),
		continueOnFail: () => false,
		getExecutionCancelSignal: () => undefined,
		helpers: {
			httpRequest: async (options) => {
				if (options.method === 'POST') {
					const marker = path.join(folder, 'submission-started.json');
					// Exclusive creation prevents a crash or retry from submitting twice.
					fs.writeFileSync(
						marker,
						JSON.stringify({ at: new Date().toISOString() }),
						{ flag: 'wx' },
					);
					const redacted = structuredClone(options.body);
					for (const media of redacted.input.media ?? [])
						if (media.url.startsWith('data:'))
							media.url = '[binary image omitted]';
					save(path.join(folder, 'request.json'), redacted);
					creating = true;
					const response = await httpRequest(options);
					save(path.join(folder, 'create-response.json'), response);
					return response;
				}
				return httpRequest(options);
			},
			getBinaryDataBuffer: async () => image,
			prepareBinaryData: async (bytes, fileName, mimeType) => {
				fs.writeFileSync(path.join(folder, 'video.mp4'), bytes);
				return { data: '[written by acceptance harness]', fileName, mimeType };
			},
		},
	});
	try {
		const createFile = path.join(folder, 'create-response.json');
		let taskId;
		if (fs.existsSync(createFile)) {
			const response = JSON.parse(fs.readFileSync(createFile));
			taskId = response.task_id ?? response.id;
		} else {
			const [[output]] = await new Wan().execute.call(
				makeExecutor({
					...parameters,
					operation: 'create',
					waitForCompletion: false,
				}),
			);
			taskId = output.json.taskId;
			save(path.join(folder, 'create-output.json'), output.json);
		}
		console.log(
			JSON.stringify({ name, event: creating ? 'created' : 'resumed', taskId }),
		);
		if (!taskId) throw new Error('No task ID; submission will not be repeated');
		let context = {};
		if (fs.existsSync(resultFile))
			context = JSON.parse(fs.readFileSync(resultFile)).pollingContext ?? {};
		const started = Date.now();
		while (Date.now() - started < 25 * 60_000) {
			const [[output]] = await new Wan().execute.call(
				makeExecutor({
					operation: 'get',
					taskId,
					waitForCompletion: false,
					pollingContext: context,
				}),
			);
			save(resultFile, output.json);
			context = output.json.pollingContext ?? {};
			fs.appendFileSync(
				path.join(folder, 'timeline.jsonl'),
				JSON.stringify({
					at: new Date().toISOString(),
					status: output.json.providerStatus,
					queryError: output.json.queryError,
					downloaded: output.json.downloaded,
				}) + '\n',
			);
			console.log(
				JSON.stringify({
					name,
					event: 'query',
					status: output.json.providerStatus,
					downloaded: output.json.downloaded,
					error:
						output.json.queryError ??
						output.json.error ??
						output.json.downloadError,
				}),
			);
			if (
				output.json.isSuccess ||
				output.json.isFailure ||
				output.json.queryError
			)
				return;
			await sleep(20_000);
		}
		console.log(JSON.stringify({ name, event: 'local_timeout', taskId }));
	} catch (error) {
		const message = String(error.message).split(apiKey).join('[REDACTED]');
		save(path.join(folder, 'runner-error.json'), { message });
		console.log(JSON.stringify({ name, event: 'error', message }));
	}
}

const mode = process.argv[2];
if (mode === 'smoke') {
	await Promise.all([
		run('default-1080p', {
			prompt:
				'A small orange toy robot walks slowly from left to right on a wooden desk in soft daylight. Fixed wide camera, clean pale blue background, smooth continuous motion. Soft gentle music. No text.',
		}),
		run(
			'binary-first-frame',
			{
				mode: 'firstFrame',
				firstFrameSource: 'binary',
				firstFrameBinary: 'reference',
				prompt: '南瓜轻轻晃动，镜头缓慢推进，保持原始画面风格。',
				resolution: '480P',
				duration: 2,
			},
			firstUrl,
		),
	]);
} else if (mode === 'compact') {
	await run(
		'binary-audio-compact',
		{
			mode: 'multimodal',
			resolution: '480P',
			referenceDuration: 2,
			prompt:
				'参考图1中的眼镜和米色毛衣，人物微笑并说：“你好。”参考音频1的男性音色，不加字幕。',
			references: {
				items: [
					{
						type: 'reference_image',
						source: 'binary',
						binaryProperty: 'reference',
					},
					{ type: 'reference_audio', url: audioUrl },
				],
			},
		},
		'local:.local/portrait-small.jpg',
	);
} else if (mode === 'rest') {
	const source = JSON.parse(
		fs.readFileSync(path.join(root, 'default-1080p/result.json')),
	).videoUrl;
	if (!source) throw new Error('Completed source video required');
	const video = [{ type: 'reference_video', url: source }];
	const cases = [
		[
			'first-last-frame',
			{
				mode: 'firstLastFrame',
				firstFrameUrl: firstUrl,
				lastFrameUrl: lastUrl,
				prompt: '南瓜缓缓裂开，金光和白雾中出现小兔子，平滑自然地过渡至尾帧。',
				resolution: '480P',
				duration: 3,
			},
		],
		[
			'binary-audio-reference',
			{
				mode: 'multimodal',
				prompt:
					'以图1为人物参考，参考音频1的音色，人物微笑着说：“你好，欢迎来到这里。”固定机位，不加字幕。',
				references: {
					items: [
						{
							type: 'reference_image',
							source: 'binary',
							binaryProperty: 'reference',
						},
						{ type: 'reference_audio', url: audioUrl },
					],
				},
				resolution: '480P',
				referenceDuration: 3,
			},
			portraitUrl,
		],
		[
			'video-reference',
			{
				mode: 'multimodal',
				prompt: '参考视频1中玩具机器人的外观和行走动作，在白色桌面上向右走动。',
				references: { items: video },
				resolution: '480P',
				referenceDuration: 3,
			},
		],
		[
			'video-edit',
			{
				mode: 'multimodal',
				intent: 'edit',
				prompt:
					'把背景的浅蓝色墙面改成明亮的粉红色，保留橙色玩具机器人和木桌。',
				references: { items: video },
				resolution: '480P',
			},
		],
		[
			'extend-backward',
			{
				mode: 'multimodal',
				intent: 'extend',
				direction: 'backward',
				prompt: '机器人继续向画面右侧走两步，再停下挥手。',
				references: { items: video },
				resolution: '480P',
				intentDuration: 8,
			},
		],
		[
			'extend-forward',
			{
				mode: 'multimodal',
				intent: 'extend',
				direction: 'forward',
				prompt:
					'在原视频之前，机器人先站在原起点左边，转身准备开始向右行走，然后自然接入原视频。',
				references: { items: video },
				resolution: '480P',
				intentDuration: 8,
			},
		],
		[
			'extend-both',
			{
				mode: 'multimodal',
				intent: 'extend',
				direction: 'both',
				prompt:
					'在原视频之前增加机器人从画面左侧进入的过程，在原视频之后增加机器人停下挥手的过程，原视频作为中间段。',
				references: { items: video },
				resolution: '480P',
				intentDuration: 8,
			},
		],
	];
	// At most two concurrent paid tasks; each case has a persistent no-resubmit marker.
	for (let i = 0; i < cases.length; i += 2)
		await Promise.all(cases.slice(i, i + 2).map((args) => run(...args)));
} else throw new Error('Choose smoke or rest');
