import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { DataRepository } from './repository.interface'
import { DATA_REPOSITORY } from './repository.interface'
import { JsonFileRepository } from './json-file.repository'
import { SupabaseRelationalRepository } from './supabase-relational.repository'

@Global()
@Module({
  providers: [
    {
      provide: DATA_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DataRepository => {
        const projectUrl = config.get<string>('SUPABASE_URL')
        const publishableKey = config.get<string>('SUPABASE_PUBLISHABLE_KEY')
        const apiSecret = config.get<string>('SUPABASE_API_SECRET')

        const configured = [projectUrl, publishableKey, apiSecret].filter(Boolean).length
        if (configured === 3) {
          return new SupabaseRelationalRepository(projectUrl!, publishableKey!, apiSecret!)
        }

        if (configured > 0) {
          throw new Error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_API_SECRET must be configured together.')
        }

        if (config.get<string>('VERCEL')) {
          throw new Error('Persistent Supabase storage is required on Vercel. Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_API_SECRET.')
        }

        return new JsonFileRepository()
      }
    }
  ],
  exports: [DATA_REPOSITORY]
})
export class StorageModule {}
