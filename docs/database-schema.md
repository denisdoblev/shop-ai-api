# Catalog database schema

The proposed catalog schema is stored in [`database-schema.sql`](database-schema.sql). It is a design reference for the catalog domains and is not an applied TypeORM migration. Schema changes that become part of the application must still be implemented as new migrations under `src/db/migrations/`.

The TypeORM application schema deliberately diverges from the reference SQL for
primary-key defaults and audit timestamps: application tables use generated UUIDs
and `TIMESTAMPTZ`. The catalog migrations implement the listed tables, partial
unique indexes, product brand/category indexes, price history index, and typed EAV
boolean, numeric, and string filter indexes.

## Scope

The schema defines the following tables:

- `brands`
- `categories`, including a self-referencing category hierarchy
- `attributes`
- `products`
- `category_attributes`, which suggests attributes for a category without restricting products to them
- `product_images`
- `product_specifications`, using typed EAV values
- `product_prices`, retaining price history

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
