export const STRATEGY_BEFORE_STYLE = 'Start with what the audience must understand, feel, or do; derive the visual idea before style.';
export const PREMIUM_FALLACY = 'Premium is not black and gold. It emerges from restraint, hierarchy, spacing, refinement, material control, precision, and consistency.';
export const ANTI_CLICHE_KNOWLEDGE = [
  {category:'premium',signals:['default black and gold','unmotivated marble','excessive luxury serif']},
  {category:'technology',signals:['random neon','circuit lines','holograms','floating UI','ubiquitous blue glow']},
  {category:'connectivity',signals:['meaningless network lines','generic signal waves','floating particles']},
  {category:'finance',signals:['coins','upward arrows','generic charts']},
  {category:'ai',signals:['floating 3D blobs','glass spheres','purple gradients','random chrome']},
  {category:'urgency',signals:['red badges everywhere','oversized exclamation marks']},
  {category:'culture',signals:['generic national symbols without contextual relevance']},
] as const;
export const CREATIVE_PROMPT_POLICY = ['Do not create a fictional brand name.','Do not redesign an official logo.','Do not invent commercial claims.','Do not copy literal reference identity.','Do not mistake style labels for concepts.','Do not use decoration without communication purpose.',PREMIUM_FALLACY,'Do not force visual metaphors.','Do not generate final layout coordinates.'] as const;
