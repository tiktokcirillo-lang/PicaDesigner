import {ANTI_AI_SIGNALS} from '../../domain/art-direction/index.js';
import {ANTI_CLICHE_KNOWLEDGE, CREATIVE_PROMPT_POLICY, type CommunicationBrief, type CreativeDirectionRequest} from '../../domain/creative-direction/index.js';

export const buildCreativePromptModules = (brief: CommunicationBrief, request: CreativeDirectionRequest, contexts: {brand?: unknown; reference?: unknown; adapted?: unknown}) => ({
  creativePolicy: CREATIVE_PROMPT_POLICY,
  communicationBrief: brief,
  brandConstraints: contexts.brand,
  referencePrinciples: contexts.reference,
  adaptedConstraints: contexts.adapted,
  antiCliche: ANTI_CLICHE_KNOWLEDGE,
  antiAi: ANTI_AI_SIGNALS.map(({id, diagnosticQuestion, defaultCorrection}) => ({id, diagnosticQuestion, defaultCorrection})),
  routeDivergence: 'Create exactly three conceptually distinct routes. Diverge in at least three of concept, hero, device, spatial logic, imagery, typography, narrative, and abstraction. Pairwise normalized vector distance must be at least 0.25.',
  outputContract: 'Return concise structured data only. Preserve approved copy. Use null for an unnecessary tension or metaphor. Declare every possible violation, invented claim, literal reference transfer, and brand-drift trait in its audit array. Do not generate coordinates or image prompts.',
  project: {format: request.format, destinationTool: request.destinationTool, tone: request.tone},
});
