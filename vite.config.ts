import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: 'src/client',
    plugins: [react()],
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
