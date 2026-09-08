# Render Asset Architecture

`ProjectAssetRegistry` stores metadata and backing references without duplicating bytes. `AssetBinaryResolver` separates binary access; the initial memory/browser contracts prepare later project storage.

Deterministic content includes copy, typography, supplied logos, colors, cards, borders, lines and basic vectors. Photography, realistic people/environments, complex illustration, 3D and synthetic textures become `AssetRequirement`s. Generative requirements default to no text, logos, brand marks, UI text or watermark. Official logos only accept `brand_asset`; a missing required logo keeps production readiness false.

The next Image Engine can consume AssetRequirement plus route image strategy and brand photography rules, returning a resolved asset without reinterpreting layout.
