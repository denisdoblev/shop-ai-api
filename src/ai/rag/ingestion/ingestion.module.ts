import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../../products/entities/product.entity';
import { ChunkingModule } from '../chunking/chunking.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { RagChunk } from '../entities/rag-chunk.entity';
import { RagDocument } from '../entities/rag-document.entity';
import { PdfModule } from '../pdf/pdf.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Product, RagDocument, RagChunk]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        limits: {
          fileSize: configService.get<number>(
            'RAG_PDF_MAX_FILE_SIZE_BYTES',
            26_214_400,
          ),
          files: 1,
        },
      }),
    }),
    PdfModule,
    ChunkingModule,
    EmbeddingsModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
