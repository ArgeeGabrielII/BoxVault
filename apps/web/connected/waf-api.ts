type RuntimeConfig = { captchaUrl: string; challengeUrl: string; apiKey: string };
declare global {
 interface Window {
  AwsWafIntegration?: { getToken(): Promise<string> };
  AwsWafCaptcha?: { renderCaptcha(container: HTMLElement, options: { apiKey: string; onSuccess(): void; onError(error: unknown): void }): unknown };
 }
}
let ready: Promise<RuntimeConfig> | undefined;
function loadScript(address: string) {
 const url = new URL(address);
 if (url.protocol !== 'https:' || !url.hostname.endsWith('.awswaf.com') || url.username || url.password || url.search || url.hash) throw Error('Invalid security integration');
 return new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src=url.toString();script.async=true;script.onload=()=>resolve();script.onerror=()=>reject(Error('Security check unavailable'));document.head.append(script);});
}
export function loadSecurity() {
 if (!ready) ready=(async()=>{
  const r=await fetch('/runtime-config.json',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('Security configuration unavailable');
  const config=await r.json() as RuntimeConfig;
  if(typeof config.apiKey!=='string' || !config.apiKey || typeof config.captchaUrl!=='string' || typeof config.challengeUrl!=='string')throw Error('Security configuration unavailable');
  await loadScript(config.challengeUrl);await loadScript(config.captchaUrl);
  if(!window.AwsWafIntegration || !window.AwsWafCaptcha)throw Error('Security check unavailable');
  return config;
 })().catch(error=>{ready=undefined;throw error;});
 return ready;
}
let queue: Promise<unknown> = Promise.resolve();
let lastStarted = 0;
export async function hostedFetch(input: RequestInfo | URL, init?: RequestInit) {
 if(import.meta.env?.MODE!=='aws')return fetch(input,init);
 const request=queue.then(async()=>{
  await loadSecurity();const token=await window.AwsWafIntegration!.getToken();
  const wait = Math.max(0, lastStarted + 1100 - Date.now());
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const headers=new Headers(init?.headers);headers.set('x-aws-waf-token',token);
  lastStarted = Date.now();
  // Never replay a possibly committed mutation after an edge/network failure.
  return fetch(input,{...init,headers});
 });
 queue=request.then(()=>undefined,()=>undefined);return request;
}
