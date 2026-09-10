# Campaign variant orchestration

A campaign family shares workspace input, reference intelligence, brand intelligence and one selected Creative Direction. The invariant lock is created once. From Layout onward each canonical Meta placement has independent lineage, status, geometry, review, render, asset resolution, pixel QA and production authority.

`ensureCampaignVariantFamily()` is idempotent by operation ID and deterministic fingerprint. It uses the existing responsive layout solver and rejects duplicated IDs, incorrect canvases, missing `responsive_reflow` provenance and identical normalized geometry. Approved variants are not rerun by local retry. A changed invariant fingerprint creates a new family rather than mutating an approved run.
