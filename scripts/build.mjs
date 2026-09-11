import {build as viteBuild} from 'vite';
import {build} from 'esbuild';
import {mkdir,rename,cp} from 'node:fs/promises';
await viteBuild();
// Sites Worker deployments serve public assets from dist/client.
await mkdir('dist/client',{recursive:true});
await rename('dist/index.html','dist/client/index.html');
await rename('dist/assets','dist/client/assets');
await cp('public','dist/client',{recursive:true});
await build({entryPoints:['server/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',loader:{'.html':'text'}});
