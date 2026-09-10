# Campaign family export

Family export is server-authoritative and serialization-only: it may not create, resize or reflow a missing format. The intended deterministic ZIP order is `project_1x1.png`, `project_4x5.png`, `project_9x16.png`, `project_1.91x1.png`, then `manifest.json`. The manifest records format dimensions, checksums and authority/QA lineage without private backing references, signed URLs or prompts.

Migration `004_campaign_variant_families.sql` creates a separate family export-session table so single-format export semantics remain stable.
