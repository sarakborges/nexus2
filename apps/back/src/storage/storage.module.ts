import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { DataRepository } from './repository.interface'
import { DATA_REPOSITORY } from './repository.interface'
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

        if (!projectUrl || !publishableKey || !apiSecret) {
          throw new Error(
            'Relational Supabase storage is required in every environment. Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_API_SECRET.'
          )
        }

        return new SupabaseRelationalRepository(projectUrl, publishableKey, apiSecret)
      }
    }
  ],
  exports: [DATA_REPOSITORY]
})
export class StorageModule {}
