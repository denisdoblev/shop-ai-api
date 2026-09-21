# Grounded RAG generation

The internal `RagService` owns the complete answer workflow. It accepts a
question plus optional `productId` and `topK`, retrieves vector-ranked chunks,
discards chunks below `RAG_MIN_SIMILARITY`, constructs a source-delimited
grounding prompt, and delegates generation to the provider-neutral `LlmService`.
There is no public chat handler yet.

## Runtime flow

```text
RagService.answer()
  -> RetrievalService.retrieve()
     -> EmbeddingsService.embedQuery()
     -> PostgreSQL/pgvector cosine search
  -> similarity threshold
     -> no chunks: deterministic insufficiency answer
  -> buildGroundingPrompt()
  -> LlmService.generate()
     -> LLM_PROVIDER
        -> Ollama POST /api/chat
```

`embeddinggemma` remains exclusive to query/document embeddings. Generation
uses `qwen3:8b` by default, sends `stream: false`, `think: false`, and
temperature zero, and consumes only the final `message.content`. Embedding and
generation timeouts are intentionally independent.

The prompt requires the model to use only the supplied chunks, treat chunk
content as untrusted data, avoid unsupported product comparisons, and return
this canonical fallback when the evidence is insufficient:

> No dispongo de información suficiente en las fuentes proporcionadas para responder la pregunta.

If retrieval is empty or every result is below the similarity threshold,
`RagService` returns that answer without invoking the LLM.

## Result contract

```ts
interface RagAnswer {
  answer: string;
  sources: Array<{
    chunkId: string;
    documentId: string;
    documentName: string;
    productId: string;
    chunkIndex: number;
    pageStart: number | null;
    pageEnd: number | null;
    section: string | null;
  }>;
}
```

Sources are mapped directly from the exact chunks included in the prompt. They
do not expose embeddings, chunk content, arbitrary metadata, or model-generated
citations. Page values come from the relational `page_start`/`page_end` fields;
text documents can therefore report honest `null` pages.

## Configuration

| Variable                | Default    | Purpose                                  |
| ----------------------- | ---------- | ---------------------------------------- |
| `LLM_PROVIDER`          | `ollama`   | Generation provider selector             |
| `OLLAMA_LLM_MODEL`      | `qwen3:8b` | Ollama generation model                  |
| `OLLAMA_LLM_TIMEOUT_MS` | `120000`   | Generation request timeout               |
| `RAG_DEFAULT_TOP_K`     | `5`        | Retrieval count when callers omit `topK` |
| `RAG_MIN_SIMILARITY`    | `0.50`     | Inclusive cosine-similarity threshold    |

The threshold is a calibration starting point, not proof that a chunk contains
a complete answer. The prompt keeps the independent responsibility of refusing
questions that the retained context cannot fully answer.

## Local verification

The normal unit and HTTP E2E suites do not require Ollama. The explicit
integration suite requires both models and the migrated `_test` database:

```bash
ollama pull embeddinggemma
ollama pull qwen3:8b
pnpm run docker:db
pnpm run db:test:setup
pnpm run test:integration
```

An intentionally run integration suite fails visibly if Ollama or either model
is unavailable; it is not silently skipped.
