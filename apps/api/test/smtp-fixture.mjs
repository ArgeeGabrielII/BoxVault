// Disposable CI-only SMTP sink. Never use with real user email or tokens.
import net from 'node:net';
import fs from 'node:fs';
const path=process.env.BOXVAULT_TEST_MAIL_FILE || '/tmp/boxvault-mail-ci.txt';
fs.writeFileSync(path, '');
net.createServer(socket => {
  let pending='', body='', dataMode=false;
  socket.write('220 boxvault-ci ESMTP\r\n');
  socket.on('data',chunk=>{
    pending += chunk.toString('utf8');
    while(pending.includes('\r\n')){
      const i=pending.indexOf('\r\n');
      const line=pending.slice(0,i);
      pending=pending.slice(i+2);
      if(dataMode){
        if(line==='.'){
          fs.appendFileSync(path, body + '\n---END-MAIL---\n');
          body='';dataMode=false;socket.write('250 queued\r\n');
        } else body+=line+'\n';
      } else {
        const cmd=line.toUpperCase();
        if(cmd.startsWith('EHLO')) socket.write('250-boxvault-ci\r\n250 SIZE 1000000\r\n');
        else if(cmd.startsWith('HELO')||cmd.startsWith('MAIL FROM')||
                cmd.startsWith('RCPT TO')||cmd.startsWith('RSET')) socket.write('250 ok\r\n');
        else if(cmd==='DATA'){dataMode=true;socket.write('354 send message\r\n');}
        else if(cmd==='QUIT'){socket.write('221 bye\r\n');socket.end();}
        else socket.write('502 unsupported\r\n');
      }
    }
  });
}).listen(2525,'127.0.0.1');
