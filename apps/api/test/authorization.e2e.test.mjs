import { PrismaClient } from '@prisma/client';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';

// Real PostgreSQL integration test. Missing secrets/configuration MUST fail, not skip.
const adminUrl=process.env.AUTHZ_ADMIN_DATABASE_URL;
const runtimeUrl=process.env.AUTHZ_RUNTIME_DATABASE_URL;
assert.ok(adminUrl,'AUTHZ_ADMIN_DATABASE_URL is required');
assert.ok(runtimeUrl,'AUTHZ_RUNTIME_DATABASE_URL is required');
assert.notEqual(adminUrl,runtimeUrl,'Use different fixture and runtime roles');
const admin=new PrismaClient({datasources:{db:{url:adminUrl}}});
const app=new PrismaClient({datasources:{db:{url:runtimeUrl}}});
const id=()=>randomUUID(), nonce=randomBytes(8).toString('hex');
const u={owner:id(),editor:id(),viewer:id(),other:id(),outsider:id(),operator:id()};
const t={a:id(),b:id()};
const c={private:id(),selected:id(),family:id(),outside:id()};
const item={private:id(),selected:id(),family:id(),outside:id()};
const media={private:id(),selected:id(),family:id(),outside:id()};
const tokens=Object.fromEntries(Object.keys(c).map(k=>[k,randomBytes(32).toString('hex')]));
let seeded=false;
async function scoped(who,tenant,fn){
  return app.$transaction(async tx=>{
    if(who) await tx.$queryRawUnsafe("SELECT set_config('app.user_id', $1, true)",who);
    if(tenant) await tx.$queryRawUnsafe("SELECT set_config('app.tenant_id', $1, true)",tenant);
    return fn(tx);
  });
}
const ALLOWED=new Set(['Container','Item','MediaAsset','ContainerAccessGrant']);
async function visible(tx,table,recordId){
  assert.ok(ALLOWED.has(table));
  const rows=await tx.$queryRawUnsafe('SELECT id FROM "'+table+'" WHERE id=$1::uuid',recordId);
  return rows.length===1;
}
const canSee=(who,tenant,table,recordId)=>scoped(who,tenant,tx=>visible(tx,table,recordId));
async function changeQty(who,tenant,itemId){
  return scoped(who,tenant,tx=>tx.$executeRawUnsafe('UPDATE "Item" SET quantity=42 WHERE id=$1::uuid',itemId));
}
test('SEC-00: runtime database role is restricted and RLS is enforced',async()=>{
  const [role]=await app.$queryRawUnsafe('SELECT rolsuper AS superuser, rolbypassrls AS bypass, rolcreaterole AS create_role, rolcreatedb AS create_db FROM pg_roles WHERE rolname=current_user');
  assert.ok(role);
  for(const field of ['superuser','bypass','create_role','create_db']) assert.equal(role[field],false,field);
  for(const table of ['Tenant','TenantMember','Container','ContainerAccessGrant','Item','MediaAsset']){
    const [policy]=await app.$queryRawUnsafe("SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced, pg_get_userbyid(relowner)=current_user AS owns FROM pg_class WHERE oid=to_regclass($1)",'public."'+table+'"');
    assert.ok(policy,table+' missing');
    assert.equal(policy.enabled,true,table+' RLS off');
    assert.equal(policy.forced,true,table+' FORCE RLS off');
    assert.equal(policy.owns,false,table+' runtime owns table');
  }
  // A content runtime role must never read or mutate auth, MFA or finance tables.
  // RLS on inventory cannot compensate for a leaked AuthSession or TOTP secret.
  for(const table of ['User','AuthSession','AuthIdentity','TotpFactor',
    'MfaRecoveryCode','Plan','CreditWallet','TopupRequest']){
    const [rights]=await app.$queryRawUnsafe(
      "SELECT has_table_privilege(current_user, format('public.%I',$1::text),'SELECT') AS readable," +
      " has_table_privilege(current_user, format('public.%I',$1::text),'UPDATE') AS writable",table);
    assert.equal(rights.readable,false,table+' readable by content runtime');
    assert.equal(rights.writable,false,table+' mutable by content runtime');
  }
  const [roleAdmin]=await admin.$queryRawUnsafe('SELECT rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user');
  assert.equal(roleAdmin.bypass,true,'Fixture role must BYPASSRLS');
  assert.deepEqual(await app.$queryRawUnsafe('SELECT id FROM "Container"'),[]);
});
test('SEC-01: seed synthetic independent tenants, family members and child content',async()=>{
  for(const [k,v] of Object.entries(u)) await admin.user.create({data:{id:v,email:'authz-'+nonce+'-'+k+'@example.invalid'}});
  for(const [k,v] of Object.entries(t)) await admin.tenant.create({data:{id:v,name:'authz-'+nonce+'-'+k}});
  for(const [tenantId,userId,role] of [[t.a,u.owner,'OWNER'],[t.a,u.editor,'EDITOR'],[t.a,u.viewer,'VIEWER'],[t.a,u.other,'VIEWER'],[t.b,u.outsider,'OWNER']]){
    await admin.tenantMember.create({data:{tenantId,userId,role,status:'ACTIVE'}});
  }
  for(const [key,containerId] of Object.entries(c)){
    const outside=key==='outside',tenantId=outside?t.b:t.a,ownerUserId=outside?u.outsider:u.owner;
    const shareMode=key==='family'?'ALL_FAMILY':key==='selected'?'SELECTED_MEMBERS':'PRIVATE';
    await admin.container.create({data:{id:containerId,tenantId,ownerUserId,shareMode,name:'authz-'+nonce+'-'+key,publicToken:tokens[key]}});
    await admin.item.create({data:{id:item[key],tenantId,containerId,name:'fixture-'+nonce+'-'+key}});
    await admin.mediaAsset.create({data:{id:media[key],tenantId,containerId,objectKey:'fixture/'+nonce+'/'+key,mimeType:'image/png',byteSize:10}});
  }
  await admin.containerAccessGrant.createMany({data:[
    {tenantId:t.a,containerId:c.selected,granteeUserId:u.editor,permission:'VIEW',grantedBy:u.owner},
    {tenantId:t.a,containerId:c.selected,granteeUserId:u.viewer,permission:'EDIT',grantedBy:u.owner},
  ]});
  seeded=true;
  assert.equal(await canSee(u.owner,t.a,'Container',c.private),true);
});
test('SEC-02: tenant A cannot read tenant B or spoof tenant context',async()=>{
  assert.ok(seeded);
  for(const who of [u.owner,u.editor,u.viewer,u.other]){
    for(const [table,rid] of [['Container',c.outside],['Item',item.outside],['MediaAsset',media.outside]]){
      assert.equal(await canSee(who,t.a,table,rid),false,table+' cross tenant');
    }
  }
  assert.equal(await canSee(u.owner,t.b,'Container',c.outside),false);
  assert.equal(await canSee(u.outsider,t.a,'Container',c.private),false);
});
test('SEC-03: private-by-default hides box, item and media from siblings and operator',async()=>{
  assert.ok(seeded);
  for(const who of [u.editor,u.viewer,u.other,u.operator]){
    for(const [table,rid] of [['Container',c.private],['Item',item.private],['MediaAsset',media.private]])
      assert.equal(await canSee(who,t.a,table,rid),false,table+' private leak');
  }
});
test('SEC-04: SELECTED grants respect VIEW/EDIT and tenant role intersection',async()=>{
  assert.ok(seeded);
  for(const who of [u.editor,u.viewer]){
    assert.equal(await canSee(who,t.a,'Container',c.selected),true);
    assert.equal(await canSee(who,t.a,'Item',item.selected),true);
    assert.equal(await canSee(who,t.a,'MediaAsset',media.selected),true);
    assert.equal(await changeQty(who,t.a,item.selected),0,'read-only actor edited selected item');
  }
  assert.equal(await canSee(u.other,t.a,'Container',c.selected),false);
});
test('SEC-05: ALL_FAMILY allows active members; viewer cannot edit, editor can',async()=>{
  assert.ok(seeded);
  for(const who of [u.owner,u.editor,u.viewer,u.other])
    assert.equal(await canSee(who,t.a,'Container',c.family),true);
  assert.equal(await changeQty(u.viewer,t.a,item.family),0);
  assert.equal(await changeQty(u.editor,t.a,item.family),1);
});
test('SEC-06: removed member immediately loses ACL, box and child access',async()=>{
  assert.ok(seeded);
  await admin.tenantMember.update({where:{tenantId_userId:{tenantId:t.a,userId:u.editor}},data:{status:'REMOVED'}});
  for(const [table,rid] of [['Container',c.family],['Container',c.selected],['Item',item.selected],['MediaAsset',media.selected]])
    assert.equal(await canSee(u.editor,t.a,table,rid),false,table+' leaked after removal');
});
test('SEC-07: unauthenticated/missing tenant claims fail closed',async()=>{
  assert.ok(seeded);
  assert.equal(await canSee(null,t.a,'Container',c.family),false);
  assert.equal(await canSee(u.owner,null,'Container',c.private),false);
  assert.equal(await canSee(u.operator,t.a,'Container',c.family),false);
  assert.deepEqual(await app.$queryRawUnsafe('SELECT id FROM "Container"'),[]);
});
test('SEC-08: knowing QR token grants no container access',async()=>{
  assert.ok(seeded);
  const rows=await scoped(u.other,t.a,tx=>tx.$queryRawUnsafe('SELECT id FROM "Container" WHERE "publicToken"=$1',tokens.private));
  assert.deepEqual(rows,[]);
});
test('SEC-09: non-owner with read permission cannot widen sharing',async()=>{
  assert.ok(seeded);
  const modified=await scoped(u.viewer,t.a,tx=>tx.$executeRawUnsafe('UPDATE "Container" SET "shareMode"=$1::"ContainerShareMode" WHERE id=$2::uuid','ALL_FAMILY',c.selected));
  assert.equal(modified,0);
});
test('SEC-10: ACTIVE family editor cannot transfer ownership or widen sharing',async()=>{
  assert.ok(seeded);
  const key={tenantId_userId:{tenantId:t.a,userId:u.editor}};
  await admin.tenantMember.update({where:key,data:{status:'ACTIVE'}});
  try {
    assert.equal(await canSee(u.editor,t.a,'Container',c.family),true,
      'active editor must see shared family container before escalation checks');
    assert.equal(await changeQty(u.editor,t.a,item.family),1,
      'active editor must have real item edit permission before escalation checks');
    const changed=await scoped(u.editor,t.a,tx=>tx.$executeRawUnsafe(
      'UPDATE "Container" SET "shareMode"=$1::"ContainerShareMode" WHERE id=$2::uuid',
      'PRIVATE',c.family));
    assert.equal(changed,0,'active editor reclassified another user container');
    const ownership=await scoped(u.editor,t.a,tx=>tx.$executeRawUnsafe(
      'UPDATE "Container" SET "ownerUserId"=$1::uuid WHERE id=$2::uuid',
      u.editor,c.family));
    assert.equal(ownership,0,'active editor stole ownership of shared container');
  } finally {
    await admin.tenantMember.update({where:key,data:{status:'REMOVED'}});
  }
});
after(async()=>{
  try{
    const filter={tenantId:{in:Object.values(t)}};
    await admin.containerAccessGrant.deleteMany({where:filter});
    await admin.mediaAsset.deleteMany({where:filter});
    await admin.item.deleteMany({where:filter});
    await admin.container.deleteMany({where:filter});
    await admin.tenantMember.deleteMany({where:filter});
    await admin.tenant.deleteMany({where:{id:{in:Object.values(t)}}});
    await admin.user.deleteMany({where:{id:{in:Object.values(u)}}});
  } finally { await Promise.all([admin.$disconnect(),app.$disconnect()]); }
});
