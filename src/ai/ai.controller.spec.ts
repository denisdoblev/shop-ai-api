import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { RagService, RagAnswer } from './rag/rag.service';

describe('AiController', () => {
  let controller: AiController;
  const ragService: {
    answer: jest.MockedFunction<RagService['answer']>;
  } = { answer: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: RagService, useValue: ragService }],
    }).compile();

    controller = module.get(AiController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates the exact public input and returns the RAG result unchanged', async () => {
    const result: RagAnswer = {
      answer: 'Sí.',
      sources: [
        {
          chunkId: '36972d36-29c5-40b1-9243-ae29f829efc7',
          documentId: '0e51dbad-9c06-4975-9492-cb5fb6229558',
          documentName: 'Manual.pdf',
          productId: '2f4bbf44-43f0-4a5b-bf1b-c7d92e04e4a8',
          chunkIndex: 0,
          pageStart: 4,
          pageEnd: 4,
          section: null,
        },
      ],
    };
    ragService.answer.mockResolvedValue(result);

    await expect(
      controller.ask({
        productId: '2f4bbf44-43f0-4a5b-bf1b-c7d92e04e4a8',
        question: '  ¿Tiene cancelación de ruido?  ',
      }),
    ).resolves.toBe(result);
    expect(ragService.answer).toHaveBeenCalledWith({
      productId: '2f4bbf44-43f0-4a5b-bf1b-c7d92e04e4a8',
      question: '  ¿Tiene cancelación de ruido?  ',
    });
  });

  it('propagates service failures', async () => {
    const error = new Error('failed');
    ragService.answer.mockRejectedValue(error);

    await expect(
      controller.ask({
        productId: '2f4bbf44-43f0-4a5b-bf1b-c7d92e04e4a8',
        question: 'Question',
      }),
    ).rejects.toBe(error);
  });
});
