import type { IDataObject } from 'n8n-workflow';
import { record } from './task';
import { validateUrl } from './media';
import type { Executor, WanCreatePayload } from './types';

export class WanRequestError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public code?: string,
	) {
		super(message);
	}
}
export function safeMessage(error: unknown, secret = ''): string {
	let message = error instanceof Error ? error.message : String(error);
	if (secret) message = message.split(secret).join('[REDACTED]');
	return message
		.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
		.replace(/data:[^\s"']+/gi, '[binary omitted]')
		.slice(0, 1500);
}
async function request(
	executor: Executor,
	method: 'GET' | 'POST',
	path: string,
	body?: WanCreatePayload,
	timeout = 60_000,
): Promise<IDataObject> {
	const credential = await executor.getCredentials('maibaoWanApi');
	const apiKey = String(credential.apiKey ?? '').trim();
	const baseUrl = String(credential.baseUrl ?? 'https://ai.maibao.chat')
		.trim()
		.replace(/\/+$/, '');
	validateUrl(baseUrl);
	const parsed = new URL(baseUrl);
	if (parsed.search || parsed.hash || parsed.pathname !== '/')
		throw new Error('Base URL 应为服务根地址，不包含路径、查询参数或片段');
	if (!apiKey) throw new Error('请配置麦包 API Key');
	try {
		const response: unknown = await executor.helpers.httpRequest({
			method,
			url: `${baseUrl}${path}`,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				...(method === 'POST' ? { 'X-DashScope-Async': 'enable' } : {}),
			},
			body,
			json: true,
			timeout,
			disableFollowRedirect: true,
		});
		if (
			response === null ||
			typeof response !== 'object' ||
			Array.isArray(response)
		)
			throw new Error('麦包返回了非 JSON 对象响应');
		return response as IDataObject;
	} catch (error) {
		const detail = error as {
			statusCode?: number;
			httpCode?: string;
			response?: { status?: number; data?: unknown };
			code?: string;
			error?: unknown;
		};
		const status =
			detail.statusCode ??
			detail.response?.status ??
			(detail.httpCode ? Number(detail.httpCode) : undefined);
		const raw = record(detail.response?.data ?? detail.error);
		const problem = record(raw.error);
		const message =
			typeof problem.message === 'string'
				? problem.message
				: typeof raw.message === 'string'
					? raw.message
					: safeMessage(error, apiKey);
		throw new WanRequestError(
			`${method === 'POST' ? '创建请求失败或结果不明确；未自动重发，请先核实麦包任务记录。' : '查询请求失败。'} ${safeMessage(new Error(message), apiKey)}`,
			status,
			typeof problem.code === 'string' ? problem.code : detail.code,
		);
	}
}
export const createWanTask = (executor: Executor, payload: WanCreatePayload) =>
	request(
		executor,
		'POST',
		'/api/v1/services/aigc/video-generation/video-synthesis',
		payload,
		180_000,
	);
export const getWanTask = (
	executor: Executor,
	taskId: string,
	timeout = 60_000,
) =>
	request(
		executor,
		'GET',
		`/api/v1/tasks/${encodeURIComponent(taskId)}`,
		undefined,
		timeout,
	);
export async function downloadWanVideo(
	executor: Executor,
	url: string,
	taskId: string,
) {
	validateUrl(url);
	const response = await executor.helpers.httpRequest({
		method: 'GET',
		url,
		headers: {},
		json: false,
		encoding: 'arraybuffer',
		returnFullResponse: true,
		sendCredentialsOnCrossOriginRedirect: false,
		timeout: 120_000,
	});
	const bytes = Buffer.isBuffer(response.body)
		? response.body
		: Buffer.from(response.body as ArrayBuffer);
	if (!bytes.length) throw new Error('视频下载响应为空');
	const contentType = String(
		response.headers?.['content-type'] ?? 'video/mp4',
	).split(';')[0];
	if (
		!(
			contentType.startsWith('video/') ||
			contentType === 'application/octet-stream'
		)
	)
		throw new Error('下载响应不是视频文件');
	return executor.helpers.prepareBinaryData(
		bytes,
		`wan-${taskId.replace(/[^a-z0-9_-]/gi, '_')}.mp4`,
		'video/mp4',
	);
}
