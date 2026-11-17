import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type {
  IDataObject,
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';

const EVENTS = [
  'new_message', 'message_sent', 'message_delivered', 'message_read', 'message_failed',
  'message_ack_sent', 'message_ack_delivered', 'message_ack_read', 'message_ack_played',
  'message_updated', 'message_deleted', 'message_reaction', 'message_receipt', 'message_media_update',
  'connected', 'disconnected', 'qr_ready', 'call_received', 'presence_update',
  'chat_upsert', 'chat_updated', 'chat_deleted', 'contacts_upsert', 'contacts_updated',
  'group_upsert', 'group_updated', 'group_participants_updated', 'history_sync',
];

async function api(ctx: IHookFunctions, method: 'GET' | 'POST' | 'DELETE', path: string, body?: IDataObject) {
  const creds = await ctx.getCredentials('zapZApi');
  const baseUrl = String(creds.baseUrl || 'https://api.zapz.dev').replace(/\/+$/, '').replace(/\/v1$/, '');
  return ctx.helpers.httpRequestWithAuthentication.call(ctx, 'zapZApi', { method, url: `${baseUrl}/v1${path}`, body, json: true });
}

/** Starts a workflow on WhatsApp events. Registers a ZapZ webhook on activation and removes it on deactivation. */
export class ZapZTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'ZapZ Trigger',
    name: 'zapZTrigger',
    icon: 'file:zapz.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["events"].join(", ")}}',
    description: 'Starts the workflow on ZapZ WhatsApp events (signed webhooks)',
    defaults: { name: 'ZapZ Trigger' },
    inputs: [],
    outputs: ['main'],
    credentials: [{ name: 'zapZApi', required: true }],
    webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }],
    properties: [
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        required: true,
        default: ['new_message'],
        options: EVENTS.map((e) => ({ name: e, value: e })),
      },
      {
        displayName: 'Instance ID',
        name: 'instanceId',
        type: 'string',
        default: '',
        description: 'Only events of this instance. Empty = every instance of the account.',
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const data = this.getWorkflowStaticData('node');
        if (!data.webhookId) return false;
        const url = this.getNodeWebhookUrl('default');
        const hooks = (await api(this, 'GET', '/webhooks')) as IDataObject[];
        return Array.isArray(hooks) && hooks.some((h) => h.id === data.webhookId && h.url === url);
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const secret = randomBytes(24).toString('hex');
        const instanceId = String(this.getNodeParameter('instanceId', '') || '').trim();
        const hook = (await api(this, 'POST', '/webhooks', {
          url: this.getNodeWebhookUrl('default'),
          events: this.getNodeParameter('events') as string[],
          secret,
          ...(instanceId ? { instance_id: instanceId } : {}),
        })) as IDataObject;
        const data = this.getWorkflowStaticData('node');
        data.webhookId = hook.id;
        data.secret = secret;
        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const data = this.getWorkflowStaticData('node');
        if (data.webhookId) {
          try {
            await api(this, 'DELETE', `/webhooks/${encodeURIComponent(String(data.webhookId))}`);
          } catch {
            // already gone
          }
        }
        delete data.webhookId;
        delete data.secret;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const req = this.getRequestObject();
    const secret = String(this.getWorkflowStaticData('node').secret ?? '');
    const ts = String(req.headers['x-webhook-timestamp'] ?? '');
    const sig = String(req.headers['x-webhook-signature-v2'] ?? '');
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody?.toString('utf8') ?? JSON.stringify(req.body);
    const fresh = /^\d+$/.test(ts) && Math.abs(Date.now() / 1000 - Number(ts)) <= 300;
    const expected = 'sha256=' + createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
    const valid = !!secret && fresh && expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    if (!valid) {
      this.getResponseObject().status(401).send('invalid signature');
      return { noWebhookResponse: true };
    }
    return { workflowData: [this.helpers.returnJsonArray(req.body as IDataObject)] };
  }
}
