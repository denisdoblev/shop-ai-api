# Grounded RAG generation

`RagService` owns the complete answer workflow. It accepts a
question plus optional `productId` and `topK`, attempts a strict Spanish lexical
match and otherwise retrieves vector-ranked chunks, evaluates the top two
similarities through a configurable relevance gate,
constructs a source-delimited grounding prompt, and delegates generation to the
provider-neutral `LlmService`. The authenticated single-turn HTTP entry point is
`POST /api/ai/ask`; the empty chat scaffold remains unexposed.

Omitting `productId` performs global retrieval. When supplied, `productId` must
be a valid UUID and scopes retrieval to that product; invalid values are
rejected before embeddings, database access, or generation. `RagService`
additionally verifies that a supplied product is active before retrieval and
retains it for query enrichment. The HTTP DTO always requires `productId`, while
internal callers retain the global retrieval option.

The HTTP endpoint uses the configured default `topK`, accepts users and admins,
and returns `200` for both generated answers and canonical insufficiency with an
empty `sources` array. Missing products return `404`. Normalized embedding and
LLM provider failures return `503`, except LLM timeouts, which return `504`.
Unexpected retrieval and database failures remain standard `500` errors without
leaking internal details.

## Runtime flow

```text
RagService.answer()
  -> RetrievalService.findBestLexicalMatch()
     -> PostgreSQL FTS (Spanish AND semantics, best active ready chunk)
     -> match: use exactly that chunk and skip embeddings/vector retrieval
     -> no match: RetrievalService.retrieve()
        -> enrich the embedding query with the selected product name
        -> EmbeddingsService.embedQuery()
        -> PostgreSQL/pgvector cosine search
        -> relevance gate (top 1 absolute similarity or top 1/top 2 separation)
           -> insufficient relevance: deterministic insufficiency answer
  -> buildGroundingPrompt()
  -> LlmService.generate()
     -> LLM_PROVIDER
        -> Ollama POST /api/chat
```

`embeddinggemma` remains exclusive to query/document embeddings. Generation
uses `qwen3:8b` by default, sends `stream: false`, `think: false`, and
temperature zero, and consumes only the final `message.content`. Embedding and
generation timeouts are intentionally independent.

Before SQL, lexical retrieval removes question/exclamation marks and only the
Spanish interrogatives `qué`, `cuál/es`, `cuánto/a/os/as`, `cuán`, `cómo`,
`dónde`/`adónde`, `cuándo` and `quién/es`, comparing those words without case or
accent distinctions. It preserves every other term, including numbers and
hyphens, and returns no match without querying PostgreSQL when nothing remains.
The normalized text is passed to `plainto_tsquery('spanish', query)` against
`to_tsvector('spanish', coalesce(section, '') || ' ' || content)`. Normal query
terms are combined with AND semantics after Spanish stop-word removal and
stemming, so every significant term must occur in the same chunk and user input
cannot introduce query operators. This version does not add an OR mode, query
rewriting, fusion, lexical thresholds, or language configuration. Ranking uses
cover-density rank descending, then shorter content, then chunk UUID for a stable
winner. The query retains the active chunk,
active/ready document, active product, and optional product filters from vector
retrieval; it neither reads nor validates embeddings.

`RagService` always gives lexical retrieval the original trimmed question. On a
lexical miss with a selected product, only the vector embedding query becomes:

```text
Producto seleccionado: <product.name>
Pregunta del usuario: <pregunta original>
```

Internal calls without `productId` keep the vector query unchanged. Prompt
generation and the public answer continue to use the original question; stored
chunk embeddings, relevance thresholds and context selection are unchanged.

The prompt requires the model to use only the supplied chunks, treat chunk
content as untrusted data, avoid unsupported product comparisons, and return
this canonical fallback when the evidence is insufficient:

> No dispongo de información suficiente en las fuentes proporcionadas para responder la pregunta.

The gate permits generation when:

```text
top1 >= strongSimilarityThreshold
OR
(top1 >= moderateSimilarityThreshold AND top1 - top2 >= minimumSimilarityGap)
```

All comparisons are inclusive. Empty retrieval always abstains. With one result,
only the strong branch can permit generation because there is no observed top 2;
the implementation does not invent a gap against zero.

`top1` and `top2` are the first two results returned by `RetrievalService`, which
orders cosine distance ascending and therefore similarity descending. The gate
does not sort, rerank, rewrite, or otherwise modify retrieval results.

The strong branch retains the previous context behavior by including every
retrieved chunk at or above the strong threshold. The moderate branch includes
only the dominant top 1 chunk. This prevents the lower-ranked evidence that made
the gap meaningful from being added to the prompt. If the gate rejects the
results, `RagService` returns the canonical answer without invoking the LLM.

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

Sources are mapped directly from the exact chunks included in the prompt, except
that the canonical insufficiency answer always returns an empty source list. This
prevents an LLM abstention after an admitted vector result from presenting that
result as supporting evidence. Sources do not expose embeddings, chunk content,
arbitrary metadata, or model-generated citations. Page values come from the
relational `page_start`/`page_end` fields; text documents can therefore report
honest `null` pages.

## Configuration

| Variable                            | Default    | Purpose                                      |
| ----------------------------------- | ---------- | -------------------------------------------- |
| `LLM_PROVIDER`                      | `ollama`   | Generation provider selector                 |
| `OLLAMA_LLM_MODEL`                  | `qwen3:8b` | Ollama generation model                      |
| `OLLAMA_LLM_TIMEOUT_MS`             | `120000`   | Generation request timeout                   |
| `RAG_DEFAULT_TOP_K`                 | `5`        | Retrieval count when callers omit `topK`     |
| `RAG_STRONG_SIMILARITY_THRESHOLD`   | `0.50`     | Absolute top 1 generation threshold          |
| `RAG_MODERATE_SIMILARITY_THRESHOLD` | `0.40`     | Minimum top 1 for the gap branch             |
| `RAG_MINIMUM_SIMILARITY_GAP`        | `0.12`     | Minimum inclusive top 1 minus top 2 distance |

`RAG_MIN_SIMILARITY` is no longer consumed. Deployments that overrode the old
value must migrate to the three explicit variables; deployments without
overrides receive the defaults above.

The moderate threshold cannot exceed the strong threshold. Similarity thresholds
are constrained to `[-1, 1]` and the gap to `[0, 2]` during environment
validation.

These values are calibration starting points, not proof that a chunk contains a
complete answer. The prompt keeps the independent responsibility of refusing
questions that the retained context cannot fully answer.

## Observability

The existing `rag_retrieval_completed` debug event reports
the complete gate decision without logging question or chunk content:

| Field             | Meaning                                                   |
| ----------------- | --------------------------------------------------------- |
| `event`           | Always `rag_retrieval_completed`                          |
| `retrievalMode`   | `lexical` for the fast path, otherwise `vector`           |
| `retrievedChunks` | Number of ranked results returned by retrieval            |
| `includedChunks`  | Number of chunks supplied to the grounding prompt         |
| `lexicalMatches`  | `1` on the lexical fast path; otherwise `0`               |
| `durationMs`      | Retrieval duration; it excludes LLM generation            |
| `lexicalScore`    | Best FTS score on the lexical path; otherwise `null`      |
| `top1Similarity`  | First similarity, or `null` when retrieval is empty       |
| `top2Similarity`  | Second similarity, or `null` with fewer than two results  |
| `similarityGap`   | `top1Similarity - top2Similarity`, or `null` without both |
| `reason`          | Stable machine-readable reason for the decision           |

| Reason                         | Meaning                                                 |
| ------------------------------ | ------------------------------------------------------- |
| `strong_similarity`            | Top 1 met the strong absolute threshold                 |
| `moderate_similarity_with_gap` | Top 1 met the moderate threshold and the minimum gap    |
| `insufficient_relevance`       | No generation branch matched; the pipeline must abstain |
| `lexical_match`                | One strict complete lexical match bypassed embeddings   |

The event is emitted for both generation and abstention paths. Operationally,
`reason=insufficient_relevance` with no later LLM completion is an intentional
gate rejection, not an LLM failure.

## Deployment and rollback

Apply `AddRagChunkSpanishFtsIndex` before deploying the application. The
migration adds only a partial GIN index; it does not require reingestion or
re-embedding and adds no environment variable.

Rollout checklist:

1. Apply pending migrations, including the Spanish FTS index.
2. Replace any `RAG_MIN_SIMILARITY` override with all three new variables.
3. Validate that moderate similarity does not exceed strong similarity.
4. Restart the application so `ConfigModule` validates and loads the new values.
5. Run `pnpm test:rag-eval` against the safe `_test` database and compare the
   dataset version and SHA-256 before comparing metrics.
6. Monitor retrieval modes, decision reasons, null similarities, false abstentions, false answers,
   and grounding failures. Do not log chunk content.

Rollback order is application first and index second. After the old application
is running, revert the migration; its `down` removes only the FTS index. Vector
retrieval, stored documents, and embeddings remain unchanged.

To emulate the previous absolute `similarity >= 0.50` gate while keeping the new
code, set both strong and moderate thresholds to `0.50`; the strong branch then
captures every result eligible for the moderate branch, so the gap cannot admit
additional calls. `RAG_MINIMUM_SIMILARITY_GAP` may remain `0.12`.

If the application binary itself is rolled back, restore `RAG_MIN_SIMILARITY=0.50`
because the previous code does not read the three new variables. A configuration
rollback still requires an application restart.

## Local verification

The normal unit and HTTP E2E suites do not require Ollama. The explicit
integration suite requires both models and the migrated `_test` database:

```bash
ollama pull embeddinggemma
ollama pull qwen3:8b
pnpm run docker:db
pnpm run db:test:setup
pnpm test
pnpm run test:integration
pnpm test:rag-eval
```

An intentionally run integration suite fails visibly if Ollama or either model
is unavailable; it is not silently skipped. The evaluation command can complete
successfully with quality failures because its report is diagnostic; inspect
`artifacts/rag-evaluation.json` and the printed classifications.
