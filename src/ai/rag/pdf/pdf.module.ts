import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PDF_PARSER_ADAPTER, unpdfParserAdapter } from './pdf-parser.adapter';
import { PdfParserService } from './pdf-parser.service';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: PDF_PARSER_ADAPTER, useValue: unpdfParserAdapter },
    PdfParserService,
  ],
  exports: [PdfParserService],
})
export class PdfModule {}
