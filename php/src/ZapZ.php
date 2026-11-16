<?php

declare(strict_types=1);

namespace ZapZ;

use ZapZ\Exception\ZapZException;
use ZapZ\Resources\ContactsResource;
use ZapZ\Resources\GroupsResource;
use ZapZ\Resources\InstancesResource;
use ZapZ\Resources\MessagesResource;
use ZapZ\Resources\SandboxResource;
use ZapZ\Resources\WebhooksResource;

/**
 * ZapZ API client.
 *
 *     $zapz = new ZapZ\ZapZ('sk_live_...');
 *     $zapz->messages->sendText('INSTANCE_ID', ['to' => '5511999999999', 'text' => 'Olá!']);
 */
final class ZapZ
{
    public readonly InstancesResource $instances;
    public readonly MessagesResource $messages;
    public readonly ContactsResource $contacts;
    public readonly GroupsResource $groups;
    public readonly WebhooksResource $webhooks;
    public readonly SandboxResource $sandbox;
    public readonly HttpClient $http;

    /**
     * @param string|null $apiKey defaults to the ZAPZ_API_KEY environment variable
     * @param array{baseUrl?: string, timeout?: float, maxRetries?: int} $options
     */
    public function __construct(?string $apiKey = null, array $options = [])
    {
        $key = $apiKey ?? (getenv('ZAPZ_API_KEY') ?: null);
        if (!$key) {
            throw new ZapZException('Missing API key: pass it to the constructor or set ZAPZ_API_KEY.');
        }
        $this->http = new HttpClient($key, $options);
        $this->instances = new InstancesResource($this->http);
        $this->messages = new MessagesResource($this->http);
        $this->contacts = new ContactsResource($this->http);
        $this->groups = new GroupsResource($this->http);
        $this->webhooks = new WebhooksResource($this->http);
        $this->sandbox = new SandboxResource($this->http);
    }
}
