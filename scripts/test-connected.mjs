// Black-box integration through the same-origin web proxy and local inbox.
// Does not read database credentials or bypass registration/verification.
import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
const origin=process.env.BOXVAULT_CONNECTED_TEST_ORIGIN || 'http://127.0.0.1:5180';
assert.equal(new URL(origin).hostname,'127.0.0.1','Only literal loopback fixtures may be tested');
const password='Local-Connected-Test-2026-Strong!';
async function request(path,client,method='GET',body,expected=200){
 const r=await fetch(origin+path,{method,headers:{origin,...(client?.access?{authorization:'Bearer '+client.access}:{}),...(client?.cookie?{cookie:client.cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,expected,method+' '+path.replace(/[0-9a-f-]{36}/gi,':id'));
 const cookie=r.headers.get('set-cookie');if(cookie&&client)client.cookie=cookie.split(';')[0];
 return r;
}
async function data(path,client,method='GET',body,expected=200){return (await request('/api/v1'+path,client,method,body,expected)).json();}
async function mail(email,kind){const box=await (await request('/__local/mail')).json();const entry=box.messages.find(m=>m.to.includes(email)&&m.link&&new URL(m.link).pathname==='/'+kind);assert.ok(entry,'Expected a local email action');const link=new URL(entry.link);assert.equal(link.origin,origin);assert.equal(link.search,'','Proofs must not enter query strings');const token=new URLSearchParams(link.hash.slice(1)).get('token');assert.match(token,/^[A-Za-z0-9_-]{43}$/);return token;}
async function signup(label){const email='connected-'+randomBytes(6).toString('hex')+'-'+label+'@example.invalid';await data('/auth/register',null,'POST',{email,password},201);const token=await mail(email,'verify-email');await data('/auth/verify-email',null,'POST',{token,password},201);const client={email,access:'',cookie:''};const login=await data('/auth/login',client,'POST',{email,password},201);assert.equal(login.mfaRequired,false);client.access=login.accessToken;assert.ok(client.cookie.startsWith('boxvault_refresh='));client.profile=await data('/auth/me',client);client.tenant=(await data('/tenants',client)).data[0].id;return client;}
// Every browser entry dependency must bypass the API proxy. In particular,
// /api.ts is a client module, not a backend route.
const clientModule=await request('/api.ts');assert.match(clientModule.headers.get('content-type') || '',/javascript/);assert.ok((await clientModule.text()).includes('refreshSession'));
const page=await request('/');assert.ok((await page.text()).includes('/main.tsx'),'Connected web entry must be served');
const guardDirectory = fileURLToPath(new URL('../apps/web/connected/.boxvault-local/',import.meta.url));
await mkdir(guardDirectory,{recursive:true}); const guardPath=guardDirectory+'guard-'+randomBytes(6).toString('hex')+'.json';
await writeFile(guardPath,'{"private":true}');try{const result=await fetch(origin+'/@fs'+guardPath);assert.equal(result.status,403,'Private local state must not be served by Vite');}finally{await unlink(guardPath);}
const a=await signup('owner'),b=await signup('member');
assert.equal(a.profile.email,a.email);assert.equal(a.profile.verified,true);
const created=await data('/containers',a,'POST',{tenantId:a.tenant,name:'Local end-to-end box',location:'First shelf'},201);const id=created.data.id;assert.equal((await data('/containers/'+id+'?tenantId='+a.tenant,a)).data.location,'First shelf');
await data('/containers/'+id,a,'PATCH',{tenantId:a.tenant,name:'Seasonal storage',location:'Hall closet'});
const item=(await data('/containers/'+id+'/items',a,'POST',{tenantId:a.tenant,name:'String lights',quantity:2},201)).data;
await data('/items/'+item.id,a,'PATCH',{tenantId:a.tenant,name:'String lights',quantity:3});
await data('/items/'+item.id,a,'PATCH',{tenantId:a.tenant,name:'String lights',quantity:-1},400);
const boxes=(await data('/containers?tenantId='+a.tenant,a)).data;const box=boxes.find(x=>x.id===id);assert.equal(box.location,'Hall closet');assert.equal(box.canManage,true);assert.equal(box.itemCount,1);
assert.equal((await data('/containers/'+id+'/items?tenantId='+a.tenant,a)).data[0].quantity,3);
let label=(await data('/containers/'+id+'/labels',a,'POST',{tenantId:a.tenant},201)).data.url;
const getToken=label=>{const u=new URL(label);assert.equal(u.origin,origin);assert.equal(u.pathname,'/scan');assert.equal(u.search,'');assert.ok(!label.includes(id));return new URLSearchParams(u.hash.slice(1)).get('token');};
const first=getToken(label);
await data('/labels/resolve',null,'POST',{tenantId:a.tenant,token:first},401);
assert.equal((await data('/labels/resolve',a,'POST',{tenantId:a.tenant,token:first},201)).data.id,id);
await data('/labels/resolve',b,'POST',{tenantId:b.tenant,token:first},404);
await data('/labels/resolve',b,'POST',{tenantId:a.tenant,token:first},404);
label=(await data('/containers/'+id+'/labels',a,'POST',{tenantId:a.tenant},201)).data.url;const second=getToken(label);assert.notEqual(first,second);
await data('/labels/resolve',a,'POST',{tenantId:a.tenant,token:first},404);
await data('/labels/resolve',a,'POST',{tenantId:a.tenant,token:second},201);
const forbidden=await fetch(origin+'/__local/mail',{headers:{origin:'https://unrelated.example'}});assert.equal(forbidden.status,403);
await request('/__local/family',b,'POST',{tenantId:a.tenant},404);
await request('/__local/family',a,'POST',{tenantId:a.tenant});
await data('/tenants/'+a.tenant+'/invitations',a,'POST',{email:b.email,role:'VIEWER'},201);
await data('/invitations/accept',b,'POST',{token:await mail(b.email,'accept-invitation')},201);
const shared=await data('/tenants/'+a.tenant+'/members',a);const member=shared.data.find(x=>x.email===b.email);assert.ok(member);
await data('/containers/'+id+'/sharing',a,'PUT',{tenantId:a.tenant,shareMode:'SELECTED_MEMBERS',grants:[{userId:member.userId,permission:'VIEW'}]});
await data('/labels/resolve',b,'POST',{tenantId:a.tenant,token:second},201);
assert.equal((await data('/containers/'+id+'/items?tenantId='+a.tenant,b)).data.length,1);
await data('/items/'+item.id,b,'PATCH',{tenantId:a.tenant,name:'Denied',quantity:1},404);
const viewOnly=(await data('/containers/'+id+'?tenantId='+a.tenant,b)).data;assert.equal(viewOnly.canEdit,false);assert.equal(viewOnly.canManage,false);
await data('/containers/'+id+'/sharing',a,'PUT',{tenantId:a.tenant,shareMode:'SELECTED_MEMBERS',grants:[{userId:member.userId,permission:'EDIT'}]});
await data('/containers/'+id+'/items',b,'POST',{tenantId:a.tenant,name:'Denied',quantity:1},404);
await data('/containers/'+id+'/labels',b,'POST',{tenantId:a.tenant},404);
await data('/containers/'+id+'/sharing',a,'PUT',{tenantId:a.tenant,shareMode:'PRIVATE',grants:[]});
await data('/labels/resolve',b,'POST',{tenantId:a.tenant,token:second},404);
await data('/auth/password-reset/request',null,'POST',{email:b.email},201);
const nextPassword='Local-Connected-New-2026-Strong!';await data('/auth/password-reset/confirm',null,'POST',{token:await mail(b.email,'reset-password'),password:nextPassword},201);
await data('/auth/me',b,'GET',undefined,401);
const renewed=await data('/auth/refresh',a,'POST',{},201);a.access=renewed.accessToken;assert.equal((await data('/auth/me',a)).email,a.email);
assert.ok((await data('/containers?tenantId='+a.tenant,a)).data.some(x=>x.id===id),'Data must persist across session refresh');
await data('/items/'+item.id,a,'DELETE',undefined,400); // Missing tenant context must deny.
await data('/items/'+item.id+'?tenantId='+a.tenant,a,'DELETE');
assert.equal((await data('/containers/'+id+'/items?tenantId='+a.tenant,a)).data.length,0);
await data('/auth/logout',a,'POST',{},201);await data('/auth/refresh',a,'POST',{},401);
console.log('Connected HTTP flow passed: register → local mail → verify → login → saved box/items → QR/rotation → Family/share/revoke → reset → refresh/logout.');
