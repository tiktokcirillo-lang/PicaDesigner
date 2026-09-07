import type {AntiAISignalId, DesignPrinciple} from './types';

export interface AntiAISignalKnowledge {
  id: AntiAISignalId;
  name: string;
  diagnosticQuestion: string;
  defaultCorrection: string;
}

const signal = (id: AntiAISignalId, name: string, diagnosticQuestion: string, defaultCorrection: string): AntiAISignalKnowledge => ({id, name, diagnosticQuestion, defaultCorrection});

export const ANTI_AI_SIGNALS: readonly AntiAISignalKnowledge[] = [
  signal('unjustified_perfect_symmetry', 'Unjustified perfect symmetry', 'Does symmetry clarify meaning, or merely make the image feel generated?', 'Introduce optically balanced asymmetry tied to hierarchy.'),
  signal('excessive_cinematic_fog', 'Excessive cinematic fog', 'Is atmosphere motivated by the scene and communication goal?', 'Reduce haze and restore clear tonal separation.'),
  signal('unnecessary_volumetric_light', 'Unnecessary volumetric light', 'Would light beams exist with the visible environment and particles?', 'Keep only physically motivated light volume.'),
  signal('arbitrary_neon', 'Arbitrary neon', 'Does neon support brand, setting, or focal hierarchy?', 'Replace arbitrary neon with a purposeful accent palette.'),
  signal('excessive_bloom', 'Excessive bloom', 'Are highlights bleeding beyond plausible exposure?', 'Reduce bloom and preserve highlight detail.'),
  signal('excessive_rim_lighting', 'Excessive rim lighting', 'Does the rim correspond to a visible or plausible source?', 'Use subtler edge separation tied to the lighting setup.'),
  signal('hyper_perfect_surfaces', 'Hyper-perfect surfaces', 'Do materials lack production, age, or contact variation?', 'Add material-specific variation only where physically expected.'),
  signal('random_floating_particles', 'Random floating particles', 'Do particles communicate environment, motion, or scale?', 'Remove particles without semantic or spatial function.'),
  signal('purposeless_decoration', 'Purposeless decoration', 'Does each decorative element support hierarchy, brand, or meaning?', 'Remove or reassign decoration to a clear communication role.'),
  signal('impossible_reflections', 'Impossible reflections', 'Do reflections match geometry, viewpoint, and nearby objects?', 'Rebuild reflections from consistent surfaces and view angles.'),
  signal('physically_inconsistent_shadows', 'Physically inconsistent shadows', 'Do shadow direction, softness, and contact match the sources?', 'Unify shadows around a plausible lighting model.'),
  signal('excessive_local_contrast', 'Excessive local contrast', 'Is micro-contrast flattening the intended hierarchy?', 'Reserve local contrast for focal information.'),
  signal('excessive_sharpening', 'Excessive sharpening', 'Are halos or uniformly crisp details visible?', 'Reduce sharpening and vary acuity by depth and importance.'),
  signal('arbitrary_gradients', 'Arbitrary gradients', 'Does the gradient model light, depth, brand, or hierarchy?', 'Use flat color or a gradient with a defined role.'),
  signal('generic_futuristic_geometry', 'Generic futuristic geometry', 'Does the geometry communicate a specific product or idea?', 'Replace generic sci-fi forms with brand-specific structure.'),
  signal('plastic_skin', 'Plastic skin', 'Are pores, translucency, and tonal variation implausibly suppressed?', 'Restore restrained, natural skin response and texture.'),
  signal('meaningless_micro_details', 'Meaningless micro-details', 'Do tiny details survive at output scale or add meaning?', 'Simplify detail and concentrate resolution at focal areas.'),
  signal('excessive_bokeh', 'Excessive bokeh', 'Is bokeh optically plausible and compositionally useful?', 'Reduce highlight discs and preserve environmental context.'),
  signal('fake_depth_of_field', 'Fake depth of field', 'Does blur follow a coherent focus plane and depth map?', 'Align blur transitions with lens behavior and scene depth.'),
  signal('excessive_glow', 'Excessive glow', 'Are non-emissive elements glowing or losing edge definition?', 'Limit glow to emissive sources and controlled spill.'),
  signal('unnecessary_3d_objects', 'Unnecessary 3D objects', 'Do floating forms explain, frame, or reinforce the message?', 'Remove objects without a compositional or semantic job.'),
  signal('over_compositing', 'Over-compositing', 'Are too many treatments competing for attention?', 'Reduce layers and retain one clear visual proposition.'),
  signal('inconsistent_perspective', 'Inconsistent perspective', 'Do horizon, vanishing points, and object scale agree?', 'Reconstruct elements against a shared perspective system.'),
  signal('inconsistent_light_sources', 'Inconsistent light sources', 'Do highlights and shadows agree on source position and color?', 'Define key, fill, and ambient sources consistently.'),
];

const positivePrinciple = (id: string, name: string, description: string, rationale: string, signals: string[]): DesignPrinciple => ({
  id,
  name,
  domain: 'composition',
  description,
  professionalRationale: rationale,
  positiveSignals: signals,
  negativeSignals: [],
  applicableContexts: ['editorial', 'identity', 'advertising', 'digital', 'image making'],
  conflictsWith: [],
});

export const ANTI_AI_POSITIVE_PRINCIPLES: readonly DesignPrinciple[] = [
  positivePrinciple('anti-ai.intentional-asymmetry', 'Intentional asymmetry', 'Use unequal elements in deliberate optical balance.', 'Avoids static machine-like centering while retaining control.', ['weighted counterbalance', 'purposeful off-center focus']),
  positivePrinciple('anti-ai.optical-alignment', 'Optical alignment', 'Correct mathematical alignment for perceived shape and weight.', 'Human perception, not coordinates alone, determines felt alignment.', ['overshoot correction', 'alignment by visible edge']),
  positivePrinciple('anti-ai.controlled-imperfection', 'Controlled imperfection', 'Keep selective variation that reflects process and material.', 'Credible imperfection creates specificity without manufacturing noise.', ['material-specific variation', 'subtle irregularity']),
  positivePrinciple('anti-ai.plausible-light', 'Physically plausible light', 'Keep direction, falloff, color, reflection, and shadow coherent.', 'Lighting credibility anchors even stylized imagery.', ['consistent shadow direction', 'credible contact shadows']),
  positivePrinciple('anti-ai.editorial-restraint', 'Editorial restraint', 'Limit devices to those that support a clear point of view.', 'Selection creates authorship and protects hierarchy.', ['few purposeful treatments', 'clear pacing']),
  positivePrinciple('anti-ai.purposeful-texture', 'Purposeful texture', 'Choose texture to describe material, depth, era, or tone.', 'Texture is strongest when it carries information.', ['region-specific texture', 'material relevance']),
  positivePrinciple('anti-ai.controlled-grain', 'Controlled grain', 'Apply grain at output-aware scale and restrained density.', 'Consistent grain can unify sources without obscuring form.', ['coherent grain scale', 'preserved focal detail']),
  positivePrinciple('anti-ai.meaningful-contrast', 'Meaningful contrast', 'Concentrate contrast according to hierarchy.', 'Contrast is an attention budget, not a global effect.', ['focal contrast peak', 'quiet supporting regions']),
  positivePrinciple('anti-ai.functional-decoration', 'Functional decoration', 'Give ornament a framing, grouping, directional, or brand role.', 'Purpose turns decoration into communication.', ['reinforced grouping', 'brand-specific motif']),
  positivePrinciple('anti-ai.natural-material-response', 'Natural material response', 'Match roughness, reflection, translucency, and wear to material.', 'Specific response prevents generic plastic rendering.', ['material-specific highlights', 'credible surface variation']),
  positivePrinciple('anti-ai.clear-focal-hierarchy', 'Clear focal hierarchy', 'Create an explicit primary, secondary, and tertiary attention order.', 'A clear order makes complexity readable and intentional.', ['dominant first read', 'controlled eye path']),
];

export const findAntiAISignal = (id: AntiAISignalId): AntiAISignalKnowledge | undefined =>
  ANTI_AI_SIGNALS.find((item) => item.id === id);
