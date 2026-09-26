import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { LlmModule } from '../llm/llm.module';
import { ProductsModule } from '../../products/products.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatToolRegistry } from './tools/chat-tool.registry';
import { GetCurrentProductTool } from './tools/get-current-product.tool';
import { RetrieveCurrentProductDocumentationTool } from './tools/retrieve-current-product-documentation.tool';

@Module({
  imports: [LlmModule, ProductsModule, RagModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatToolRegistry,
    GetCurrentProductTool,
    RetrieveCurrentProductDocumentationTool,
  ],
})
export class ChatModule {}
