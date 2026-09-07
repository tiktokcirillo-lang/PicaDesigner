import type {AdaptedDesignConstraints, BrandDNA, BrandReferenceCompatibilityReport} from './types.js';

export const buildBrandDesignContext = (brand: BrandDNA, compatibility: BrandReferenceCompatibilityReport, adapted: AdaptedDesignConstraints) => ({
  identityMode: brand.identityMode,
  approvedColorRoles: brand.colorSystem?.tokens.map(({name, value, role, usage, priority}) => ({name, value, role, usage, priority})),
  typographyBehaviors: brand.typographySystem?.roles.map(({role, fontFamily, classification, weightRange, caseBehavior, trackingCharacter, leadingCharacter, usageRules, fallbackStrategy}) => ({role, fontFamily, classification, weightRange, caseBehavior, trackingCharacter, leadingCharacter, usageRules, fallbackStrategy})),
  logoRules: brand.logoSystem ? {preserveLogoFidelity: true, primary: brand.logoSystem.primaryLogo} : undefined,
  shapeLanguage: brand.shapeLanguage,
  photographyCharacter: brand.photographyStyle,
  distinctiveAssets: brand.brandDistinctiveness,
  hardConstraints: brand.hardConstraints.map(({domain, rule, severity, authority}) => ({domain, rule, severity, authority})),
  antiPatterns: adapted.antiPatterns,
  brandPersonality: brand.visualPersonality,
  brandDriftRiskFactors: compatibility.requiredBrandOverrides,
  adaptedDesignConstraints: adapted,
});
