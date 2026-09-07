# Creative Route Scoring

## Divergence

Exactly three candidate routes are expected. `calculateCreativeRouteDistance()` computes mean absolute distance across nine normalized dimensions: abstraction, human focus, product focus, editoriality, dynamism, minimalism, dimensionality, narrative depth, and typographic expression. Every pair must reach `MIN_ROUTE_DISTANCE = 0.25`; otherwise the session fails with `insufficient_divergence`. The vector supplements—not replaces—semantic divergence in concept, hero, device, spatial logic, image strategy, typography, and narrative.

## Risks and hard gates

Baseline risks in Brand × Reference compatibility remain distinct from route risks. `calculateRouteBrandDriftRisk()` and `calculateRouteReferenceImitationRisk()` use traits declared by each proposed route. Literal color/type/hero/device/treatment transfer raises imitation risk; departures in color roles, typography, logo handling, image character, shapes, distinctive assets, and prohibited behavior raise brand drift. These are evaluated locally, not copied from provider scores.

A route is ineligible when it declares a hard brand or logo violation, invents a commercial claim, has imitation risk above 0.40, brand drift above 0.35, constraint compliance below 0.70, or communication fit below 0.60. No ineligible fallback is silently selected.

## Deterministic score and selection

Eligible routes use this fixed weighted score:

| Dimension | Weight |
|---|---:|
| Communication fit | 0.20 |
| Brand fit | 0.18 |
| Constraint compliance | 0.15 |
| Distinctiveness | 0.12 |
| Reference transformation | 0.10 |
| Format fit | 0.08 |
| Production feasibility | 0.06 |
| Visual sophistication | 0.05 |
| Anti-AI discipline | 0.03 |
| Originality | 0.03 |

The highest eligible score wins. Ties resolve by lower brand drift, lower imitation risk, higher communication fit, then higher distinctiveness. This keeps provider generation separate from local governance and makes route selection reproducible.
