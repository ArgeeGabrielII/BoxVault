/**
 * SECURITY GATE: HTTP authentication / MFA contracts.
 * Real integration checks against isolated PostgreSQL; never accept 404 as auth success.
 * It does NOT use mocked sessions or accept 404 as a substitute for authentication.
 * Run against the started BoxVault NestJS API after building.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
const base = process.env.BOXVAULT_API_URL;
assert.ok(base && /^https?:\/\//.test(base),
  'BOXVAULT_API_URL must identify a running isolated BoxVault API; never skip');
async function req(path,method='GET',bearer,body) {
  const headers = { accept:'application/json' };
  if (bearer) headers.authorization='Bearer '+bearer;
  if (body) headers['content-type']='application/json';
  return fetch(new URL(path,base), {
    method, headers, redirect:'manual',
    body: body ? JSON.stringify(body) : undefined,
    signal:AbortSignal.timeout(5000)
  });
}
test('AUTH-HTTP-00: health check is the only public scaffold route',async()=>{
  const r=await req('/api/v1/health');
  assert.equal(r.status,200);
});
test('AUTH-HTTP-01: inventory access requires authenticated session (not 404)',async()=>{
  for(const path of ['/api/v1/containers','/api/v1/containers/11111111-1111-4111-8111-111111111111']){
    const r=await req(path);
    assert.equal(r.status,401,path+': missing auth MUST be rejected before inventory routing');
  }
});
test('AUTH-HTTP-02: forged bearer cannot access container lists',async()=>{
  const r=await req('/api/v1/containers','GET','forged.session.value');
  assert.equal(r.status,401);
});
test('AUTH-HTTP-03: Google token is verified server-side',async()=>{
  const r=await req('/api/v1/auth/google','POST',undefined,{idToken:'forged-not-a-jwt'});
  assert.ok([400,401].includes(r.status),'Google identity token cannot be accepted; 404 is not a verified auth endpoint');
});
test('AUTH-HTTP-04: unverified MFA challenge cannot issue full session',async()=>{
  const r=await req('/api/v1/auth/mfa/challenges/verify','POST',undefined,
    {challengeId:'invalid',code:'000000'});
  assert.ok([400,401].includes(r.status),'MFA verification endpoint must reject invalid challenge, not be absent');
});
test('AUTH-HTTP-05: admin payment review requires privileged authentication',async()=>{
  const r=await req('/api/v1/admin/topups');
  assert.equal(r.status,401);
});
test('AUTH-HTTP-06: password login must not expose account enumeration',async()=>{
  const r=await req('/api/v1/auth/login','POST',undefined,{email:'nonexistent@example.invalid',password:'invalid'});
  assert.ok([400,401,429].includes(r.status),'Login endpoint must reject without exposing internal data; 404 is not acceptable');
});

test('AUTH-HTTP-07: password session, MFA setup, one-time recovery and refresh rotation',async()=>{
  const loginPayload={email:'m1-auth-test@example.invalid',password:'M1-Test-strong-password-123!'};
  const start=await req('/api/v1/auth/login','POST',undefined,loginPayload);
  assert.equal(start.status,201,'Valid password must authenticate');
  const first=await start.json();
  assert.equal(first.mfaRequired,false);
  assert.equal(typeof first.accessToken,'string');
  assert.equal(first.tokenType,'Bearer');
  const firstCookie=start.headers.get('set-cookie')?.split(';')[0];
  assert.ok(firstCookie?.startsWith('boxvault_refresh='));
  assert.match(start.headers.get('set-cookie')??'',/httponly/i);
  assert.match(start.headers.get('set-cookie')??'',/samesite=strict/i);

  // Valid JWT is not an admin credential or proof of tenant membership.
  const admin=await req('/api/v1/admin/topups','GET',first.accessToken);
  assert.equal(admin.status,403);
  const missingTenant=await req('/api/v1/containers','GET',first.accessToken);
  assert.equal(missingTenant.status,400);

  const setup=await req('/api/v1/auth/mfa/totp/setup','POST',first.accessToken,{});
  assert.equal(setup.status,201);
  const provisioning=await setup.json();
  assert.match(provisioning.provisioningUri,/^otpauth:\/\/totp\//);
  // Local synthetic code generation (no live user data).
  const parsed=new URL(provisioning.provisioningUri);
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const raw=parsed.searchParams.get('secret');
  assert.ok(raw);
  let bits=0,value=0;const bytes=[];
  for(const char of raw){value=(value<<5)|alphabet.indexOf(char);bits+=5;if(bits>=8){bits-=8;bytes.push((value>>>bits)&255);}}
  const crypto=await import('node:crypto');
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const h=crypto.createHmac('sha1',Buffer.from(bytes)).update(counter).digest();
  const offset=h[h.length-1]&15;
  const code=((h.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
  const confirm=await req('/api/v1/auth/mfa/totp/confirm','POST',first.accessToken,{code});
  assert.equal(confirm.status,201);
  const result=await confirm.json();
  assert.equal(result.reloginRequired,true);
  assert.equal(result.recoveryCodes.length,10);

  // Enrollment invalidates all older access and refresh sessions.
  const obsolete=await req('/api/v1/admin/topups','GET',first.accessToken);
  assert.equal(obsolete.status,401);

  const next=await req('/api/v1/auth/login','POST',undefined,loginPayload);
  assert.equal(next.status,201);
  const pending=await next.json();
  assert.equal(pending.mfaRequired,true);
  assert.equal(pending.accessToken,undefined);

  // First single-use recovery code completes MFA; it cannot be replayed.
  const verify=await req('/api/v1/auth/mfa/challenges/verify','POST',undefined,
    {challengeId:pending.challengeId,code:result.recoveryCodes[0]});
  assert.equal(verify.status,201);
  const authenticated=await verify.json();
  assert.equal(typeof authenticated.accessToken,'string');
  const replay=await req('/api/v1/auth/mfa/challenges/verify','POST',undefined,
    {challengeId:pending.challengeId,code:result.recoveryCodes[0]});
  assert.equal(replay.status,401);
  const cookie=verify.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('boxvault_refresh='));

  const rotated=await fetch(new URL('/api/v1/auth/refresh',base),{
    method:'POST',headers:{cookie},redirect:'manual',
  });
  assert.equal(rotated.status,201);
  const renewed=await rotated.json();
  assert.equal(typeof renewed.accessToken,'string');
  assert.notEqual(rotated.headers.get('set-cookie')?.split(';')[0],cookie);
  const reuse=await fetch(new URL('/api/v1/auth/refresh',base),{
    method:'POST',headers:{cookie},redirect:'manual',
  });
  assert.equal(reuse.status,401);

  const logout=await req('/api/v1/auth/logout','POST',renewed.accessToken,{});
  assert.equal(logout.status,201);
  const afterLogout=await req('/api/v1/admin/topups','GET',renewed.accessToken);
  assert.equal(afterLogout.status,401);
});

test('AUTH-HTTP-08: verified-email signup, personal tenant and single-use password recovery',async()=>{
  const fs=await import('node:fs');
  const { PrismaClient } = await import('@prisma/client');
  const file=process.env.BOXVAULT_TEST_MAIL_FILE;
  assert.ok(file,'CI mailbox fixture is required');
  const inbox=()=>fs.readFileSync(file,'utf8').replace(/=\r?\n/g,'').replace(/=3D/gi,'=');
  const getToken=(portion)=>{
    const tokens=[...portion.matchAll(/token=([A-Za-z0-9_-]{43})/g)];
    assert.ok(tokens.length>0,'Expected a real single-use SMTP-delivered token');
    return tokens.at(-1)[1];
  };
  const email='signup-ci-boxvault@example.invalid';
  const original='M1-Another-Strong-Pass-123!';
  const newer='M1-A-Different-Strong-Pass-456!';
  const before=inbox();
  const register=await req('/api/v1/auth/register','POST',undefined,{email,password:original});
  assert.equal(register.status,201);
  assert.deepEqual(await register.json(),{accepted:true});
  const unreadable=await req('/api/v1/auth/login','POST',undefined,{email,password:original});
  assert.equal(unreadable.status,401,'Unverified identity must never receive a session');
  const delivered=inbox().slice(before.length);
  const verifyToken=getToken(delivered);
  const verified=await req('/api/v1/auth/verify-email','POST',undefined,{token:verifyToken,password:original});
  assert.equal(verified.status,201);
  assert.deepEqual(await verified.json(),{verified:true});
  const reused=await req('/api/v1/auth/verify-email','POST',undefined,{token:verifyToken});
  assert.equal(reused.status,401,'Email token must be single use');

  const db=new PrismaClient({datasources:{db:{url:process.env.AUTHZ_ADMIN_DATABASE_URL}}});
  let tenantId;
  try {
    const user=await db.user.findUnique({where:{email},include:{memberships:true}});
    assert.ok(user?.emailVerifiedAt);
    assert.equal(user.memberships.length,1,'New verified user gets one personal tenant');
    assert.equal(user.memberships[0].role,'OWNER');
    tenantId=user.memberships[0].tenantId;
  } finally {await db.$disconnect();}

  const login=await req('/api/v1/auth/login','POST',undefined,{email,password:original});
  assert.equal(login.status,201);
  const auth=await login.json();
  assert.equal(auth.mfaRequired,false);
  const listed=await req('/api/v1/containers?tenantId='+tenantId,'GET',auth.accessToken);
  assert.equal(listed.status,200);
  assert.deepEqual((await listed.json()).data,[]);

  const resetBefore=inbox();
  const sent=await req('/api/v1/auth/password-reset/request','POST',undefined,{email});
  assert.equal(sent.status,201);
  assert.deepEqual(await sent.json(),{accepted:true});
  const resetToken=getToken(inbox().slice(resetBefore.length));
  const change=await req('/api/v1/auth/password-reset/confirm','POST',undefined,
    {token:resetToken,password:newer});
  assert.equal(change.status,201);
  const replay=await req('/api/v1/auth/password-reset/confirm','POST',undefined,
    {token:resetToken,password:newer});
  assert.equal(replay.status,401);
  const old=await req('/api/v1/auth/login','POST',undefined,{email,password:original});
  assert.equal(old.status,401);
  const stale=await req('/api/v1/containers?tenantId='+tenantId,'GET',auth.accessToken);
  assert.equal(stale.status,401,'Password reset must revoke older access sessions');
  const fresh=await req('/api/v1/auth/login','POST',undefined,{email,password:newer});
  assert.equal(fresh.status,201);
  assert.equal(typeof (await fresh.json()).accessToken,'string');
  const nonexistent=await req('/api/v1/auth/password-reset/request','POST',undefined,
    {email:'nobody-boxvault@example.invalid'});
  assert.equal(nonexistent.status,201);
  assert.deepEqual(await nonexistent.json(),{accepted:true});
});
