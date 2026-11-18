import { readMailbox } from './local-mailbox.mjs';
import { createRequire } from 'node:module';
const requireApi=createRequire(new URL('../apps/api/package.json',import.meta.url));
export function localServices() {
 return {name:'boxvault-local-services',apply:'serve',configureServer(server){
  if(process.env.BOXVAULT_LOCAL_PROFILE!=='1' || process.env.NODE_ENV!=='test')return;
  const origin=process.env.PUBLIC_WEB_URL, apiOrigin=process.env.BOXVAULT_LOCAL_API_ORIGIN;
  if(!origin || !apiOrigin || new URL(origin).hostname!=='127.0.0.1' || new URL(apiOrigin).hostname!=='127.0.0.1')throw Error('Local services require literal loopback origins');
  const database = new URL(process.env.DIRECT_URL || '');
  if(!['127.0.0.1','localhost'].includes(database.hostname) || !['/boxvault_local','/boxvault_auth_ci','/boxvault_connected_ci'].includes(database.pathname))throw Error('Local services refuse hosted or unrelated databases');
  const {PrismaClient}=requireApi('@prisma/client');
  const db=new PrismaClient({datasources:{db:{url:process.env.DIRECT_URL}}});
  server.httpServer?.once('close',()=>void db.$disconnect());
  server.middlewares.use('/__local',async(req,res)=>{
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
   const reply=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
   if(req.headers.host!==new URL(origin).host || !['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress) || (req.headers.origin && req.headers.origin!==origin)){reply(403,{message:'Local access only'});return;}
   try{
    if(req.url==='/mail' && req.method==='GET'){reply(200,{messages:await readMailbox(process.env.BOXVAULT_TEST_MAIL_FILE,origin)});return;}
    if(req.url==='/family' && req.method==='POST'){
     if(req.headers.origin!==origin || typeof req.headers.authorization!=='string'){reply(403,{message:'Local authenticated request required'});return;}
     let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048){reply(413,{message:'Request too large'});return;}}
     let body;try{body=JSON.parse(raw);}catch{reply(400,{message:'Invalid request'});return;}
     if(!body || Object.keys(body).join()!=='tenantId' || !/^[0-9a-f-]{36}$/i.test(body.tenantId)){reply(400,{message:'Invalid workspace'});return;}
     const response=await fetch(apiOrigin+'/api/v1/tenants',{headers:{authorization:req.headers.authorization},signal:AbortSignal.timeout(5000),redirect:'error'});
     if(!response.ok){reply(response.status,{message:'Sign in to your workspace first'});return;}
     const {data}=await response.json();if(!data.some(w=>w.id===body.tenantId && w.role==='OWNER')){reply(404,{message:'Workspace unavailable'});return;}
     await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${body.tenantId}::text,0))::text`;
      const plan=await tx.plan.upsert({where:{code:'FAMILY'},update:{},create:{code:'FAMILY',annualCredits:1999,maxMembers:4,maxContainers:10000,maxStorageMb:0}});
      const existing=await tx.subscription.findFirst({where:{tenantId:body.tenantId,planId:plan.id,status:'ACTIVE'}});
      const until=new Date(Date.now()+30*86400000);
      if(existing)await tx.subscription.update({where:{id:existing.id},data:{validUntil:until}});
      else await tx.subscription.create({data:{tenantId:body.tenantId,planId:plan.id,status:'ACTIVE',validUntil:until}});
     });reply(200,{enabled:true,sandbox:true});return;
    }
    reply(404,{message:'Local operation unavailable'});
   }catch{reply(503,{message:'Local service unavailable. Check the BoxVault launcher.'});}
  });
 }};
}
