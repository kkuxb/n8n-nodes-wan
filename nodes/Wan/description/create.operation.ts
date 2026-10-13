import type { INodeProperties } from 'n8n-workflow';
import { RATIOS, RESOLUTIONS } from '../shared/constants';

const create = { operation: ['create'] };
const imageFields = (
	prefix: string,
	label: string,
	modes: string[],
): INodeProperties[] => [
	{
		displayName: `${label}来源`,
		name: `${prefix}Source`,
		type: 'options',
		default: 'url',
		options: [
			{ name: 'URL', value: 'url' },
			{ name: 'Binary 文件', value: 'binary' },
		],
		displayOptions: { show: { ...create, mode: modes } },
	},
	{
		displayName: `${label} URL`,
		name: `${prefix}Url`,
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { ...create, mode: modes, [`${prefix}Source`]: ['url'] },
		},
	},
	{
		displayName: `${label} Binary 属性名`,
		name: `${prefix}Binary`,
		type: 'string',
		default: 'data',
		required: true,
		description: '上游输入中的图片 binary 属性名，例如 data 或 image1',
		displayOptions: {
			show: { ...create, mode: modes, [`${prefix}Source`]: ['binary'] },
		},
	},
];
export const createProperties: INodeProperties[] = [
	{
		displayName: '模型',
		name: 'model',
		type: 'options',
		default: 'wan3.0-video',
		options: [{ name: 'Wan 3.0 Video（麦包）', value: 'wan3.0-video' }],
		displayOptions: { show: create },
	},
	{
		displayName: '创建模式',
		name: 'mode',
		type: 'options',
		default: 'text',
		options: [
			{ name: '文生视频', value: 'text' },
			{ name: '首帧图生视频', value: 'firstFrame' },
			{ name: '首尾帧图生视频', value: 'firstLastFrame' },
			{ name: '多模态参考生视频', value: 'multimodal' },
		],
		displayOptions: { show: create },
	},
	{
		displayName: '任务意图',
		name: 'intent',
		type: 'options',
		default: 'reference',
		options: [
			{ name: '参考生成', value: 'reference' },
			{ name: '视频编辑', value: 'edit' },
			{ name: '视频延长', value: 'extend' },
		],
		displayOptions: { show: { ...create, mode: ['multimodal'] } },
	},
	{
		displayName: '延长方向',
		name: 'direction',
		type: 'options',
		default: 'backward',
		options: [
			{ name: '向后', value: 'backward' },
			{ name: '向前', value: 'forward' },
			{ name: '双向', value: 'both' },
		],
		displayOptions: {
			show: { ...create, mode: ['multimodal'], intent: ['extend'] },
		},
	},
	{
		displayName: '目标视频编号',
		name: 'targetVideoIndex',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: 5, numberPrecision: 0 },
		description:
			'按参考视频单独编号，1 表示视频1。0 仅在只有一个参考视频时自动选择；多个视频必须明确选择。',
		displayOptions: {
			show: { ...create, mode: ['multimodal'], intent: ['edit', 'extend'] },
		},
	},
	{
		displayName: '提示词',
		name: 'prompt',
		type: 'string',
		default: '',
		typeOptions: { rows: 5 },
		description:
			'文生视频、编辑和延长必填。参考素材可用图1、视频1、音频1引用；编辑和延长会自动补充任务指令。',
		displayOptions: { show: create },
	},
	...imageFields('firstFrame', '首帧', ['firstFrame', 'firstLastFrame']),
	...imageFields('lastFrame', '尾帧', ['firstLastFrame']),
	{
		displayName: '参考素材',
		name: 'references',
		type: 'fixedCollection',
		default: {},
		placeholder: '添加素材',
		typeOptions: { multipleValues: true },
		displayOptions: { show: { ...create, mode: ['multimodal'] } },
		options: [
			{
				name: 'items',
				displayName: '素材',
				values: [
					{
						displayName: '素材	URL',
						name: 'url',
						type: 'string',
						default: '',
						description:
							'无需登录即可访问的视频或音频	URL；各类型总时长不超过	15	秒',
					},
					{
						displayName: '素材类型',
						name: 'type',
						type: 'options',
						default: 'reference_image',
						options: [
							{
								name: '图片',
								value: 'reference_image',
							},
							{
								name: '视频',
								value: 'reference_video',
							},
							{
								name: '音频',
								value: 'reference_audio',
							},
						],
					},
					{
						displayName: '图片	URL',
						name: 'imageUrl',
						type: 'string',
						default: '',
					},
					{
						displayName: '图片来源',
						name: 'source',
						type: 'options',
						default: 'url',
						options: [
							{
								name: 'URL',
								value: 'url',
							},
							{
								name: 'Binary	文件',
								value: 'binary',
							},
						],
					},
					{
						displayName: 'Binary	属性名',
						name: 'binaryProperty',
						type: 'string',
						default: 'data',
					},
				],
			},
		],
	},
	{
		displayName: '分辨率',
		name: 'resolution',
		type: 'options',
		default: '1080P',
		options: RESOLUTIONS.map((value) => ({ name: value, value })),
		displayOptions: { show: create },
	},
	{
		displayName: '宽高比',
		name: 'ratio',
		type: 'options',
		default: 'adaptive',
		options: RATIOS.map((value) => ({
			name: value === 'adaptive' ? '自适应' : value,
			value,
		})),
		description: '视频延长必须选择自适应；编辑建议自适应',
		displayOptions: { show: create },
	},
	{
		displayName: '视频时长（秒）',
		name: 'duration',
		type: 'number',
		default: 5,
		typeOptions: { minValue: -1, maxValue: 30, numberPrecision: 0 },
		description:
			'2–30 秒，-1 为自动。存在参考视频时，输入与输出视频时长合计不超过 30 秒。',
		displayOptions: { show: create, hide: { mode: ['multimodal'] } },
	},
	{
		displayName: '视频时长（秒）',
		name: 'referenceDuration',
		type: 'number',
		default: 5,
		typeOptions: { minValue: -1, maxValue: 30, numberPrecision: 0 },
		description: '2–30 秒，-1 为自动；输入与输出视频时长合计不超过 30 秒',
		displayOptions: {
			show: { ...create, mode: ['multimodal'], intent: ['reference'] },
		},
	},
	{
		displayName: '输出视频总时长（秒）',
		name: 'intentDuration',
		type: 'number',
		default: -1,
		typeOptions: { minValue: -1, maxValue: 30, numberPrecision: 0 },
		description:
			'-1 为自动；原视频 5 秒再延长 3 秒应填 8，表示最终总时长。编辑建议使用自动。',
		displayOptions: {
			show: { ...create, mode: ['multimodal'], intent: ['edit', 'extend'] },
		},
	},
	{
		displayName: '生成音频',
		name: 'audio',
		type: 'boolean',
		default: true,
		description: 'Whether to generate an audio track with the video',
		displayOptions: { show: create },
	},
	{
		displayName: '高级选项',
		name: 'advanced',
		type: 'collection',
		default: {},
		placeholder: '添加选项',
		displayOptions: { show: create },
		options: [
			{
				displayName: '提示词改写',
				name: 'promptExtend',
				type: 'boolean',
				default: true,
				description: 'Whether to enable prompt expansion by the provider',
			},
			{
				displayName: '添加水印',
				name: 'watermark',
				type: 'boolean',
				default: false,
				description: 'Whether to add the provider watermark',
			},
			{
				displayName: '随机种子',
				name: 'seed',
				type: 'number',
				default: -1,
				typeOptions: { minValue: -1, maxValue: 2147483647, numberPrecision: 0 },
				description: '-1 为随机；固定种子也不保证完全一致的结果',
			},
		],
	},
];
