import { Wan } from '../dist/nodes/Wan/Wan.node.js';
export const baseInput = (overrides = {}) => ({
	mode: 'text',
	intent: 'reference',
	direction: 'backward',
	prompt: 'A robot waves.',
	media: [],
	resolution: '1080P',
	ratio: 'adaptive',
	duration: 5,
	audio: true,
	promptExtend: true,
	watermark: false,
	...overrides,
});
export function executor(
	parameters = {},
	http = async () => ({}),
	options = {},
) {
	const requests = [];
	const inputs = options.items ?? [{ json: {} }];
	const context = {
		getNodeParameter: (key, index, fallback) => {
			const params = Array.isArray(parameters) ? parameters[index] : parameters;
			return Object.hasOwn(params, key) ? params[key] : fallback;
		},
		getInputData: () => inputs,
		getNode: () => ({
			name: 'Wan',
			type: 'n8n-nodes-wan.wan',
			typeVersion: 1,
			parameters: {},
			position: [0, 0],
		}),
		getCredentials: async () =>
			options.credentials ?? {
				apiKey: 'private-test-key',
				baseUrl: 'https://api.example.test/',
			},
		continueOnFail: () => options.continueOnFail ?? false,
		getExecutionCancelSignal: () => undefined,
		helpers: {
			httpRequest: async (config) => {
				requests.push(config);
				return http(config);
			},
			getBinaryDataBuffer: async (index, name) => options.binary?.(index, name),
			prepareBinaryData: async (bytes, fileName, mimeType) => ({
				data: bytes.toString('base64'),
				fileName,
				mimeType,
			}),
		},
	};
	return { context, requests, execute: () => new Wan().execute.call(context) };
}
export const complete = {
	task_id: 'task_1',
	status: 'completed',
	metadata: { url: 'https://media.example.test/video.mp4' },
};
