import { randomUUID } from 'crypto';
import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestMethods,
  INodeExecutionData,
  INodeProperties,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { OPERATIONS, RESOURCES } from './operations';

const PARAM_LABEL: Record<string, string> = {
  instanceId: 'Instance ID',
  webhookId: 'Webhook ID',
  messageId: 'Message ID',
  groupId: 'Group ID',
  jid: 'Contact JID',
};

/** Properties are built from the generated operation table, so new API routes show up after regenerating. */
function buildProperties(): INodeProperties[] {
  const props: INodeProperties[] = [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      noDataExpression: true,
      options: RESOURCES.map((r) => ({ name: r.name, value: r.value })),
      default: 'messages',
    },
  ];
  for (const r of RESOURCES) {
    const ops = OPERATIONS.filter((o) => o.resource === r.value);
    props.push({
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      displayOptions: { show: { resource: [r.value] } },
      options: ops.map((o) => ({ name: o.name, value: o.operation, action: o.name })),
      default: ops[0].operation,
    });
  }
  const paramOps = new Map<string, Map<string, string[]>>();
  for (const o of OPERATIONS) {
    for (const p of o.pathParams) {
      const byRes = paramOps.get(p.arg) ?? new Map<string, string[]>();
      byRes.set(o.resource, [...(byRes.get(o.resource) ?? []), o.operation]);
      paramOps.set(p.arg, byRes);
    }
  }
  for (const [arg, byRes] of paramOps) {
    for (const [resource, operations] of byRes) {
      props.push({
        displayName: PARAM_LABEL[arg] ?? arg,
        name: arg,
        type: 'string',
        required: true,
        default: '',
        displayOptions: { show: { resource: [resource], operation: operations } },
      });
    }
  }
  for (const o of OPERATIONS) {
    const show = { resource: [o.resource], operation: [o.operation] };
    if (o.body) {
      props.push({
        displayName: 'Body (JSON)',
        name: 'body',
        type: 'json',
        default: JSON.stringify(o.bodyExample ?? {}, null, 2),
        displayOptions: { show },
        description: o.autoClientMessageId ? 'clientMessageId is generated when missing, so retries never send twice' : undefined,
      });
    }
    if (o.query.length) {
      props.push({
        displayName: 'Query Parameters',
        name: 'query',
        type: 'collection',
        placeholder: 'Add parameter',
        default: {},
        displayOptions: { show },
        options: o.query.map((q) => ({ displayName: q, name: q, type: 'string' as const, default: '' })),
      });
    }
  }
  return props;
}

export class ZapZ implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'ZapZ',
    name: 'zapZ',
    icon: 'file:zapz.svg',
    group: ['output'],
    version: 1,
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
    description: 'WhatsApp API with anti-ban protection',
    defaults: { name: 'ZapZ' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'zapZApi', required: true }],
    properties: buildProperties(),
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];
    const creds = await this.getCredentials('zapZApi');
    const baseUrl = String(creds.baseUrl || 'https://api.zapz.com').replace(/\/+$/, '').replace(/\/v1$/, '');

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;
        const op = OPERATIONS.find((o) => o.resource === resource && o.operation === operation);
        if (!op) throw new NodeOperationError(this.getNode(), `Unknown operation ${resource}.${operation}`, { itemIndex: i });

        let path = op.path;
        for (const p of op.pathParams) {
          const v = String(this.getNodeParameter(p.arg, i) ?? '').trim();
          if (!v) throw new NodeOperationError(this.getNode(), `${PARAM_LABEL[p.arg] ?? p.arg} is required`, { itemIndex: i });
          path = path.replace(`{${p.name}}`, encodeURIComponent(v));
        }
        let body: IDataObject | undefined;
        if (op.body) {
          const raw = this.getNodeParameter('body', i, '{}');
          body = (typeof raw === 'string' ? JSON.parse(raw || '{}') : raw) as IDataObject;
          if (op.autoClientMessageId && !body.clientMessageId) body = { ...body, clientMessageId: randomUUID() };
        }
        const qs = op.query.length ? (this.getNodeParameter('query', i, {}) as IDataObject) : undefined;

        const response = await this.helpers.httpRequestWithAuthentication.call(this, 'zapZApi', {
          method: op.method as IHttpRequestMethods,
          url: `${baseUrl}/v1${path}`,
          body,
          qs,
          json: true,
        });
        const rows = Array.isArray(response) ? response : [response ?? { success: true }];
        for (const r of rows) out.push({ json: (typeof r === 'object' && r !== null ? r : { value: r }) as IDataObject, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        if (error instanceof NodeOperationError) throw error;
        throw new NodeApiError(this.getNode(), error as never, { itemIndex: i });
      }
    }
    return [out];
  }
}
