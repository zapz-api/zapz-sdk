// ESM entry: Node gives an ES module the whole CommonJS exports object as its default import,
// so `import ZapZ from '@zapz/sdk'` needs this file to make the client class the default.
import cjs from '../dist/index.js';

export * from '../dist/index.js';
export default cjs.ZapZ;
