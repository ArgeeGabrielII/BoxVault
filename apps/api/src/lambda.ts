import serverlessExpress from '@codegenie/serverless-express';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from './application';
import { createRuntimeLoader } from './aws-runtime';
import { awsIngress } from './aws-ingress';
const load = createRuntimeLoader();
let app: INestApplication | undefined;
let adapter: ReturnType<typeof serverlessExpress> | undefined;
let version = '';
// A single Lambda environment handles one invocation at a time. The stack must
// reserve concurrency=1. No write/transaction is replayed after a failed request.
export async function handler(event: any, context: any) {
 try {
  if (!event?.requestContext?.apiId || !event?.requestContext?.stage || !process.env.BOXVAULT_API_ID || event.requestContext.apiId !== process.env.BOXVAULT_API_ID || event.requestContext.stage !== 'prototype') throw Error('Untrusted API entry point');
  const next = await load(); // Fresh current credentials before every invocation.
  if (!adapter || next !== version) {
   await app?.close(); app = undefined; adapter = undefined;
   app = await createApplication(); await app.init();
   adapter = serverlessExpress({ app: app.getHttpAdapter().getInstance() }); version = next;
  }
  return await awsIngress.run(true, () => adapter!(event, context, () => undefined));
 } catch {
  // Do not log provider payloads, connection URLs, secrets or request bodies.
  console.error('BoxVault request initialization failed');
  return {statusCode:503,headers:{'Cache-Control':'no-store','Content-Type':'application/json'},body:JSON.stringify({message:'Service temporarily unavailable'})};
 }
}
