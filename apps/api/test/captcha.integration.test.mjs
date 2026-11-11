import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { AuthHardeningService }=require('../dist/auth/auth-hardening.service.js');

test('CAPTCHA-01: server verifies action/host/score/time and denies token replay',async()=>{
  const old={
    mode:process.env.AUTH_BOT_PROTECTION_MODE,
    secret:process.env.RECAPTCHA_SECRET_KEY,
    hostname:process.env.RECAPTCHA_HOSTNAME,
    url:process.env.RECAPTCHA_VERIFY_URL,
  };
  const originalFetch=globalThis.fetch;
  process.env.AUTH_BOT_PROTECTION_MODE='enforce';
  process.env.RECAPTCHA_SECRET_KEY='ci-only-fake-captcha-secret';
  process.env.RECAPTCHA_HOSTNAME='localhost';
  process.env.RECAPTCHA_VERIFY_URL='http://127.0.0.1:9999/fake-verification';
  const svc=new AuthHardeningService();
  try {
    let result={
      success:true, hostname:'localhost', action:'login',score:0.9,
      challenge_ts:new Date().toISOString(),
    };
    globalThis.fetch=async() => new Response(JSON.stringify(result),{status:200});
    await svc.captcha('CI_fake_captcha_token_1234567890','login');
    await assert.rejects(
      svc.captcha('CI_fake_captcha_token_1234567890','login'),
      e=>e.getStatus?.()===401,'Verified CAPTCHA tokens cannot be replayed');
    result={...result,hostname:'another.example'};
    await assert.rejects(svc.captcha('CI_fake_captcha_token_bad_host','login'),
      e=>e.getStatus?.()===401);
    result={...result,hostname:'localhost',action:'register'};
    await assert.rejects(svc.captcha('CI_fake_captcha_token_bad_action','login'),
      e=>e.getStatus?.()===401);
    result={...result,action:'login',score:0.1};
    await assert.rejects(svc.captcha('CI_fake_captcha_token_low_score','login'),
      e=>e.getStatus?.()===401);
    result={...result,score:0.9,challenge_ts:new Date(Date.now()-5*60_000).toISOString()};
    await assert.rejects(svc.captcha('CI_fake_captcha_token_expired','login'),
      e=>e.getStatus?.()===401);
    globalThis.fetch=async()=>{throw new Error('Provider unavailable');};
    await assert.rejects(svc.captcha('CI_fake_captcha_token_unreachable','login'),
      e=>e.getStatus?.()===503);
  } finally {
    globalThis.fetch=originalFetch;
    for(const [key,value] of Object.entries({
      AUTH_BOT_PROTECTION_MODE:old.mode,
      RECAPTCHA_SECRET_KEY:old.secret,
      RECAPTCHA_HOSTNAME:old.hostname,
      RECAPTCHA_VERIFY_URL:old.url,
    })) {
      if(value === undefined) delete process.env[key];
      else process.env[key]=value;
    }
    await svc.onModuleDestroy();
  }
});
