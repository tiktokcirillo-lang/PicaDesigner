import {buildReferenceDesignContext} from '../reference-intelligence/design-context.js';
import type {DesignDecision, GenerateDesignSpecRequest} from './types.js';
import {adaptReferenceDNA, buildBrandDesignContext, createBrandIntelligenceSession, resolveBrandReferenceCompatibility, validateBrandIntelligenceSession, type AdaptedDesignConstraints, type BrandIntelligenceSession, type BrandReferenceCompatibilityReport} from '../../domain/brand-intelligence/index.js';
import {validateCreativeDirectionSession} from '../../domain/creative-direction/index.js';

export interface BuiltDesignSpecPrompt {instructions: string; input: string; decisions: DesignDecision[]}
export interface ResolvedBrandDesign {session: BrandIntelligenceSession; compatibility?: BrandReferenceCompatibilityReport; adapted?: AdaptedDesignConstraints; context?: ReturnType<typeof buildBrandDesignContext>}

const BASE_ART_DIRECTOR_POLICY = `You are not inventing an arbitrary visual style. Translate reference structural intelligence, project communication objective, brand constraints, and format constraints into an executable design system. Every major decision must trace to reference DNA, brand, communication, format, or explicitly identified creative interpretation.`;
const REFERENCE_POLICY = `Reference intelligence describes structural visual logic. Preserve hierarchy, proportions, rhythm, balance, spacing logic, color relationships, lighting behavior, material behavior, visual tension, and typography behavior. Do not copy literal people, products, logos, written text, exact brands, locations, or narrative objects unless explicitly requested. High-confidence reference DNA outranks a generic tone preset structurally. Soft influences are optional; context-only signals must never be forced.`;
const OUTPUT_CONTRACT = `Return a professional Portuguese specification with these sections: VALIDAÇÃO DE FORMATO E DIMENSÕES; CONCEITO VISUAL; TIPOGRAFIA; PALETA DE CORES; IMAGENS E DIREÇÃO DE ARTE; ICONOGRAFIA; LAYOUT; DETALHES DE LUXO. Keep recommendations executable and concise.`;

export class DesignSpecPromptBuilder {
  resolveBrand(request: GenerateDesignSpecRequest): ResolvedBrandDesign {
    if (request.brandIntelligence && (!validateBrandIntelligenceSession(request.brandIntelligence).success || request.brandIntelligence.projectId !== request.projectId)) throw new Error('Invalid or incompatible Brand Intelligence session.');
    const session = createBrandIntelligenceSession(request.brandInput, request.projectId, request.brandIntelligence);
    if (!session.brandDNA) return {session};
    const referenceDNA = request.referenceIntelligence?.designDNA;
    const compatibility = resolveBrandReferenceCompatibility(session.brandDNA, referenceDNA);
    const adapted = adaptReferenceDNA(referenceDNA, session.brandDNA, compatibility);
    return {session, compatibility, adapted, context: buildBrandDesignContext(session.brandDNA, compatibility, adapted)};
  }

  build(request: GenerateDesignSpecRequest, brand = this.resolveBrand(request)): BuiltDesignSpecPrompt {
    if (request.creativeDirection && (!validateCreativeDirectionSession(request.creativeDirection) || request.creativeDirection.projectId !== request.projectId || request.creativeDirection.status !== 'ready' || !request.creativeDirection.selectedRoute)) throw new Error('Não foi possível construir uma direção criativa válida.');
    const referenceContext = request.referenceIntelligence ? buildReferenceDesignContext(request.referenceIntelligence) : undefined;
    const route = request.creativeDirection?.selectedRoute;
    const modules = {
      projectContext: {copy: request.copy, tone: request.tone, destinationTool: request.destinationTool},
      formatRules: {format: request.format, instruction: 'Respect exact dimensions, aspect ratio, safe areas, and destination-tool constraints.'},
      brandContext: brand.context,
      referenceDesignDNA: referenceContext,
      creativeDirection: route ? {concept: route.concept, creativeDevice: route.creativeDevice, heroStrategy: route.heroStrategy, compositionStrategy: route.compositionStrategy, hierarchyStrategy: route.hierarchyStrategy, typographyBehavior: route.typographyBehavior, colorBehavior: route.colorBehavior, imageStrategy: route.imageStrategy, brandExpression: route.brandExpression, formatAdaptability: route.formatAdaptability, provenance: route.provenance} : undefined,
      copyHierarchy: {instruction: 'Derive title, subtitle, body, data, and CTA hierarchy only when present in the supplied copy.'},
    };
    const decisions: DesignDecision[] = [
      {decision: `Respect output format ${request.format}.`, domain: 'format', source: 'format'},
      {decision: `Communicate using the ${request.tone} tone.`, domain: 'communication', source: 'communication_strategy'},
      ...(route ? [{decision: `Execute the approved core idea: ${route.concept.coreIdea}`, domain: 'concept', source: 'creative_concept' as const, confidence: route.confidence}, {decision: `Use the approved creative device: ${route.creativeDevice.name}`, domain: 'creative_device', source: 'creative_device' as const, confidence: route.confidence}] : []),
      ...(referenceContext ? [{decision: 'Use reference structural DNA according to confidence authority.', domain: 'art_direction', source: 'reference_structure' as const, confidence: referenceContext.confidence}] : []),
      ...(brand.session.brandDNA?.hardConstraints.map(({domain, rule, confidence}) => ({decision: rule, domain, source: 'brand_hard_constraint' as const, confidence})) ?? []),
      ...(brand.session.brandDNA?.softPreferences.map(({domain, rule, confidence}) => ({decision: rule, domain, source: 'brand_soft_preference' as const, confidence})) ?? []),
      ...(brand.session.brandDNA?.brandDistinctiveness?.map(({type, description, confidence}) => ({decision: description, domain: type, source: 'brand_distinctive_asset' as const, confidence})) ?? []),
      ...(brand.compatibility?.adaptationPlan.map(({domain, instruction, confidence}) => ({decision: instruction, domain, source: 'adaptation' as const, confidence})) ?? []),
    ];
    const authority = route ? 'The selected Creative Direction route is the conceptual authority. Execute it faithfully. Do not replace its core idea, creative device, hero strategy, or brand adaptation logic. Resolve only execution details and preserve approved copy.' : '';
    return {instructions: [BASE_ART_DIRECTOR_POLICY, REFERENCE_POLICY, authority, OUTPUT_CONTRACT].filter(Boolean).join('\n\n'), input: JSON.stringify(modules), decisions};
  }
}
