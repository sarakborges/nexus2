import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { DataRepository } from './repository.interface'
import { DATA_REPOSITORY } from './repository.interface'
import { JsonFileRepository } from './json-file.repository'
import { SupabaseRestRepository } from './supabase-rest.repository'

@Global()
@Module({
  providers: [
    {
      provide: DATA_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DataRepository => {
        const projectUrl = config.get<string>('SUPABASE_URL')
        const serviceRoleKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY')

        if (projectUrl && serviceRoleKey) {
          return new SupabaseRestRepository(projectUrl, serviceRoleKey)
        }

        if (projectUrl || serviceRoleKey) {
          throw new Error('Both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.')
        }

        if (config.get<string>('VERCEL')) {
          throw new Error('Supabase persistence is required on Vercel. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend service.')
        }

        return new JsonFileRepository()
      }
    }
  ],
  exports: [DATA_REPOSITORY]
})
export class StorageModule {}
