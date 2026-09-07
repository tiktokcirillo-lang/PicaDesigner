# Creative Direction Engine

## Strategy before style

Creative Direction sits between validated intelligence and execution:

`communication + copy + brand + reference structure + adapted constraints + format → three routes → local evaluation → selected route → Design Spec`

It defines the idea, visual thesis, repeatable creative device, hero role, and conceptual art-direction strategy. It does not generate an image, layout coordinates, or final production geometry. Style is treated as a consequence of the audience response and communication problem—not as the starting point.

## Brief and explainability

`CommunicationBrief` preserves approved copy as source of truth. Objective, desired response, proposition, messages, proof, mandatory content, CTA, context, uncertainties, and confidence distinguish `explicit` facts from `inferred` interpretations. Inference never creates a price, discount, date, benefit, proof, guarantee, technical attribute, testimonial, or commercial claim.

The strategic frame turns the brief into communication problem/opportunity, single-minded proposition, message hierarchy, and explicit roles for brand, reference, and format. Optional `CreativeTension` and `VisualMetaphor` are allowed only when useful. `CreativeTerritory` describes strategic logic; it is not a style label. `CreativeDevice` must state a communication function and brand connection, making arbitrary decoration invalid.

Every `ArtDirectionRoute` includes concept and visual thesis, hero role, conceptual composition/hierarchy/type/color/image/space/material behavior, copy hierarchy, brand expression, reference principles, adaptation actions, distinctive assets, Anti-Cliché and Anti-AI strategies, format adaptability, production feasibility, divergence vector, confidence, and decision provenance. Coordinates and final image prompts are deliberately absent.

## Provider and structured output

The domain depends only on provider-neutral `CreativeRouteGenerator`. `OpenAICreativeRouteGenerator` uses the existing `AIProvider` and `BudgetedAIExecutor`; it never imports the OpenAI SDK. Terra receives compact brand/reference contexts, adapted constraints, the brief, stable policy modules, and a strict JSON Schema with real nested objects and `additionalProperties: false`. Local runtime validation follows Structured Outputs. At most one structural repair is allowed and cannot replace the ideas.

Prompt modules are separated conceptually into creative policy, communication brief, brand constraints, reference principles, adapted constraints, Anti-Cliché knowledge, route divergence, and output contract. No VisualForensics report, image base64, API key, raw prompt, or provider-private payload is stored in the session.

## Session, cache, and execution authority

`CreativeDirectionSession` is versioned and stores the normalized input fingerprint, brief, frame, three routes, local evaluations, deterministic selection, quality, warnings, source session versions, usage, and stage cost. Extra whitespace and line endings are normalized; material copy, objective, tone, format, brand/reference session, adapted constraints, or schema changes invalidate the cache.

Ready sessions become conceptual authority for `DesignSpecPromptBuilder`. Design Spec may resolve execution details but cannot silently replace the selected core idea, device, hero strategy, or brand adaptation. A failed direction returns `no_eligible_route` or `insufficient_divergence` and blocks Design Spec with “Não foi possível construir uma direção criativa válida.”

The existing Generate button invisibly ensures reference, brand, and Creative Direction before requesting Design Spec. Sessions are saved with projects and versions. `?debug=creative` reveals selected route, local scores, pairwise distances, risks, quality, and stage cost—but never private prompts.

## Budget

Creative Direction targets US$0.12 and has a US$0.18 stage ceiling. Its executor receives the lower of that stage ceiling and the remaining US$0.75 project limit. Initial generation and the single repair share this stage allowance. Reference, Creative Direction, Design Spec, and future critic calls use one application `BudgetStore` and load the existing project ledger.

The default `InMemoryBudgetStore` is useful locally but is not transactionally durable across Vercel cold starts or parallel instances. `DurableBudgetStore` marks the production extension point; a transactional external implementation is required before the hard cap can be guaranteed across all serverless invocations.
