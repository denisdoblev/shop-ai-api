import { Injectable } from '@nestjs/common';
import {
  ProductCatalogDetails,
  ProductsService,
} from '../../../products/products.service';
import { ChatTool, ChatToolResult, ToolExecutionContext } from './chat-tool';

export const MAX_CURRENT_PRODUCT_TOOL_OUTPUT_CHARS = 12_000;
const MAX_DESCRIPTION_CHARS = 4_000;
const MAX_SPECIFICATION_TEXT_CHARS = 1_000;

interface BoundedProductDetails extends ProductCatalogDetails {
  truncated: boolean;
}

@Injectable()
export class GetCurrentProductTool implements ChatTool {
  readonly definition = {
    name: 'get_current_product',
    description:
      'Obtiene precio actual, marca, modelo, categoría, descripción y especificaciones estructuradas del producto actual.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };

  constructor(private readonly productsService: ProductsService) {}

  validate(argumentsValue: Record<string, unknown>): boolean {
    return Object.keys(argumentsValue).length === 0;
  }

  async execute(
    _argumentsValue: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ChatToolResult> {
    const details = await this.productsService.findCatalogDetails(
      context.currentProductId,
    );
    return { output: { ...this.boundOutput(details) }, sources: [] };
  }

  private boundOutput(details: ProductCatalogDetails): BoundedProductDetails {
    const description = this.truncate(
      details.description,
      MAX_DESCRIPTION_CHARS,
    );
    const output: BoundedProductDetails = {
      ...details,
      description: description.value,
      specifications: [],
      truncated: description.truncated,
    };
    this.fitDescriptionToBudget(output);

    for (const specification of details.specifications) {
      const value =
        typeof specification.value === 'string'
          ? this.truncate(specification.value, MAX_SPECIFICATION_TEXT_CHARS)
          : { value: specification.value, truncated: false };
      const boundedSpecification = {
        ...specification,
        value: value.value,
      };
      const candidate = {
        ...output,
        specifications: [...output.specifications, boundedSpecification],
        truncated: output.truncated || value.truncated,
      };
      if (
        JSON.stringify(candidate).length > MAX_CURRENT_PRODUCT_TOOL_OUTPUT_CHARS
      ) {
        output.truncated = true;
        break;
      }
      output.specifications.push(boundedSpecification);
      output.truncated = candidate.truncated;
    }

    return output;
  }

  private fitDescriptionToBudget(output: BoundedProductDetails): void {
    if (
      output.description === null ||
      JSON.stringify(output).length <= MAX_CURRENT_PRODUCT_TOOL_OUTPUT_CHARS
    ) {
      return;
    }

    const description = output.description;
    let lowerBound = 0;
    let upperBound = description.length;
    while (lowerBound < upperBound) {
      const prefixLength = Math.ceil((lowerBound + upperBound) / 2);
      output.description = this.ellipsize(description, prefixLength);
      if (
        JSON.stringify(output).length <= MAX_CURRENT_PRODUCT_TOOL_OUTPUT_CHARS
      ) {
        lowerBound = prefixLength;
      } else {
        upperBound = prefixLength - 1;
      }
    }
    output.description = this.ellipsize(description, lowerBound);
    output.truncated = true;
  }

  private ellipsize(value: string, length: number): string {
    if (length <= 0) return '';
    return `${value.slice(0, length - 1)}…`;
  }

  private truncate<T extends string | null>(
    value: T,
    maxLength: number,
  ): { value: T; truncated: boolean } {
    if (value === null || value.length <= maxLength) {
      return { value, truncated: false };
    }
    return {
      value: this.ellipsize(value, maxLength) as T,
      truncated: true,
    };
  }
}
