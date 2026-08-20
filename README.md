# Base REST API — NestJS Starter

> Starter for building REST APIs with NestJS, TypeScript, TypeORM, and PostgreSQL.

## Technologies

- NestJS
- TypeScript
- TypeORM
- PostgreSQL
- Docker
- pnpm
- Jest

## Step-by-step Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd base-nest-api
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Create the environment file

```bash
cp .env.example .env
```

The default values are ready to run the app locally with PostgreSQL in Docker.

### 4. Start the database

```bash
pnpm run docker:db
```

### 5. Run the migrations

```bash
pnpm run migration:run
```

### 6. Start the application in development mode

```bash
pnpm run start:dev
```

## Environment Variables

The application reads these variables in [src/db/data-source.ts](src/db/data-source.ts) and in the Nest configuration:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=secretKey
DB_NAME=base_nest_api
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
SWAGGER_TITLE=Base Nest API
SWAGGER_DESCRIPTION=This is a base Nest REST API
SWAGGER_VERSION=1.0.0
```

## Swagger and Examples

The DTO examples are aligned with valid values for validation and Swagger. For example:

- email: `user@example.com`
- password: `Abc123`
- full name: `John Doe`

For pagination, `limit` and `offset` now show values that match their real usage. See [src/common/dtos/pagination.dto.ts](src/common/dtos/pagination.dto.ts).

## Migrations

You now have a simpler command for generating migrations:

```bash
pnpm run migration:create --name=YourMigrationName
```

That script already includes the datasource and migration folder, so you only need to provide the migration name.

Generate a migration when your schema changes:

```bash
pnpm run migration:create --name=YourMigrationName
```

Apply pending migrations:

```bash
pnpm run migration:run
```

Revert the last migration:

```bash
pnpm run migration:revert
```

## Useful Scripts

```bash
pnpm run start:dev
pnpm run build
pnpm run test
pnpm run test:e2e
pnpm run test:cov
```

## Structure

| Path | Purpose |
|---|---|
| `src/` | Application source code |
| `src/db/` | TypeORM datasource and migrations |
| `postgres/` | Optional local Postgres data for Docker Compose |

## Decorator ordering (guards execution)

Important note about decorator order and guards execution:

- Nest uses TypeScript decorators which accumulate metadata. When multiple decorators add the same metadata key (for example, guards via `UseGuards`), the order in which those decorators are applied affects the final execution order of the guards.
- In practice this means that when you combine an authentication guard (that populates `req.user`) with an ownership/authorization guard (that reads `req.user`), the authentication guard must run first.

Example from this codebase:

- `Auth()` applies `UseGuards(AuthGuard(), UserRoleGuard)` and populates `req.user`.
- `ResourceOwnerGuard` checks `req.user` to confirm resource ownership.
- If `ResourceOwnerGuard` runs before `AuthGuard`, `req.user` will be undefined and the guard will throw `User not found in request`.

Fix and references:

- We updated the controller usage so authentication runs before ownership checks. See:
	- [src/workout-templates/workout-templates.controller.ts](src/workout-templates/workout-templates.controller.ts#L64-L67)
	- [src/workout-executions/workout-executions.controller.ts](src/workout-executions/workout-executions.controller.ts)

Recommendation:

- When combining guards that depend on each other, ensure the guard that sets up required context (e.g. `AuthGuard`) is applied so it executes before dependent guards (e.g. `ResourceOwnerGuard`).


