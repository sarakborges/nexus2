import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173', credentials: true })
  await app.listen(Number(process.env.PORT ?? process.env.BFF_PORT ?? 3001), '0.0.0.0')
}
void bootstrap()
