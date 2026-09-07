import type {AntiAISignalId} from '../art-direction';
import type {ForensicAntiAISignal} from './types';

export const FORENSIC_ANTI_AI_KNOWLEDGE_MAP: Readonly<Record<ForensicAntiAISignal, AntiAISignalId>> = {
  inconsistentLighting: 'inconsistent_light_sources',
  impossibleReflection: 'impossible_reflections',
  overSymmetry: 'unjustified_perfect_symmetry',
  fakeDepth: 'fake_depth_of_field',
  excessiveGlow: 'excessive_glow',
  arbitraryDecoration: 'purposeless_decoration',
  hyperPerfectSurface: 'hyper_perfect_surfaces',
  genericAITexture: 'meaningless_micro_details',
  perspectiveConflict: 'inconsistent_perspective',
};
