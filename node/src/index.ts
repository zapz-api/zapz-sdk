import { ClientOptions, ZapZCore } from './core';
import { createResources, Resources } from './generated/resources';
import { verifyWebhook } from './webhooks';

/**
 * ZapZ API client.
 *
 * ```ts
 * import ZapZ from '@zapz-api/sdk';
 * const zapz = new ZapZ({ apiKey: process.env.ZAPZ_API_KEY });
 * await zapz.messages.sendText('INSTANCE_ID', { to: '5511999999999', text: 'Olá!' });
 * ```
 */
export class ZapZ extends ZapZCore {
  readonly instances: Resources['instances'];
  readonly messages: Resources['messages'];
  readonly contacts: Resources['contacts'];
  readonly groups: Resources['groups'];
  readonly webhooks: Resources['webhooks'];
  readonly sandbox: Resources['sandbox'];

  /** Verify a webhook delivery: `ZapZ.verifyWebhook(rawBody, headers, secret)`. */
  static verifyWebhook = verifyWebhook;

  constructor(opts: ClientOptions = {}) {
    super(opts);
    const r = createResources(this);
    this.instances = r.instances;
    this.messages = r.messages;
    this.contacts = r.contacts;
    this.groups = r.groups;
    this.webhooks = r.webhooks;
    this.sandbox = r.sandbox;
  }
}

export default ZapZ;
export { DEFAULT_BASE_URL, VERSION } from './core';
export type { ClientOptions, RequestOptions } from './core';
export * from './errors';
export * from './models';
export { verifyWebhook, WebhookVerificationError } from './webhooks';
export type * from './generated/types';
