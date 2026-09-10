# Final Production & Export Engine

Exports accept only a `VisualApprovedRenderPackage`. Preflight checks visual approval, QA/render lineage, canonical SVG checksums, production readiness, required placeholders and every active generated-asset backing. Export never falls back to a superseded asset and never calls an AI provider; `cost.aiUsd` is always exactly `0`.

PNG is rendered losslessly from canonical SVG plus final active assets at the approved scene dimensions. WebP keeps those dimensions with explicit quality 92. PDF is a digital client proof, one scene per page, and makes no CMYK, PDF/X or print-proof claim. SVG is a safe self-contained derivative; canonical SVG is not mutated. Multi-scene order follows `RenderDocument`.

The export fingerprint excludes timestamps/debug state and includes canonical/active checksums, requested formats, profile and policy versions. Matching sessions are reused only while all artifact backings still exist.
# Campaign families

Meta family export requires four existing server-side authorities. Export serializes approved artifacts and never generates a missing placement.
