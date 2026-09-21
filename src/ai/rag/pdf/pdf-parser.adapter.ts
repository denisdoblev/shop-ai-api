import { extractText, getDocumentProxy } from 'unpdf';

export type PdfDocumentProxy = Awaited<ReturnType<typeof getDocumentProxy>>;

export interface PdfParserAdapter {
  open(data: Uint8Array): Promise<PdfDocumentProxy>;
  extract(document: PdfDocumentProxy): Promise<{
    totalPages: number;
    text: string[];
  }>;
}

export const PDF_PARSER_ADAPTER = Symbol('PDF_PARSER_ADAPTER');

export const unpdfParserAdapter: PdfParserAdapter = {
  open: (data) => getDocumentProxy(data),
  extract: (document) => extractText(document, { mergePages: false }),
};
