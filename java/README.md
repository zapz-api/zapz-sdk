# zapz-java

SDK oficial da API de WhatsApp da ZapZ para Java 17+. Sem dependências (usa `java.net.http`).

```xml
<dependency><groupId>dev.zapz</groupId><artifactId>zapz-java</artifactId><version>0.1.0</version></dependency>
```

```java
ZapZ zapz = new ZapZ(); // lê ZAPZ_API_KEY
Map<String, Object> msg = zapz.messages.sendText("INSTANCE_ID", Map.of("to", "5511999999999", "text", "Olá!"));
```

- Corpos e respostas são `Map`/`List`. Os campos aceitos de cada método estão no Javadoc.
- Erros: `ZapZException` (`getStatus()`, `getCode()`, `getRetryAfter()`) e subclasses `NotFoundException`, `RateLimitException`…
- Webhooks: `Webhook.verify(rawBody, headers, secret)`.
