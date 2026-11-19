import { DescribeSecretCommand, PutSecretValueCommand, UpdateSecretVersionStageCommand } from '@aws-sdk/client-secrets-manager';
import { randomBytes } from 'node:crypto';
import { secret,secrets,trustedDatabaseHost,url,withDatabase,sqlString } from './database';
function validate(value:Record<string,unknown>) {
 if(value.username!==process.env.TARGET_DB_USER || !['boxvault_runtime_m1','boxvault_auth_runtime_m1'].includes(String(value.username)) || value.host!==trustedDatabaseHost() || value.dbname!=='boxvault' || value.engine!=='postgres' || value.port!==5432 || typeof value.password!=='string' || value.password.length<32)throw Error('Invalid rotation target');
 return value as {username:string;password:string;host:string;dbname:string;engine:string;port:number};
}
async function test(value:Record<string,unknown>) {
 const candidate=validate(value);
 await withDatabase(url(candidate.username,candidate.password),async db=>{
  const rows=await db.$queryRawUnsafe<Array<{current_user:string;rolsuper:boolean;rolbypassrls:boolean;rolcreaterole:boolean;rolcreatedb:boolean;rolinherit:boolean}>>('SELECT current_user,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit FROM pg_roles WHERE rolname=current_user');
  const row=rows[0];if(!row || row.current_user!==candidate.username || row.rolsuper || row.rolbypassrls || row.rolcreaterole || row.rolcreatedb || row.rolinherit)throw Error('Invalid runtime privileges');
 });
}
export async function handler(event: {SecretId?:string;ClientRequestToken?:string;Step?:string}) {
 try {
  const id=process.env.TARGET_SECRET_ARN,token=event.ClientRequestToken;
  if(!id || id!==event.SecretId || !token || !/^[a-zA-Z0-9-]{32,64}$/.test(token) || process.env.BOXVAULT_ROTATION_RUNTIME!=='1')throw Error('Invalid rotation invocation');
  const metadata=await secrets.send(new DescribeSecretCommand({SecretId:id}));
  const stages=metadata.VersionIdsToStages?.[token];
  if(!metadata.RotationEnabled || !stages)throw Error('Unregistered rotation');
  if(stages.includes('AWSCURRENT'))return {status:'already-current'};
  if(!stages.includes('AWSPENDING'))throw Error('Invalid rotation stage');
  const current=await secret(id);validate(current.data);
  if(event.Step==='createSecret') {
   try {const pending=await secret(id,token,'AWSPENDING');validate(pending.data);return {status:'pending-exists'};}
   catch(error) {if((error as {name?:string}).name!=='ResourceNotFoundException')throw error;}
   const next={...current.data,password:randomBytes(32).toString('hex')};
   await secrets.send(new PutSecretValueCommand({SecretId:id,ClientRequestToken:token,SecretString:JSON.stringify(next),VersionStages:['AWSPENDING']}));
  } else if(event.Step==='setSecret') {
   const pending=validate((await secret(id,token,'AWSPENDING')).data);
   try{await test(pending);return {status:'target-already-set'};}catch{/* Retry only the idempotent password-setting step, never an application write. */}
   const masterId=process.env.MASTER_SECRET_ARN;if(!masterId)throw Error('Missing rotation administrator');
   const master=(await secret(masterId)).data;if(master.username!=='boxvault_admin')throw Error('Invalid rotation administrator');
   await withDatabase(url(master.username,master.password),async db=>{
    const rows=await db.$queryRawUnsafe<Array<{rolsuper:boolean;rolbypassrls:boolean;rolcreaterole:boolean;rolcreatedb:boolean;rolinherit:boolean}>>('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit FROM pg_roles WHERE rolname=$1',pending.username);
    if(!rows[0] || Object.values(rows[0]).some(Boolean))throw Error('Unsafe runtime role');
    await db.$executeRawUnsafe(`ALTER ROLE "${pending.username}" PASSWORD ${sqlString(pending.password)}`);
   });
  } else if(event.Step==='testSecret') {
   await test((await secret(id,token,'AWSPENDING')).data);
  } else if(event.Step==='finishSecret') {
   await test((await secret(id,token,'AWSPENDING')).data);
   await secrets.send(new UpdateSecretVersionStageCommand({SecretId:id,VersionStage:'AWSCURRENT',MoveToVersionId:token,RemoveFromVersionId:current.version}));
  } else throw Error('Unknown rotation step');
  return {status:'complete',step:event.Step};
 } catch {console.error('Database credential rotation failed');throw Error('Database credential rotation failed');}
}
