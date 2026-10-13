import type {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class MaibaoWanApi implements ICredentialType {
	name = 'maibaoWanApi';
	displayName = 'Wan API';
	documentationUrl = 'https://ai.lmao.net.cn';
	icon: Icon = 'file:wan.svg';
	properties: INodeProperties[] = [
		{
			displayName: '服务商',
			// Keep the stored URL so existing Maibao credentials retain their provider.
			name: 'baseUrl',
			type: 'options',
			options: [
				{ name: '麦包API', value: 'https://ai.maibao.chat' },
				{ name: '龙猫API', value: 'https://ai.lmao.net.cn' },
			],
			required: true,
			default: 'https://ai.lmao.net.cn',
			description:
				'麦包API：https://ai.maibao.chat；龙猫API：https://ai.lmao.net.cn。请填写所选服务商的 API Key',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
		},
	];
	// Authentication is scoped to this node and its credential test, not HTTP Request.
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.baseUrl.endsWith("/") ? $credentials.baseUrl.slice(0, -1) : $credentials.baseUrl}}',
			url: '/v1/models',
			method: 'GET',
			headers: { Authorization: '=Bearer {{$credentials.apiKey}}' },
		},
	};
}
