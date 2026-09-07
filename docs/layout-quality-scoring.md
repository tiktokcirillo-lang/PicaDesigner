# Layout Quality Scoring

Layout candidates are evaluated locally from measurable geometry. Weights total 1.00:

| Dimension | Weight |
|---|---:|
| hierarchy | .15 |
| alignment | .10 |
| spacing consistency | .10 |
| grouping | .07 |
| negative space | .08 |
| balance | .08 |
| safe-area compliance | .12 |
| collision safety | .12 |
| text fit | .08 |
| brand compliance | .04 |
| route fidelity | .04 |
| format suitability | .02 |

The visual-mass center is compared with a restrained optical center and the route's balance intent, so deliberate asymmetry is not treated as accidental imbalance. Occupancy cells estimate visual/text/hero density, negative space and edge pressure.

An ineligible candidate cannot win. Hard failures include invalid normalized geometry, mandatory content outside the safe area, mandatory text overflow, unresolved unsafe collision, logo integrity failure, omitted legal content and required brand-constraint violations. Eligible ties resolve by hierarchy, text fit, collision safety, route fidelity and stable layout ID.
