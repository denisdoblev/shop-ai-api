# AI chat tool calling

`POST /api/ai/chat` is a stateless, authenticated orchestration loop. The server
validates `context.currentProductId` before the first model call and never exposes
that ID as a tool argument.

The enabled registry contains `get_current_product` for structured catalog facts
and `retrieve_current_product_documentation` for product-filtered evidence. The
latter consumes `RagEvidenceService`, so it preserves lexical-first retrieval,
vector fallback and the existing relevance gate without generating an intermediate
answer. `search_catalog_products`, stock and multi-turn persistence are not enabled.

Each round accepts at most four calls, exact duplicates execute once, and calls are
returned to the model in their original order. The request permits three tool
rounds and eight calls total, followed by a required final answer. Unknown tools or
invalid arguments receive a safe `invalid_arguments` result; infrastructure errors
remain HTTP failures. A nontrivial request cannot return a final answer before a
valid tool has executed: one omission is retried with an explicit server instruction
and a second omission fails with `503`. A small exact-match allowlist permits greetings,
thanks and farewells without tools.

The endpoint is limited to five requests per minute per user, one active request
per authenticated user and four active requests in total in each API process. The
complete operation has a 150-second deadline; its concurrency slots remain occupied
until the underlying operation settles. Public sources are the consulted chunks,
deduplicated by `chunkId`. The
canonical insufficiency answer always returns `sources: []`; prompts, tool traces,
results and provider bodies never leave the API.

`get_current_product` serializes at most 12,000 characters. It caps the description
at 4,000 characters and each string specification value at 1,000, stops adding
specifications when the total budget would be exceeded, and returns
`truncated: true` whenever data was shortened or omitted.

Operational events are `ai_chat_started`, `ai_tool_requested`,
`ai_tool_completed`, `ai_tool_failed`, `ai_chat_completed` and `ai_chat_failed`.
They contain identifiers, counts, durations and outcomes, but not user messages,
queries, arguments, chunks, embeddings or JWT data.
