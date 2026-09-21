import {
  buildGroundingPrompt,
  INSUFFICIENT_INFORMATION_ANSWER,
} from './grounding-prompt';
import { RetrievedChunk } from './retrieval/retrieval.service';

const chunk: RetrievedChunk = {
  id: 'chunk-id',
  documentId: 'document-id',
  documentName: 'Manual técnico',
  productId: 'product-id',
  content: 'El botón físico silencia el micrófono.',
  chunkIndex: 0,
  pageStart: 14,
  pageEnd: 14,
  section: null,
  metadata: {},
  similarity: 0.8,
};

describe('buildGroundingPrompt', () => {
  it('delimits ordered sources with real document and page fields', () => {
    const prompt = buildGroundingPrompt('¿Puedo silenciarlo?', [
      chunk,
      {
        ...chunk,
        id: 'second-chunk',
        documentName: 'Ficha de texto',
        pageStart: null,
        pageEnd: null,
      },
    ]);

    expect(prompt.prompt).toContain('[SOURCE 1]');
    expect(prompt.prompt).toContain('Document: Manual técnico');
    expect(prompt.prompt).toContain('Pages: 14-14');
    expect(prompt.prompt).toContain('[SOURCE 2]');
    expect(prompt.prompt).toContain('Pages: N/A');
    expect(prompt.prompt).toContain('QUESTION\n¿Puedo silenciarlo?');
    expect(prompt.prompt.indexOf('[SOURCE 1]')).toBeLessThan(
      prompt.prompt.indexOf('[SOURCE 2]'),
    );
  });

  it('instructs the model to ignore source instructions and use fallback', () => {
    const { systemPrompt } = buildGroundingPrompt('Question', [chunk]);

    expect(systemPrompt).toContain('untrusted data');
    expect(systemPrompt).toContain('Use exclusively');
    expect(systemPrompt).toContain(INSUFFICIENT_INFORMATION_ANSWER);
    expect(systemPrompt).toContain('Do not compare products');
  });

  it('requires at least one source', () => {
    expect(() => buildGroundingPrompt('Question', [])).toThrow(
      'At least one source chunk is required',
    );
  });
});
