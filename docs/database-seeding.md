# Database seeding

## Purpose

`pnpm db:seed` creates a deterministic catalog and local administrator for
development. It is not a fixture system for tests or a production bootstrap.
Migrations define schema; seeds create demonstration data; tests keep their own
setup and cleanup.

## Architecture

The entry point at `src/db/seeds/seed.ts` starts `SeedsModule` with
`NestFactory.createApplicationContext()`. The module contains only database
configuration, TypeORM entities, the orchestrator, and seeders. It does not import
`AppModule`, create an HTTP server, configure Swagger, or initialize auth providers.

`DatabaseSeederService` first rejects databases with pending migrations, then runs
all seeders in one `DataSource.transaction()`. Every seeder receives the same
transactional `EntityManager`; seeders do not inject repositories. The application
context closes in a `finally` block, and failures leave a non-zero process exit code.

Execution order is brands, categories, attributes, category attributes, products,
product specifications, product images, product prices, and users.

## Commands and prerequisites

Set the database variables plus `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`
documented in `.env.example`, start a PostgreSQL instance, and apply migrations
before running a seed. Both administrator variables are required and validated in
development and test. The email must be valid; the password must be 6-20
characters and contain uppercase, lowercase, and a number or symbol.

```bash
pnpm run migration:run
pnpm db:seed
```

For an explicit development setup, use `pnpm db:setup`, which runs migrations and
then the source seed. After compiling, `pnpm db:seed:dist` runs the generated
CommonJS entry point. Seeds are never run automatically when the API starts.

## Seeded data

The development set contains nine headphone brands, an Electronics > Audio >
Headphones hierarchy plus Speakers and Wearables, five reusable headphone
attributes, and nine comparable products. Each product has typed specifications,
two ordered images, and two USD price-history entries. It also creates an active
administrator from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, with the `admin`
role. The data supports catalog listing/detail, category and brand
filters, EAV string/number/boolean filters, image ordering, and price history.

Text search and a product-comparison endpoint are not implemented by the API; the
data is suitable for their future development but does not provide those features.

## Idempotency and soft deletes

Active rows are identified by stable natural keys: slugs for main catalog records,
category/attribute and product/attribute pairs for associations, product/position
for images, and product/timestamp for prices. Upserts use the `deleted_at IS NULL`
partial-index predicate, so a second execution reconciles managed active rows
without duplicating them.

The local administrator is create-only and identified by email. Rerunning the seed
does nothing when any active or soft-deleted user already has that email: it never
reactivates the account, changes its roles, or resets its password. This makes the
seed idempotent without risking elevation of an existing account.

The declared seed keys are managed by the seed: rerunning it restores their
documented mutable values, while records with other keys remain untouched. The seed
does not remove records that have been removed from data files. Price records are
immutable and use `ON CONFLICT DO NOTHING`; change a seeded price by adding a new
timestamped entry instead of editing history.

Soft-deleted matches are deliberately not restored. If no active match exists, the
seed creates a new active row and preserves deleted history, matching the catalog's
slug-reuse behavior.

## Adding or changing a seeder

Keep deterministic data in `src/db/seeds/data/` and persistence in one provider
under `src/db/seeds/seeders/`. Implement `seed(manager: EntityManager)`, register
the provider in `SeedsModule`, and add it in dependency order to
`DatabaseSeederService`. Resolve foreign keys from natural keys inside the provided
manager. Do not inject a repository or use the global datasource in a seeder.

When changing values, preserve natural keys where possible. A changed slug creates
a new managed row; retiring data does not delete the older row. Schema changes still
require a reviewed migration.

## Production and tests

The set is demonstration data. With `NODE_ENV=production`, administrator variables
are rejected and the user seeder is disabled before it accesses the users table.
Catalog seeding remains available, but it can overwrite values for its documented
catalog keys; review the data and target connection first. Do not use the command as
a production administrator bootstrap contract.

E2E tests truncate tables through the shared test helper. Run database-backed tests
only against a dedicated disposable database, never a development or production
database. A full verification should run the seed twice, validate active counts and
relations, induce a failure to confirm transaction rollback, and confirm the process
releases its database connection.
