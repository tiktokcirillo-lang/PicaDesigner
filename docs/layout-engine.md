# Professional Layout & Composition Engine

The Layout Engine converts an approved Creative Direction route into deterministic, normalized geometry. It does not reinterpret the concept and makes no AI call by default: concept precedes geometry, rules precede coordinates, and relationships precede pixels.

## Pipeline

`CreativeDirectionSession.ready → format → canvas/safe area → intent → archetype ranking → grid/tokens → three candidates → constraints and text fit → local quality scoring → hard gates → deterministic selection → LayoutPlan`

The format registry owns 1080×1080, 1080×1350, 1080×1920 and 1920×1080 definitions and temporary aliases. Unknown strings fail explicitly; bounded custom dimensions are accepted. Normalized rectangles are the logical authority and integer pixel rectangles are deterministic resolved output.

Safe area is composed from format policy, configurable platform chrome and bounded art-direction needs. Grid columns, baseline, gutter and spacing module respond to format, route density and Brand DNA rather than a universal margin or column count. Text blocks reference approved `MessageHierarchyItem.id`; logos reference original asset IDs.

The solver allocates major regions, maps hierarchy to area/type/isolation/layer order, estimates text capacity, places image/logo regions, builds occupancy and visual-mass metrics, detects collisions and applies hard gates. Mandatory copy is never deleted or rewritten. Missing fonts are marked `fallback` or `unresolved`.

## Authority and security

`POST /api/layout/plan` rebuilds the plan server-side from structured sessions and costs `$0.0000`. It fetches no URLs and executes no user HTML, SVG or script. `POST /api/layout/debug` emits a diagnostic SVG wireframe; its colors are technical and are not production design tokens.

The Design Spec receives the validated LayoutPlan as the sole geometric authority. It may explain absent details qualitatively but cannot invent coordinates, sizes, margins, grid counts or placement.
