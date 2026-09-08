# Campaign packaging

`ApprovedProductionFamily` groups independently approved variants while preserving campaign invariants. Geometry may differ because every placement must have its own upstream layout and visual approval. The export engine never manufactures responsive variants.

The manifest records safe lineage IDs, dimensions, format IDs, checksums and QA status. It excludes prompts, keys, private backing refs, signed URLs, filesystem paths and budget internals. ZIP paths are sanitized and reject traversal.
