# Catalog API

All routes are served below `/api`; the exhaustive OpenAPI contract is available
at `/api/docs`. Responses are plain JSON objects without an envelope. Validation
rejects unknown properties.

## Security

Catalog reads are public. Every catalog mutation requires a bearer JWT belonging
to an active user with the `admin` role. Missing or invalid authentication
returns 401; an authenticated non-admin user receives 403. Registration and
login remain public, while `GET /api/auth/check-status` requires authentication
without an administrative role.

The endpoint-by-endpoint access matrix, ownership decisions, and implementation
record are in
[`authentication-authorization-plan.md`](authentication-authorization-plan.md).

## Brands

Brand reads are public and brand mutations require `admin`. Creation accepts an
explicit `slug`; the API does not derive it from `name`.

| Method   | Route                                | Success | Purpose                    |
| -------- | ------------------------------------ | ------: | -------------------------- |
| `POST`   | `/brands`                            |     201 | Create a brand             |
| `GET`    | `/brands?limit=10&offset=0&name=son` |     200 | List non-deleted brands    |
| `GET`    | `/brands/:id`                        |     200 | Read a non-deleted brand   |
| `PATCH`  | `/brands/:id`                        |     200 | Update a non-deleted brand |
| `DELETE` | `/brands/:id`                        |     204 | Soft-delete a brand        |

Create fields are `name` (required, at most 100 characters), `slug` (required,
at most 120 characters), and `logoUrl` (optional URL or `null`). Patch accepts
the same fields optionally. Responses expose `id`, `name`, `slug`, `logoUrl`,
`createdAt`, and `updatedAt`; they do not expose `deletedAt`.

`GET /brands` uses the shared `limit`/`offset` pagination contract, defaulting to
10 and 0. The optional `name` parameter filters by a case-insensitive partial
match. Results are ordered by name and then ID. No pagination envelope or total
count is returned because neither is an established project convention.

Names and slugs are unique among non-deleted brands. Name uniqueness is
case-insensitive but otherwise uses the submitted value without whitespace
normalization. A duplicate returns 409. Deletion uses TypeORM soft delete,
ordinary reads exclude deleted rows, and partial unique indexes permit reusing a
deleted brand's name and slug.

## Approved persistence alignment

Catalog entities extend the existing shared `BaseEntity`. Consequently, the
implemented brand and category migrations use application-standard generated UUIDs and
`TIMESTAMPTZ` audit columns. This is an explicitly approved divergence from the
catalog reference SQL's non-generated UUID declaration and `TIMESTAMP` audit
columns. The reference schema documentation remains unchanged pending a separate
schema decision.

## Categories

Categories use the same plain responses, `limit`/`offset` pagination, optional
case-insensitive partial `name` filter, active-slug uniqueness, and soft-delete
behavior as brands.

| Method   | Route                           | Success | Purpose                             |
| -------- | ------------------------------- | ------: | ----------------------------------- |
| `POST`   | `/categories`                   |     201 | Create a root or child category     |
| `GET`    | `/categories?limit=10&offset=0&name=audio` |     200 | List and filter active categories   |
| `GET`    | `/categories/:id`               |     200 | Read an active category             |
| `PATCH`  | `/categories/:id`               |     200 | Partially update an active category |
| `DELETE` | `/categories/:id`               |     204 | Soft-delete a category              |

Creation requires `name` and explicit `slug`. `parentId` and `description` are
optional and nullable. A non-null `parentId` must reference an active category;
assigning the category itself as its parent returns 400. Responses expose the
scalar `parentId` but do not eagerly load or embed the parent entity.

The database foreign key uses `ON DELETE RESTRICT`. API deletion remains a soft
delete, so it updates `deletedAt` rather than physically deleting the row.

### Category attribute template

`category_attributes` provides suggested attributes for a category; it is not a
product-validation rule. Products may omit template attributes or use attributes
outside the template.

| Method   | Route                                             | Success | Purpose                      |
| -------- | ------------------------------------------------- | ------: | ---------------------------- |
| `GET`    | `/categories/:categoryId/attributes`              |     200 | List suggestions by position |
| `POST`   | `/categories/:categoryId/attributes`              |     201 | Add an attribute suggestion  |
| `DELETE` | `/categories/:categoryId/attributes/:attributeId` |     204 | Soft-delete a suggestion     |

The POST body requires `attributeId` and accepts optional non-negative `position`
(default `0`). Both category and attribute must be active. The active
`(categoryId, attributeId)` pair is unique, but the pair can be recreated after a
soft delete.

Responses include the association `id`, `attributeId`, attribute `name`,
`position`, and timestamps. They omit `categoryId` because it is already part of
the request URL.

## Attributes

Attributes define the reusable typed fields used later by product specifications.
They use the same CRUD routes, active-slug uniqueness, soft-delete behavior, and
`limit`/`offset` listing convention as the other catalog resources.

| Method   | Route                           | Success | Purpose                       |
| -------- | ------------------------------- | ------: | ----------------------------- |
| `POST`   | `/attributes`                   |     201 | Create an attribute           |
| `GET`    | `/attributes?limit=10&offset=0&name=battery` | 200 | List active attributes |
| `GET`    | `/attributes/:id`               |     200 | Read an active attribute      |
| `PATCH`  | `/attributes/:id`               |     200 | Partially update an attribute |
| `DELETE` | `/attributes/:id`               |     204 | Soft-delete an attribute      |

`name`, explicit `slug`, and `dataType` are required. `dataType` is constrained
to `string`, `number`, or `boolean`, mirroring the database check constraint and
the typed EAV model. `unit` is optional and nullable; it can be used for values
such as `hours` or `kg`. The optional `name` query performs a case-insensitive
partial match before pagination and accepts at most 100 characters. Attribute
responses do not expose soft-delete state.

## Products

The product resource stores its catalog identity and required brand/category
references. Images, specifications, price history, and dynamic EAV filters are
implemented as separate subresources and query parameters.
The collection accepts an optional `name` query of up to 100 characters for a
partial case-insensitive search, combinable with brand, category,
specification, and pagination filters.

| Method   | Route                         | Success | Purpose                  |
| -------- | ----------------------------- | ------: | ------------------------ |
| `POST`   | `/products`                   |     201 | Create a product         |
| `GET`    | `/products?limit=10&offset=0` |     200 | List active products     |
| `GET`    | `/products/search`            |     200 | Search with facets       |
| `GET`    | `/products/:id`               |     200 | Read an active product   |
| `PATCH`  | `/products/:id`               |     200 | Partially update product |
| `DELETE` | `/products/:id`               |     204 | Soft-delete a product    |

Creation requires `brandId`, `categoryId`, `name`, and explicit `slug`.
`model` and `description` are optional and nullable. A referenced brand or
category must be active; otherwise creation or update returns 404.

In addition to `brandId` and `categoryId`, `GET /products` supports a dynamic
specification filter. Provide `specAttributeId` and optionally exactly matching
`specStringValue` or `specBooleanValue`, or an inclusive numeric range with
`specNumberMin` and/or `specNumberMax`. Specification values without
`specAttributeId` are rejected with 400. Filters are applied together with the
normal brand/category constraints and pagination.

### Product search

`GET /products/search` is additive and does not change `GET /products`. It
accepts `q`, repeated `categoryId`, repeated `priceRange`, repeated `featureId`,
`sort`, `limit`, and `offset`. Categories use OR and include descendants, price
bands use OR, and selected boolean features use AND. Supported price bands are
`<500`, `500-999.99`, `1000-1499.99`, and `>=1500`.

Text relevance ranks exact, prefix, then contained matches. Without `q`,
`relevance` falls back to ascending product name. Price facets and sorting use
the latest active USD record. Products without USD sort last and do not match
price filters. The visible price remains the latest active record in any
currency. Facet counts apply the other filter groups and ignore their own.
The service uses a constant set of aggregate queries without per-product calls.

### Product RAG documents

`POST /products/:productId/rag-documents` requires `admin` and consumes
`multipart/form-data`:

- `file`: required PDF kept in memory for the duration of the request.
- `chunkSize`: optional integer from 200 through 4000; default `1200`.
- `chunkOverlap`: optional non-negative integer smaller than `chunkSize`;
  default `200`.

The 201 response contains `id`, `productId`, `name`, `sourceType`, `mimeType`,
`status`, `pageCount`, `chunkCount`, `fileSizeBytes`, `processedAt`, and
`createdAt`. Successful synchronous ingestion always returns `status: "ready"`.

Missing, non-PDF, corrupt, textless, or invalidly configured uploads return 400.
An absent active product returns 404. An active document with the same product
and SHA-256 content hash returns 409, including concurrent uploads. A normalized
embedding-provider failure returns 503. Authentication and authorization use the
standard 401/403 behavior.

### Product prices

`GET /products/:productId/prices` returns active historical price records in
descending `recordedAt` order. `POST /products/:productId/prices` accepts
`price`, uppercase three-letter `currency`, and `recordedAt`; it always creates
a new historical record. A duplicate active `(productId, recordedAt)` returns
409, and prices are never overwritten through this subresource.

`GET /products` supports `brandId` and `categoryId` UUID filters in addition to
the shared `limit` and `offset` parameters. Results expose only scalar brand and
category IDs in this stage, avoiding eager relation loading.

### Product images

| Method | Route                         | Success | Purpose                        |
| ------ | ----------------------------- | ------: | ------------------------------ |
| `GET`  | `/products/:productId/images` |     200 | List active images by position |
| `POST` | `/products/:productId/images` |     201 | Add a product image            |

Creation requires a valid URL and accepts optional nullable `altText` plus a
non-negative `position` (default `0`). Each active `(productId, position)` pair
is unique.

### Product specifications

Specifications use the public `{ "attributeId", "value" }` contract. The API
looks up the attribute type and stores the value internally as string, numeric,
or boolean; those persistence fields are never exposed. `PATCH` and `DELETE`
address the specification by `attributeId` in the URL.

## Favorites

Favorites are personal resources. All routes require a bearer JWT and derive
the owner from that JWT; requests and responses never contain `userId`.

| Method   | Route                         | Success | Purpose                         |
| -------- | ----------------------------- | ------: | ------------------------------- |
| `GET`    | `/favorites?productId=<uuid>` |     200 | List the current user's entries |
| `PUT`    | `/favorites/:productId`       |     200 | Create or restore idempotently  |
| `DELETE` | `/favorites/:productId`       |     204 | Remove idempotently             |

`PUT` returns 404 when the active product does not exist. Deletion is soft and
restoration reuses the existing favorite identity. Repository queries include
the authenticated user ID, so another user's favorite is not read or modified.
