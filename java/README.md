# zapz-java

Official Java 17+ SDK for the [ZapZ](https://zapz.dev) WhatsApp API. No dependencies (uses `java.net.http`).

Documentation: https://zapz.dev/#/docs

```xml
<dependency>
  <groupId>dev.zapz</groupId>
  <artifactId>zapz-java</artifactId>
  <version>0.1.0</version>
</dependency>
```

```java
ZapZ zapz = new ZapZ(); // reads ZAPZ_API_KEY
Map<String, Object> msg = zapz.messages.sendText("INSTANCE_ID", Map.of("to", "5511999999999", "text", "Hello!"));
```

- Bodies and responses are `Map`/`List`. The fields each method accepts are in the Javadoc.
- Errors: `ZapZException` (`getStatus()`, `getCode()`, `getRetryAfter()`) and subclasses `NotFoundException`, `RateLimitException`…
- Webhooks: `Webhook.verify(rawBody, headers, secret)`.

## License

MIT
