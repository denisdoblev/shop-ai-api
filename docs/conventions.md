# Project Conventions

This document is the source of truth for conventions established by the repository. “Explicit” means enforced by configuration or project documentation; “strong inferred” means consistently repeated in the implemented code. Features without repository evidence are identified as not established.

## 1. Project Architecture

- **Explicit:** Use modular NestJS architecture. A domain owns its controller, service, TypeORM data access, DTOs, entities, supporting providers, and colocated unit tests (`AGENTS.md`, `src/auth/`).
- **Explicit:** Controllers remain thin; business workflows belong in injectable services (`src/auth/auth.controller.ts`, `src/auth/auth.service.ts`).
- **Explicit:** Injecting TypeORM `Repository<Entity>` directly is the established repository/data-access pattern. A custom repository layer is optional, not required (`src/auth/auth.service.ts`, `AGENTS.md`).
- **Strong inferred:** Shared application code belongs in `src/common/`, configuration factories in `src/config/`, and datasource/migrations in `src/db/`.
- **Explicit:** AI capabilities belong to the `src/ai/` aggregate. `AiModule` composes chat orchestration, RAG persistence/workflow modules, and LLM integration; RAG entities live under `src/ai/rag/entities/`.
- **Explicit:** The AI aggregate exposes synchronous, administrator-only local PDF ingestion under a product. The PDF remains in memory, parsing preserves page numbering, chunking never crosses a page, embeddings are validated before persistence, and one transaction writes a ready document plus all chunks. `EmbeddingsService` depends on the provider-neutral `EMBEDDING_PROVIDER` token, and `EmbeddingsModule` selects the configured adapter. The Ollama adapter owns EmbeddingGemma input formatting and response validation. `RetrievalService` first offers one strict Spanish PostgreSQL FTS match over active chunks of ready, active documents/products, with an optional product filter and no embedding dependency; only a miss proceeds to the unchanged top-K pgvector cosine search over model-compatible 768-dimensional embeddings. The common chunk contract contains source/prompt fields, while vector results expose `similarity` and lexical results expose `lexicalScore`. `RagService` is the sole grounded-answer orchestrator: it validates an optional active product, uses a lexical winner as the only context or evaluates the configured strong similarity or moderate similarity plus top 1/top 2 gap, short-circuits to deterministic insufficiency when vector evidence is weak or ambiguous, builds the delimited prompt from the selected chunks, delegates to `LlmService`, maps provider failures to the internal availability contract, and maps sources from exactly those chunks. It remains available only to evaluations and integration tests. `LlmService` depends on the provider-neutral `LLM_PROVIDER`; the Ollama adapter uses non-streaming `qwen3:8b` with thinking disabled. `POST /api/ai/chat` is the assistant's only public HTTP interface.
- **Not established in the current codebase:** CQRS, domain events, use-case classes, or a formal hexagonal layer structure.

## 2. File and Folder Naming

- **Explicit:** Files and folders use lowercase kebab-case with Nest role suffixes: `auth.controller.ts`, `create-user.dto.ts`, `user-role.guard.ts`.
- **Explicit:** DTO folders are singular `dto/` in domains and shared code (`src/auth/dto/`, `src/common/dto/`). Other artifact folders are plural (`entities/`, `guards/`, `decorators/`, `interfaces/`, `strategies/`, `adapters/`).
- **Strong inferred:** Classes use PascalCase, members/functions camelCase, constants and enum members UPPER_SNAKE_CASE.
- **Explicit:** Unit tests are colocated as `*.spec.ts`; e2e tests live under `test/` as `*.e2e-spec.ts`.
- **Strong inferred:** `index.ts` barrel files expose a folder's intended public symbols.

## 3. TypeScript Conventions

- **Explicit:** TypeScript strict mode is enabled. `any` is prohibited by ESLint; use concrete types or `unknown` with narrowing (`tsconfig.json`, `eslint.config.mjs`).
- **Explicit:** The compiler uses NodeNext modules/resolution, ES2023, decorator metadata, isolated modules, strict casing, and no fallthrough in switches.
- **Strong inferred:** Interfaces model contracts/payloads (`HashAdapter`, `JwtPayload`); local structural combinations use `type`; DTOs/entities are runtime classes.
- **Explicit:** Decorator-populated entity and DTO fields use definite assignment (`!`). Truly optional input uses `?`; nullable persistence state uses a union such as `Date | null`.
- **Strong inferred:** Injected/stable dependencies are `private readonly`. Async I/O uses `async`/`await` and public boundary return types are explicit.
- **Explicit:** Project imports are relative. Barrels may be used within a local feature; no path alias is configured.
- **Explicit:** String enum member names are UPPER_SNAKE_CASE while serialized
  values retain their API/database spelling (`ValidRoles.ADMIN = 'admin'`). The
  supported role set is `USER` and `ADMIN`.

## 4. NestJS Conventions

- **Strong inferred:** Modules register controllers/providers and entity repositories with `TypeOrmModule.forFeature()`.
- **Explicit:** `RetrievalModule` and `LlmModule` export their services for AI composition. `RagModule` exports `RagEvidenceService` and `RagService`: retrieval/gating belongs to the former, while internal grounded single-turn generation belongs to the latter. `ChatModule` owns the only AI controller plus tool schemas, runtime validation, registry and orchestration; tools consume domain services rather than repositories.
- **Strong inferred:** Dependencies use constructor injection. Interface-typed dependencies use an explicit provider token (`BcryptAdapter` for `HashAdapter`).
- **Explicit:** `configureApplication()` owns the global `/api` prefix and `ValidationPipe`; production and e2e bootstrap both call it (`src/config/application.config.ts`, `src/main.ts`, `test/test-utils.ts`).
- **Strong inferred:** Composite decorators package authentication/authorization behavior. `@Auth()` runs Passport JWT before role checks; `@GetUser()` accesses the authenticated principal.
- **Not established in the current codebase:** custom interceptors, exception filters, middleware, or custom pipes.

## 5. API Conventions

- **Explicit:** All routes use the `/api` prefix and lowercase kebab-case route segments. Swagger is served at `/api/docs`.
- **Explicit:** Register and login are POST endpoints returning 201. Check status is GET returning 200.
- **Explicit:** `POST /api/ai/chat` is authenticated and stateless. It accepts only `message` plus `context.currentProductId`; the server injects that product into contextual tools. The first release exposes `get_current_product` and `retrieve_current_product_documentation`, allows at most three tool rounds, four calls per round and eight calls total, and returns only `{ answer, sources }`.
- **Explicit:** AI chat permits tool-free responses only for an exact allowlist of trivial conversation. Other requests get one forced-tool retry and fail closed if no valid tool executes. It applies a per-user five-request/minute limit, one concurrent request per user, four concurrent requests per API process, and a 150-second operation deadline. Structured catalog tool output is capped at 12,000 serialized characters and signals truncation. The canonical insufficiency answer returns no sources.
- **Explicit:** Register, login, and check status return `AuthResponseDto`: `id`, `email`, `fullname`, `isActive`, `roles`, and `token`. Passwords and persistence timestamps are never returned.
- **Strong inferred:** Request bodies use validated DTO classes and successful responses are plain objects without a response envelope.
- **Strong inferred:** Shared `Api*Responses` decorators document success/common failure statuses and bearer auth; DTO/entity fields use `@ApiProperty`.
- **Explicit:** Pagination uses `limit`/`offset`, transforms query strings to numbers, and applies defaults 10/0 (`src/common/dto/pagination.dto.ts`).
- **Explicit:** Catalog listing supports `limit`/`offset`; brands, categories,
  and attributes support a case-insensitive partial `name` filter, and products also support
  brand/category and typed EAV filters. Sorting remains internal to each service;
  pagination metadata, response versioning, and a common data envelope are not established.

## 6. Database Conventions

- **Explicit:** Use PostgreSQL, TypeORM, `SnakeNamingStrategy`, and migrations; `synchronize` remains false.
- **Explicit:** Entities extend `BaseEntity`, which provides UUID `id`, `createdAt`, `updatedAt`, and nullable `deletedAt`. Database names are snake_case through the naming strategy.
- **Strong inferred:** Tables are explicitly plural lowercase (`users`). Columns/constraints/defaults are declared on entities; email is normalized in lifecycle hooks.
- **Explicit:** Runtime and CLI discover migrations under `src/db/migrations` in source and the corresponding compiled directory.
- **Explicit:** The initial users migration targets an empty database. It does not upgrade an existing numeric-ID `users` table.
- **Explicit:** Catalog relationships use named foreign keys with `ON DELETE RESTRICT`.
  Product filters use query builders and partial indexes, including typed EAV
  indexes. RAG strict lexical search uses a partial GIN index on the Spanish
  `section + content` tsvector for active chunks. RAG similarity search uses the cosine `<=>` operator and the partial
  HNSW `vector_cosine_ops` index on active non-null embeddings. Standalone seeds
  run all writes through one `EntityManager` transaction. Locking remains
  unestablished.

## 7. Validation and Error Handling

- **Explicit:** The global validation pipe transforms input, whitelists declared properties, and rejects extra properties.
- **Strong inferred:** DTOs combine `class-validator`, `class-transformer` where conversion is needed, and Swagger metadata.
- **Explicit:** Missing authentication identity is always `UnauthorizedException` (401) in decorators and guards. Invalid credentials/token and inactive users are also 401; duplicate registration is 409; authorization denial is 403; absent resources are 404.
- **Strong inferred:** Nest's standard HTTP exception serialization is used; no custom error envelope exists.

## 8. Testing Conventions

- **Explicit:** Jest unit tests are colocated under `src/`; Jest/Supertest e2e tests live under `test/`.
- **Strong inferred:** Controller tests use `Test.createTestingModule`; focused services/adapters/strategies use direct construction with typed Jest mocks.
- **Strong inferred:** Reset mocks between tests and assert both outputs/errors and collaborator calls. Authentication tests assert safe response shapes and absence of password.
- **Explicit:** E2e applications call the same shared application and Swagger configuration as production, including `/api`, validation and `/api/docs-json`. Database cleanup is centralized in `test/test-utils.ts`.
- **Explicit:** Integration tests require both local Ollama and the migrated safe `_test` database; their Jest configuration applies the same environment guard as E2E before loading application modules.
- **Explicit:** Destructive e2e cleanup requires `NODE_ENV=test`, an explicit
  `TEST_DB_NAME` ending in `_test`, and a TypeORM datasource targeting that exact
  database. The test database must be pre-existing and migrated; unavailable
  databases and cleanup failures fail the suite.
- **Not established in the current codebase:** fixtures/factories, snapshots, test containers, or coverage thresholds.

## 9. Logging and Observability

- **Explicit:** Nest uses `nestjs-pino`; production logs at info and other environments at debug. Development output uses `pino-pretty`; tests omit the transport so its worker does not keep Jest alive.
- **Explicit:** Authorization headers and password/token request fields are redacted.
- **Explicit:** `console.error` is reserved for fatal bootstrap failure before a reliable application logger is available.
- **Explicit:** `rag_retrieval_completed` records retrieval mode, counts, one lexical score or vector similarities, duration, and decision reason. Questions and chunk content are never logged.
- **Not established in the current codebase:** metrics, tracing, audit logs, or error-reporting integrations.

## 10. Configuration and Environment

- **Explicit:** Global `ConfigModule` validates environment through Joi. Database, Swagger, `NODE_ENV`, and `JWT_SECRET` values are required; `PORT` defaults to 3000.
- **Explicit:** Embedding configuration is validated at startup and defaults to Ollama at `http://localhost:11434`, model `embeddinggemma`, and a 30000 ms timeout. Provider connectivity is lazy and is never checked during bootstrap.
- **Explicit:** LLM generation configuration is validated separately and defaults to Ollama model `qwen3:8b` with a 120000 ms timeout. Grounded RAG defaults to top K 5, strong similarity 0.50, moderate similarity 0.40, and a minimum top 1/top 2 gap of 0.12; comparisons are inclusive, and a single result can only pass the strong branch. LLM connectivity remains lazy, and generation has no automatic retry.
- **Explicit:** Local PDF ingestion limits are validated at startup and default to 25 MiB and 500 pages. Uploaded PDFs are not written to disk or object storage.
- **Strong inferred:** Runtime code consumes `ConfigService`; standalone TypeORM CLI setup loads dotenv directly.
- **Explicit:** `ProcessEnv` declarations describe raw environment values as strings. Parse/coerce numeric values at configuration boundaries.
- **Explicit:** `.env` files are ignored and real secrets must never appear in source or documentation.

## 11. Code Style

- **Explicit:** Prettier uses single quotes and trailing commas. ESLint uses type-aware recommended rules and treats Prettier/no-explicit-any violations as errors.
- **Strong inferred:** Use two-space indentation, semicolons, early guards/throws, object destructuring, and small controller methods.
- **Strong inferred:** Comments explain non-obvious behavior; avoid implementation-history comments and stale TODOs. Build output removes comments.
- **Not established in the current codebase:** fixed function-size limits, an immutability mandate, JSDoc requirements, or automated import sorting.

## 12. Common Implementation Patterns

### Add a domain or endpoint

1. Follow `src/auth/`: create the module/controller/service and role-specific folders under `src/<domain>/`.
2. Register entities with `TypeOrmModule.forFeature()` and inject `Repository<Entity>` into the service.
3. Keep route methods declarative, use validated DTOs/shared Swagger decorators, and delegate behavior to the service.
4. Import the domain module into `AppModule`; add colocated unit tests and relevant e2e coverage.

### Add a DTO or entity

1. Put DTO classes in singular `dto/`, add validation, transformation where necessary, Swagger properties, and barrel exports.
2. Extend `BaseEntity` for persistence entities, declare TypeORM columns/constraints, and expose only API-safe fields.
3. Generate and review a migration with `pnpm run migration:create --name=Name`; never enable synchronization.

### Add tests

1. Add `*.spec.ts` beside source or `test/*.e2e-spec.ts` for HTTP behavior.
2. Reuse `configureApplication()`/`test-utils.ts` so e2e behavior matches production.
3. Test success, validation, expected exceptions, sensitive-field exclusion, and dependency calls.

## 13. Inconsistencies / Decisions Needed

- `ResourceOwnerGuard` is implemented but no current route uses it; ownership relationship conventions remain unproven.
- `PaginationDto` is established, tested, and consumed by the brand, category,
  attribute, and product listings. Pagination response metadata remains
  undecided because those endpoints return arrays without totals or an envelope.
- Catalog entities establish relationship, transaction, filter, and internal sort
  patterns. A public sorting contract remains undecided.
- Catalog GET routes are public. Catalog mutations use
  `@Auth(ValidRoles.ADMIN)`; missing/invalid authentication returns 401 and an
  authenticated user without `ADMIN` receives 403.
- Personal favorite routes use `@Auth()` and `@GetUser('id')`. Services scope
  every query by that ID and never accept or expose `userId`.

## 14. Agent Checklist

- Read `AGENTS.md`, this document, and adjacent domain code before editing.
- Preserve modular boundaries, thin controllers, DTO validation, safe response shapes, relative imports, UUIDs, and migrations.
- Do not expose passwords, tokens, `.env` values, or persistence-only fields.
- Update unit/e2e tests and Swagger when changing behavior or contracts.
- Run `pnpm test`, `pnpm run test:e2e` when relevant, `pnpm run lint`, `pnpm typecheck`, and `pnpm run build`.
- Review generated migrations and keep `synchronize: false`.
- Do not push, edit secrets, delete migrations, or perform destructive database operations unless explicitly requested.
