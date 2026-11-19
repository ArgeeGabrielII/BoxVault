import { PrismaClient } from '@prisma/client';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
export const secrets = new SecretsManagerClient({region:'ap-southeast-2',maxAttempts:2});
export async function secret(id: string, version?: string, stage='AWSCURRENT') {
 const value=await secrets.send(new GetSecretValueCommand({SecretId:id,VersionStage:stage,...(version?{VersionId:version}:{})}));
 if(!value.SecretString || !value.VersionId)throw Error('Secret unavailable');
 return {data:JSON.parse(value.SecretString) as Record<string,unknown>,version:value.VersionId};
}
export function trustedDatabaseHost() {
 const host=process.env.DATABASE_HOST;
 if(process.env.AWS_REGION!=='ap-southeast-2' || typeof host!=='string' || !/^[a-z0-9.-]+\.ap-southeast-2\.rds\.amazonaws\.com$/.test(host))throw Error('Invalid database configuration');
 return host;
}
export function url(user: unknown,password: unknown) {
 const host=trustedDatabaseHost();
 if(typeof user!=='string' || !['boxvault_admin','boxvault_runtime_m1','boxvault_auth_runtime_m1'].includes(user) || typeof password!=='string' || password.length<16)throw Error('Invalid database credentials');
 return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/boxvault?sslmode=require&sslaccept=strict&sslcert=/var/task/rds-ca.pem&connection_limit=1&pool_timeout=5`;
}
export async function withDatabase<T>(address:string,fn:(db:PrismaClient)=>Promise<T>){const db=new PrismaClient({datasources:{db:{url:address}},log:[]});try{return await fn(db);}finally{await db.$disconnect();}}
export function sqlString(value:string){return "'"+value.replace(/'/g,"''")+"'";}
