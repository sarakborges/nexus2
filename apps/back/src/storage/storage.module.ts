import { Global, Module } from '@nestjs/common'
import { JsonFileRepository } from './json-file.repository'
import { DATA_REPOSITORY } from './repository.interface'

@Global()
@Module({
  providers: [JsonFileRepository, { provide: DATA_REPOSITORY, useExisting: JsonFileRepository }],
  exports: [DATA_REPOSITORY]
})
export class StorageModule {}
