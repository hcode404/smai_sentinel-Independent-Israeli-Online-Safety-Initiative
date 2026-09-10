import {mkdirSync} from 'node:fs';
import {localDatabase} from './local-db.mjs';
import {api} from '../server/index.js';
export function devAPI(){return {name:'sentinel-local-api',configureServer(server){
  mkdirSync('.local',{recursive:true});const DB=localDatabase('.local/sentinel.sqlite');
  server.httpServer?.on('close',()=>DB.close());
  server.middlewares.use(async(req,res,next)=>{
    if(!req.url.startsWith('/api/'))return next();
    const buffers=[];for await(const chunk of req)buffers.push(chunk);
    const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
    // Local-only identity; never bundled into the production Worker.
    headers.set('oai-authenticated-user-id','local_seedy');headers.set('oai-authenticated-user-email','seedy@sites.test');
    const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(buffers)}:{})});
    const response=await api(request,{DB,ADMIN_EMAILS:'seedy@sites.test',GEMINI_API_KEY:process.env.GEMINI_API_KEY,GEMINI_MODEL:process.env.GEMINI_MODEL});
    res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));
  });
}};}
