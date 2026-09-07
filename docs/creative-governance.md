# Creative Route Governance

Phase 5.1 formalizes: **model proposes; local governance verifies**. Provider confidence and declarations remain diagnostic metadata, not objective truth.

## Referential integrity

Message hierarchy items now carry stable IDs such as `msg_headline_01`, plus explicit/inferred provenance. Routes declare `messageRefsUsed` and `claimRefsUsed`. Claim references must identify explicit approved messages. A numeric guard separately scans communication fields for money, numbers, percentages, and dates absent from explicit copy facts; structured design scores are deliberately outside that scan.

Routes also reference `brandConstraintRefsApplied`, `brandConstraintRefsPotentiallyViolated`, `adaptationActionRefs`, `referencePrincipleRefs`, and `distinctiveAssetRefsUsed`. Unknown IDs fail governance. Required/forbidden brand constraints, logo fidelity, adaptation actions, validated reference principles, and must-preserve distinctive assets are checked against the supplied sessions rather than accepted from free text.

## Local dimensions

- Communication fit combines primary-message coverage, mandatory content, CTA treatment, hierarchy compatibility, and whether the creative device has a communication purpose.
- Constraint compliance compares the route against hard/prohibited brand rules, logo policy, claim integrity, referenced IDs, and format behavior.
- Brand fit measures hard-rule coverage, required distinctive assets, prohibited behavior, and meaningful device-to-brand connection.
- Reference transformation rewards valid structural principles and adaptation actions while subtracting literal imitation risk.
- Distinctiveness measures device specificity, purpose, brand connection, and pairwise route divergence.
- Originality measures concept specificity, Anti-Cliché discipline, and coherent territory—not strangeness.
- Anti-AI discipline checks strategy relevance against the global knowledge base and brand anti-pattern collisions; a populated array alone cannot earn a high score.

Each dimension stores `{value, sources[]}` in `evaluationProvenance`. Existing deterministic weights and tie-breaks remain, but hard gates now consume local results. A route cannot pass by setting `confidence = 1` or claiming no violations.

Creative Direction schema is `1.1.0`. Older sessions fail runtime validation and fingerprint comparison, forcing safe regeneration. Process-local cache remains only an optimization: cache correctness is not budget correctness. A ready session must have a selected route and no `failureReason`; failed sessions distinguish `insufficient_divergence`, `no_eligible_route`, and controlled `generation_failed`.
