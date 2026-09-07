# Durable AI Budget

## Audited limitation

Before Phase 5.1, each warm process shared an `InMemoryBudgetStore`, but enforcement still followed read → provider call → save. Cold starts lost state, independent Vercel instances could not see one another, and two concurrent invocations could reserve the same remaining balance. Monthly checks were also not uniformly applied to text calls.

## Reservation lifecycle

Every paid call now goes through `BudgetedAIExecutor` → `ProjectAIBudgetCoordinator` → `BudgetStore`:

1. Estimate cost and multiply by `AI_BUDGET_RESERVATION_SAFETY_FACTOR` (default 1.20).
2. Convert to integer microUSD (`1 USD = 1,000,000 microUSD`) using nearest-microUSD rounding for USD conversion and ceiling for the safety-adjusted reservation.
3. Atomically verify project spent + reserved, UTC monthly spent + reserved, and optional stage spent + reserved.
4. Reserve before contacting the provider.
5. Commit actual usage and cost after a response, releasing unused reserved capacity. `budgetOverrun` records the exceptional case where actual exceeds reserved.
6. Release on a known pre-response failure. A timeout has ambiguous provider outcome, so its reservation becomes `unknown_provider_outcome` and remains capacity-consuming until expiry.

Reservation TTL defaults to 600 seconds. In-memory validation reclaims expired entries before capacity checks. Upstash tracks reservation expiries in a sorted set; the reserve Lua script reclaims expired reservation counters atomically before evaluating a new reservation.

## Upstash atomicity and keys

`UpstashBudgetStore` uses `@upstash/redis` and Lua/EVAL for check + reserve, commit, and release. There is no GET/GET/SET admission sequence. The namespace is:

- `picadesigner:ai:project:{projectId}`
- `picadesigner:ai:project:{projectId}:calls`
- `picadesigner:ai:project:{projectId}:stage:{stage}`
- `picadesigner:ai:month:{YYYY-MM}`
- `picadesigner:ai:reservation:{reservationId}`
- `picadesigner:ai:operation:{operationId}`

Project/stage/call data expire after 90 days of inactivity, monthly aggregates after 18 months, and active reservations after their logical 10-minute TTL plus a short diagnostic window. Months always use UTC `YYYY-MM`.

`operationId` is a stable technical fingerprint of project, stage, pass, schema, repair state, and input fingerprint. Concurrent duplicate operations are rejected before a second provider call. Returning a previously completed AI result still requires a separate future result cache; budget idempotency does not pretend to be response persistence.

## Store selection and failure mode

`createBudgetStore()` selects Upstash when either the Upstash variables or documented Vercel KV-compatible aliases are present. Development/test without Redis uses the atomic in-process mock store. Production without durable credentials fails closed before every paid provider call unless the explicit `AI_ALLOW_INMEMORY_BUDGET=true` override is set. Redis outages also fail closed with the sanitized message “AI budget service temporarily unavailable.” The main health route remains independent; `GET /api/health/ai-budget` reports only status, store class, and atomic-reservation capability.

Required Vercel production variables:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
AI_MAX_PROJECT_COST_USD=0.75
AI_TARGET_PROJECT_COST_USD=0.50
AI_MONTHLY_BUDGET_USD=15
AI_BUDGET_RESERVATION_TTL_SECONDS=600
AI_BUDGET_RESERVATION_SAFETY_FACTOR=1.20
AI_ALLOW_INMEMORY_BUDGET=false
```

`KV_REST_API_URL` and `KV_REST_API_TOKEN` are accepted explicit aliases. None may use `VITE_` or enter browser code.

## Privacy

The financial store contains only project/operation/reservation identifiers, UTC timestamps, model/pass/stage, token usage, safe request ID, duration, output utilization, and costs. It never stores API keys, authorization headers, images/base64, prompts, full copy, BrandDNA, VisualForensics, or Creative Direction payloads.
