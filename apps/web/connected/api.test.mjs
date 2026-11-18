import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api, rememberSession, ApiError } from './api.ts';
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
test('simultaneous expired requests share one refresh and retry with the new credential',async t=>{
 rememberSession('expired-fixture');let refreshes=0;const authorized=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
  if(url.endsWith('/auth/refresh')){refreshes++;await new Promise(r=>setTimeout(r,5));return json(201,{accessToken:'fresh-fixture'});}
  authorized.push(options.headers.authorization);return options.headers.authorization==='Bearer fresh-fixture'?json(200,{ok:true}):json(401,{});
 });
 const responses=await Promise.all([api('/containers'),api('/auth/me')]);
 assert.equal(refreshes,1);assert.deepEqual(responses,[{ok:true},{ok:true}]);assert.equal(authorized.filter(x=>x==='Bearer fresh-fixture').length,2);
});
test('failed refresh ends the session without retrying with a revoked credential',async t=>{
 rememberSession('revoked-fixture');let ended=0,requests=0;
 globalThis.window={dispatchEvent(event){if(event.type==='boxvault-session-ended')ended++;}};t.after(()=>{delete globalThis.window;});
 t.mock.method(globalThis,'fetch',async()=>{requests++;return json(401,{message:'Authentication required'});});
 await assert.rejects(api('/auth/me'),error=>error instanceof ApiError && error.status===401);
 assert.equal(requests,2);assert.equal(ended,1);
});
test('public auth errors do not trigger a refresh of a different signed-in account',async t=>{
 let requests=0;t.mock.method(globalThis,'fetch',async(_url,options)=>{requests++;assert.equal(options.headers.authorization,undefined);return json(401,{message:'Invalid credentials'});});
 await assert.rejects(api('/auth/login','POST',{email:'fixture@example.invalid',password:'wrong'},false),error=>error.status===401);assert.equal(requests,1);
});

test('an incorrect MFA code is a form error, not an automatic session logout',async t=>{
 rememberSession('active-fixture');let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;return json(401,{message:'Invalid credentials'});});
 await assert.rejects(api('/auth/mfa/totp/confirm','POST',{code:'wrong'}),error=>error.status===401);assert.equal(requests,1);
});
