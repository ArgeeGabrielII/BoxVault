import { spawn } from 'node:child_process';
import { readFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { secret,url,withDatabase,sqlString,trustedDatabaseHost } from './database';
async function migrate(address:string) {
 await new Promise<void>((resolve,reject)=>{
  const engineRequire=createRequire(require.resolve('prisma/package.json'));
  const engine=join(dirname(engineRequire.resolve('@prisma/engines/package.json')),'schema-engine-rhel-openssl-3.0.x');
  const child=spawn(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',join(process.cwd(),'prisma/schema.prisma')],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:address,DIRECT_URL:address,PRISMA_SCHEMA_ENGINE_BINARY:engine},stdio:['ignore','ignore','ignore']});
  const timeout=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Migration timed out'));},180000);
  child.once('error',()=>{clearTimeout(timeout);reject(Error('Migration process failed'));});
  child.once('exit',code=>{clearTimeout(timeout);code===0?resolve():reject(Error('Migration process failed'));});
 });
}
export async function handler(event: {operation?: string}) {
 try {
  if(process.env.BOXVAULT_MIGRATION_RUNTIME!=='1' || event?.operation!=='apply-committed-migrations')throw Error('Invalid migration invocation');
  const ids=[process.env.MASTER_SECRET_ARN,process.env.AUTH_DATABASE_SECRET_ARN,process.env.CONTENT_DATABASE_SECRET_ARN];
  if(ids.some(id=>!id))throw Error('Missing migration references');
  const [master,auth,content]=await Promise.all(ids.map(id=>secret(id!)));
  if(master.data.username!=='boxvault_admin')throw Error('Invalid migration administrator');
  const address=url(master.data.username,master.data.password);
  const runtime: Array<Record<string,unknown> & {expected:string}> = [{...auth.data,expected:'boxvault_auth_runtime_m1'},{...content.data,expected:'boxvault_runtime_m1'}];
  await withDatabase(address,async db=>{
   for(const role of runtime){
    if(role.username!==role.expected || role.host!==trustedDatabaseHost() || role.dbname!=='boxvault' || typeof role.password!=='string' || role.password.length<32)throw Error('Invalid runtime role');
    const rows=await db.$queryRawUnsafe<Array<{rolsuper:boolean;rolbypassrls:boolean;rolcreaterole:boolean;rolcreatedb:boolean;rolinherit:boolean}>>('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit FROM pg_roles WHERE rolname=$1',role.expected);
    if(!rows.length)await db.$executeRawUnsafe(`CREATE ROLE "${role.expected}" LOGIN PASSWORD ${sqlString(role.password)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    else if(Object.values(rows[0]).some(Boolean))throw Error('Existing runtime role is not restricted');
   }
  });
  await migrate(address);
  await withDatabase(address,async db=>{
   const records=await db.$queryRawUnsafe<Array<{migration_name:string;checksum:string;finished_at:Date|null;rolled_back_at:Date|null}>>('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name');
   const dirs=(await readdir(join(process.cwd(),'prisma/migrations'),{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort();
   if(records.length!==dirs.length || dirs.length!==8)throw Error('Unexpected migration history');
   for(const [i,name] of dirs.entries()){
    const digest=createHash('sha256').update(await readFile(join(process.cwd(),'prisma/migrations',name,'migration.sql'))).digest('hex');
    if(records[i].migration_name!==name || records[i].checksum!==digest || !records[i].finished_at || records[i].rolled_back_at)throw Error('Migration history mismatch');
   }
   // A single transactional DO block applies reviewed grants, not arbitrary SQL from the invocation.
   const grants=await readFile(join(process.cwd(),'aws-sql/runtime-grants.sql'),'utf8');
   // Prisma raw execution rejects multi-statement prepared commands. The bundled,
   // reviewed file is wrapped as a single trusted PL/pgSQL DO statement.
   await db.$executeRawUnsafe('DO $boxvault_grants$ BEGIN '+grants+' END $boxvault_grants$;');
  });
  for(const role of runtime)await withDatabase(url(role.username,role.password),async db=>{await db.$queryRawUnsafe('SELECT current_user');});
  return {status:'migrated',migrations:8,runtimeRoles:'verified'};
 }catch{console.error('AWS database migration failed');throw Error('AWS database migration failed');}
}
