import { AsyncLocalStorage } from 'node:async_hooks';
// Only the Lambda entry point sets this context, after matching the configured
// API/stage. Deployment must associate and test the regional WAF before enabling it.
export const awsIngress = new AsyncLocalStorage<boolean>();
export function hasAwsWafIngress() {
 return process.env.NODE_ENV === 'production' && process.env.BOXVAULT_AWS_RUNTIME === '1' && process.env.AUTH_BOT_PROTECTION_MODE === 'aws-waf' && awsIngress.getStore() === true;
}
