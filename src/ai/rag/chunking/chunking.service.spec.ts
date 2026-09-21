import { ChunkingService } from './chunking.service';

describe('ChunkingService', () => {
  const service = new ChunkingService();

  it('keeps short paragraphs together and normalizes whitespace', () => {
    const chunks = service.chunk(
      [
        {
          pageNumber: 1,
          text: ' First   paragraph.\r\n\r\nSecond paragraph. ',
        },
      ],
      { chunkSize: 200, chunkOverlap: 20 },
    );

    expect(chunks).toEqual([
      {
        pageNumber: 1,
        content: 'First paragraph.\n\nSecond paragraph.',
      },
    ]);
  });

  it('splits oversized text without exceeding the maximum', () => {
    const paragraphs = Array.from({ length: 5 }, (_, paragraph) =>
      Array.from({ length: 14 }, (_, word) => `p${paragraph}word${word}`).join(
        ' ',
      ),
    );
    const text = paragraphs.join('\n\n');
    const chunks = service.chunk([{ pageNumber: 3, text }], {
      chunkSize: 200,
      chunkOverlap: 30,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(({ content }) => content.length <= 200)).toBe(true);
    expect(chunks.every(({ pageNumber }) => pageNumber === 3)).toBe(true);
    const previousWords = new Set(chunks[0]?.content.split(/\s+/u) ?? []);
    const overlapWords = chunks[1]?.content
      .split(/\s+/u)
      .filter((word) => previousWords.has(word));
    expect(overlapWords?.length).toBeGreaterThan(0);
  });

  it('hard-cuts only a word that itself exceeds the maximum', () => {
    const chunks = service.chunk([{ pageNumber: 1, text: 'x'.repeat(450) }], {
      chunkSize: 200,
      chunkOverlap: 0,
    });

    expect(chunks.map(({ content }) => content.length)).toEqual([200, 200, 50]);
  });

  it('omits empty pages and never crosses page boundaries', () => {
    const chunks = service.chunk(
      [
        { pageNumber: 1, text: 'Page one' },
        { pageNumber: 2, text: '  \n' },
        { pageNumber: 3, text: 'Page three' },
      ],
      { chunkSize: 200, chunkOverlap: 20 },
    );

    expect(chunks).toEqual([
      { pageNumber: 1, content: 'Page one' },
      { pageNumber: 3, content: 'Page three' },
    ]);
  });

  it.each([
    { chunkSize: 199, chunkOverlap: 0 },
    { chunkSize: 4001, chunkOverlap: 0 },
    { chunkSize: 1200, chunkOverlap: -1 },
    { chunkSize: 1200, chunkOverlap: 1200 },
  ])('rejects invalid options %#', (options) => {
    expect(() =>
      service.chunk([{ pageNumber: 1, text: 'text' }], options),
    ).toThrow(RangeError);
  });

  it('rejects a document without extractable text', () => {
    expect(() =>
      service.chunk([{ pageNumber: 1, text: ' \n ' }], {
        chunkSize: 1200,
        chunkOverlap: 200,
      }),
    ).toThrow('PDF does not contain extractable text');
  });
});
