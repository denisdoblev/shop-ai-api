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

  it('splits at 400 characters with word-bounded overlap without crossing pages', () => {
    const paragraph = (page: number, paragraphIndex: number) =>
      Array.from(
        { length: 36 },
        (_, wordIndex) =>
          `p${page}${paragraphIndex}${wordIndex.toString().padStart(3, '0')}`,
      ).join(' ');
    const pageText = (page: number) =>
      [paragraph(page, 0), paragraph(page, 1)].join('\n\n');

    const chunks = service.chunk(
      [
        { pageNumber: 1, text: pageText(1) },
        { pageNumber: 2, text: pageText(2) },
      ],
      { chunkSize: 400, chunkOverlap: 80 },
    );

    expect(chunks).toHaveLength(4);
    expect(chunks.every(({ content }) => content.length <= 400)).toBe(true);
    expect(chunks.map(({ pageNumber }) => pageNumber)).toEqual([1, 1, 2, 2]);

    for (const firstChunkIndex of [0, 2]) {
      const first = chunks[firstChunkIndex]?.content ?? '';
      const second = chunks[firstChunkIndex + 1]?.content ?? '';
      const firstWords = first.split(' ');
      const expectedOverlap = firstWords.slice(-11).join(' ');
      const overlapWithPreviousWord = firstWords.slice(-12).join(' ');

      expect(expectedOverlap.length).toBeLessThanOrEqual(80);
      expect(overlapWithPreviousWord.length).toBeGreaterThan(80);
      expect(second.startsWith(`${expectedOverlap} `)).toBe(true);
    }

    const lastPageOneWords = new Set(chunks[1]?.content.split(/\s+/u));
    const firstPageTwoWords = chunks[2]?.content.split(/\s+/u) ?? [];
    expect(firstPageTwoWords.some((word) => lastPageOneWords.has(word))).toBe(
      false,
    );
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
