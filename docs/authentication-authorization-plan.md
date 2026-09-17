# Authentication and authorization implementation plan

Status: **implemented for catalog endpoints and favorites**. Favorites establish
the first service-scoped ownership model. Other personal-resource ownership and
a database role constraint remain deferred.

## 1. Executive recommendation

Keep the existing JWT authentication and introduce endpoint-local RBAC for the
catalog. Public catalog reads remain unguarded; catalog writes use the existing
`@Auth(...)` decorator with the administrative role; authenticated personal
resources must be scoped to the authenticated user's ID in their services.

For the current number of roles, the existing `users.roles text[]` column is
sufficient. A roles table, granular permissions, ABAC, CASL, a global auth guard,
and a new authorization dependency would add complexity without solving a
current requirement.

The current code enforces this target policy: catalog reads are public, every
catalog mutation requires `ADMIN`, and favorite routes require an active user
while scoping every operation to `user.id` from Passport.

## 2. Baseline repository diagnosis

This section records the state found before the authorization implementation.

### What exists

- NestJS domains exist for authentication, brands, categories, attributes, and
  products. Product images, prices, and specifications and category attributes
  are nested controllers within their parent domains.
- `AuthModule` is global and configures Passport JWT and `JwtModule`. JWTs expire
  after two hours and contain only `{ id }`.
- `JwtStrategy` extracts a bearer token, reloads the user by ID on every
  authenticated request, and rejects missing or inactive users with 401.
- Registration never accepts roles from the request. New users receive the
  database/entity default `['user']`.
- `User.roles` is a PostgreSQL `text[]`. `ValidRoles` currently contains
  `user`, `admin`, and `super-user`.
- `@Auth(...roles)` runs `AuthGuard('jwt')` before `UserRoleGuard`.
  `@Auth()` means authenticated with no role restriction. A failed role check
  returns 403.
- `@GetUser()` reads the authenticated `User` from the request and returns 401
  if Passport did not populate it.
- `ResourceOwnerGuard` and `@CheckOwner()` exist and have minimal unit coverage,
  but no module provides the guard and no route uses either artifact.
- Swagger has a bearer security scheme. Authentication response DTOs and the
  shared response decorators include Swagger metadata.
- Unit tests are colocated and HTTP e2e tests share the production bootstrap and
  validation setup. `test/roles.e2e-spec.ts` is skipped because there are no
  role-protected routes.
- The database migrations implement `users` and all currently exposed catalog
  tables. There are no favorites, comparisons, or conversations entities,
  migrations, modules, or endpoints yet.

### What is missing

- No catalog controller applies `@Auth`, so there is no authorization boundary
  around catalog mutations.
- There is no tested administrative endpoint and no active RBAC e2e suite.
- There is no application workflow for assigning or revoking administrative
  roles, nor a documented first-admin bootstrap procedure.
- Swagger does not document 401/403 or bearer requirements on catalog writes.
- There is no established ownership model because personal-resource domains do
  not exist.
- The roles array has no database constraint limiting its values. The TypeScript
  entity also exposes it as `string[]`, rather than `ValidRoles[]`.

### Decisions already established and worth preserving

- Keep controllers thin and put resource queries and ownership enforcement in
  injectable services.
- Keep Passport JWT authentication. Because the token contains only the user ID
  and the strategy reloads the user, role changes and deactivation take effect
  on the next request; roles must not be copied into JWT claims.
- Continue using standard Nest exceptions: unauthenticated/invalid identity is
  401, an authenticated principal lacking a role or ownership is 403, and an
  absent resource is 404.
- Keep plain responses, validated DTOs, relative imports, and existing Swagger
  conventions. Do not accept roles in registration or login DTOs.
- Keep `synchronize: false`; any future schema constraint requires a new
  migration rather than editing `CreateUsersTable1756425600000`.

## 3. Inconsistencies and risks

1. **Requested two-role RBAC versus three implemented roles.** The intended
   policy names `USER` and `ADMIN`, but `ValidRoles.SUPER_USER` exists and is the
   only role that bypasses `ResourceOwnerGuard`. The approved resolution is to
   remove it and use `ADMIN`; deployed values must be normalized first to avoid
   locking out an existing operator.
2. **Documentation versus runtime security.** Catalog documentation describes
   public resources, and runtime currently makes all catalog methods public.
   The proposed policy changes only mutations to administrative access.
3. **Generic ownership guard versus unproven ownership schema.** The guard
   assumes a route parameter named `id`, searches an arbitrary relation graph,
   returns true when `id` is absent, and cannot correctly scope list/create or
   nested-resource operations. Reusing it unchanged could authorize the wrong
   request or produce expensive queries.
4. **Roles lack persistence validation.** PostgreSQL accepts any string in the
   roles array. Application-only typing cannot prevent invalid values written by
   another process. This does not block the first RBAC rollout, but it is a data
   integrity decision.
5. **No role-administration path.** The approved interim mechanism is a controlled
   direct database update. Without completing that operation first, no user can
   perform protected catalog writes.
6. **Swagger helpers can overstate security.** Shared `Api*Responses` decorators
   default to bearer auth even though security is not globally enforced. Security
   metadata must follow actual guards, not HTTP method alone.
7. **Ownership semantics are not yet designable at entity level.** Favorites,
   comparisons, and conversations are product intentions only. Their routes,
   identifiers, relationships, sharing rules, and admin behavior must be decided
   when those domains are introduced.

## 4. Recommended authorization architecture

### Roles and persistence

Use the existing roles array for the initial rollout. It supports an account
having more than one role, requires no schema migration, and is adequate for a
small fixed role set. A normalized roles table is justified only when roles
become managed data with metadata or dynamic permissions.

Use `ValidRoles` at TypeScript boundaries and keep the server as the only source
of role information. Registration and authentication inputs must not accept a
role. Decide separately whether to add a PostgreSQL check constraint; if added,
first audit existing values and create a new migration.

The approved target is strict two-role RBAC. Remove `SUPER_USER` from
`ValidRoles` and remove its ownership bypass; only `ADMIN` authorizes catalog
mutations. Before deploying that change to an environment with existing users,
inspect `users.roles` and replace any `super-user` assignment with `admin`
directly in the database so an existing operator is not silently locked out.

### Guards and decorators

- Keep authentication opt-in and endpoint-local. Public reads need no decorator.
- Apply `@Auth(ValidRoles.ADMIN)` to each existing catalog mutation. Apply
  `@Auth()` to authenticated personal-resource endpoints.
- Do not introduce `@Public()` or a global JWT guard now. A deny-by-default global
  model could be reconsidered when authenticated domains dominate the API, but
  currently it would require marking every public read and authentication entry
  point and would be a broad behavioral change.
- Keep Passport before role evaluation so missing/invalid credentials return 401
  and valid users with insufficient roles return 403.
- Extend the authentication decorator, or a narrowly named administrative
  composite decorator, so runtime guards and OpenAPI bearer/401/403 metadata are
  declared together. Avoid a second authorization framework.

### Ownership

Prefer service-level scoping for future personal resources. The controller must
obtain `user.id` with `@GetUser('id')` and pass it to the service; repository
queries must include both the resource identifier and `userId`. This works for
lists, creates, direct IDs, and nested routes and prevents a caller from choosing
another owner in the request body.

For an existing ID owned by another user, returning 404 is recommended to avoid
confirming its existence. Use 403 only where the product contract deliberately
distinguishes a known resource from lack of ownership. An admin bypass should be
explicit per personal-resource use case, not inherited automatically from the
catalog role.

Do not apply the current `ResourceOwnerGuard` to future routes unchanged. Once a
real ownership schema exists, either replace it with direct service scoping or
redesign it around an explicit resolver contract and the actual route keys.

### JWT freshness and trust boundary

Continue signing only the immutable user ID. `JwtStrategy` already reloads
`roles` and `isActive`, so revocation, deactivation, and role changes become
effective without waiting for the two-hour token to expire. This adds one users
query per protected request, an acceptable cost for correct revocation at the
current scale. Neither role headers, body properties, query parameters, nor JWT
role claims should be trusted.

## 5. Target access matrix for existing endpoints

This is the implemented policy for current endpoints. “None” under ownership
means the resource is catalog data, not user-owned data.

| Method | Endpoint | Target access | Ownership | Guard/decorator | Notes |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | None | None | Server assigns the default user role. |
| `POST` | `/api/auth/login` | Public | None | None | Returns JWT after credential and active-status checks. |
| `GET` | `/api/auth/check-status` | Authenticated | Self | `@Auth()` + `@GetUser()` | Already enforced; returns the authenticated principal only. |
| `GET` | `/api/favorites` | Authenticated | Self | `@Auth()` + `@GetUser('id')` | Optional `productId`; service filters by authenticated user. |
| `PUT` | `/api/favorites/:productId` | Authenticated | Self | `@Auth()` + `@GetUser('id')` | Idempotent create/restore; client cannot select owner. |
| `DELETE` | `/api/favorites/:productId` | Authenticated | Self | `@Auth()` + `@GetUser('id')` | Idempotent soft delete scoped by user and product. |
| `POST` | `/api/brands` | Admin | None | `@Auth(ADMIN)` | Catalog mutation. |
| `GET` | `/api/brands` | Public | None | None | Public catalog discovery. |
| `GET` | `/api/brands/:id` | Public | None | None | Public catalog detail. |
| `PATCH` | `/api/brands/:id` | Admin | None | `@Auth(ADMIN)` | Catalog mutation. |
| `DELETE` | `/api/brands/:id` | Admin | None | `@Auth(ADMIN)` | Soft delete. |
| `POST` | `/api/categories` | Admin | None | `@Auth(ADMIN)` | Catalog mutation. |
| `GET` | `/api/categories` | Public | None | None | Public catalog discovery. |
| `GET` | `/api/categories/:id` | Public | None | None | Public catalog detail. |
| `PATCH` | `/api/categories/:id` | Admin | None | `@Auth(ADMIN)` | Catalog mutation. |
| `DELETE` | `/api/categories/:id` | Admin | None | `@Auth(ADMIN)` | Soft delete. |
| `GET` | `/api/categories/:categoryId/attributes` | Public | None | None | Public product-form metadata. |
| `POST` | `/api/categories/:categoryId/attributes` | Admin | None | `@Auth(ADMIN)` | Changes category metadata. |
| `DELETE` | `/api/categories/:categoryId/attributes/:attributeId` | Admin | None | `@Auth(ADMIN)` | Soft-deletes association. |
| `POST` | `/api/attributes` | Admin | None | `@Auth(ADMIN)` | Catalog mutation. |
| `GET` | `/api/attributes` | Public | None | None | Public filter metadata. |
| `GET` | `/api/attributes/:id` | Public | None | None | Public filter metadata. |
| `PATCH` | `/api/attributes/:id` | Admin | None | `@Auth(ADMIN)` | May affect specification semantics. |
| `DELETE` | `/api/attributes/:id` | Admin | None | `@Auth(ADMIN)` | Soft delete. |
| `POST` | `/api/products` | Admin | None | `@Auth(ADMIN)` | Catalog mutation. |
| `GET` | `/api/products` | Public | None | None | Includes current filters and pagination. |
| `GET` | `/api/products/:id` | Public | None | None | Public catalog detail. |
| `PATCH` | `/api/products/:id` | Admin | None | `@Auth(ADMIN)` | Catalog mutation. |
| `DELETE` | `/api/products/:id` | Admin | None | `@Auth(ADMIN)` | Soft delete. |
| `GET` | `/api/products/:productId/images` | Public | None | None | Public product presentation. |
| `POST` | `/api/products/:productId/images` | Admin | None | `@Auth(ADMIN)` | Catalog mutation. No update/delete endpoint exists. |
| `GET` | `/api/products/:productId/prices` | Public | None | None | Public price history. |
| `POST` | `/api/products/:productId/prices` | Admin | None | `@Auth(ADMIN)` | Immutable history insertion. |
| `GET` | `/api/products/:productId/specifications` | Public | None | None | Public product data. |
| `POST` | `/api/products/:productId/specifications` | Admin | None | `@Auth(ADMIN)` | Catalog mutation. |
| `PATCH` | `/api/products/:productId/specifications/:attributeId` | Admin | None | `@Auth(ADMIN)` | Catalog mutation. |
| `DELETE` | `/api/products/:productId/specifications/:attributeId` | Admin | None | `@Auth(ADMIN)` | Soft delete. |

Favorites, comparisons, and conversations are intentionally absent from the
matrix because no real endpoint exists. Their baseline policy should be
authenticated plus owner-scoped, not admin-only; their exact rows must be added
when their contracts are designed.

## 6. Incremental implementation plan

### Stage 0 — Record approved policy decisions

- **Objective:** freeze the approved semantics before changing externally visible
  access.
- **Affected artifacts:** this document and the decision record in section 8.
- **Changes:** record strict `USER`/`ADMIN`, direct database administration of
  roles for now, the deferred role constraint, ownership 404 behavior, and no
  implicit admin ownership bypass.
- **Dependencies:** none.
- **Acceptance:** every decision in section 8 is marked approved.
- **Risks:** an environment needs at least one user with `admin` assigned directly
  in `users.roles` before protected catalog writes are deployed. Existing
  `super-user` values must be replaced first.

### Stage 1 — Harden existing authorization primitives

- **Objective:** make the existing RBAC boundary typed, reusable, and documented.
- **Affected files:** `src/auth/interfaces/valid-roles.ts`,
  `src/auth/entities/user.entity.ts`, `src/auth/decorators/auth.decorator.ts`,
  `src/auth/guards/user-role.guard.ts`, `src/auth/auth.module.ts`, and their unit
  tests.
- **Changes:** type roles with `ValidRoles`; use handler/class metadata lookup;
  explicitly register required guards/providers; couple bearer and 401/403
  Swagger metadata to protected decorators; preserve JWT-before-role ordering.
  Do not add roles to `JwtPayload`.
- **Dependencies:** stage 0 role decision.
- **Acceptance:** `@Auth()` requires a valid active user; role-restricted auth
  accepts an allowed current database role, rejects an authenticated ordinary
  user with 403, and rejects missing/invalid JWT with 401.
- **Risks:** decorator metadata order and class-level metadata must be covered by
  tests; changing role representation must not expose a role input in DTOs.

### Stage 2 — Apply catalog policies one domain at a time

- **Objective:** protect all existing catalog writes while retaining public reads.
- **Affected files:** the eight catalog/nested controllers and their controller
  specs, in this order: brands, categories/category attributes, attributes,
  products/product images/product prices/product specifications.
- **Changes:** add the approved role decorator to every mutation in the matrix;
  leave every listed GET unguarded. Add Swagger 401/403 responses through the
  selected composite decorator.
- **Dependencies:** stage 1.
- **Acceptance:** each controller matches the matrix exactly; no service contract
  or successful response body changes.
- **Risks:** missing a nested mutation leaves a public write path. Implement and
  test by domain to keep reviews small.

### Stage 3 — Document direct database role administration

- **Objective:** ensure operators can assign `admin` without exposing
  self-promotion or adding application functionality at this stage.
- **Affected artifacts:** deployment/runbook documentation only.
- **Changes:** document the controlled database procedure for promoting a known
  existing user and for replacing existing `super-user` values with `admin`.
  Do not add an HTTP endpoint, seed, or application script yet.
- **Dependencies:** stage 0; can be delivered before stage 2 deployment.
- **Acceptance:** an operator can promote an already registered user by a
  deliberate database change; the application exposes no client role-assignment
  path.
- **Risks:** direct database changes bypass application validation and must be
  access-controlled, reviewed, targeted by immutable user ID, and verified after
  execution. Credentials and connection details must not be committed or logged.

### Stage 4 — Add ownership with each personal-resource domain

Favorites completed this stage with controller-derived `user.id` and
service-level `(userId, productId)` scoping. Future comparisons or conversations
must reuse this ownership pattern instead of the unused generic ownership guard.

- **Objective:** enforce per-user isolation when favorites, comparisons, or
  conversations are actually implemented.
- **Affected files:** future domain entities, migrations, controllers, services,
  DTOs, and tests; possibly removal/redesign of `ResourceOwnerGuard` and
  `@CheckOwner()`.
- **Changes:** add a non-client-controlled user foreign key; derive it from the
  authenticated principal; include `userId` in reads/updates/deletes; define the
  chosen 404/403 behavior and any explicit admin support access.
- **Dependencies:** real domain contracts and schema, plus stage 1.
- **Acceptance:** users cannot create for, list, read, modify, or delete another
  user's data; tests cover guessed UUIDs and nested routes.
- **Risks:** a generic guard alone cannot protect list and create operations.
  Ownership must be part of the data query and transaction design.

### Stage 5 — Optional database role constraint

- **Objective:** reject invalid roles at the persistence boundary if this extra
  integrity is approved.
- **Affected files:** a newly generated migration, `User` entity metadata if
  appropriate, and schema documentation. Never edit the initial users migration.
- **Changes:** audit distinct array values; normalize legacy values; add a check
  ensuring all role elements belong to the approved enum and optionally ensure
  the array is non-empty.
- **Dependencies:** approved strict role set and production-data audit.
- **Acceptance:** valid role combinations migrate and invalid inserts fail; up
  and down migrations are reviewed and tested.
- **Risks:** the constraint will fail on unknown deployed role values and may
  complicate future additions. It is optional for the initial endpoint rollout.

### Stage 6 — OpenAPI and documentation alignment

- **Objective:** make security requirements discoverable and truthful.
- **Affected files:** secured controllers/decorators, `docs/api.md`, `README.md`,
  `docs/database-schema.md`, and this plan/status document.
- **Changes:** mark only protected operations with bearer security; document 401
  and 403; publish the implemented access matrix and admin bootstrap; update the
  plan status and schema notes after any migration.
- **Dependencies:** stages 1–3 and stage 5 if selected.
- **Acceptance:** generated OpenAPI shows no lock on public reads and bearer plus
  401/403 on protected mutations; prose matches tested behavior.
- **Risks:** shared Swagger decorators with permissive defaults can drift from
  guards unless security metadata is composed with authorization.

### Stage 7 — Verification and rollout

- **Objective:** prove behavior and detect accidental contract changes.
- **Affected files:** auth/guard/controller unit specs,
  `test/roles.e2e-spec.ts`, relevant catalog e2e suites, and test utilities only
  where reusable setup is needed.
- **Changes:** activate the roles e2e suite; create ordinary/admin fixtures using
  server-controlled test setup; test each access class and representative nested
  endpoints; retain validation and success-path assertions.
- **Dependencies:** stages 1–3.
- **Acceptance:** all commands pass: `pnpm test`, `pnpm run test:e2e`,
  `pnpm run lint`, `pnpm typecheck`, and `pnpm run build`. Review lint changes.
- **Risks:** e2e requires the isolated, migrated PostgreSQL test database. A
  missing database must be reported, not treated as a passing test.

## 7. Test strategy and acceptance criteria

### Unit tests

- `UserRoleGuard`: no metadata, empty roles, allowed role, multiple allowed
  roles, missing user (401), insufficient role (403), and handler/class metadata.
- `Auth` decorator: Passport guard precedes role guard and Swagger metadata
  matches authenticated versus role-restricted use.
- Controllers: every mutation has the required metadata/guard while public GETs
  remain unguarded; controller delegation and DTO behavior remain unchanged.
- JWT strategy: valid user, unknown user, inactive user, and current roles loaded
  from the repository.
- Future ownership services: all queries include authenticated `userId`, ignore
  owner fields supplied by clients, and cover foreign-resource access.

### E2E tests

For each policy class, assert:

- public GET succeeds without `Authorization`;
- protected mutation without a token returns 401;
- malformed/expired token returns 401;
- active `USER` token on an admin mutation returns 403;
- approved administrative role succeeds and preserves the existing status/body;
- a role change or user deactivation affects the next request even with an old
  unexpired token;
- at least one nested mutation is protected, preventing route omissions;
- registration rejects undeclared role fields through the global whitelist.

The rollout is accepted only when all target matrix rows are represented by
controller inspection/tests, OpenAPI matches runtime guards, no password or
persistence-only field is exposed, and all repository quality commands pass (or
an unavailable e2e database is explicitly reported).

## 8. Approved decisions

1. **Role set:** use only `USER` and `ADMIN`. Remove `SUPER_USER`; normalize any
   existing database assignment to `admin` before deployment.
2. **Role administration:** do not add an endpoint, seed, or script yet. Promote
   known users by a controlled direct database change.
3. **Database constraint:** defer from the first authorization implementation,
   audit data, then add a separate migration if database-level enum integrity is
   desired.
4. **Ownership denial:** return 404 for another user's opaque personal-resource
   ID; use 403 only where existence is already visible by contract.
5. **Admin access to personal data:** no implicit bypass. Add support/moderation
   access only per use case with explicit audit requirements.

Stages 1–3 are implemented. Stage 4 remains tied to future personal-resource
designs rather than being invented in advance, and stage 5 remains deferred.
