# Renderer integration for source assets

The source-asset registry maps official logos to `brand_asset` with `official_logo` provenance, product images to `user_upload` with `uploaded_product`, brand photos to `uploaded_photo`, and graphics to `graphic_device`. Visual references never enter this registry.

Rendering and QA accept canonical source IDs, re-resolve metadata server-side, and use a composite binary resolver that routes `source-private://` objects to the source store and generated objects to the generated-asset store. Private source backing references are removed from client responses. Missing required source backing remains unresolved and cannot trigger a provider-generated replacement for protected official/uploaded roles.
