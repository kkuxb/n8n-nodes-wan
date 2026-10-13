import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class MaibaoWanApi implements ICredentialType {
	name = 'maibaoWanApi';
	displayName = '麦包 Wan API';
	documentationUrl = 'https://ai.maibao.chat';
	icon: Icon = 'file:wan.svg';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'https://ai.maibao.chat',
			description: '麦包服务根地址，不包含 /v1 或 /api/v1 后缀',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: { Authorization: '=Bearer {{$credentials.apiKey}}' },
		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.baseUrl.endsWith("/") ? $credentials.baseUrl.slice(0, -1) : $credentials.baseUrl}}',
			url: '/v1/models',
			method: 'GET',
		},
	};
}
