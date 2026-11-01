export function getBackendUrl(): string {
  const configuredUrl = process.env.BACKEND_URL?.trim()
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '')

  const boundServiceUrl = process.env.BACKEND_SERVICE_URL?.trim()
  if (boundServiceUrl) return `${boundServiceUrl.replace(/\/+$/, '')}/api`

  return 'http://localhost:3002/api'
}
