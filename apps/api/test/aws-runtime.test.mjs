import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {createRuntimeLoader} = require('../dist/aws-runtime.js');
const saved={...process.env};
const refs={auth:'arn:aws:secretsmanager:ap-southeast-2:666734238831:secret:boxvault/app/auth-test',content:'arn:aws:secretsmanager:ap-southeast-2:666734238831:secret:boxvault/app/content-test',crypto:'arn:aws:secretsmanager:ap-southeast-2:666734238831:secret:boxvault/app/crypto-test'};
function fixtures() {return {auth:{VersionId:'auth-1',SecretString:JSON.stringify({username:'boxvault_auth_runtime_m1',password:'a'.repeat(40),host:'boxvault-app-test.example.ap-southeast-2.rds.amazonaws.com',dbname:'boxvault'})},content:{VersionId:'content-1',SecretString:JSON.stringify({username:'boxvault_runtime_m1',password:'c'.repeat(40),host:'boxvault-app-test.example.ap-southeast-2.rds.amazonaws.com',dbname:'boxvault'})},crypto:{VersionId:'crypto-1',SecretString:JSON.stringify({seed:'k'.repeat(64)})}};}
function reader(values){return async id => structuredClone(values[Object.keys(refs).find(key=>refs[key]===id)]);}
beforeEach(()=>Object.assign(process.env,{BOXVAULT_AWS_RUNTIME:'1',AWS_REGION:'ap-southeast-2',NODE_ENV:'production',AUTH_DATABASE_SECRET_ARN:refs.auth,CONTENT_DATABASE_SECRET_ARN:refs.content,AUTH_CRYPTO_SECRET_ARN:refs.crypto,AUTH_CRYPTO_SECRET_VERSION:'crypto-1'}));
afterEach(()=>{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);});
test('uses current separate DB secrets and purpose-separated keys with strict RDS TLS',async()=>{const load=createRuntimeLoader(reader(fixtures()));const version=await load();assert.equal(version,'auth-1:content-1:crypto-1');assert.notEqual(process.env.AUTH_SESSION_PEPPER,process.env.AUTH_ACCESS_JWT_KEY);assert.equal(Buffer.from(process.env.TOTP_ENCRYPTION_KEY,'base64').length,32);const auth=new URL(process.env.AUTH_DATABASE_URL);assert.equal(auth.username,'boxvault_auth_runtime_m1');assert.equal(auth.searchParams.get('sslaccept'),'strict');assert.equal(auth.searchParams.get('sslcert'),'/var/task/rds-ca.pem');assert.equal(new URL(process.env.DATABASE_URL).username,'boxvault_runtime_m1');});
test('observes rotated DB credentials on the next invocation without rotating app keys',async()=>{const values=fixtures();const load=createRuntimeLoader(reader(values));await load();const key=process.env.TOTP_ENCRYPTION_KEY;values.content.VersionId='content-2';const secret=JSON.parse(values.content.SecretString);secret.password='d'.repeat(40);values.content.SecretString=JSON.stringify(secret);assert.equal(await load(),'auth-1:content-2:crypto-1');assert.equal(new URL(process.env.DATABASE_URL).password,'d'.repeat(40));assert.equal(process.env.TOTP_ENCRYPTION_KEY,key);});
test('refuses a blind cryptographic-key replacement and preserves the loaded environment',async()=>{const values=fixtures();const load=createRuntimeLoader(reader(values));await load();const old=process.env.TOTP_ENCRYPTION_KEY;values.crypto.VersionId='crypto-2';await assert.rejects(load,/migration required/);assert.equal(process.env.TOTP_ENCRYPTION_KEY,old);});
for(const [name,change] of [['master credential',v=>v.auth.SecretString=JSON.stringify({...JSON.parse(v.auth.SecretString),username:'boxvault_owner'})],['cross-host DB secret',v=>v.auth.SecretString=JSON.stringify({...JSON.parse(v.auth.SecretString),host:'outside.example.com'})],['missing version',v=>delete v.content.VersionId],['missing secret',v=>delete v.content.SecretString]])test('refuses '+name,async()=>{const values=fixtures();change(values);await assert.rejects(createRuntimeLoader(reader(values))());});
test('refuses other regions before reading secrets',async()=>{process.env.AWS_REGION='us-east-1';let reads=0;await assert.rejects(createRuntimeLoader(async()=>{reads++;return {};})());assert.equal(reads,0);});
test('secret-provider failures fail closed',async()=>{await assert.rejects(createRuntimeLoader(async()=>{throw Error('unavailable');})());});
test('production cannot accept an HTTP caller merely because WAF mode is configured',async()=>{
 const {hasAwsWafIngress,awsIngress}=require('../dist/aws-ingress.js');
 process.env.AUTH_BOT_PROTECTION_MODE='aws-waf';
 assert.equal(hasAwsWafIngress(),false);
 assert.equal(await awsIngress.run(true,async()=>hasAwsWafIngress()),true);
 assert.equal(hasAwsWafIngress(),false);
 process.env.NODE_ENV='test';assert.equal(await awsIngress.run(true,async()=>hasAwsWafIngress()),false);
});
test('SES sends with workload credentials and keeps the single-use proof in the URL fragment',async()=>{
 const {SESv2Client}=require('@aws-sdk/client-sesv2');const {AuthHardeningService}=require('../dist/auth/auth-hardening.service.js');
 const previous=SESv2Client.prototype.send;let delivered;
 SESv2Client.prototype.send=async command=>{delivered=command.input;return {MessageId:'synthetic-message'};};
 Object.assign(process.env,{MAIL_TRANSPORT:'ses',SES_FROM:'sender@example.invalid',PUBLIC_WEB_URL:'https://example.cloudfront.net',AUTH_DATABASE_URL:'postgresql://unconfigured:unconfigured@127.0.0.1:1/unconfigured'});
 const service=new AuthHardeningService();
 try {service.assertMailerConfigured();await service.email('test@example.invalid','verify-email','synthetic-proof');assert.equal(delivered.FromEmailAddress,process.env.SES_FROM);const link=delivered.Content.Simple.Body.Text.Data.match(/https:\/\/[^\s]+/)[0];assert.equal(new URL(link).search,'');assert.equal(new URL(link).hash,'#token=synthetic-proof');}
 finally {SESv2Client.prototype.send=previous;await service.onModuleDestroy();}
});
test('changing the cryptographic version fails on a fresh cold start as well',async()=>{
 const values=fixtures();values.crypto.VersionId='unapproved-new-version';await assert.rejects(createRuntimeLoader(reader(values))(),/migration required/);
});
