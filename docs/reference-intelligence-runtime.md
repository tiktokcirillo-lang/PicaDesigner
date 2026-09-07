# Reference Intelligence Runtime

## Runtime flow

PicaDesigner treats an uploaded JPEG, PNG, or WebP as a structural reference, not as a generic prompt attachment:

`upload → preview → Generate Design → Visual Forensics → DesignDNA → ReferenceIntelligenceSession → compact design context → Design Spec`

The default analysis depth is `standard`. Upload itself is free; paid analysis begins only when the user requests design generation. If analysis fails, generation stops with a clear error. No generic design is silently presented as reference-informed.

## Session and lifecycle

`ReferenceIntelligenceSession` is an application-layer, UI-independent versioned contract. It records project/session IDs, source metadata, analysis depth, status, forensics and DesignDNA schema versions, report, DesignDNA, quality, usage, and warnings. `ready` sessions can drive generation. A valid but insufficient report becomes `partial` and is blocked until evidence quality and overall confidence are both at least `0.60`.

The browser reads image width, height, size, and modification time when available. It computes a SHA-256 fingerprint over stable file metadata and image content. A session is reused only when fingerprint, project, analysis depth, session schema, forensic schema, and DesignDNA schema match. Changing/removing the image, changing depth, or encountering an incompatible schema invalidates reuse. Copy, tone, output format, and destination tool do not invalidate reference intelligence.

Projects store the session next to their normal state in the existing IndexedDB database. The session never contains image base64, so the report does not duplicate the existing uploaded-image payload. Restored projects and versions restore their reference session for reuse.

## Compact DesignDNA context

`buildReferenceDesignContext()` selects composition, hierarchy, grid, spacing, typography, color, lighting, materials, geometry, depth, Gestalt, concrete inferred principles, negative-space strategy, and sufficiently confident Anti-AI findings. Raw observations and full evidence chains are not sent to Design Spec generation.

Confidence controls authority:

- `>= 0.75`: strong structural constraint
- `0.50–0.74`: soft influence
- `< 0.50`: context only; never forced

High-confidence structural DNA outranks generic tone presets. Movement names are secondary metadata; concrete evidenced principles remain primary. The generation policy explicitly preserves structural logic while prohibiting copying literal people, products, logos, text, brands, locations, and narrative objects.

## Structured generation and provenance

The browser sends structured project data to `POST /api/ai/generate-design-spec`: copy, format, destination tool, tone, optional brand input, and optional validated reference session. `DesignSpecPromptBuilder` composes separate art-director policy, project context, reference DNA, brand, format, copy hierarchy, and output-contract modules server-side. The old `prompt` input remains as an internally deprecated compatibility path.

`DesignSpecificationResult` preserves textual `content` for the current UI and adds project ID, reference session ID, quality metadata, AI usage, and decision provenance. Provenance classifies decisions as reference DNA, brand, communication, format, or creative interpretation for future explainability.

## Cost separation and diagnostics

Reference analysis and Design Spec generation use separate ledgers. The browser derives `referenceAnalysisCost`, `designSpecCost`, and `projectTotalAiCost`; this prepares the future Project AI Cost view without weakening existing budget guards.

Add `?debug=forensics` to the application URL to show a development diagnostic containing only quality score, confidence, evidence quality, speculation risk, a compact DesignDNA summary, and reference-analysis cost. It does not display keys, base64, prompts, raw evidence, or private provider payloads.
