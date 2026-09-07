# Visual Forensics Engine

## What is Visual Forensics?

Visual Forensics is the provider-independent domain layer that turns a reference into auditable structural evidence before creative interpretation. Its versioned `VisualForensicsReport` records canvas geometry, observed regions, measurements, relationships, domain analyses, semantic content, inferred principles, uncertainty, contradictions, Anti-AI findings, and evidence quality.

The engine defines contracts and validation; it does not perform computer vision or call an AI provider. The required order is image → observations → evidence → relationships → inferences → Design DNA.

## Why observation precedes inference

Raw observations contain only directly perceptible facts and always use `inferenceLevel: observed`. Claims such as likely material, lighting arrangement, design principle, or reading pattern live in separate inference structures and cite observation IDs. This prevents a plausible interpretation from being silently presented as a fact.

## Why relationships matter

Design behavior emerges from alignment, proximity, overlap, grouping, contrast, scale, spacing, continuation, and occlusion. A region alone says little about hierarchy; its relationships explain why it dominates, groups with another region, or directs attention. `VisualRelationship` therefore uses stable source and target IDs, evidence IDs, optional measurement, strength, and confidence.

## Semantic firewall

Literal content is stored in `SemanticFirewall.semanticObservations`, outside structural observations. Its policy reuses `SemanticExclusions` from Design DNA and covers people, faces, products, brands, logos, written content, locations, objects, scenes, and narrative. The mapper never transfers semantic observations into structural Design DNA fields. Structural properties of an excluded logo or product region may still be retained as anonymous geometry when they are relevant to composition.

## Confidence propagation

`propagateConfidence()` uses a weighted mean, caps it at the strongest dependency, and multiplies it by evidence sufficiency. Empty evidence returns zero. A derived claim therefore cannot exceed its strongest supporting item, and weak evidence coverage reduces it further. Mapping additionally caps section confidence by report confidence.

## From Visual Forensics to Design DNA

`mapForensicsToDesignDNA()` is separate from extraction. It maps only populated forensic sections, preserves evidence and confidence, records uncertain properties as speculative, builds professional metrics from measured analyses, links principles through the Art Direction Knowledge Base, and converts evidence-backed Anti-AI findings. It does not invent absent analysis.

## Multimodal provider integration

A future adapter implements `VisualForensicsExtractor.analyze(input)`. Inputs support URL, base64, or bytes, plus context, semantic exclusions, analysis depth, and language. Provider code remains outside this domain and must return a report that passes `validateVisualForensicsReport()`.

Prompt modules are split by responsibility: observation, relationships, composition, typography, color/light, inference, and critique. Builders add execution context without coupling instructions to Gemini, OpenAI, or another provider. Analytical passes explicitly preserve the sequence from raw facts to Design DNA mapping.
