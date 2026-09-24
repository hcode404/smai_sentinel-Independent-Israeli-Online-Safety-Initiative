import {build as viteBuild} from 'vite';
import {build} from 'esbuild';
import {mkdir,rename,cp,copyFile} from 'node:fs/promises';
await viteBuild();
// Sites Worker deployments serve public assets from dist/client.
await mkdir('dist/client',{recursive:true});
await rename('dist/index.html','dist/client/index.html');
await rename('dist/assets','dist/client/assets');
await cp('public','dist/client',{recursive:true});
// GitHub Pages serves this file for clean SPA routes such as /login and /admin.
await copyFile('dist/client/index.html','dist/client/404.html');
await build({entryPoints:['server/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',external:['node:tls'],loader:{'.html':'text'}});
