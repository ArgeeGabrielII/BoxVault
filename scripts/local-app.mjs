// Persistent, loopback-only local sandbox. Does not load .env or migrate Neon.
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, access, chmod } from 'node:fs/promises';
import { constants, openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
const root=fileURLToPath(new URL('../',import.meta.url));
const state=resolve(process.env.BOXVAULT_LOCAL_STATE || join(root,'.boxvault-local'));
await mkdir(state,{recursive:true,mode:0o700});await chmod(state,0o700);
const configFile=join(state,'config.json');let config;
try{config=JSON.parse(await readFile(configFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;
 config={version:1,webPort:5180,apiPort:4380,pgPort:5580,smtpPort:2580,adminPassword:randomBytes(32).toString('hex'),contentPassword:randomBytes(32).toString('hex'),authPassword:randomBytes(32).toString('hex'),sessionPepper:randomBytes(48).toString('hex'),jwtKey:randomBytes(48).toString('hex'),totpKey:randomBytes(32).toString('base64')};
 await writeFile(configFile,JSON.stringify(config),{mode:0o600});}
if([config.adminPassword,config.contentPassword,config.authPassword].some(value=>typeof value!=='string'|| !/^[a-f0-9]{64}$/.test(value)))throw Error('Invalid local credentials');
if(new Set([config.webPort,config.apiPort,config.pgPort,config.smtpPort]).size!==4)throw Error('Local ports must be distinct');
if(config.version!==1 || [config.webPort,config.apiPort,config.pgPort,config.smtpPort].some(p=>!Number.isInteger(p)||p<1024||p>65535))throw Error('Invalid local configuration');
let pgBin;
try{pgBin=execFileSync('pg_config',['--bindir'],{encoding:'utf8'}).trim();}catch{}
for(const candidate of ['/opt/homebrew/opt/postgresql@18/bin','/usr/local/opt/postgresql@18/bin',pgBin].filter(Boolean)){try{await access(join(candidate,'initdb'),constants.X_OK);pgBin=candidate;break;}catch{}}
if(!pgBin)throw Error('PostgreSQL is required. Install PostgreSQL 18 and make pg_config available.');
try{await access(join(pgBin,'initdb'),constants.X_OK);}catch{throw Error('PostgreSQL server tools are unavailable. Install PostgreSQL 18.');}
const origin='http://127.0.0.1:'+config.webPort, apiOrigin='http://127.0.0.1:'+config.apiPort;
const dbUrl=(user,password)=>'postgresql://'+user+':'+encodeURIComponent(password)+'@127.0.0.1:'+config.pgPort+'/boxvault_local?schema=public';
const env={...process.env,NODE_ENV:'test',BOXVAULT_LOCAL_PROFILE:'1',BOXVAULT_LOCAL_STATE:state,BOXVAULT_LOCAL_WEB_PORT:String(config.webPort),BOXVAULT_LOCAL_API_ORIGIN:apiOrigin,PORT:String(config.apiPort),WEB_ORIGIN:origin,PUBLIC_WEB_URL:origin,DIRECT_URL:dbUrl('boxvault_local_admin',config.adminPassword),DATABASE_URL:dbUrl('boxvault_runtime_m1',config.contentPassword),AUTH_DATABASE_URL:dbUrl('boxvault_auth_runtime_m1',config.authPassword),AUTH_BOT_PROTECTION_MODE:'off',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(config.smtpPort),SMTP_FROM:'BoxVault <local@boxvault.example.invalid>',SMTP_USER:'',SMTP_PASSWORD:'',SMTP_ALLOW_PLAINTEXT_TEST:'true',BOXVAULT_PRESERVE_LOCAL_MAIL:'1',BOXVAULT_TEST_MAIL_FILE:join(state,'mail.txt'),AUTH_SESSION_PEPPER:config.sessionPepper,AUTH_ACCESS_JWT_KEY:config.jwtKey,TOTP_ENCRYPTION_KEY:config.totpKey,PGPASSWORD:config.adminPassword};
const children=[];let startedPg=false,stopping=false;
function killService(child, signal) { try { if(process.platform!=='win32')process.kill(-child.pid,signal);else child.kill(signal); } catch {} }
const run=(command,args,options={})=>new Promise((done,fail)=>{const child=spawn(command,args,{cwd:root,env,stdio:['ignore','inherit','inherit'],...options});child.on('error',()=>fail(Error('Could not run '+command)));child.on('exit',code=>code===0?done():fail(Error(command+' exited with status '+code)));});
const psql=()=>[join(pgBin,'psql'),['-h','127.0.0.1','-p',String(config.pgPort),'-U','boxvault_local_admin','-d','boxvault_local','-v','ON_ERROR_STOP=1']];
async function sql(statement){const [command,args]=psql();await new Promise((done,fail)=>{const child=spawn(command,args,{cwd:root,env,stdio:['pipe','ignore','pipe']});let error='';child.stderr.on('data',chunk=>{error+=chunk;});child.on('error',()=>fail(Error('Database provisioning failed')));child.on('exit',code=>code===0?done():fail(Error('Local database provisioning failed. Inspect local permissions.')));child.stdin.end(statement);});}
function service(command,args,log){const output=openSync(join(state,log),'a',0o600);const child=spawn(command,args,{cwd:root,env,detached:process.platform!=='win32',stdio:['ignore',output,output]});closeSync(output);children.push(child);child.once('error',()=>{console.error('A local service could not start. See .boxvault-local/'+log);void stop(1);});child.once('exit',code=>{if(!stopping){console.error('A local service stopped ('+log+').');void stop(code||1);}});return child;}
async function available(port){await new Promise((done,fail)=>{const server=net.createServer();server.once('error',()=>fail(Error('Port '+port+' is already in use. Stop the other service or edit the local configuration.')));server.listen(port,'127.0.0.1',()=>server.close(done));});}
async function ready(url){for(let i=0;i<100;i++){if(stopping)throw Error('Local startup stopped');try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Service did not become ready. Check .boxvault-local logs.');}
async function stop(code=0){if(stopping)return;stopping=true;for(const child of children)killService(child,'SIGTERM');await Promise.all(children.map(child=>new Promise(r=>{if(child.exitCode!==null||child.signalCode)return r();child.once('exit',r);setTimeout(()=>{killService(child,'SIGKILL');r();},3000).unref();})));if(startedPg){try{execFileSync(join(pgBin,'pg_ctl'),['-D',join(state,'data'),'-m','fast','-w','stop'],{stdio:'ignore',env});}catch{}}process.exit(code);}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
try{
 for(const port of [config.webPort,config.apiPort,config.smtpPort])await available(port);
 const data=join(state,'data');let initialized=true;try{await access(join(data,'PG_VERSION'));}catch{initialized=false;}
 if(!initialized){await available(config.pgPort);const pw=join(state,'admin-password');await writeFile(pw,config.adminPassword,{mode:0o600});await run(join(pgBin,'initdb'),['-D',data,'-U','boxvault_local_admin','--auth-local=trust','--auth-host=scram-sha-256','--pwfile='+pw]);}
 const status=spawn(join(pgBin,'pg_ctl'),['-D',data,'status'],{stdio:'ignore'});const isRunning=await new Promise(r=>status.on('exit',code=>r(code===0)));
 if(!isRunning){await available(config.pgPort);await run(join(pgBin,'pg_ctl'),['-D',data,'-l',join(state,'postgres.log'),'-o','-h 127.0.0.1 -p '+config.pgPort+' -k '+"'"+state.replace(/'/g,"'\\''")+"'"+' -c timezone=UTC','-w','start'],{stdio:'ignore'});startedPg=true;}
 if(!initialized)await run(join(pgBin,'createdb'),['-h','127.0.0.1','-p',String(config.pgPort),'-U','boxvault_local_admin','boxvault_local'],{stdio:'ignore'});
 await sql(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='boxvault_runtime_m1') THEN CREATE ROLE boxvault_runtime_m1 LOGIN PASSWORD '${config.contentPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='boxvault_auth_runtime_m1') THEN CREATE ROLE boxvault_auth_runtime_m1 LOGIN PASSWORD '${config.authPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF; END $$;`);
 console.log('Preparing your local BoxVault database and app…');
 await run('pnpm',['--filter','@boxvault/api','db:generate']);await run('pnpm',['--filter','@boxvault/api','db:deploy']);
 await sql(`GRANT CONNECT ON DATABASE boxvault_local TO boxvault_runtime_m1,boxvault_auth_runtime_m1; GRANT USAGE ON SCHEMA public,security TO boxvault_runtime_m1,boxvault_auth_runtime_m1;
 GRANT SELECT ON public."Tenant",public."TenantMember" TO boxvault_runtime_m1;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public."Container",public."Item",public."MediaAsset",public."ContainerAccessGrant" TO boxvault_runtime_m1;
 GRANT EXECUTE ON FUNCTION security.actor_id(),security.tenant_id(),security.active_member(uuid,uuid),security.member_can_edit(uuid,uuid),security.container_allowed(uuid,uuid,boolean),security.grant_visible(uuid,uuid,uuid) TO boxvault_runtime_m1;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public."User",public."AuthIdentity",public."AuthSession",public."AuthChallenge",public."TotpFactor",public."MfaRecoveryCode",public."EmailActionToken",public."AuthRateLimit",public."RefreshTokenReuse" TO boxvault_auth_runtime_m1;
 GRANT SELECT,INSERT ON public."AuthAuditEvent" TO boxvault_auth_runtime_m1; GRANT SELECT ON public."PlatformOperator" TO boxvault_auth_runtime_m1;
 GRANT EXECUTE ON FUNCTION security.bootstrap_verified_email_tenant(text,uuid,uuid) TO boxvault_auth_runtime_m1;`);
 await sql(await readFile(join(root,'apps/api/test/family-runtime-grants.fixture.sql'),'utf8'));
 await run('pnpm',['--filter','@boxvault/api','build']);await run('pnpm',['--filter','@boxvault/qr','build']);await run('node',['apps/web/scripts/prepare-assets.mjs']);
 service(process.execPath,['apps/api/test/smtp-fixture.mjs'],'smtp.log');service(process.execPath,['apps/api/dist/main.js'],'api.log');
 await ready(apiOrigin+'/api/v1/health');service('pnpm',['--filter','@boxvault/web','dev:connected'],'web.log');await ready(origin);
 console.log('\nBoxVault is ready: '+origin+'\nCreate an account, open Local inbox, verify your email and sign in.\nData is saved in .boxvault-local. Press Ctrl+C to stop; restart with pnpm dev:local.\nLocal sandbox only: external email, CAPTCHA providers, payments and cloud photos are not enabled.');
}catch(error){console.error(error instanceof Error?error.message:'Local startup failed');await stop(1);}
