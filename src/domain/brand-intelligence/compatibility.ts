import type {DesignDNA} from '../art-direction/index.js';
import {selectAuthoritativeConstraint, TRANSFER_PRINCIPLES_NOT_IDENTITY} from './constraints.js';
import type {AdaptedDesignConstraints, BrandAdaptationAction, BrandDNA, BrandReferenceCompatibilityReport} from './types.js';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const colors = (reference?: DesignDNA) => (reference?.color?.palette ?? []).map(({hex}) => hex?.toUpperCase()).filter(Boolean) as string[];
const brandColors = (brand: BrandDNA) => brand.colorSystem?.tokens.map(({value}) => value.toUpperCase()) ?? [];
const referenceTypography = (reference?: DesignDNA) => reference?.typography?.samples.map(({classification}) => classification).filter((value) => value !== 'unknown') ?? [];

export const calculateBrandDriftRisk = (brand: BrandDNA, outputTraits: {colors?: string[]; typography?: string[]; logoTransformations?: string[]; prohibitedBehaviors?: string[]; distinctiveAssetIds?: string[]}): number => {
  const approvedColors = new Set(brandColors(brand));
  const wrongColor = outputTraits.colors?.some((value) => approvedColors.size > 0 && !approvedColors.has(value.toUpperCase())) ? 1 : 0;
  const approvedFonts = new Set(brand.typographySystem?.roles.map(({fontFamily}) => fontFamily).filter(Boolean));
  const wrongTypography = outputTraits.typography?.some((value) => approvedFonts.size > 0 && !approvedFonts.has(value)) ? 1 : 0;
  const logoMisuse = outputTraits.logoTransformations?.length ? 1 : 0;
  const prohibited = outputTraits.prohibitedBehaviors?.length ? 1 : 0;
  const requiredAssets = brand.brandDistinctiveness?.filter(({mustPreserve}) => mustPreserve).map(({id}) => id) ?? [];
  const missingDistinctive = requiredAssets.some((id) => !outputTraits.distinctiveAssetIds?.includes(id)) ? 1 : 0;
  return clamp((wrongColor + wrongTypography + logoMisuse * 2 + prohibited + missingDistinctive) / 6);
};

export const calculateReferenceImitationRisk = (input: {sameExactColors?: boolean; sameExactCoordinates?: boolean; sameHeroSubject?: boolean; sameGraphicDevice?: boolean; sameLiteralTypography?: boolean; sameDecorativeDetails?: boolean}): number => clamp(Object.values(input).filter(Boolean).length / 6);

export const resolveBrandReferenceCompatibility = (brand: BrandDNA, reference?: DesignDNA): BrandReferenceCompatibilityReport => {
  const adaptationPlan: BrandAdaptationAction[] = [];
  const compatiblePatterns: string[] = [];
  const adaptablePatterns: string[] = [];
  const conflicts: BrandReferenceCompatibilityReport['conflicts'] = [];
  const rejectedReferenceTraits: string[] = [];
  const requiredBrandOverrides: string[] = [];
  const referenceColors = colors(reference);
  const approvedColors = brandColors(brand);
  if (referenceColors.length && approvedColors.length) {
    const same = referenceColors.some((value) => approvedColors.includes(value));
    adaptationPlan.push({id: 'adapt-color-role', domain: 'color', action: same ? 'preserve' : 'translate', referenceTrait: `Reference color roles: ${referenceColors.join(', ')}`, brandRule: `Approved brand colors: ${approvedColors.join(', ')}`, instruction: same ? 'Preserve compatible color roles using approved tokens.' : 'Preserve contrast, dominance, accent coverage, and focal function while replacing reference HEX values with approved brand tokens.', confidence: 1});
    (same ? compatiblePatterns : adaptablePatterns).push('color relationship and functional hierarchy');
    if (!same) requiredBrandOverrides.push('Replace reference colors with approved brand color roles.');
  }
  const referenceType = referenceTypography(reference);
  const brandType = brand.typographySystem?.roles ?? [];
  if (referenceType.length && brandType.length) {
    adaptationPlan.push({id: 'adapt-typography', domain: 'typography', action: 'override', referenceTrait: `Reference classifications: ${referenceType.join(', ')}`, brandRule: 'Use approved brand typography roles.', instruction: 'Preserve hierarchy, scale contrast, density, tracking character, and reading rhythm while using the approved brand type system.', confidence: 1});
    conflicts.push({domain: 'typography', referenceTrait: referenceType.join(', '), brandRule: 'Approved brand typography is required.', winningAuthority: 'explicit_user_constraint', resolution: 'Override type identity; preserve structural hierarchy.'});
    requiredBrandOverrides.push('Use brand typography instead of literal reference typography.');
  }
  if (reference?.composition?.balance.value === 'asymmetric') {
    const hardComposition = selectAuthoritativeConstraint(brand.hardConstraints.filter(({domain}) => domain === 'composition'));
    if (!hardComposition) {adaptationPlan.push({id: 'preserve-asymmetry', domain: 'composition', action: 'preserve', referenceTrait: 'high-confidence asymmetric composition', instruction: 'Preserve asymmetric structural balance because no explicit brand rule conflicts.', confidence: reference.composition.balance.confidence}); compatiblePatterns.push('asymmetric composition');}
    else {adaptationPlan.push({id: 'override-composition', domain: 'composition', action: 'override', referenceTrait: 'asymmetric composition', brandRule: hardComposition.rule, instruction: 'Apply the explicit brand composition rule while retaining hierarchy and tension where possible.', confidence: hardComposition.confidence, sourceConstraintIds: [hardComposition.id]}); conflicts.push({domain: 'composition', referenceTrait: 'asymmetric composition', brandRule: hardComposition.rule, winningAuthority: hardComposition.authority, resolution: 'Explicit brand constraint overrides reference structure.'});}
  }
  for (const constraint of brand.prohibitedBehaviors) adaptationPlan.push({id: `reject-${constraint.id}`, domain: constraint.domain, action: 'reject', brandRule: constraint.rule, instruction: `Reject prohibited behavior: ${constraint.rule}`, confidence: constraint.confidence, sourceConstraintIds: [constraint.id]});
  if (brand.logoSystem) {requiredBrandOverrides.push('Preserve the official logo asset without transformations.'); rejectedReferenceTraits.push('reference logo identity and logo treatment');}
  rejectedReferenceTraits.push(TRANSFER_PRINCIPLES_NOT_IDENTITY);
  const compatibilityScore = clamp(1 - conflicts.length * 0.15 - rejectedReferenceTraits.length * 0.03);
  const baselineBrandDriftRisk = calculateBrandDriftRisk(brand, {});
  const baselineReferenceImitationRisk = calculateReferenceImitationRisk({sameExactColors: referenceColors.length > 0 && referenceColors.every((value) => approvedColors.includes(value))});
  return {compatibilityScore, compatiblePatterns, adaptablePatterns, conflicts, rejectedReferenceTraits, requiredBrandOverrides, adaptationPlan, baselineBrandDriftRisk, baselineReferenceImitationRisk, brandDriftRisk: baselineBrandDriftRisk, referenceImitationRisk: baselineReferenceImitationRisk};
};

export const adaptReferenceDNA = (reference: DesignDNA | undefined, brand: BrandDNA, report = resolveBrandReferenceCompatibility(brand, reference)): AdaptedDesignConstraints => ({
  composition: reference?.composition,
  hierarchy: reference?.visualHierarchy,
  color: brand.colorSystem,
  typography: brand.typographySystem,
  spacing: brand.spacingCharacter ?? (reference?.spacing ? {density: reference.spacing.density, whitespacePreference: reference.spacing.negativeSpaceRatio} : undefined),
  shape: brand.shapeLanguage,
  photography: brand.photographyStyle,
  materials: brand.materialLanguage,
  iconography: brand.iconography,
  brandDistinctiveAssets: brand.brandDistinctiveness ?? [],
  antiPatterns: brand.prohibitedBehaviors.map(({rule}) => rule),
  adaptationActions: report.adaptationPlan,
  confidence: Math.min(brand.confidence, reference?.confidence ?? 1, report.compatibilityScore),
});
