import type {DesignDomain, DesignPrinciple, VisualMovementId} from './types';

export const ART_DIRECTION_VOCABULARY = {
  composition: ['symmetry', 'asymmetry', 'balance', 'tension', 'center of gravity', 'visual mass', 'directional flow', 'edge tension', 'cropping', 'framing', 'layering', 'overlap', 'focal placement'],
  visual_hierarchy: ['primary focal point', 'secondary focal point', 'tertiary focal point', 'eye-entry point', 'eye-exit point', 'reading order', 'attention anchors', 'contrast hierarchy', 'information hierarchy'],
  grid: ['modular grid', 'column grid', 'baseline grid', 'manuscript grid', 'rule of thirds', 'golden ratio', 'Z-pattern', 'F-pattern', 'radial composition', 'freeform editorial composition'],
  spacing: ['negative space', 'active space', 'passive space', 'margins', 'gutters', 'padding rhythm', 'proximity', 'density', 'whitespace ratio'],
  scale: ['hero scale', 'type scale', 'logo scale', 'object-to-canvas ratio', 'foreground/background ratio', 'scale contrast', 'dominance through scale'],
  typography: ['classification', 'personality', 'weight', 'width', 'x-height', 'stroke contrast', 'tracking', 'kerning', 'leading', 'line length', 'case', 'alignment', 'line breaks', 'hierarchy', 'optical sizing', 'headline behavior', 'text density'],
  color: ['dominant color', 'supporting colors', 'accent color', 'luminance', 'saturation', 'temperature', 'hue relationship', 'color coverage', 'contrast', 'foreground/background separation', 'tonal hierarchy', 'brand dominance'],
  lighting: ['key light', 'fill light', 'rim light', 'direction', 'size', 'softness', 'shadow hardness', 'shadow direction', 'specular intensity', 'diffusion', 'bounce', 'ambient illumination', 'color temperature', 'lighting contrast ratio'],
  photography: ['focal length character', 'camera angle', 'perspective', 'depth of field', 'focus hierarchy', 'exposure character', 'editorial vs commercial behavior', 'crop', 'subject isolation', 'lens distortion'],
  materials_and_finish: ['matte', 'gloss', 'satin', 'metallic', 'translucent', 'transparent', 'rough', 'polished', 'paper', 'plastic', 'glass', 'chrome', 'textile', 'natural material behavior'],
  texture: ['grain', 'noise', 'halftone', 'paper texture', 'film grain', 'surface imperfections', 'tactile contrast', 'texture density'],
  geometry: ['organic vs geometric', 'angularity', 'curvature', 'repetition', 'modularity', 'shape language', 'silhouette', 'contour behavior'],
  depth: ['foreground', 'midground', 'background', 'occlusion', 'atmospheric perspective', 'blur hierarchy', 'spatial layering', 'ambient occlusion'],
  gestalt: ['proximity', 'similarity', 'continuity', 'closure', 'figure-ground', 'common region', 'connectedness', 'symmetry', 'Prägnanz'],
  brand_language: ['personality', 'positioning', 'perceived price level', 'sophistication', 'accessibility', 'innovation', 'trust', 'energy', 'restraint', 'distinctiveness'],
} as const satisfies Partial<Record<DesignDomain, readonly string[]>>;

export interface VisualMovementKnowledge {
  id: VisualMovementId;
  name: string;
  context: string;
  principleIds: string[];
}

const movementPrinciple = (
  id: string,
  name: string,
  description: string,
  rationale: string,
  positiveSignals: string[],
  negativeSignals: string[],
  applicableContexts: string[],
  conflictsWith: string[] = [],
): DesignPrinciple => ({
  id,
  name,
  domain: 'visual_history_and_movements',
  description,
  professionalRationale: rationale,
  positiveSignals,
  negativeSignals,
  applicableContexts,
  conflictsWith,
});

export const DESIGN_PRINCIPLES: readonly DesignPrinciple[] = [
  movementPrinciple('swiss.grid-discipline', 'Grid discipline', 'Use a rational grid as an alignment system while allowing controlled asymmetry.', 'A shared grid creates order and makes scale, spacing, and typography carry hierarchy.', ['consistent alignments', 'asymmetric balance', 'objective typography', 'restrained ornament'], ['arbitrary offsets', 'decoration replacing hierarchy'], ['editorial', 'identity', 'information design']),
  movementPrinciple('bauhaus.form-follows-function', 'Form follows function', 'Reduce elements to purposeful geometry, material, type, and color.', 'Every formal decision should improve use, production, or communication.', ['functional geometry', 'primary forms', 'integrated type and image'], ['ornament without purpose', 'historical imitation'], ['identity', 'poster', 'product communication']),
  movementPrinciple('constructivism.dynamic-structure', 'Dynamic structural tension', 'Use diagonals, scale jumps, cropping, and photomontage to create directed energy.', 'Tension and directional force can make hierarchy immediate and socially forceful.', ['diagonal vectors', 'bold scale contrast', 'active cropping'], ['random agitation', 'illegible collision'], ['poster', 'campaign', 'cultural communication']),
  movementPrinciple('modernism.reduction', 'Modernist reduction', 'Remove nonessential form and expose a clear system of proportion and hierarchy.', 'Reduction improves legibility and lets content and structure remain primary.', ['simple geometry', 'clear hierarchy', 'honest material cues'], ['gratuitous ornament', 'nostalgic pastiche'], ['identity', 'architecture', 'editorial']),
  movementPrinciple('mid-century.human-geometry', 'Humanized geometry', 'Combine simple geometry with warm color, illustration, and approachable rhythm.', 'Modern clarity becomes more inviting when tempered by play and human scale.', ['warm restrained palette', 'playful abstraction', 'organic accents'], ['cold corporate uniformity', 'literal retro copying'], ['illustration', 'brand', 'editorial']),
  movementPrinciple('brutalism.raw-directness', 'Raw directness', 'Expose structure, contrast, and imperfect materiality with minimal mediation.', 'Unpolished form can communicate urgency, honesty, and anti-polish positioning.', ['visible structure', 'hard contrast', 'raw typography'], ['inaccessibility without intent', 'chaos presented as authenticity'], ['cultural', 'experimental', 'campaign']),
  movementPrinciple('postmodernism.rule-questioning', 'Rule questioning', 'Use quotation, contradiction, layering, and expressive typography to challenge a single rational order.', 'Controlled ambiguity can create cultural resonance and multiple readings.', ['intentional eclecticism', 'layered references', 'expressive type'], ['arbitrary mixing', 'reference without meaning'], ['cultural', 'editorial', 'fashion']),
  movementPrinciple('memphis.pattern-play', 'Pattern and geometric play', 'Build energetic systems from repeated shapes, bold color relationships, and deliberate visual wit.', 'Playful repetition can create memorability when hierarchy remains controlled.', ['rhythmic pattern', 'unexpected geometry', 'confident color'], ['undirected clutter', 'novelty overwhelming content'], ['youth', 'culture', 'campaign']),
  movementPrinciple('editorial-minimalism.pacing', 'Editorial pacing', 'Use whitespace, typography, and sparse image placement to control reading tempo.', 'Restraint makes sequencing, contrast, and content selection more meaningful.', ['generous whitespace', 'precise type scale', 'selective imagery'], ['emptiness without hierarchy', 'default minimalism'], ['editorial', 'portfolio', 'culture']),
  movementPrinciple('luxury-editorial.scarcity', 'Perceived value through scarcity', 'Use selective content, refined typography, tactile detail, and measured pacing.', 'Visual scarcity and craft cues can signal confidence and high perceived value.', ['controlled palette', 'fine typographic detail', 'high material fidelity'], ['generic black-and-gold', 'ornament as a shortcut to luxury'], ['luxury', 'fashion', 'hospitality']),
  movementPrinciple('japanese.ma-and-asymmetry', 'Ma and active emptiness', 'Treat empty space as an active interval and balance asymmetry through optical weight.', 'Intervals give objects presence and support nuanced, nonliteral relationships.', ['active negative space', 'optical balance', 'precise restraint'], ['token cultural motifs', 'emptiness without spatial tension'], ['editorial', 'packaging', 'identity']),
  movementPrinciple('contemporary-fashion.image-type-tension', 'Image–type tension', 'Use assertive crops, scale shifts, and typography as spatial material.', 'Product and attitude are communicated through controlled friction rather than literal description.', ['aggressive crop', 'type-image overlap', 'unexpected pacing'], ['trend mimicry', 'illegibility without editorial payoff'], ['fashion', 'beauty', 'campaign']),
  movementPrinciple('tech-minimalism.system-clarity', 'System clarity', 'Express technical sophistication through consistent spacing, restrained color, and legible modular systems.', 'Predictable structure builds trust while focused accents communicate action and innovation.', ['modular rhythm', 'clear states', 'purposeful accent color'], ['generic gradients', 'futuristic decoration without function'], ['technology', 'product', 'interface']),
  movementPrinciple('neo-brutalism.explicit-boundaries', 'Explicit boundaries', 'Use visible containers, direct typography, hard edges, and flat contrast to clarify structure.', 'Overt construction can feel energetic and accessible when interaction and hierarchy remain coherent.', ['strong outlines', 'flat color', 'clear containers'], ['visual noise', 'poor usability treated as style'], ['digital product', 'youth brand', 'campaign']),
  movementPrinciple('commercial-design.single-mindedness', 'Single-minded communication', 'Organize image, product, message, and action around one dominant communication objective.', 'Commercial effectiveness depends on rapid comprehension, relevance, and credible craft.', ['clear benefit hierarchy', 'product legibility', 'purposeful polish'], ['over-compositing', 'generic aspirational imagery'], ['advertising', 'retail', 'brand campaign']),
];

const MOVEMENT_NAMES: Record<VisualMovementId, string> = {
  swiss: 'International Typographic Style / Swiss',
  bauhaus: 'Bauhaus',
  constructivism: 'Constructivism',
  modernism: 'Modernism',
  mid_century_modern: 'Mid-century Modern',
  brutalism: 'Brutalism',
  postmodernism: 'Postmodernism',
  memphis: 'Memphis',
  editorial_minimalism: 'Editorial Minimalism',
  luxury_editorial: 'Luxury Editorial',
  japanese_graphic_design: 'Japanese Graphic Design',
  contemporary_fashion: 'Contemporary Fashion',
  tech_minimalism: 'Tech Minimalism',
  neo_brutalism: 'Neo-Brutalism',
  contemporary_commercial_design: 'Contemporary Commercial Design',
};

const MOVEMENT_PREFIXES: Record<VisualMovementId, string> = {
  swiss: 'swiss.', bauhaus: 'bauhaus.', constructivism: 'constructivism.', modernism: 'modernism.',
  mid_century_modern: 'mid-century.', brutalism: 'brutalism.', postmodernism: 'postmodernism.',
  memphis: 'memphis.', editorial_minimalism: 'editorial-minimalism.', luxury_editorial: 'luxury-editorial.',
  japanese_graphic_design: 'japanese.', contemporary_fashion: 'contemporary-fashion.',
  tech_minimalism: 'tech-minimalism.', neo_brutalism: 'neo-brutalism.',
  contemporary_commercial_design: 'commercial-design.',
};

export const VISUAL_MOVEMENTS: readonly VisualMovementKnowledge[] = (Object.keys(MOVEMENT_NAMES) as VisualMovementId[]).map((id) => ({
  id,
  name: MOVEMENT_NAMES[id],
  context: 'A reasoning lens made of transferable principles, never a literal preset or copying instruction.',
  principleIds: DESIGN_PRINCIPLES.filter((principle) => principle.id.startsWith(MOVEMENT_PREFIXES[id])).map((principle) => principle.id),
}));

export const findDesignPrinciple = (id: string): DesignPrinciple | undefined =>
  DESIGN_PRINCIPLES.find((principle) => principle.id === id);
