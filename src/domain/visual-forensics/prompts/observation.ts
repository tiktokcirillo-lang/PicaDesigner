import type {ForensicsPromptModule} from './types.js';

export const OBSERVATION_PROMPT: ForensicsPromptModule = {
  id: 'visual-facts-only', pass: 'raw_observation', objective: 'Record directly perceptible visual facts and measurable regions without interpretation.',
  instructions: ['Describe geometry, position, color, contrast, visible type blocks, edges, shadows, and empty areas.', 'Use normalized coordinates and estimates where possible.', 'Assign stable IDs to observations and regions.', 'Set inferenceLevel to observed for every raw observation.', 'Move literal content into semantic observations.'],
  prohibited: ['Marketing interpretation', 'Brand assumptions', 'Creative suggestions', 'Style or movement labels', 'Exact font identification', 'Naming people', 'Emotional or narrative interpretation', 'Inferring products from shape alone'],
  expectedOutputs: ['RawVisualObservation[]', 'VisualRegion[]', 'SemanticObservation[]'],
};
