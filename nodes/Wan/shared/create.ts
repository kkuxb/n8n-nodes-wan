import { MODEL, RATIOS, RESOLUTIONS } from './constants';
import type { WanCreateInput, WanCreatePayload } from './types';

export function buildCreateRequest(input: WanCreateInput) {
	if (
		!['text', 'firstFrame', 'firstLastFrame', 'multimodal'].includes(input.mode)
	)
		throw new Error('无效的创建模式');
	if (!RESOLUTIONS.includes(input.resolution) || !RATIOS.includes(input.ratio))
		throw new Error('无效的分辨率或宽高比');
	if (
		!Number.isInteger(input.duration) ||
		!(input.duration === -1 || (input.duration >= 2 && input.duration <= 30))
	)
		throw new Error('时长必须是 2–30 秒整数，或 -1（自动）');
	if (
		input.seed !== undefined &&
		(!Number.isInteger(input.seed) ||
			input.seed < -1 ||
			input.seed > 2147483647)
	)
		throw new Error('随机种子必须是 -1 或 0–2147483647 的整数');
	if (
		[input.audio, input.promptExtend, input.watermark].some(
			(v) => typeof v !== 'boolean',
		)
	)
		throw new Error('声音、提示词改写和水印必须是布尔值');
	const count = (type: string) =>
		input.media.filter((m) => m.type === type).length;
	if (
		input.media.some(
			(m) =>
				![
					'first_frame',
					'last_frame',
					'reference_image',
					'reference_video',
					'reference_audio',
				].includes(m.type),
		)
	)
		throw new Error('不支持的素材类型');
	if (input.mode === 'text' && (input.media.length || !input.prompt.trim()))
		throw new Error('文生视频必须填写提示词且不能带素材');
	if (
		input.mode === 'firstFrame' &&
		!(input.media.length === 1 && count('first_frame') === 1)
	)
		throw new Error('首帧模式必须且只能提供一张首帧图');
	if (
		input.mode === 'firstLastFrame' &&
		!(
			input.media.length === 2 &&
			count('first_frame') === 1 &&
			count('last_frame') === 1
		)
	)
		throw new Error('首尾帧模式必须提供一张首帧图和一张尾帧图');
	if (
		input.mode === 'multimodal' &&
		(!input.media.length || count('first_frame') || count('last_frame'))
	)
		throw new Error('多模态需要参考素材，且不能混用首尾帧');
	if (
		input.media.length > 20 ||
		count('reference_image') > 10 ||
		count('reference_video') > 5 ||
		count('reference_audio') > 5
	)
		throw new Error(
			'最多 20 个素材：参考图片最多 10 张、视频最多 5 段、音频最多 5 段',
		);
	if (!['reference', 'edit', 'extend'].includes(input.intent))
		throw new Error('无效的任务意图');
	if (input.mode !== 'multimodal' && input.intent !== 'reference')
		throw new Error('编辑和延长仅用于多模态模式');
	let submittedPrompt = input.prompt;
	let targetVideoIndex: number | undefined;
	if (input.intent !== 'reference') {
		const videos = count('reference_video');
		targetVideoIndex = input.targetVideoIndex || (videos === 1 ? 1 : undefined);
		if (
			!videos ||
			!Number.isInteger(targetVideoIndex) ||
			targetVideoIndex! < 1 ||
			targetVideoIndex! > videos
		)
			throw new Error(
				'编辑或延长需明确目标参考视频编号；只有一个视频时可填 0 自动选择',
			);
		if (!input.prompt.trim()) throw new Error('请描述需要编辑或延长的内容');
		if (input.intent === 'edit')
			submittedPrompt = `编辑视频${targetVideoIndex}，按以下要求修改，未指定修改的内容尽量保持不变。\n${input.prompt}`;
		else {
			const direction = {
				backward: '向后延长',
				forward: '向前延长',
				both: '向前和向后双向延长',
			}[input.direction];
			if (!direction) throw new Error('无效的视频延长方向');
			if (input.ratio !== 'adaptive')
				throw new Error('视频延长要求宽高比为自适应');
			submittedPrompt = `将视频${targetVideoIndex}${direction}，保持画面与原视频连贯。${input.duration === -1 ? '' : `最终输出视频总时长为${input.duration}秒。`}\n${input.prompt}`;
		}
	}
	if (Array.from(submittedPrompt).length > 20_000)
		throw new Error('最终提交提示词不能超过 20000 字符（含自动补充指令）');
	const payload: WanCreatePayload = {
		model: MODEL,
		input: {
			prompt: submittedPrompt,
			...(input.media.length ? { media: input.media } : {}),
		},
		parameters: {
			resolution: input.resolution,
			ratio: input.ratio,
			duration: input.duration,
			audio: input.audio,
			prompt_extend: input.promptExtend,
			watermark: input.watermark,
			...(input.seed !== undefined ? { seed: input.seed } : {}),
		},
	};
	return {
		payload,
		requestSummary: {
			model: MODEL,
			mode: input.mode,
			intent: input.intent,
			...(input.intent === 'extend' ? { direction: input.direction } : {}),
			targetVideoIndex,
			originalPrompt: input.prompt,
			submittedPrompt,
			...payload.parameters,
			media: input.media.map((m) => ({
				type: m.type,
				source: m.url.startsWith('data:') ? 'binary' : 'url',
			})),
		},
	};
}
