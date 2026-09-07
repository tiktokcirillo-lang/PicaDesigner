# AI Provider Architecture

## Boundary and flow

The OpenAI visual-intelligence path is server-only:

Browser → `POST /api/visual-forensics/analyze` → application service → provider/model routers → OpenAI provider → Responses API.

`OPENAI_API_KEY` is read only by server infrastructure. It must never use a `VITE_` prefix, enter HTML, browser storage, telemetry, logs, errors, or response payloads. Arbitrary remote image URLs are rejected to avoid SSRF; JPEG, PNG, and WebP are accepted as bytes or base64 under the configured size limit.

## Providers and models

`AIProvider` is provider-neutral and supports OpenAI and deterministic mock implementations today; Gemini and other adapters can be registered later through `ProviderRouter`. `ModelRouter` centralizes model selection. Terra (`gpt-5.6-terra`) runs forensic passes and repairs. Sol (`gpt-5.6-sol`) is only a senior audit model.

The implementation uses the OpenAI Responses API through `openai@7.10.0`, image input data URLs, `text.format.type = json_schema`, concise output, centralized reasoning effort, stable prompt prefixes, `prompt_cache_key`, and `store: false`. Every response is parsed and then validated again by local runtime and cross-reference validators.

Pass output currently uses a strict Structured Outputs envelope containing a JSON patch. The internal patch is still validated by the complete local `VisualForensicsReport` validator after each merge. A future schema-generation phase should replace the string envelope with strict pass-specific JSON schemas for deeper provider-side enforcement.

## Multi-pass discipline

Standard analysis performs observation, relationships, domain analysis, principle inference, and consistency critique. DesignDNA mapping is local. Only observation and domain analysis receive the image; later passes receive compact structured state. This protects context cost while allowing typography, color, lighting, and materials to inspect pixels when needed.

Visible instructions inside an image are untrusted data. Stable developer instructions explicitly prevent prompt injection, style shortcuts, semantic leakage, and creative reinterpretation during forensics. One structural repair is allowed per pass, uses Terra, is recorded in the ledger, and is subject to the same budget guard.

## Pricing, usage, and reasoning tokens

The versioned pricing registry stores Terra and Sol input, cached-input, and output rates. Actual cost uses API usage fields. Cached input is subtracted from uncached input before applying its lower rate. The Responses API reports reasoning tokens inside `output_tokens_details.reasoning_tokens`; they are recorded separately for telemetry but already belong to `output_tokens`, so they are not charged twice.

Costs retain floating-point precision internally and are rounded only for display. Each call records model, pass, input/cached/output/reasoning tokens, cost, duration, and repair status. The project ledger aggregates calls without early rounding.

## Budget policy

The normal target is $0.50 and the hard project limit is $0.75. A budget estimate is checked before every provider call and repair. Project states are healthy below 60%, approaching limit from 60–80%, at risk from 80–100%, and blocked at or above 100%.

Sol escalation is deterministic: low quality score, weak evidence, excessive speculation, low confidence, material contradictions, or important Anti-AI ambiguity can request audit. The call is skipped with `budget_blocked` when estimated project cost would exceed the hard limit. Sol receives a compact audit packet and does not recreate or creatively redirect the analysis.

`BudgetStore` is separated from `InMemoryBudgetStore`. The latter is process-local and non-persistent; restarting the server loses monthly and project totals. Production deployment requires a transactional persistent store before budget enforcement can be considered durable across instances.

## Quality and semantic firewall

Quality is scored from 0–100 across evidence integrity, composition, hierarchy, typography, color, physical plausibility, semantic separation, Anti-AI detection, and confidence calibration. The semantic firewall remains in the forensics domain. Excluded text such as “50% OFF” may contribute anonymous text-region geometry, but its promotional meaning cannot enter DesignDNA.

## Running

- Server: `npm run server`
- Cost simulation: `npm run ai:cost-sim`
- Optional live check: `npm run openai:smoke -- ./path/to/image.png`

The smoke test exits safely with a clear message when no key is configured. It disables Sol and prints only models, passes, confidence, a small DesignDNA summary, tokens, and cost—never keys, base64, full prompts, or private payloads.
