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

`product_favorites` is added by
`1789300000000-CreateProductFavoritesTable.ts`. It uses generated UUID and audit
columns, restrictive foreign keys to `users` and `products`, an active-user
lookup index, and a partial unique index on active `(user_id, product_id)`.
The expansion-only migration preserves existing data. Its `down` path removes
only this table and its constraints and indexes.

## RAG storage

RAG storage requires PostgreSQL 17 and pgvector. The Compose development service
uses `pgvector/pgvector:pg17`. Migration
`1789738394056-EnableVectorExtension.ts` runs `CREATE EXTENSION IF NOT EXISTS
vector`; its rollback intentionally leaves the extension installed because it
may be shared or may have existed before this application.

The later expansion-only migration
`1789739751921-CreateRagTables.ts` creates two tables without modifying catalog
tables or existing data:

- `rag_documents` belongs to exactly one `products` row through a restrictive
  foreign key. It records the source name and provider-independent source URI,
  SHA-256 content hash, MIME type, asynchronous processing status and error,
  optional page/file metadata, and object-shaped JSON metadata. Active hashes
  are unique per product; soft-deleting a document permits the hash to be reused.
- `rag_chunks` belongs to exactly one document through a restrictive foreign
  key. It records non-empty text, a non-negative chunk index, optional valid page
  range/section/token count, object-shaped JSON metadata, and an optional
  embedding. Active chunk indexes are unique per document; soft-deleting a chunk
  permits the index to be reused. Embedding, non-empty model name, and embedding
  timestamp must either all be present or all be absent.

`1789847112362-AllowTextRagDocuments.ts` expands `source_type` to `pdf` and
`text`, and makes `source_uri` nullable for honest manual-text sources. Its
rollback refuses to contract the schema while any text source or null URI
exists.

`1789847117759-DimensionRagChunkEmbeddings.ts` first rejects any existing
non-null vector whose dimension is not 768, then converts `embedding` to
`vector(768)`. It creates the partial
`idx_rag_chunks_embedding_hnsw_active` index with HNSW and
`vector_cosine_ops`, limited to non-deleted rows with an embedding. Rollback
drops that index and widens the column back to dimensionless `vector` without
rewriting or deleting embedding values.

Rollback of the original table migration removes the chunk foreign key and
indexes, then `rag_chunks`, followed by the document foreign key and indexes and
`rag_documents`. It does not modify `products` or remove the `vector` extension.

PostgreSQL 15 development databases are disposable for this transition. Recreate
them as empty PostgreSQL 17 databases and apply the complete migration chain;
there is no `pg_upgrade` or data-transfer path in scope.

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
