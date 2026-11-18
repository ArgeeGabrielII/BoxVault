import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
// @ts-ignore Node-only local development plugin; never imported by client code.
import { localServices } from '../../scripts/local-web-plugin.mjs';
const apiOrigin=process.env.BOXVAULT_LOCAL_API_ORIGIN || 'http://127.0.0.1:4380';
if(new URL(apiOrigin).hostname!=='127.0.0.1' || new URL(apiOrigin).protocol!=='http:')throw Error('Connected local API must use literal loopback');
export default defineConfig({
 root:fileURLToPath(new URL('./connected',import.meta.url)),
 plugins:[react(),localServices()],
 publicDir:fileURLToPath(new URL('./public',import.meta.url)),
 server:{host:'127.0.0.1',port:Number(process.env.BOXVAULT_LOCAL_WEB_PORT || 5180),strictPort:true,fs:{deny:['.env','.env.*','**/*.{crt,pem}','**/.git/**','**/.boxvault-local/**',...(process.env.BOXVAULT_LOCAL_STATE?[process.env.BOXVAULT_LOCAL_STATE+'/**']:[])]},allowedHosts:['localhost','127.0.0.1'],proxy:{'/api':{target:apiOrigin,changeOrigin:false}}},
 build:{outDir:fileURLToPath(new URL('./dist-connected',import.meta.url)),emptyOutDir:true},
});
