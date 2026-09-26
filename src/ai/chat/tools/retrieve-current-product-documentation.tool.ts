import { Injectable } from '@nestjs/common';
import { RagEvidenceService } from '../../rag/rag-evidence.service';
import { RagSource } from '../../rag/rag.service';
import { ChatTool, ChatToolResult, ToolExecutionContext } from './chat-tool';

@Injectable()
export class RetrieveCurrentProductDocumentationTool implements ChatTool {
  readonly definition = {
    name: 'retrieve_current_product_documentation',
    description:
      'Recupera evidencia de manuales y documentación técnica del producto actual.',
    parameters: {
      type: 'object',
      required: ['query'],
      properties: { query: { type: 'string', minLength: 1, maxLength: 1000 } },
      additionalProperties: false,
    },
  };

  constructor(private readonly evidenceService: RagEvidenceService) {}

  validate(argumentsValue: Record<string, unknown>): boolean {
    return (
      Object.keys(argumentsValue).length === 1 &&
      typeof argumentsValue.query === 'string' &&
      argumentsValue.query.trim().length > 0 &&
      argumentsValue.query.length <= 1000
    );
  }

  async execute(
    argumentsValue: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ChatToolResult> {
    const evidence = await this.evidenceService.retrieve({
      query: argumentsValue.query as string,
      productId: context.currentProductId,
    });
    const sources: RagSource[] = evidence.chunks.map((chunk) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      productId: chunk.productId,
      chunkIndex: chunk.chunkIndex,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      section: chunk.section,
    }));
    return {
      output: {
        status: evidence.status,
        evidence: evidence.chunks.map((chunk) => ({
          content: chunk.content,
          documentName: chunk.documentName,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          section: chunk.section,
        })),
      },
      sources,
    };
  }
}
