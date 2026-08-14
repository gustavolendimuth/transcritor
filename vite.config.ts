import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: 'src/client',
    build: {
      outDir: '../../dist/client',
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT ?? 5173),
      proxy: {
        '/api': 'http://localhost:3011',
      },
    },
  };
});
