import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PdfDocumentProxy, PdfParserAdapter } from './pdf-parser.adapter';
import { PdfParserService } from './pdf-parser.service';

describe('PdfParserService', () => {
  const destroy = jest.fn<Promise<void>, []>();
  const document = {
    numPages: 2,
    loadingTask: { destroy },
  } as unknown as PdfDocumentProxy;
  const open = jest.fn<
    ReturnType<PdfParserAdapter['open']>,
    Parameters<PdfParserAdapter['open']>
  >();
  const extract = jest.fn<
    ReturnType<PdfParserAdapter['extract']>,
    Parameters<PdfParserAdapter['extract']>
  >();
  const adapter: jest.Mocked<PdfParserAdapter> = {
    open,
    extract,
  };
  const configService = {
    get: jest.fn().mockReturnValue(500),
  };
  const service = new PdfParserService(
    configService as unknown as ConfigService,
    adapter,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    destroy.mockResolvedValue();
    open.mockResolvedValue(document);
    extract.mockResolvedValue({
      totalPages: 2,
      text: ['First page', ''],
    });
  });

  it('returns every page with one-based numbering and preserves empty pages', async () => {
    const data = new Uint8Array([1, 2, 3]);

    await expect(service.parse(data)).resolves.toEqual([
      { pageNumber: 1, text: 'First page' },
      { pageNumber: 2, text: '' },
    ]);
    expect(open).toHaveBeenCalledWith(data);
    expect(extract).toHaveBeenCalledWith(document);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid PDFs as bad requests', async () => {
    open.mockRejectedValue(new Error('Invalid PDF structure'));

    await expect(service.parse(new Uint8Array())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(destroy).not.toHaveBeenCalled();
  });

  it('enforces the page limit before extraction and destroys the proxy', async () => {
    configService.get.mockReturnValueOnce(1);

    await expect(service.parse(new Uint8Array([1]))).rejects.toThrow(
      'PDF exceeds the maximum of 1 pages',
    );
    expect(extract).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the proxy when extraction fails', async () => {
    extract.mockRejectedValue(new Error('broken stream'));

    await expect(service.parse(new Uint8Array([1]))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
