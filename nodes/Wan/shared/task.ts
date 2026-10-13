import type { IDataObject } from 'n8n-workflow';
import type { WanTask } from './types';

export function record(value: unknown): IDataObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as IDataObject)
		: {};
}
export function mapTaskResponse(
	raw: IDataObject,
	fallbackTaskId = '',
): WanTask {
	const taskId =
		typeof raw.task_id === 'string'
			? raw.task_id
			: typeof raw.id === 'string'
				? raw.id
				: fallbackTaskId;
	if (fallbackTaskId && taskId !== fallbackTaskId)
		throw new Error('查询响应的任务 ID 与请求不一致');
	const providerStatus = typeof raw.status === 'string' ? raw.status : '';
	const state = providerStatus.toLowerCase();
	const status =
		(
			{
				queued: 'queued',
				pending: 'queued',
				in_progress: 'running',
				running: 'running',
				completed: 'succeeded',
				succeeded: 'succeeded',
				failed: 'failed',
				cancelled: 'cancelled',
				canceled: 'cancelled',
				expired: 'expired',
				unknown: 'unknown',
			} as Record<string, string>
		)[state] ?? 'unknown';
	const videoUrl =
		typeof record(raw.metadata).url === 'string'
			? (record(raw.metadata).url as string)
			: undefined;
	const isSuccess = status === 'succeeded';
	const isFailure = ['failed', 'cancelled', 'expired'].includes(status);
	return {
		taskId,
		status,
		providerStatus,
		videoUrl,
		isSuccess,
		isFailure,
		isTerminal: isSuccess || isFailure,
		shouldPoll: ['queued', 'running'].includes(status),
		model: raw.model,
		progress: raw.progress,
		requestId: raw.request_id,
		usage: raw.usage,
		createdAt: raw.created_at,
		completedAt: raw.completed_at,
		error: isFailure
			? (raw.error ?? {
					code: raw.code,
					message: raw.message ?? '供应商任务未成功完成',
				})
			: null,
		...(isSuccess && !videoUrl
			? {
					resultError: {
						code: 'MISSING_VIDEO_URL',
						message:
							'任务成功，但服务商响应未提供 metadata.url；可稍后继续查询。',
					},
				}
			: {}),
		raw,
	};
}
