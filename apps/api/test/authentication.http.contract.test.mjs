/**
 * SECURITY GATE: HTTP authentication / MFA contracts.
 * This suite is EXPECTED TO FAIL while M1 authentication routes are unimplemented.
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
