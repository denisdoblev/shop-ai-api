import { BadRequestException } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

describe('IngestionController', () => {
  const ingestionService = { ingestPdf: jest.fn() };
  const controller = new IngestionController(
    ingestionService as unknown as IngestionService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delegates an uploaded file and validated options', async () => {
    const file = { originalname: 'manual.pdf' } as Express.Multer.File;
    const options = { chunkSize: 400, chunkOverlap: 80 };
    ingestionService.ingestPdf.mockResolvedValue({ id: 'document-id' });

    await controller.create('product-id', file, options);

    expect(ingestionService.ingestPdf).toHaveBeenCalledWith(
      'product-id',
      file,
      options,
    );
  });

  it('rejects a missing file before delegation', () => {
    expect(() =>
      controller.create('product-id', undefined, {
        chunkSize: 400,
        chunkOverlap: 80,
      }),
    ).toThrow(BadRequestException);
    expect(ingestionService.ingestPdf).not.toHaveBeenCalled();
  });
});
