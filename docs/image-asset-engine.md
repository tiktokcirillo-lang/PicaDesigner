# Image Asset Engine

Phase 9 converts unresolved, generatable `AssetRequirement`s from an approved `RenderSession` into governed assets. It first reuses project assets, then builds an `ImagePromptPlan`, resolves provider size/quality, reserves budget, calls a media-specific provider, validates bytes, stores them behind a `bytesRef`, and rebuilds the render session.

Logos, uploaded products/photos and content-bearing assets are never synthesized. Generated assets remain `qaPending`; image generation is not final artwork approval.

The initial `InMemoryGeneratedAssetStore` is intentionally non-persistent and unsuitable for durable serverless production storage. Replace it with object storage implementing `GeneratedAssetStore`; do not put image bytes in Redis or project JSON.
