import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export async function readMailbox(path, origin) {
 let text; try { text = await readFile(path,'utf8'); } catch (error) { if (error.code==='ENOENT') return []; throw error; }
 // Local test server writes standard Nodemailer text mail; decode soft wraps.
 return text.split('---END-MAIL---').filter(part=>part.trim()).slice(-30).reverse().map(part=>{
  const decoded=part.replace(/=\r?\n/g,'').replace(/=3D/gi,'=');
  const candidate=decoded.match(/https?:\/\/[^\s<>]+\/(?:verify-email|reset-password|accept-invitation)#token=[A-Za-z0-9_-]{43}/)?.[0];
  let link=null; if(candidate){ const url=new URL(candidate); if(url.origin===origin)link=url.toString(); }
  return {id:createHash('sha256').update(part).digest('hex').slice(0,16),to:decoded.match(/^To:\s*(.+)$/im)?.[1]?.trim()??'Local account',subject:decoded.match(/^Subject:\s*(.+)$/im)?.[1]?.trim()??'BoxVault account message',link};
 });
}
