import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class ZapZApi implements ICredentialType {
  name = 'zapZApi';
  displayName = 'ZapZ API';
  documentationUrl = 'https://api.zapz.dev/v1/openapi.json';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'sk_live_... (production) or sk_test_... (sandbox), created in Chaves de API',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.zapz.dev',
      description: 'Use the sandbox URL with sk_test_ keys',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
  };

  test: ICredentialTestRequest = {
    request: { baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}', url: '/v1/instances' },
  };
}
