# Postman / Insomnia collection

`zapz.postman_collection.json` has every public route of the [ZapZ](https://zapz.dev) API, grouped by resource, with example bodies.

1. Postman: **Import** → file. Insomnia: **Import** → file (it accepts Postman v2.1 collections).
2. Fill in the collection variables: `baseUrl`, `apiKey` and `instanceId`.

The collection is generated from `openapi.json`. Postman and Insomnia can also import the specification directly from `GET /v1/openapi.json`.

Documentation: https://zapz.dev/#/docs
