import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateFreePlan} from './aws-free-plan-policy.mjs';
const baseline=()=>({identity:{Account:'666734238831',Arn:'arn:aws:sts::666734238831:assumed-role/BoxVaultToolkitReadOnly/test'},region:'ap-southeast-2',now:Date.parse('2026-11-19T01:00:00Z'),estimatedUsd:50,plan:{accountPlanType:'FREE',accountPlanStatus:'ACTIVE',accountPlanRemainingCredits:{amount:200,unit:'USD'},accountPlanExpirationDate:'2027-05-18T05:39:04Z'}});
test('allows a verified active Free plan with reserve and estimate',()=>assert.equal(evaluateFreePlan(baseline()).passed,true));
for(const [name,change] of [
 ['paid plan',x=>x.plan.accountPlanType='PAID'],['closed plan',x=>x.plan.accountPlanStatus='CLOSED'],['wrong project',x=>x.identity.Account='000000000000'],['root identity',x=>x.identity.Arn='arn:aws:iam::666734238831:root'],['wrong region',x=>x.region='us-east-1'],['unknown plan',x=>x.plan=undefined],['empty credits',x=>x.plan.accountPlanRemainingCredits.amount=0],['reserve exhausted',x=>x.estimatedUsd=181],['invalid cost estimate',x=>x.estimatedUsd=NaN],['negative cost estimate',x=>x.estimatedUsd=-1],['missing cost estimate',x=>delete x.estimatedUsd],['insufficient reserve',x=>x.reserveUsd=0],['expired plan',x=>x.now=Date.parse('2027-05-18T05:39:04Z')],['unknown expiry',x=>delete x.plan.accountPlanExpirationDate],['wrong currency',x=>x.plan.accountPlanRemainingCredits.unit='PHP'],
])test('refuses '+name,()=>{const x=baseline();change(x);assert.equal(evaluateFreePlan(x).passed,false);});
