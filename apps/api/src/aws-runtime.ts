import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createHmac } from 'node:crypto';
const region = 'ap-southeast-2';
const client = new SecretsManagerClient({ region, maxAttempts: 2 });
export type SecretReader = (id: string) => Promise<{ VersionId?: string; SecretString?: string }>;
const read: SecretReader = id => client.send(new GetSecretValueCommand({ SecretId: id, VersionStage: 'AWSCURRENT' }));
function databaseUrl(secret: Record<string, unknown>) {
 const { username, password, host, port = 5432, dbname } = secret;
 if (typeof username !== 'string' || !['boxvault_auth_runtime_m1','boxvault_runtime_m1'].includes(username) || typeof password !== 'string' || password.length < 32 || typeof host !== 'string' || !/^[a-z0-9.-]+\.ap-southeast-2\.rds\.amazonaws\.com$/.test(host) || port !== 5432 || dbname !== 'boxvault') throw Error('Invalid runtime database secret');
 return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:5432/boxvault?sslmode=require&sslaccept=strict&sslcert=/var/task/rds-ca.pem&connection_limit=2&pool_timeout=5`;
}
export function createRuntimeLoader(reader: SecretReader = read) {
 let cryptoVersion: string | undefined;
 return async function load() {
  if (process.env.BOXVAULT_AWS_RUNTIME !== '1' || process.env.AWS_REGION !== region || process.env.NODE_ENV !== 'production') throw Error('Invalid AWS runtime');
  const ids = [process.env.AUTH_DATABASE_SECRET_ARN, process.env.CONTENT_DATABASE_SECRET_ARN, process.env.AUTH_CRYPTO_SECRET_ARN];
  if (ids.some(id => !id || !new RegExp(`^arn:aws:secretsmanager:${region}:666734238831:secret:boxvault/app/`).test(id))) throw Error('Missing scoped runtime secret reference');
  const values = await Promise.all(ids.map(id => reader(id!)));
  if (values.some(value => !value.VersionId || !value.SecretString)) throw Error('Runtime secret unavailable');
  if (!process.env.AUTH_CRYPTO_SECRET_VERSION || values[2].VersionId !== process.env.AUTH_CRYPTO_SECRET_VERSION || (cryptoVersion && cryptoVersion !== values[2].VersionId)) throw Error('Cryptographic key migration required before changing the current key');
  const [auth, content, crypto] = values.map(value => JSON.parse(value.SecretString!) as Record<string, unknown>);
  if (auth.username !== 'boxvault_auth_runtime_m1' || content.username !== 'boxvault_runtime_m1' || auth.host !== content.host || typeof crypto.seed !== 'string' || crypto.seed.length < 64) throw Error('Invalid runtime credential separation');
  const derive = (purpose: string) => createHmac('sha256', crypto.seed as string).update(purpose).digest();
  const env = { AUTH_DATABASE_URL: databaseUrl(auth), DATABASE_URL: databaseUrl(content), AUTH_SESSION_PEPPER: derive('boxvault/session-pepper/v1').toString('hex'), AUTH_ACCESS_JWT_KEY: derive('boxvault/access-jwt/v1').toString('hex'), TOTP_ENCRYPTION_KEY: derive('boxvault/totp/v1').toString('base64') };
  cryptoVersion = values[2].VersionId;
  Object.assign(process.env, env);
  // Only opaque version identifiers leave this loader; never log loaded values.
  return values.map(value => value.VersionId).join(':');
 };
}
