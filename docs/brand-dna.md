# BrandDNA

BrandDNA describes the rules and recognizable decisions that make a brand itself. It is separate from Reference DesignDNA, which describes how a reference organizes communication. Manual brand input is deterministic, costs nothing, and never fetches a supplied website URL.

## Sources and authority

Every source records provenance: manual input, explicit guideline, logo/brand asset, existing campaign, website metadata, inference, or unknown. Authority is resolved in this order:

1. Explicit brand guideline
2. Explicit user constraint
3. Verified brand asset
4. Repeated existing pattern
5. Inferred property

An inference cannot override an explicit rule. One asset is weak evidence; repeated patterns record occurrences, source assets, consistency, and confidence.

## Brand system

The versioned schema supports logo variants, functional color tokens, typography roles and fallbacks, spacing character, shape language, iconography, photography and human-image policies, illustration, materials, textures, composition, motion, multidimensional personality, sophistication, accessibility, and distinctive assets. Missing information stays missing.

Colors are defined by role, priority, permitted pairings, usage, and optional coverage—not as a loose HEX list. Typography records role and behavior. If an exact family is unavailable, fallback substitution must be explicit. Personality is a set of evidence-backed visual communication traits, not a mystical archetype.

Official logos use `PRESERVE_LOGO_FIDELITY`: retain the source asset and prohibit distortion, rotation, unauthorized recoloring, effects, cropping, recomposition, and redrawing. Distinctive assets identify the color, shape, pattern, logo behavior, typography, composition, photography, graphic device, or iconography that must survive adaptation.

Brand-specific prohibited behavior is separate from the global Anti-AI knowledge base. It may reject generic gradients, unauthorized gold, wrong corner radii, excessive density, off-brand photography, or other explicit anti-patterns.

## Sessions and assets

`createBrandDNAFromInput()` converts the current color/font fields and expanded `BrandInput` into basic or defined BrandDNA without AI. Empty input produces identity mode `none`; it never creates fake official identity. `ProvisionalBrandSystem` is reserved for future clearly labeled provisional work.

`BrandIntelligenceSession` stores schema versions, identity mode, input and asset fingerprints, BrandDNA, evidence quality, confidence, warnings, and optional isolated AI usage. Changing brand colors, fonts, logos, assets, or rules changes its fingerprint. Copy, format, and reference changes do not.

`BrandAssetAnalyzer` is provider-agnostic. This phase includes a deterministic mock and the contracts required for future multimodal analysis of repeated brand signals. No asset is analyzed automatically and guideline PDF parsing remains deferred.
