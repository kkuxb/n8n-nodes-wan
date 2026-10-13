import { sleep as n8nSleep, type IDataObject } from 'n8n-workflow';
import { POLL_INTERVAL_MS, UNKNOWN_GRACE_MS } from './constants';
import { mapTaskResponse } from './task';
import { safeMessage, WanRequestError } from './transport';
import type { PollingContext, WanPollResult, WanTask } from './types';

export interface PollWanOptions {
	taskId: string;
	query: (timeoutMs: number) => Promise<IDataObject>;
	wait: boolean;
	timeoutMs: number;
	context?: PollingContext;
	initial?: WanTask;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
	cancelled?: () => boolean;
}
export async function pollWanTask(
	options: PollWanOptions,
): Promise<WanPollResult> {
	if (
		!options.taskId.trim() ||
		!Number.isFinite(options.timeoutMs) ||
		options.timeoutMs <= 0
	)
		throw new Error('任务 ID 和等待时间无效');
	const now = options.now ?? Date.now;
	const sleep = options.sleep ?? n8nSleep;
	const startedAt = now();
	const context: PollingContext = { taskId: options.taskId };
	const first = options.context?.firstUnknownAt;
	if (
		options.context?.taskId === options.taskId &&
		typeof first === 'number' &&
		Number.isFinite(first) &&
		first >= 0 &&
		first <= startedAt
	)
		context.firstUnknownAt = first;
	let last =
		options.initial ?? mapTaskResponse({ status: 'unknown' }, options.taskId);
	let pollCount = 0;
	let errors = 0;
	let lastQueryError: IDataObject | undefined;
	const finish = (extra: IDataObject = {}): WanPollResult => ({
		...last,
		timedOut: false,
		pollCount,
		waitedMs: Math.max(0, now() - startedAt),
		pollingContext: context,
		...(lastQueryError ? { queryError: lastQueryError } : {}),
		...extra,
	});
	while (true) {
		if (options.cancelled?.())
			return finish({
				shouldPoll: false,
				queryError: {
					code: 'EXECUTION_CANCELLED',
					message:
						'当前 n8n 执行已停止；服务端生成任务可能仍在运行，可凭 taskId 续查。',
				},
			});
		const remaining = options.timeoutMs - (now() - startedAt);
		if (remaining <= 0) return finish({ timedOut: true });
		try {
			pollCount++;
			const response = await options.query(
				Math.max(1, Math.min(60_000, remaining)),
			);
			if (typeof response.status !== 'string' || !response.status)
				throw new Error('响应缺少任务状态');
			last = mapTaskResponse(response, options.taskId);
			if (
				last.status === 'unknown' &&
				last.providerStatus.toLowerCase() !== 'unknown'
			)
				throw new Error(`无法识别的供应商状态：${last.providerStatus}`);
			errors = 0;
			lastQueryError = undefined;
			if (last.status === 'unknown') {
				context.firstUnknownAt ??= now();
				if (now() - context.firstUnknownAt >= UNKNOWN_GRACE_MS)
					return finish({
						shouldPoll: false,
						queryError: {
							code: 'UNKNOWN_TIMEOUT',
							message:
								'任务状态持续未知超过 120 秒；未判为生成失败，可核实任务 ID 后继续查询。',
						},
					});
				last.shouldPoll = true;
			} else {
				delete context.firstUnknownAt;
			}
			if (!options.wait || last.isTerminal) return finish();
		} catch (error) {
			errors++;
			lastQueryError = {
				code:
					error instanceof WanRequestError
						? (error.code ?? 'QUERY_ERROR')
						: 'INVALID_RESPONSE',
				message: safeMessage(error),
			};
			const transient =
				error instanceof WanRequestError &&
				(error.statusCode === undefined ||
					error.statusCode === 429 ||
					error.statusCode >= 500);
			if (!options.wait || !transient || errors > 3)
				return finish({
					shouldPoll: false,
					queryError: {
						code:
							error instanceof WanRequestError
								? (error.code ?? 'QUERY_ERROR')
								: 'INVALID_RESPONSE',
						message: safeMessage(error),
					},
				});
		}
		const delay = Math.min(
			POLL_INTERVAL_MS,
			Math.max(0, options.timeoutMs - (now() - startedAt)),
		);
		if (delay) await sleep(delay);
	}
}
