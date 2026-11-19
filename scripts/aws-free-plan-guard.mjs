import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { evaluateFreePlan } from './aws-free-plan-policy.mjs';
let values;
try { ({values} = parseArgs({options:{profile:{type:'string'},'estimated-usd':{type:'string'},help:{type:'boolean'}},strict:true})); }
catch { console.error('Invalid arguments. Use --help.'); process.exit(2); }
if (values.help) { console.log('Usage: pnpm aws:free-guard --profile boxvault-restricted --estimated-usd REVIEWED_LIFETIME_ESTIMATE\nReads identity and current Free-plan metadata only. No resources or secret values are accessed.'); process.exit(0); }
if (!values.profile || !/^[A-Za-z0-9_.-]+$/.test(values.profile) || values.profile === 'boxvault-bootstrap-owner' || !/^\d+(\.\d{1,2})?$/.test(values['estimated-usd'] ?? '')) { console.error('Provide a named non-owner profile and a reviewed USD estimate.'); process.exit(2); }
function read(service, operation, region) {
 const r=spawnSync('aws',[service,operation,'--profile',values.profile,'--region',region,'--output','json','--no-cli-pager','--cli-connect-timeout','5','--cli-read-timeout','10'],{encoding:'utf8',timeout:20000,maxBuffer:1048576,env:{...process.env,AWS_PAGER:'',AWS_CLI_AUTO_PROMPT:'off'},stdio:['ignore','pipe','pipe']});
 if(r.error || r.status!==0) throw Error('Unable to verify AWS metadata. Check restricted-profile authentication and permissions; no deployment is authorized.');
 try{return JSON.parse(r.stdout);}catch{throw Error('AWS metadata was not valid JSON.');}
}
try {
 const identity=read('sts','get-caller-identity','ap-southeast-2');
 const plan=read('freetier','get-account-plan-state','us-east-1');
 const result=evaluateFreePlan({identity,plan,region:'ap-southeast-2',estimatedUsd:Number(values['estimated-usd'])});
 console.log(JSON.stringify(result,null,2)); if(!result.passed)process.exitCode=1;
} catch {console.error('AWS Free-plan verification failed; no deployment is authorized. Check CLI authentication/permissions.');process.exitCode=2;}
