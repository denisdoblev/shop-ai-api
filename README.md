# Shop AI API

REST API for an AI shopping copilot, built with NestJS, TypeScript, TypeORM, PostgreSQL, pnpm, and Jest.

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm run docker:db
pnpm run migration:run
pnpm db:seed
pnpm run start:dev
```

The API is served under `/api`. Swagger is available at `/api/docs`.

## Environment

Configuration is validated at startup. The required variable names are documented in `.env.example`:

- `NODE_ENV`
- `PORT`
- `JWT_SECRET`
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
- `TEST_DB_NAME` for the exclusive E2E database
- `SWAGGER_TITLE`, `SWAGGER_DESCRIPTION`, `SWAGGER_VERSION`

Do not commit `.env` or real secret values.

### E2E database safety

E2E tests destructively clear their data between cases and therefore require a
separate, pre-existing PostgreSQL database. `TEST_DB_NAME` must differ from
`DB_NAME` and end with `_test`; the default documented name is
`shop_ai_api_test`.

Create the database once and apply the migrations before running the suite. For
the example local configuration:

```bash
createdb -h localhost -U postgres shop_ai_api_test
DB_NAME=shop_ai_api_test NODE_ENV=test pnpm run migration:run
pnpm run test:e2e
```

The suite does not create the database or run migrations. It fails before Nest
or TypeORM initialization when the test database configuration is missing or
unsafe, and database connection or cleanup errors fail the suite instead of
being ignored.

## Authentication API

The implemented routes are:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/check-status`

Registration and login return HTTP 201. All three routes return the same safe authenticated profile:

```json
{
  "id": "3d6f0a36-40ed-4d30-ae15-7f12ab21379a",
  "email": "user@example.com",
  "fullname": "John Doe",
  "isActive": true,
  "roles": ["user"],
  "token": "<jwt>"
}
```

Passwords and persistence timestamps are not included in authentication responses.

Catalog reads are public. Catalog creation, update, and deletion require a valid
JWT for a user with the `admin` role. See the repository-audited
[`authentication and authorization plan`](docs/authentication-authorization-plan.md)
for the access matrix, ownership approach, and design decisions.

### Role administration

There is intentionally no role-management API, seed, or application script yet.
Promote an already registered user through a controlled database operation,
targeting its UUID rather than mutable profile data:

```sql
BEGIN;
SELECT id, email, roles FROM users WHERE id = '<user-uuid>' FOR UPDATE;
UPDATE users
SET roles = ARRAY['user', 'admin']::text[], updated_at = now()
WHERE id = '<user-uuid>' AND deleted_at IS NULL
RETURNING id, email, roles;
COMMIT;
```

Before deploying this strict two-role policy to an existing environment, replace
any legacy `super-user` role with `admin`. Direct database changes bypass
application validation and must be reviewed, access-controlled, and verified.

## Brands API

The brands domain exposes these endpoints; GET operations are public and
mutations require `admin`:

- `POST /api/brands`
- `GET /api/brands?limit=10&offset=0&name=son`
- `GET /api/brands/:id`
- `PATCH /api/brands/:id`
- `DELETE /api/brands/:id`

Deletion is soft: deleted brands are absent from normal reads, and their slug can
be reused by a new active brand. See [`docs/api.md`](docs/api.md) for the request
contracts and catalog API decisions.

## Categories API

Hierarchical categories expose:

- `POST /api/categories`
- `GET /api/categories?limit=10&offset=0&name=audio`
- `GET /api/categories/:id`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`

`parentId` is optional and nullable. When provided, it must reference an active
category, and a category cannot be its own parent. Deletion is soft.
The optional `name` query performs a case-insensitive partial match before
pagination.

Suggested attributes for a category are managed at
`/api/categories/:categoryId/attributes`. They are a form template only and do
not constrain the attributes a product may later receive.

## Attributes API

Reusable typed attributes expose CRUD endpoints under `/api/attributes`. Their
`dataType` is one of `string`, `number`, or `boolean`; `unit` is optional and
nullable. See [`docs/api.md`](docs/api.md) for the contract.

## Products API

Products expose CRUD endpoints under `/api/products`. Creation requires active
`brandId` and `categoryId`; listing supports optional `brandId` and `categoryId`
filters alongside `limit` and `offset`. Dynamic EAV filtering accepts
`specAttributeId` with an exact string/boolean value or inclusive numeric range
(`specStringValue`, `specBooleanValue`, `specNumberMin`, `specNumberMax`).

Product images are available at `/api/products/:productId/images`; image positions
are unique per active product. Price history is available at
`/api/products/:productId/prices`; each price record is immutable and the latest
active `recordedAt` value is the current price.

## Database and migrations

TypeORM schema synchronization is disabled. Generate migrations with:

```bash
pnpm run migration:create --name=YourMigrationName
```

Apply or revert migrations with:

```bash
pnpm run migration:run
pnpm run migration:revert
```

## Database seeding

The development catalog seed is a standalone Nest application: it does not start
the HTTP API or import `AppModule`. It checks for pending migrations, seeds a
small deterministic catalog in one transaction, and can safely be run again.

```bash
pnpm db:seed
pnpm db:setup
pnpm run build
pnpm db:seed:dist
```

`db:setup` runs migrations and then the source seed, so use it only for an
explicit development setup. See [`docs/database-seeding.md`](docs/database-seeding.md)
for data ownership, soft deletes, and production considerations.

The committed initial migration creates `users` with UUID primary keys. It targets a clean database and does not convert an existing `users` table with numeric IDs. Such a database must be migrated separately before applying it.

## Quality commands

```bash
pnpm test
pnpm run test:e2e
pnpm run lint
pnpm typecheck
pnpm run build
```

`pnpm run lint` applies automatic fixes. Use `pnpm run format` to format TypeScript source and test files directly.

## Structure

| Path                       | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `src/auth/`                | Authentication domain                                                 |
| `src/brands/`              | Brand catalog domain and CRUD API                                     |
| `src/categories/`          | Hierarchical category domain and CRUD API                             |
| `src/attributes/`          | Reusable typed attribute domain and CRUD API                          |
| `src/products/`            | Product domain, base CRUD, and brand/category filters                 |
| `src/common/`              | Shared DTOs, entities, decorators, and types                          |
| `src/config/`              | Application, environment, logging, Swagger, and TypeORM configuration |
| `src/db/`                  | TypeORM datasource, migrations, and standalone seeds                  |
| `test/`                    | End-to-end tests and shared test bootstrap                            |
| `docs/conventions.md`      | Engineering conventions and implementation recipes                    |
| `docs/authentication-authorization-plan.md` | Security diagnosis, access matrix, and implementation record |
| `docs/database-schema.md`  | Catalog schema documentation and reference SQL                        |
| `docs/database-seeding.md` | Seed architecture and operational guide                               |

## Guard ordering

Guards that populate request context must execute before guards that consume it. `Auth()` applies Passport JWT before role checks. A protected request without `request.user` consistently produces HTTP 401.
