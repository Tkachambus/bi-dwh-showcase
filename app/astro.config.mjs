import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import node from '@astrojs/node';

const isStatic = process.env.STATIC_SNAPSHOT === '1';
const base = process.env.BASE_PATH || undefined;

export default defineConfig({
  integrations: [svelte()],
  output: isStatic ? 'static' : 'server',
  adapter: isStatic ? undefined : node({ mode: 'standalone' }),
  base,
});
