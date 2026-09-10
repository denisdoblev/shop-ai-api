# Catalog database schema

The proposed catalog schema is stored in [`database-schema.sql`](database-schema.sql). It is a design reference for the catalog domains and is not an applied TypeORM migration. Schema changes that become part of the application must still be implemented as new migrations under `src/db/migrations/`.

The TypeORM application schema deliberately diverges from the reference SQL for
primary-key defaults and audit timestamps: application tables use generated UUIDs
and `TIMESTAMPTZ`. The catalog migrations implement the listed tables, partial
unique indexes (including case-insensitive active brand names), product
brand/category indexes, price history index, and typed EAV boolean, numeric, and
string filter indexes.

## Scope

The catalog reference SQL defines the following tables:

- `brands`
- `categories`, including a self-referencing category hierarchy
- `attributes`
- `products`
- `category_attributes`, which suggests attributes for a category without restricting products to them
- `product_images`
- `product_specifications`, using typed EAV values
- `product_prices`, retaining price history

Authentication is outside that reference SQL's catalog scope. The application
nevertheless has an implemented `users` table created by
`1756425600000-CreateUsersTable.ts`, with UUID/audit fields, unique email,
password hash, active status, and a `text[]` roles column defaulting to `user`.
The roles array currently has no database check constraint. Application code
accepts only `user` and `admin`; any legacy `super-user` database value must be
replaced with `admin`. Role promotion is initially performed directly in the
database. The deferred decision about constraining persisted values is documented in
[`authentication-authorization-plan.md`](authentication-authorization-plan.md).

Soft-deleted records are excluded from partial unique and query indexes. Foreign keys use `ON DELETE RESTRICT`, so related records must be handled explicitly before deleting their parent.

## Primary keys and nullability

Every table uses an explicitly non-null UUID primary key:

```sql
id UUID NOT NULL PRIMARY KEY
```

PostgreSQL already makes primary-key columns non-null implicitly. The explicit `NOT NULL` is retained so the constraint remains visible to schema readers and modeling tools. Only columns intentionally allowed to have no value are declared with `NULL`.

## Applying the design

Do not execute the reference file directly against an existing environment. When implementing these domains, create and review a TypeORM migration with:

```bash
pnpm run migration:create --name=CreateCatalogSchema
```

The migration must be reconciled with the entities and with all migrations already committed to the repository.
