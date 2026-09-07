import type {ObservationDomain} from './types.js';

export interface SeniorDesignerQuestion {id: string; domain: ObservationDomain; question: string; examines: string[]}

export const SENIOR_DESIGNER_QUESTIONS: readonly SeniorDesignerQuestion[] = [
  {id: 'hierarchy.first-dominance', domain: 'visual_hierarchy', question: 'What dominates first, and why?', examines: ['salience', 'hierarchy factors']},
  {id: 'spacing.intentional-absence', domain: 'spacing', question: 'What is intentionally absent?', examines: ['negative space', 'restraint']},
  {id: 'composition.gravity', domain: 'composition', question: 'Where is the visual center of gravity?', examines: ['visual mass', 'optical center']},
  {id: 'hierarchy.non-scale', domain: 'visual_hierarchy', question: 'What creates hierarchy besides scale?', examines: ['contrast', 'isolation', 'position', 'color', 'depth']},
  {id: 'relationships.move-impact', domain: 'relationships', question: 'What would break if this element moved?', examines: ['alignment', 'grouping', 'continuation']},
  {id: 'relationships.alignment', domain: 'relationships', question: 'Which alignment relationships organize the composition?', examines: ['grid', 'alignment deviation']},
  {id: 'hierarchy.eye-path', domain: 'visual_hierarchy', question: 'Where does the eye enter and where is it guided next?', examines: ['entry point', 'attention sequence', 'exit point']},
  {id: 'spacing.active-whitespace', domain: 'spacing', question: 'Is whitespace passive or performing a compositional function?', examines: ['active space', 'balance contribution']},
  {id: 'hierarchy.contrast-mechanism', domain: 'visual_hierarchy', question: 'Which contrast mechanism is doing most of the work?', examines: ['scale', 'luminance', 'color', 'sharpness']},
  {id: 'composition.asymmetry-control', domain: 'composition', question: 'Is asymmetry controlled or accidental?', examines: ['balance', 'counterweight', 'edge tension']},
  {id: 'lighting.form-consistency', domain: 'lighting', question: 'Does the light describe the form consistently?', examines: ['shadow', 'specular', 'source direction']},
  {id: 'materials.physical-plausibility', domain: 'materials_and_finish', question: 'Are materials behaving physically plausibly?', examines: ['roughness', 'reflection', 'edge behavior']},
  {id: 'composition.structure-decoration', domain: 'composition', question: 'Which visual decisions are structural versus decorative?', examines: ['function', 'dependency', 'hierarchy']},
  {id: 'geometry.rhythm', domain: 'geometry', question: 'Is repetition creating rhythm or redundancy?', examines: ['repetition', 'variation', 'spacing']},
  {id: 'hierarchy.salience-density', domain: 'visual_hierarchy', question: 'Which element has the highest salience per unit of area?', examines: ['salience', 'area ratio']},
  {id: 'brand.perception', domain: 'brand_language', question: 'Which structural decisions make the composition feel premium, editorial, commercial, playful, or generic?', examines: ['spacing', 'typography', 'material', 'restraint']},
];
