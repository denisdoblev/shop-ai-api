# AI Shopping Copilot API: Agent Guide

This repository is a NestJS REST API for a product catalog and AI-powered product recommendations. It uses strict TypeScript, PostgreSQL, TypeORM, pnpm, and Jest. [Project conventions](docs/conventions.md) are the source of truth; this file is the operational checklist, not a replacement for them.

> **Before implementing a new pattern, inspect existing neighboring modules and prefer the established project pattern over introducing a new abstraction.**

## Architecture

- Organize features as modular NestJS domains containing controllers, services, DTOs, entities/data access, supporting providers, and colocated tests.
- Keep controllers thin. Put business workflows in injectable services.
- Constructor injection is standard. Injecting TypeORM `Repository<Entity>` directly is valid; do not add a custom repository or architectural layer without demonstrated need.
- Put reusable application concerns in `src/common/`, configuration factories in `src/config/`, and datasource/migrations in `src/db/`.
- Keep AI capabilities under the `src/ai/` aggregate: chat orchestration, RAG workflows and persistence, and LLM integration live there without exposing HTTP handlers until their contracts exist.
- Do not introduce CQRS, use-case classes, domain events, or another abstraction merely for symmetry.

## Important directories

| Path | Purpose |
| --- | --- |
| `src/auth/` | Reference domain for module, controller, service, DTO, entity, guards, strategies, adapters, and unit tests |
| `src/ai/` | AI aggregate containing chat wiring, RAG storage/workflow modules, and LLM integration |
| `src/common/` | Shared DTOs, entities, decorators, and types |
| `src/config/` | Application, environment, logging, Swagger, and TypeORM configuration |
| `src/db/` | TypeORM CLI datasource and migrations |
| `test/` | E2E suites and shared application/database test setup |
| `scripts/` | Repository maintenance scripts, including migration creation |
| `docs/` | Detailed internal engineering documentation |

## Mandatory coding conventions

- Use strict TypeScript. Never use `any`; prefer concrete types or `unknown` with narrowing.
- Use relative imports for project code; no project path alias is configured.
- Name files/folders in lowercase kebab-case with Nest role suffixes. Use singular `dto/`; artifact directories such as `entities/`, `guards/`, and `strategies/` are plural.
- Prefer dependency injection, explicit public-boundary return types, and `private readonly` dependencies.
- Validate DTOs with `class-validator`; add `class-transformer` only where conversion is required.
- Use single quotes, trailing commas, two-space indentation, and semicolons. Follow ESLint and Prettier configuration.
- Avoid new dependencies unless their need is justified.

## API conventions

- All routes are under `/api`; use lowercase kebab-case route segments. Swagger is at `/api/docs`.
- Use validated DTO classes and Swagger metadata/decorators for request and response contracts.
- Return plain objects without an envelope. Never expose passwords, secrets, or persistence-only fields; return tokens only in intended authentication responses.
- Use Nest HTTP exceptions consistently: authentication failures `401`, authorization failures `403`, missing resources `404`, and conflicts `409`.
- Preserve shared bootstrap behavior in `configureApplication()` so production and E2E validation remain aligned.

## Database conventions

- PostgreSQL and TypeORM are required. Keep `synchronize: false`; every schema change requires a reviewed migration.
- Entities extend `BaseEntity` for UUID IDs and created/updated/soft-delete timestamps.
- Database identifiers are snake_case via `SnakeNamingStrategy`; tables are explicitly plural lowercase.
- Create migrations with `pnpm run migration:create --name=Name`. Do not rewrite or delete committed migrations; add a new migration for subsequent changes.
- Never perform destructive database operations unless explicitly requested.

## Testing and completion

- Colocate unit tests as `*.spec.ts`; place HTTP E2E tests in `test/` as `*.e2e-spec.ts`.
- Add or update tests for behavior changes, including validation, failure paths, collaborator calls, and sensitive-field exclusion.
- E2E tests must use the shared application setup in `test/test-utils.ts`.
- Before considering code work complete, run:

```bash
pnpm test
pnpm run test:e2e
pnpm run lint
pnpm typecheck
pnpm run build
```

`pnpm run lint` can modify files. Review its changes. If a command cannot run (for example, PostgreSQL is unavailable), report that explicitly.

## Do not edit manually

- Generated/runtime directories: `dist/`, `node_modules/`, `coverage/`, and `postgres/`.
- `.env` files, secrets, or credentials. Update `.env.example` only when the documented configuration contract deliberately changes.
- `pnpm-lock.yaml`; let pnpm update it when dependencies intentionally change.
- Existing migration files. Never delete migrations.

Do not push changes unless explicitly requested.

## Internal documentation

- [Detailed engineering conventions and recipes](docs/conventions.md)
- [Setup, environment, routes, and migration usage](README.md)
- [Environment variable template](.env.example)

If a deliberate architectural convention changes, update `docs/conventions.md` in the same work so it remains the repository source of truth.
