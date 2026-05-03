import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/hunyuan': {
        target: 'https://hunyuan.tencentcloudapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hunyuan/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});