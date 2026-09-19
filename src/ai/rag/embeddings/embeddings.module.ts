import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  EMBEDDING_PROVIDER,
  EmbeddingProvider,
} from './embedding-provider.interface';
import { EmbeddingsService } from './embeddings.service';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider';

export function embeddingProviderFactory(
  configService: ConfigService,
): EmbeddingProvider {
  const provider = configService.get<string>('EMBEDDINGS_PROVIDER', 'ollama');

  switch (provider) {
    case 'ollama':
      return new OllamaEmbeddingProvider({
        baseUrl: configService.get<string>(
          'OLLAMA_BASE_URL',
          'http://localhost:11434',
        ),
        model: configService.get<string>(
          'OLLAMA_EMBEDDING_MODEL',
          'embeddinggemma',
        ),
        timeoutMs: configService.get<number>(
          'OLLAMA_EMBEDDING_TIMEOUT_MS',
          30_000,
        ),
      });
  }

  throw new Error(`Unsupported embedding provider: ${provider}`);
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMBEDDING_PROVIDER,
      inject: [ConfigService],
      useFactory: embeddingProviderFactory,
    },
    EmbeddingsService,
  ],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
