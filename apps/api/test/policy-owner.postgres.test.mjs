import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
const adminUrl=process.env.AUTHZ_ADMIN_DATABASE_URL, runtimeUrl=process.env.AUTHZ_RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
for(const url of [adminUrl,runtimeUrl])assert.ok(url && ['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname),'Disposable loopback database required');
const admin=new PrismaClient({datasources:{db:{url:adminUrl}}}),runtime=new PrismaClient({datasources:{db:{url:runtimeUrl}}});
after(async()=>{await admin.$disconnect();await runtime.$disconnect();});
test('security helpers do not depend on a superuser or BYPASSRLS function owner',async()=>{
 const rows=await admin.$queryRawUnsafe(`SELECT p.proname, r.rolname, r.rolcanlogin,r.rolsuper,r.rolbypassrls FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='security' AND p.prosecdef`);
 assert.equal(rows.length,16);for(const row of rows){assert.equal(row.rolname,'boxvault_policy_m1');assert.equal(row.rolcanlogin,false);assert.equal(row.rolsuper,false);assert.equal(row.rolbypassrls,false);}
});
test('runtime cannot assume the policy role and all protected tables keep FORCE RLS',async()=>{
 const roles=await admin.$queryRawUnsafe(`SELECT rolname,pg_has_role(rolname,'boxvault_policy_m1','MEMBER') AS member FROM pg_roles WHERE rolname IN ('boxvault_runtime_m1','boxvault_auth_runtime_m1')`);
 for(const row of roles)assert.equal(row.member,false);
 await assert.rejects(runtime.$executeRawUnsafe('SET ROLE boxvault_policy_m1'));
 const tables=await admin.$queryRawUnsafe(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('Tenant','TenantMember','Container','ContainerAccessGrant','Item','MediaAsset','FamilyInvitation','FamilyAuditEvent')`);
 assert.equal(tables.length,8);for(const table of tables){assert.equal(table.relrowsecurity,true);assert.equal(table.relforcerowsecurity,true);}
});
