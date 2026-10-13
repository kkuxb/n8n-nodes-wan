import type { INodeProperties } from 'n8n-workflow';
export const getProperties: INodeProperties[] = [
	{
		displayName: '任务 ID',
		name: 'taskId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { operation: ['get'] } },
	},
	{
		displayName: '轮询上下文',
		name: 'pollingContext',
		type: 'json',
		default: '{}',
		description:
			'外部 Wait 循环中传入上次输出的 pollingContext，避免每次查询重置未知状态的观察时间',
		displayOptions: { show: { operation: ['get'] } },
	},
	{
		displayName: '等待任务完成',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		description: 'Whether to wait for completion, polling every 20 seconds',
	},
	{
		displayName: '最长等待时间（分钟）',
		name: 'waitTimeoutMinutes',
		type: 'number',
		default: 20,
		typeOptions: { minValue: 1, numberPrecision: 0 },
		displayOptions: { show: { waitForCompletion: [true] } },
	},
	{
		displayName: '下载视频',
		name: 'downloadVideo',
		type: 'boolean',
		default: true,
		description:
			'Whether to download successful video results into binary.video; also works with a single query',
	},
];
