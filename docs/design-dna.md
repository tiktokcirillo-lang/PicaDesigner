# Design DNA and Art Direction Knowledge

## What is Design DNA?

`DesignDNA` is the versioned, provider-independent representation of a visual system. It describes composition, hierarchy, grid, spacing, scale, typography, color, lighting, photography, materials, texture, geometry, depth, Gestalt behavior, brand language, movement influence, professional metrics, Anti-AI risk, evidence, and semantic exclusions.

It is deliberately more rigorous than a generic image description: measurable properties use normalized values, structured ranges, enums, arrays, and normalized coordinates. `schemaVersion` enables future migrations without silently changing meaning.

The minimum valid object is available through `createMinimalDesignDNA()`. Runtime consumers must call `validateDesignDNA()` or `assertDesignDNA()` before trusting external or AI-produced data.

## What is the Art Direction Knowledge Base?

The knowledge base is structured domain data, independent of React and any AI provider. `ART_DIRECTION_VOCABULARY` defines the professional analysis surface. `DESIGN_PRINCIPLES` explains reusable principles with rationale, positive and negative signals, contexts, and conflicts. `VISUAL_MOVEMENTS` links movements to principles; movements are reasoning lenses, never presets to copy literally.

Anti-AI knowledge is kept separately as diagnostic signals and positive counter-principles. Each detected signal records severity, confidence, reason, correction, and optional evidence.

## Why separate visual structure from semantic content?

Reference analysis should preserve visual logic without copying identity, faces, people, products, brands, text, logos, locations, objects, or narrative meaning. `SemanticExclusions` makes that boundary explicit for every extraction. A future reinterpretation stage can therefore reuse relationships such as hierarchy, rhythm, contrast, and spacing while replacing literal content.

## Evidence and confidence

Every major conclusion can cite `VisualEvidence`: an observation, optional normalized region, confidence from 0 to 1, and an inference level. The levels distinguish directly observed facts from strong inference and speculation. Collections separate `observedFacts`, `inferredProperties`, and `uncertainProperties`, preventing speculative output from being presented as objective fact.

Professional metrics also pair their normalized value with confidence and optional evidence. They are estimates for comparison and reasoning, not absolute truth.

## Guidance for future AI extractors

1. Inspect literal features and record evidence before making structural conclusions.
2. Apply semantic exclusions before deriving reusable visual logic.
3. Populate only supported fields; place weak claims in `uncertainProperties` and lower confidence.
4. Associate movement influence with matched principle IDs and evidence, not style labels alone.
5. Run Anti-AI diagnostics and record a concrete reason and correction for every detected signal.
6. Validate the final object at the provider boundary before passing it to critique or prompt-building stages.

The intended pipeline is: reference image → observed evidence → structural analysis → applicable design principles → validated Design DNA → creative reinterpretation.
