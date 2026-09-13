import app from './index.js';
import document from '../dist/client/index.html';

// The application owns its document route; ASSETS serves fingerprinted JS/CSS.
export default {fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  const documentRoute=!path.startsWith('/api/')&&!path.startsWith('/assets/')&&!/\.[a-z0-9]+$/i.test(path);
  if(documentRoute||path==='/index.html'){
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    return new Response(request.method==='HEAD'?null:document,{headers:{
      'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'
    }});
  }
  return app.fetch(request,env,ctx);
}};
