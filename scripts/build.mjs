import {build as viteBuild} from 'vite';
import {build} from 'esbuild';
await viteBuild();
await build({entryPoints:['server/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
