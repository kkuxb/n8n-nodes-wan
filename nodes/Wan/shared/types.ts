import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

export type Executor = Pick<
	IExecuteFunctions,
	'getCredentials' | 'helpers' | 'getInputData'
>;
export type WanMode = 'text' | 'firstFrame' | 'firstLastFrame' | 'multimodal';
export type WanIntent = 'reference' | 'edit' | 'extend';
export type WanDirection = 'backward' | 'forward' | 'both';
export type MediaType =
	| 'first_frame'
	| 'last_frame'
	| 'reference_image'
	| 'reference_video'
	| 'reference_audio';
export interface WanMedia {
	type: MediaType;
	url: string;
}
export interface MediaInput {
	type: MediaType;
	source: 'url' | 'binary';
	value: string;
}
export interface WanCreateInput {
	mode: WanMode;
	intent: WanIntent;
	direction: WanDirection;
	targetVideoIndex?: number;
	prompt: string;
	media: WanMedia[];
	resolution: string;
	ratio: string;
	duration: number;
	audio: boolean;
	promptExtend: boolean;
	watermark: boolean;
	seed?: number;
}
export interface WanCreatePayload {
	model: 'wan3.0-video';
	input: { prompt: string; media?: WanMedia[] };
	parameters: {
		resolution: string;
		ratio: string;
		duration: number;
		audio: boolean;
		prompt_extend: boolean;
		watermark: boolean;
		seed?: number;
	};
}
export interface WanTask extends IDataObject {
	taskId: string;
	status: string;
	providerStatus: string;
	videoUrl?: string;
	isSuccess: boolean;
	isFailure: boolean;
	isTerminal: boolean;
	shouldPoll: boolean;
	raw: IDataObject;
}
export interface PollingContext extends IDataObject {
	taskId: string;
	firstUnknownAt?: number;
}
export interface WanPollResult extends WanTask {
	timedOut: boolean;
	pollCount: number;
	waitedMs: number;
	pollingContext: PollingContext;
}
