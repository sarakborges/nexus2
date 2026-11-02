import react from '@vitejs/plugin-react'
import { URL, fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const appDirectory = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, appDirectory, '')
  const defaultProxyTarget = mode === 'production-bff'
    ? 'https://nexus2-yoggsaras-projects.vercel.app'
    : 'http://localhost:3001'
  const proxyTarget = env.BFF_PROXY_TARGET || defaultProxyTarget

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true
        }
      }
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
    }
  }
})
