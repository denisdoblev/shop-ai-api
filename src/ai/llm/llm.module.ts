import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LLM_PROVIDER, LlmProvider } from './llm-provider.interface';
import { LlmService } from './llm.service';
import { OllamaLlmProvider } from './ollama-llm.provider';

export function llmProviderFactory(configService: ConfigService): LlmProvider {
  const provider = configService.get<string>('LLM_PROVIDER', 'ollama');

  switch (provider) {
    case 'ollama':
      return new OllamaLlmProvider({
        baseUrl: configService.get<string>(
          'OLLAMA_BASE_URL',
          'http://localhost:11434',
        ),
        model: configService.get<string>('OLLAMA_LLM_MODEL', 'qwen3:8b'),
        timeoutMs: configService.get<number>('OLLAMA_LLM_TIMEOUT_MS', 120_000),
      });
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: llmProviderFactory,
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
