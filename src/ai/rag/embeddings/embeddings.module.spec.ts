import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  EMBEDDING_PROVIDER,
  EmbeddingProvider,
} from './embedding-provider.interface';
import { EmbeddingsModule } from './embeddings.module';
import { EmbeddingsService } from './embeddings.service';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider';

describe('EmbeddingsModule', () => {
  it('selects Ollama through the provider token and exports the service', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ EMBEDDINGS_PROVIDER: 'ollama' })],
        }),
        EmbeddingsModule,
      ],
    }).compile();

    const provider = module.get<EmbeddingProvider>(EMBEDDING_PROVIDER);
    expect(provider).toBeInstanceOf(OllamaEmbeddingProvider);
    expect(module.get(EmbeddingsService)).toBeDefined();

    await module.close();
  });
});
