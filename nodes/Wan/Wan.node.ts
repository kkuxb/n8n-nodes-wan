import {
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { createProperties } from './description/create.operation';
import { getProperties } from './description/get.operation';
import { buildCreateRequest } from './shared/create';
import { resolveMedia } from './shared/media';
import { pollWanTask } from './shared/polling';
import { mapTaskResponse, record } from './shared/task';
import {
	createWanTask,
	downloadWanVideo,
	getWanTask,
	safeMessage,
} from './shared/transport';
import type {
	MediaInput,
	MediaType,
	PollingContext,
	WanDirection,
	WanIntent,
	WanMode,
	WanTask,
} from './shared/types';

export class Wan implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Wan 视频生成',
		name: 'wan',
		icon: 'file:wan.svg',
		group: ['transform'],
		version: 1,
		subtitle:
			'={{$parameter["operation"] === "get" ? "查询任务" : "创建任务"}}',
		description: '通过麦包使用 Wan 3.0 创建、编辑和延长视频，支持等待及下载',
		defaults: { name: 'Wan 视频生成' },
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [{ name: 'maibaoWanApi', required: true }],
		properties: [
			{
				displayName: '操作',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'create',
				options: [
					{
						name: '创建任务',
						value: 'create',
						action: '创建视频任务',
						description: '提交视频任务，可等待完成并下载',
					},
					{
						name: '查询任务',
						value: 'get',
						action: '查询视频任务',
						description: '查询已有任务，可等待或重试下载',
					},
				],
			},
			...createProperties,
			...getProperties,
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const output: INodeExecutionData[] = [];
		for (
			let itemIndex = 0;
			itemIndex < this.getInputData().length;
			itemIndex++
		) {
			try {
				const p = (name: string, fallback: unknown) =>
					this.getNodeParameter(name, itemIndex, fallback as never);
				const operation = p('operation', 'create');
				const wait = p('waitForCompletion', true) as boolean;
				const minutes = wait ? Number(p('waitTimeoutMinutes', 20)) : 1;
				if (
					!Number.isInteger(minutes) ||
					minutes < 1 ||
					!Number.isFinite(minutes * 60_000)
				)
					throw new NodeOperationError(
						this.getNode(),
						'最长等待时间必须为正整数分钟',
					);
				let task: WanTask;
				let requestSummary: IDataObject | undefined;
				let context: PollingContext | undefined;
				if (operation === 'create') {
					const mode = p('mode', 'text') as WanMode;
					const intent = (
						mode === 'multimodal' ? p('intent', 'reference') : 'reference'
					) as WanIntent;
					const mediaInputs: MediaInput[] = [];
					for (const [prefix, type] of [
						['firstFrame', 'first_frame'],
						['lastFrame', 'last_frame'],
					] as const) {
						if (
							mode === 'firstLastFrame' ||
							(mode === 'firstFrame' && type === 'first_frame')
						) {
							const source = p(`${prefix}Source`, 'url') as 'url' | 'binary';
							mediaInputs.push({
								type,
								source,
								value: p(
									`${prefix}${source === 'binary' ? 'Binary' : 'Url'}`,
									'',
								) as string,
							});
						}
					}
					if (mode === 'multimodal') {
						const entries =
							(p('references', {}) as { items?: IDataObject[] }).items ?? [];
						for (const entry of entries) {
							const image = entry.type === 'reference_image';
							const source = image
								? (String(entry.source ?? 'url') as 'url' | 'binary')
								: 'url';
							mediaInputs.push({
								type: entry.type as MediaType,
								source,
								value: String(
									image
										? source === 'binary'
											? (entry.binaryProperty ?? '')
											: (entry.imageUrl ?? '')
										: (entry.url ?? ''),
								),
							});
						}
					}
					const advanced = record(p('advanced', {}));
					const built = buildCreateRequest({
						mode,
						intent,
						direction: p('direction', 'backward') as WanDirection,
						targetVideoIndex: Number(p('targetVideoIndex', 0)),
						prompt: p('prompt', '') as string,
						media: await resolveMedia(this, itemIndex, mediaInputs),
						resolution: p('resolution', '1080P') as string,
						ratio: p('ratio', 'adaptive') as string,
						duration: Number(
							mode !== 'multimodal'
								? p('duration', 5)
								: intent === 'reference'
									? p('referenceDuration', 5)
									: p('intentDuration', -1),
						),
						audio: p('audio', true) as boolean,
						promptExtend: (advanced.promptExtend ?? true) as boolean,
						watermark: (advanced.watermark ?? false) as boolean,
						seed: advanced.seed as number | undefined,
					});
					requestSummary = built.requestSummary;
					task = mapTaskResponse(await createWanTask(this, built.payload));
					if (!task.taskId)
						throw new NodeOperationError(
							this.getNode(),
							'麦包未返回 task_id/id，创建结果不明确；未重发，请先核实供应商任务记录',
						);
					if (!wait && task.status === 'unknown') {
						task.shouldPoll = true;
						task.pollingContext = {
							taskId: task.taskId,
							firstUnknownAt: Date.now(),
						};
					}
				} else if (operation === 'get') {
					const taskId = String(p('taskId', '')).trim();
					if (!taskId)
						throw new NodeOperationError(this.getNode(), '请填写任务 ID');
					const value = p('pollingContext', '{}');
					context = record(
						typeof value === 'string' ? JSON.parse(value) : value,
					) as PollingContext;
					task = mapTaskResponse({ status: 'unknown' }, taskId);
				} else throw new NodeOperationError(this.getNode(), '无效的操作');
				if (operation === 'get' || (wait && !task.isTerminal)) {
					const taskId = task.taskId;
					task = await pollWanTask({
						taskId,
						query: (timeout) => getWanTask(this, taskId, timeout),
						wait,
						timeoutMs: minutes * 60_000,
						context,
						initial: task,
						cancelled: () =>
							this.getExecutionCancelSignal?.()?.aborted ?? false,
					});
				}
				const item: INodeExecutionData = {
					json: {
						...task,
						...(requestSummary ? { requestSummary } : {}),
						downloaded: false,
					},
					pairedItem: { item: itemIndex },
				};
				if (task.isSuccess && task.videoUrl && p('downloadVideo', true)) {
					try {
						item.binary = {
							video: await downloadWanVideo(this, task.videoUrl, task.taskId),
						};
						item.json.downloaded = true;
					} catch (error) {
						item.json.downloadError = {
							code: 'DOWNLOAD_FAILED',
							message: safeMessage(error),
						};
					}
				}
				output.push(item);
			} catch (error) {
				if (this.continueOnFail())
					output.push({
						json: { error: { message: safeMessage(error) } },
						pairedItem: { item: itemIndex },
					});
				else
					throw new NodeOperationError(this.getNode(), safeMessage(error), {
						itemIndex,
					});
			}
		}
		return [output];
	}
}
