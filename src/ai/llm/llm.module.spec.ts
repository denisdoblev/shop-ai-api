import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { LLM_PROVIDER, LlmProvider } from './llm-provider.interface';
import { LlmModule } from './llm.module';
import { LlmService } from './llm.service';
import { OllamaLlmProvider } from './ollama-llm.provider';

describe('LlmModule', () => {
  it('selects Ollama through the LLM token and exports the service', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [
            () => ({
              LLM_PROVIDER: 'ollama',
              OLLAMA_EMBEDDING_MODEL: 'embeddinggemma',
              OLLAMA_LLM_MODEL: 'qwen3:8b',
            }),
          ],
        }),
        LlmModule,
      ],
    }).compile();

    expect(module.get<LlmProvider>(LLM_PROVIDER)).toBeInstanceOf(
      OllamaLlmProvider,
    );
    expect(module.get<LlmProvider>(LLM_PROVIDER)).toHaveProperty(
      'options.model',
      'qwen3:8b',
    );
    expect(module.get(LlmService)).toBeDefined();

    await module.close();
  });
});
