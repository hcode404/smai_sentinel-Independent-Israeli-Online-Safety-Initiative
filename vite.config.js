import { defineConfig } from 'vite';
import { sites } from '@openai/sites-vite-plugin';
import {devAPI} from './scripts/dev-api.mjs';
export default defineConfig(({command})=>({plugins:[...(command==='serve'?[devAPI()]:[]),sites()],build:{outDir:'dist',target:'es2022'}}));
