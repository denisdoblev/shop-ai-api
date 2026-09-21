# RAG PDF ingestion

The synchronous ingestion path accepts an administrator-uploaded PDF and keeps
the file exclusively in memory:

```text
multipart PDF → PdfParserService → ChunkingService → EmbeddingsService
              → one TypeORM transaction → rag_documents + rag_chunks
```

`PdfParserService` uses [unpdf](https://github.com/unjs/unpdf#extracttext) with
`mergePages: false`. It validates the page count before extraction, preserves
empty pages so later page numbers remain faithful to the source, and always
destroys the PDF.js loading task. OCR is not part of this pipeline.

`ChunkingService` processes pages independently. It normalizes whitespace,
prefers paragraph and sentence boundaries, falls back to word boundaries, and
hard-cuts only an individual oversized word. Overlap is selected at word
boundaries and counts toward the configured chunk size. Empty pages do not
produce chunks, and a PDF with no extractable text is rejected.

The service validates the active product and content hash first. Parsing,
chunking, and embedding happen before a database transaction. The transaction
then writes one `ready` document and all chunks, with stable global indexes,
page fields, metadata, 768-dimensional vectors, model, and embedding timestamp.
Any write failure rolls the entire transaction back. The active product/hash
unique constraint also maps concurrent duplicate uploads to HTTP 409.

## Configuration

- `RAG_PDF_MAX_FILE_SIZE_BYTES` defaults to `26214400` (25 MiB).
- `RAG_PDF_MAX_PAGES` defaults to `500`.
- `chunkSize` defaults to `1200` and accepts `200` through `4000` characters.
- `chunkOverlap` defaults to `200`, must be non-negative, and must be smaller
  than `chunkSize`.

The endpoint does not create local files and does not use object storage. The
current synchronous design persists only completed documents; the other status
values remain available for a future asynchronous workflow.
