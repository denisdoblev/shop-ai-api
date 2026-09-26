import { LlmService } from '../llm/llm.service';
import { ProductsService } from '../../products/products.service';
import {
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { INSUFFICIENT_INFORMATION_ANSWER } from '../rag/grounding-prompt';
import { ChatService } from './chat.service';
import { ChatTool } from './tools/chat-tool';
import { ChatToolRegistry } from './tools/chat-tool.registry';

const productId = '2f4bbf44-43f0-4a5b-bf1b-c7d92e04e4a8';
const userId = '3f4bbf44-43f0-4a5b-bf1b-c7d92e04e4a9';

describe('ChatService', () => {
  const chatMock: jest.MockedFunction<LlmService['chat']> = jest.fn();
  const findOneMock: jest.MockedFunction<ProductsService['findOne']> =
    jest.fn();
  const executeToolMock: jest.MockedFunction<ChatTool['execute']> = jest.fn();
  const llmService = { chat: chatMock };
  const productsService = { findOne: findOneMock };
  const tool: ChatTool = {
    definition: {
      name: 'get_current_product',
      description: 'details',
      parameters: { type: 'object' },
    },
    validate: (value) => Object.keys(value).length === 0,
    execute: executeToolMock,
  };
  const registry = {
    definitions: () => [tool.definition],
    get: (name: string) => (name === tool.definition.name ? tool : undefined),
  };
  const service = new ChatService(
    llmService as unknown as LlmService,
    productsService as unknown as ProductsService,
    registry as unknown as ChatToolRegistry,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findOneMock.mockResolvedValue({ id: productId } as never);
    executeToolMock.mockResolvedValue({
      output: { latestPrice: { amount: 100, currency: 'USD' } },
      sources: [],
    });
  });

  it('validates the product, executes a requested tool and returns only the final answer', async () => {
    chatMock
      .mockResolvedValueOnce({
        model: 'qwen3:8b',
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ name: 'get_current_product', arguments: {} }],
        },
      })
      .mockResolvedValueOnce({
        model: 'qwen3:8b',
        message: { role: 'assistant', content: 'Cuesta USD 100.' },
      });

    await expect(
      service.answer({
        message: '¿Cuánto cuesta?',
        currentProductId: productId,
        userId,
      }),
    ).resolves.toEqual({
      answer: 'Cuesta USD 100.',
      sources: [],
    });
    expect(findOneMock).toHaveBeenCalledWith(productId);
    expect(executeToolMock).toHaveBeenCalledWith(
      {},
      { currentProductId: productId },
    );
    expect(chatMock.mock.calls[1]?.[0].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'tool',
          toolName: 'get_current_product',
        }),
      ]),
    );
  });

  it('returns an invalid_arguments result and still requires a valid tool', async () => {
    chatMock
      .mockResolvedValueOnce({
        model: 'qwen3:8b',
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ name: 'unknown', arguments: {} }],
        },
      })
      .mockResolvedValueOnce({
        model: 'qwen3:8b',
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ name: 'get_current_product', arguments: {} }],
        },
      })
      .mockResolvedValueOnce({
        model: 'qwen3:8b',
        message: { role: 'assistant', content: 'Cuesta USD 100.' },
      });

    await service.answer({
      message: 'Pregunta',
      currentProductId: productId,
      userId,
    });
    const messages = chatMock.mock.calls[1]?.[0].messages;
    expect(
      messages.find(
        (message) =>
          message.role === 'tool' &&
          message.content.includes('invalid_arguments'),
      ),
    ).toMatchObject({
      role: 'tool',
      content: JSON.stringify({
        ok: false,
        error: { code: 'invalid_arguments' },
      }),
    });
    expect(executeToolMock).toHaveBeenCalledTimes(1);
  });

  it('retries a nontrivial answer that skipped tools and rejects a second omission', async () => {
    chatMock.mockResolvedValue({
      model: 'qwen3:8b',
      message: { role: 'assistant', content: 'Cuesta USD 999.' },
    });

    await expect(
      service.answer({
        message: '¿Cuánto cuesta?',
        currentProductId: productId,
        userId,
      }),
    ).rejects.toThrow(new ServiceUnavailableException('tool_required'));
    expect(chatMock).toHaveBeenCalledTimes(2);
    const retryMessage = chatMock.mock.calls[1]?.[0].messages.at(-1);
    expect(retryMessage?.role).toBe('system');
    expect(retryMessage?.content).toContain(
      'consultá al menos una herramienta',
    );
  });

  it('allows a greeting without tools', async () => {
    chatMock.mockResolvedValue({
      model: 'qwen3:8b',
      message: { role: 'assistant', content: '¡Hola! ¿En qué te ayudo?' },
    });

    await expect(
      service.answer({ message: 'Hola!', currentProductId: productId, userId }),
    ).resolves.toEqual({
      answer: '¡Hola! ¿En qué te ayudo?',
      sources: [],
    });
    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  it('removes consulted sources from the canonical insufficiency answer', async () => {
    executeToolMock.mockResolvedValue({
      output: { status: 'evidence_found' },
      sources: [
        {
          chunkId: 'chunk-1',
          documentId: 'document-1',
          documentName: 'Manual',
          productId,
          chunkIndex: 0,
          pageStart: 1,
          pageEnd: 1,
          section: null,
        },
      ],
    });
    chatMock
      .mockResolvedValueOnce({
        model: 'qwen3:8b',
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ name: 'get_current_product', arguments: {} }],
        },
      })
      .mockResolvedValueOnce({
        model: 'qwen3:8b',
        message: {
          role: 'assistant',
          content: INSUFFICIENT_INFORMATION_ANSWER,
        },
      });

    await expect(
      service.answer({
        message: 'Pregunta',
        currentProductId: productId,
        userId,
      }),
    ).resolves.toEqual({
      answer: INSUFFICIENT_INFORMATION_ANSWER,
      sources: [],
    });
  });

  it('allows only one concurrent request per user', async () => {
    let resolveChat!: (value: Awaited<ReturnType<LlmService['chat']>>) => void;
    chatMock.mockReturnValue(
      new Promise((resolve) => {
        resolveChat = resolve;
      }),
    );
    const first = service.answer({
      message: 'Hola',
      currentProductId: productId,
      userId,
    });

    await expect(
      service.answer({
        message: 'Hola',
        currentProductId: productId,
        userId,
      }),
    ).rejects.toMatchObject({ status: 429 });
    resolveChat({
      model: 'qwen3:8b',
      message: { role: 'assistant', content: 'Hola' },
    });
    await expect(first).resolves.toEqual({ answer: 'Hola', sources: [] });
  });

  it('limits total concurrent requests in the API process', async () => {
    const resolvers: Array<
      (value: Awaited<ReturnType<LlmService['chat']>>) => void
    > = [];
    chatMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const active = Array.from({ length: 4 }, (_, index) =>
      service.answer({
        message: 'Hola',
        currentProductId: productId,
        userId: `user-${index}`,
      }),
    );

    await expect(
      service.answer({
        message: 'Hola',
        currentProductId: productId,
        userId: 'user-over-limit',
      }),
    ).rejects.toMatchObject({ status: 429 });
    resolvers.forEach((resolve) =>
      resolve({
        model: 'qwen3:8b',
        message: { role: 'assistant', content: 'Hola' },
      }),
    );
    await expect(Promise.all(active)).resolves.toHaveLength(4);
  });

  it('enforces a deadline across the complete operation', async () => {
    jest.useFakeTimers();
    chatMock.mockReturnValue(new Promise(() => undefined));
    const answer = service.answer({
      message: 'Hola',
      currentProductId: productId,
      userId: 'deadline-user',
    });
    const expectation = expect(answer).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );

    await jest.advanceTimersByTimeAsync(150_000);
    await expectation;
    jest.useRealTimers();
  });
});
