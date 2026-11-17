import react from '@vitejs/plugin-react'
import { URL, fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const appDirectory = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, appDirectory, '')
  const defaultProxyTarget =
    mode === 'production-bff'
      ? 'https://nexus2-yoggsaras-projects.vercel.app'
      : 'http://localhost:3001'
  const configuredProxyTarget = env.BFF_PROXY_TARGET?.trim()
  const isLoopbackProxyTarget = (target: string): boolean => {
    try {
      const hostname = new URL(target).hostname.toLowerCase()
      return (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '[::1]'
      )
    } catch {
      return false
    }
  }
  const useProductionFallback =
    mode === 'production-bff' &&
    configuredProxyTarget !== undefined &&
    isLoopbackProxyTarget(configuredProxyTarget)
  const proxyTarget = useProductionFallback
    ? defaultProxyTarget
    : configuredProxyTarget || defaultProxyTarget

  if (useProductionFallback) {
    console.warn(
      '[vite] Ignoring a loopback BFF_PROXY_TARGET in production-bff mode; using the production BFF.'
    )
  }

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
