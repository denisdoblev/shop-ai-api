import { CHAT_SYSTEM_PROMPT } from '../src/ai/chat/chat-prompt';
import {
  LlmMessage,
  LlmToolDefinition,
} from '../src/ai/llm/llm-provider.interface';
import { OllamaLlmProvider } from '../src/ai/llm/ollama-llm.provider';

const BASE_URL = 'http://localhost:11434';
const MODEL = 'qwen3:8b';
const ALLOWED_TOOLS = new Set([
  'get_current_product',
  'retrieve_current_product_documentation',
]);
const TOOLS: LlmToolDefinition[] = [
  {
    name: 'get_current_product',
    description:
      'Obtiene precio, marca, modelo, categoría y especificaciones estructuradas del producto actual.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'retrieve_current_product_documentation',
    description:
      'Recupera evidencia del manual y documentación técnica del producto actual.',
    parameters: {
      type: 'object',
      required: ['query'],
      properties: { query: { type: 'string', minLength: 1, maxLength: 1000 } },
      additionalProperties: false,
    },
  },
];

describe('Ollama tool calling integration', () => {
  jest.setTimeout(180_000);
  const provider = new OllamaLlmProvider({
    baseUrl: BASE_URL,
    model: MODEL,
    timeoutMs: 120_000,
  });

  beforeAll(async () => {
    const response = await fetch(new URL('/api/tags', BASE_URL));
    if (!response.ok)
      throw new Error(`Ollama preflight returned HTTP ${response.status}`);
    const payload = (await response.json()) as {
      models?: Array<{ name?: string }>;
    };
    if (
      !payload.models?.some(
        ({ name }) => name === MODEL || name?.startsWith(`${MODEL}:`),
      )
    ) {
      throw new Error(`Ollama preflight requires the ${MODEL} model`);
    }
  });

  it.each([
    ['price', '¿Cuál es el precio actual?', ['get_current_product']],
    [
      'documentation',
      '¿Cómo silencio el micrófono con un botón físico?',
      ['retrieve_current_product_documentation'],
    ],
    [
      'combined',
      '¿Vale la pena por este precio y cómo activo mute rápido?',
      ['get_current_product', 'retrieve_current_product_documentation'],
    ],
  ])(
    'selects valid tools and completes a final answer for %s',
    async (_scenario, question, expectedTools) => {
      const messages: LlmMessage[] = [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        { role: 'user', content: question },
      ];
      const selection = await provider.chat({ messages, tools: TOOLS });
      const calls = selection.message.toolCalls ?? [];
      expect(calls.map(({ name }) => name).sort()).toEqual(
        [...expectedTools].sort(),
      );
      calls.forEach((call) => {
        expect(ALLOWED_TOOLS.has(call.name)).toBe(true);
        expect(call.arguments).not.toBeNull();
        expect(Array.isArray(call.arguments)).toBe(false);
      });

      messages.push(selection.message);
      calls.forEach((call) =>
        messages.push({
          role: 'tool',
          toolName: call.name,
          content:
            call.name === 'get_current_product'
              ? JSON.stringify({
                  name: 'Conference Headset',
                  latestPrice: { amount: 299.99, currency: 'USD' },
                })
              : JSON.stringify({
                  status: 'evidence_found',
                  evidence: [
                    { content: 'El botón físico mute silencia el micrófono.' },
                  ],
                }),
        }),
      );
      const final = await provider.chat({ messages, tools: TOOLS });
      expect(final.message.content.trim().length).toBeGreaterThan(0);
      expect(final.message.toolCalls ?? []).toHaveLength(0);
    },
  );
});
