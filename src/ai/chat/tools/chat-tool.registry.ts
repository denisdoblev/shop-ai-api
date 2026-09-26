import { Injectable } from '@nestjs/common';
import { ChatTool } from './chat-tool';
import { GetCurrentProductTool } from './get-current-product.tool';
import { RetrieveCurrentProductDocumentationTool } from './retrieve-current-product-documentation.tool';

@Injectable()
export class ChatToolRegistry {
  private readonly tools: Map<string, ChatTool>;

  constructor(
    getCurrentProduct: GetCurrentProductTool,
    retrieveDocumentation: RetrieveCurrentProductDocumentationTool,
  ) {
    this.tools = new Map<string, ChatTool>([
      [getCurrentProduct.definition.name, getCurrentProduct],
      [retrieveDocumentation.definition.name, retrieveDocumentation],
    ]);
  }

  definitions() {
    return [...this.tools.values()].map((tool) => tool.definition);
  }
  get(name: string): ChatTool | undefined {
    return this.tools.get(name);
  }
}
