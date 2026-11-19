import { useEffect, useRef, useState } from 'react';
import { loadSecurity } from './waf-api';
export function WafVerification() {
 const container=useRef<HTMLDivElement>(null);const [status,setStatus]=useState('Loading the security check…');
 useEffect(()=>{let active=true;void loadSecurity().then(config=>{
  if(!active || !container.current)return;
  setStatus('Complete the security check before continuing.');
  window.AwsWafCaptcha!.renderCaptcha(container.current,{apiKey:config.apiKey,onSuccess:()=>{if(active)setStatus('Security check complete. You can continue.');},onError:()=>{if(active)setStatus('The security check is unavailable. Refresh this page and try again.');}});
 }).catch(()=>{if(active)setStatus('The security check is unavailable. Refresh this page and try again.');});return()=>{active=false;};},[]);
 return <section aria-label="Security verification"><p role="status" className="muted">{status}</p><div ref={container}/></section>;
}
