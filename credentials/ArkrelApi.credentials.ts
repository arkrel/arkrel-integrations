import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Bearer API key credential for the Arkrel REST API
 * (https://arkrel.com/docs/api-reference). Keys are shown once at creation
 * and stored hashed on the Arkrel side.
 */
export class ArkrelApi implements ICredentialType {
	name = 'arkrelApi';

	displayName = 'Arkrel API';

	icon: Icon = { light: 'file:../icons/arkrel.svg', dark: 'file:../icons/arkrel.dark.svg' };

	documentationUrl = 'https://arkrel.com/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your Arkrel API key. Create one at arkrel.com on the API keys page. It is shown once at creation; after that it can only be revoked and replaced.',
		},
		{
			displayName: 'API Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://arkrel.com',
			required: true,
			description: 'Leave as https://arkrel.com unless Arkrel support gives you a different address.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/usage',
			method: 'GET',
		},
	};
}
