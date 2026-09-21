import { Injectable } from '@nestjs/common';

export interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export interface ChunkingPage {
  pageNumber: number;
  text: string;
}

export interface TextChunk {
  content: string;
  pageNumber: number;
}

@Injectable()
export class ChunkingService {
  chunk(pages: ChunkingPage[], options: ChunkingOptions): TextChunk[] {
    this.validateOptions(options);

    const chunks = pages.flatMap(({ pageNumber, text }) =>
      this.chunkPage(text, options).map((content) => ({ content, pageNumber })),
    );

    if (chunks.length === 0) {
      throw new RangeError('PDF does not contain extractable text');
    }

    return chunks;
  }

  private validateOptions({ chunkSize, chunkOverlap }: ChunkingOptions): void {
    if (!Number.isInteger(chunkSize) || chunkSize < 200 || chunkSize > 4_000) {
      throw new RangeError('chunkSize must be an integer between 200 and 4000');
    }
    if (
      !Number.isInteger(chunkOverlap) ||
      chunkOverlap < 0 ||
      chunkOverlap >= chunkSize
    ) {
      throw new RangeError(
        'chunkOverlap must be a non-negative integer smaller than chunkSize',
      );
    }
  }

  private chunkPage(text: string, options: ChunkingOptions): string[] {
    const normalized = this.normalize(text);
    if (normalized.length === 0) return [];

    const units = normalized
      .split(/\n{2,}/u)
      .flatMap((paragraph) =>
        this.splitParagraph(paragraph, options.chunkSize),
      );
    const chunks: string[] = [];
    let current = '';

    for (const unit of units) {
      const separator = current.length === 0 ? '' : '\n\n';
      if (
        current.length + separator.length + unit.length <=
        options.chunkSize
      ) {
        current += `${separator}${unit}`;
        continue;
      }

      if (current.length > 0) chunks.push(current);
      const overlap = this.wordBoundedTail(current, options.chunkOverlap);
      const availableOverlap = Math.max(
        0,
        options.chunkSize - unit.length - (unit.length === 0 ? 0 : 1),
      );
      const boundedOverlap = this.wordBoundedTail(overlap, availableOverlap);
      current = boundedOverlap ? `${boundedOverlap} ${unit}` : unit;
    }

    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  private normalize(text: string): string {
    return text
      .replace(/\r\n?/gu, '\n')
      .split('\n')
      .map((line) => line.replace(/[\t ]+/gu, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/gu, '\n\n')
      .trim();
  }

  private splitParagraph(paragraph: string, maxLength: number): string[] {
    const normalized = paragraph.replace(/\s*\n\s*/gu, ' ').trim();
    if (normalized.length <= maxLength) return normalized ? [normalized] : [];

    const sentences = normalized.match(/[^.!?]+(?:[.!?]+|$)/gu) ?? [normalized];
    return this.packUnits(
      sentences.map((sentence) => sentence.trim()).filter(Boolean),
      maxLength,
    );
  }

  private packUnits(units: string[], maxLength: number): string[] {
    const result: string[] = [];
    let current = '';

    for (const unit of units) {
      if (unit.length > maxLength) {
        if (current) result.push(current);
        current = '';
        result.push(...this.splitWords(unit, maxLength));
        continue;
      }

      if (!current) {
        current = unit;
      } else if (current.length + 1 + unit.length <= maxLength) {
        current += ` ${unit}`;
      } else {
        result.push(current);
        current = unit;
      }
    }

    if (current) result.push(current);
    return result;
  }

  private splitWords(text: string, maxLength: number): string[] {
    const result: string[] = [];
    let current = '';

    for (const word of text.split(/\s+/u)) {
      if (word.length > maxLength) {
        if (current) result.push(current);
        current = '';
        for (let offset = 0; offset < word.length; offset += maxLength) {
          result.push(word.slice(offset, offset + maxLength));
        }
      } else if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= maxLength) {
        current += ` ${word}`;
      } else {
        result.push(current);
        current = word;
      }
    }

    if (current) result.push(current);
    return result;
  }

  private wordBoundedTail(text: string, maximumLength: number): string {
    if (maximumLength <= 0 || text.length === 0) return '';
    if (text.length <= maximumLength) return text.trim();

    const tail = text.slice(text.length - maximumLength);
    const firstWhitespace = tail.search(/\s/u);
    return firstWhitespace < 0 ? '' : tail.slice(firstWhitespace + 1).trim();
  }
}
