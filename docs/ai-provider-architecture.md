# AI Provider Architecture

## Boundary and flow

The OpenAI visual-intelligence path is server-only:

Browser → `POST /api/visual-forensics/analyze` → application service → provider/model routers → OpenAI provider → Responses API.

`OPENAI_API_KEY` is read only by server infrastructure. It must never use a `VITE_` prefix, enter HTML, browser storage, telemetry, logs, errors, or response payloads. Arbitrary remote image URLs are rejected to avoid SSRF; JPEG, PNG, and WebP are accepted as bytes or base64 under the configured size limit.

Legacy text features follow the same boundary. `POST /api/ai/refine-copy` calls the dedicated `refineCopy()` application service, while `POST /api/ai/generate-design-spec` calls `generateDesignSpec()`. Both use provider-neutral contracts, the OpenAI adapter, the shared budget executor, pricing registry, cost ledger, usage accounting, and sanitized typed errors. Neither endpoint accepts or returns an API key.

## Providers and models

`AIProvider` is provider-neutral and supports OpenAI and deterministic mock implementations. OpenAI is the product's primary intelligence provider; the removed legacy provider is not a fallback or router option. `ModelRouter` centralizes model selection. Terra (`gpt-5.6-terra`) runs forensic passes, repairs, copy refinement, and legacy design-spec generation. Sol (`gpt-5.6-sol`) is only a senior audit model.

The implementation uses the OpenAI Responses API through `openai@7.10.0`, image input data URLs, `text.format.type = json_schema`, concise output, centralized reasoning effort, stable prompt prefixes, `prompt_cache_key`, and `store: false`. Every response is parsed and then validated again by local runtime and cross-reference validators.

Each model pass has its own strict JSON Schema with required properties and `additionalProperties: false`; there is no JSON-inside-a-string envelope. Nullable fields are explicit where a pass may lack evidence. Every structured response is still normalized, merged into the accumulated report, and checked by the complete local runtime and cross-reference validators before the next pass.

## Multi-pass discipline

Standard analysis performs observation, relationships, domain analysis, principle inference, and consistency critique. DesignDNA mapping is local. Only observation and domain analysis receive the image; later passes receive compact structured state. This protects context cost while allowing typography, color, lighting, and materials to inspect pixels when needed.

Visible instructions inside an image are untrusted data. Stable developer instructions explicitly prevent prompt injection, style shortcuts, semantic leakage, and creative reinterpretation during forensics. One structural repair is allowed per pass, uses Terra, is recorded in the ledger, and is subject to the same budget guard.

## Pricing, usage, and reasoning tokens

The versioned pricing registry stores Terra and Sol input, cached-input, cache-write, and output rates. Cache writes cost $2.50/M tokens for Terra and $5.00/M for Sol. Actual cost uses API usage fields. Cached input and cache-write tokens are each subtracted from ordinary input before their respective rates are applied, so no input token is charged twice. Missing cache-write usage is normalized to zero. The Responses API reports reasoning tokens inside `output_tokens_details.reasoning_tokens`; they are recorded separately for telemetry but already belong to `output_tokens`, so they are not charged twice.

Costs retain floating-point precision internally and are rounded only for display. Each call records model, pass, input/cached/cache-write/output/reasoning tokens, configured maximum output, output utilization, cost, duration, and repair status. The project ledger aggregates calls without early rounding. Telemetry can therefore reveal passes that routinely reserve excessive output without exposing prompts or image data.

## Budget policy

The normal target is $0.50 and the hard project limit is $0.75. A budget estimate is checked before every provider call and repair. Project states are healthy below 60%, approaching limit from 60–80%, at risk from 80–100%, and blocked at or above 100%.

Sol escalation is deterministic: low quality score, weak evidence, excessive speculation, low confidence, material contradictions, or important Anti-AI ambiguity can request audit. The call is skipped with `budget_blocked` when estimated project cost would exceed the hard limit. Sol receives a compact audit packet and does not recreate or creatively redirect the analysis.

`BudgetStore` is separated from `InMemoryBudgetStore`. The latter is process-local and non-persistent; restarting the server loses monthly and project totals. Production deployment requires a transactional persistent store before budget enforcement can be considered durable across instances.

## Quality and semantic firewall

Quality is scored from 0–100 across evidence integrity, composition, hierarchy, typography, color, physical plausibility, semantic separation, Anti-AI detection, and confidence calibration. The semantic firewall remains in the forensics domain. Excluded text such as “50% OFF” may contribute anonymous text-region geometry, but its promotional meaning cannot enter DesignDNA.

## Running

- API server: `npm run server`
- Vite frontend: `npm run dev` (development requests under `/api` are proxied to `http://localhost:3001`)
- Cost simulation: `npm run ai:cost-sim`
- Optional live check: `npm run openai:smoke -- ./path/to/image.png`
- Explicit Sol permission: add `--allow-sol`
- Per-run guard: add `--max-cost 0.50` (default $0.50; values above the $0.75 hard cap are rejected)
- Save non-sensitive local calibration: add `--save-calibration`

The smoke test exits safely with a clear message when no key is configured. Sol is disabled unless explicitly permitted. Output is limited to models, passes, quality/confidence, token categories, output utilization, budget state, and cost—never keys, base64, full prompts, or private payloads. Saved calibration contains only aggregate usage and image dimensions, is gitignored, and is written with owner-only permissions.

The simulator reports LOW, NORMAL, and HIGH synthetic scenarios. `REAL_CALIBRATED` is intentionally unavailable until `data/ai-cost-calibration.json` exists; it never fabricates real-world calibration data.

On Vercel, `api/index.ts` exports the same Express application as a Node.js Function. `vercel.json` routes `/api/*` to that function and grants sufficient duration for multimodal analysis. The Vite static frontend and server API are therefore deployed together without starting a persistent Express listener.

The serverless dependency tree uses explicit `.js` ESM specifiers in TypeScript source and `module`/`moduleResolution: NodeNext`. TypeScript resolves those specifiers back to source `.ts` files during development, while emitted Node.js code retains valid runtime paths. This prevents extensionless imports from surviving into the Vercel function. `GET /api/health` is a provider-independent readiness check and never reads or reveals credentials.

## API errors

The HTTP adapter maps unsupported input to 400, authentication to 401, exhausted project budget to 402, rate limiting to 429, validation/pipeline failures to 422, timeouts to 504, and unexpected provider failures to 500. Responses are sanitized and never include authorization headers, image payloads, keys, or full upstream bodies.
