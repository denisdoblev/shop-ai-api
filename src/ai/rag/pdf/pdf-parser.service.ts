import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PDF_PARSER_ADAPTER } from './pdf-parser.adapter';
import type { PdfParserAdapter } from './pdf-parser.adapter';

export interface ParsedPdfPage {
  pageNumber: number;
  text: string;
}

@Injectable()
export class PdfParserService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(PDF_PARSER_ADAPTER)
    private readonly adapter: PdfParserAdapter,
  ) {}

  async parse(data: Uint8Array): Promise<ParsedPdfPage[]> {
    let document: Awaited<ReturnType<PdfParserAdapter['open']>> | undefined;

    try {
      document = await this.adapter.open(data);
      const maximumPages = this.configService.get<number>(
        'RAG_PDF_MAX_PAGES',
        500,
      );
      if (document.numPages > maximumPages) {
        throw new BadRequestException(
          `PDF exceeds the maximum of ${maximumPages} pages`,
        );
      }

      const { totalPages, text } = await this.adapter.extract(document);
      if (totalPages !== document.numPages || text.length !== totalPages) {
        throw new BadRequestException('PDF parser returned inconsistent pages');
      }

      return text.map((pageText, index) => ({
        pageNumber: index + 1,
        text: pageText,
      }));
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('The uploaded PDF is invalid or corrupt');
    } finally {
      if (document) await document.loadingTask.destroy();
    }
  }
}
