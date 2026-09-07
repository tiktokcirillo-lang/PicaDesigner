import {BRAND_DNA_SCHEMA_VERSION, BRAND_INTELLIGENCE_SESSION_SCHEMA_VERSION, type AdaptedDesignConstraints, type BrandColorToken, type BrandConstraint, type BrandDNA, type BrandIntelligenceSession, type BrandReferenceCompatibilityReport, type BrandTypographyRole, type DistinctiveBrandAsset} from './types.js';

export interface BrandValidationResult<T> {success: boolean; data?: T; issues: string[]}
const normalized = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const result = <T>(value: T, issues: string[]): BrandValidationResult<T> => issues.length ? {success: false, issues} : {success: true, data: value, issues};
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const NORMALIZED_KEYS = new Set(['confidence', 'strength', 'consistency', 'density', 'whitespacePreference', 'contentCompressionTolerance', 'geometricity', 'angularity', 'curvature', 'repetition', 'detailLevel', 'retouchingLevel', 'brandColorCoverage', 'contrastCommitment', 'legibilityPriority', 'motionSensitivity', 'value']);
const validateNormalizedFields = (value: unknown, path = 'brand'): string[] => {
  if (Array.isArray(value)) return value.flatMap((item, index) => validateNormalizedFields(item, `${path}[${index}]`));
  if (!object(value)) return [];
  return Object.entries(value).flatMap(([key, item]) => NORMALIZED_KEYS.has(key) && typeof item === 'number' && !normalized(item) ? [`${path}.${key} must be 0–1`] : validateNormalizedFields(item, `${path}.${key}`));
};

export const validateBrandConstraint = (value: unknown): BrandValidationResult<BrandConstraint> => {
  const issues: string[] = [];
  if (!object(value)) return {success: false, issues: ['constraint must be an object']};
  if (typeof value.id !== 'string' || !value.id) issues.push('constraint.id is required');
  if (typeof value.rule !== 'string' || !value.rule) issues.push('constraint.rule is required');
  if (!normalized(value.confidence)) issues.push('constraint.confidence must be 0–1');
  if (!['required', 'preferred', 'avoid', 'forbidden'].includes(String(value.severity))) issues.push('constraint.severity is invalid');
  return result(value as unknown as BrandConstraint, issues);
};

export const validateBrandColorToken = (value: unknown): BrandValidationResult<BrandColorToken> => {
  const issues: string[] = [];
  if (!object(value)) return {success: false, issues: ['color token must be an object']};
  if (typeof value.id !== 'string' || typeof value.name !== 'string') issues.push('color token id/name are required');
  if (typeof value.value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.value)) issues.push('color token value must be a HEX color');
  if (!normalized(value.confidence)) issues.push('color token confidence must be 0–1');
  const range = value.coverageRange as {min?: unknown; max?: unknown} | undefined;
  if (range && (!normalized(range.min) || !normalized(range.max) || Number(range.min) > Number(range.max))) issues.push('coverageRange must contain ordered 0–1 values');
  return result(value as unknown as BrandColorToken, issues);
};

export const validateBrandTypographyRole = (value: unknown): BrandValidationResult<BrandTypographyRole> => {
  const issues: string[] = [];
  if (!object(value)) return {success: false, issues: ['typography role must be an object']};
  if (!['display', 'headline', 'subheadline', 'body', 'caption', 'data', 'cta', 'legal'].includes(String(value.role))) issues.push('typography role is invalid');
  if (!normalized(value.confidence)) issues.push('typography confidence must be 0–1');
  return result(value as unknown as BrandTypographyRole, issues);
};

export const validateDistinctiveBrandAsset = (value: unknown): BrandValidationResult<DistinctiveBrandAsset> => {
  const issues: string[] = [];
  if (!object(value)) return {success: false, issues: ['distinctive asset must be an object']};
  if (typeof value.id !== 'string' || typeof value.description !== 'string') issues.push('distinctive asset id/description are required');
  if (!normalized(value.strength) || !normalized(value.confidence)) issues.push('distinctive asset strength/confidence must be 0–1');
  if (typeof value.mustPreserve !== 'boolean') issues.push('distinctive asset mustPreserve is required');
  return result(value as unknown as DistinctiveBrandAsset, issues);
};

export const validateBrandDNA = (value: unknown): BrandValidationResult<BrandDNA> => {
  const issues: string[] = [];
  if (!object(value)) return {success: false, issues: ['BrandDNA must be an object']};
  if (value.schemaVersion !== BRAND_DNA_SCHEMA_VERSION) issues.push('BrandDNA schemaVersion is incompatible');
  if (typeof value.brandId !== 'string' || !value.brandId) issues.push('brandId is required');
  if (!normalized(value.confidence)) issues.push('BrandDNA confidence must be 0–1');
  issues.push(...validateNormalizedFields(value));
  for (const item of [...((value.hardConstraints as unknown[]) ?? []), ...((value.softPreferences as unknown[]) ?? []), ...((value.prohibitedBehaviors as unknown[]) ?? [])]) issues.push(...validateBrandConstraint(item).issues);
  const colorSystem = value.colorSystem as {tokens?: unknown[]} | undefined; for (const token of colorSystem?.tokens ?? []) issues.push(...validateBrandColorToken(token).issues);
  const typography = value.typographySystem as {roles?: unknown[]} | undefined; for (const role of typography?.roles ?? []) issues.push(...validateBrandTypographyRole(role).issues);
  for (const asset of (value.brandDistinctiveness as unknown[] | undefined) ?? []) issues.push(...validateDistinctiveBrandAsset(asset).issues);
  return result(value as unknown as BrandDNA, issues);
};

export const validateBrandIntelligenceSession = (value: unknown): BrandValidationResult<BrandIntelligenceSession> => {
  const issues: string[] = [];
  if (!object(value)) return {success: false, issues: ['brand session must be an object']};
  if (value.schemaVersion !== BRAND_INTELLIGENCE_SESSION_SCHEMA_VERSION) issues.push('brand session schemaVersion is incompatible');
  if (!normalized(value.evidenceQuality) || !normalized(value.confidence)) issues.push('session quality/confidence must be 0–1');
  if (value.brandDNA) issues.push(...validateBrandDNA(value.brandDNA).issues);
  return result(value as unknown as BrandIntelligenceSession, issues);
};

export const validateCompatibilityReport = (value: unknown): BrandValidationResult<BrandReferenceCompatibilityReport> => {
  const issues: string[] = [];
  if (!object(value)) return {success: false, issues: ['compatibility report must be an object']};
  for (const key of ['compatibilityScore', 'baselineBrandDriftRisk', 'baselineReferenceImitationRisk']) if (!normalized(value[key])) issues.push(`${key} must be 0–1`);
  if (!Array.isArray(value.adaptationPlan)) issues.push('adaptationPlan is required');
  for (const action of (value.adaptationPlan as Array<{action?: unknown; confidence?: unknown}> | undefined) ?? []) {
    if (!['preserve', 'translate', 'reinterpret', 'override', 'reject'].includes(String(action.action))) issues.push('adaptation action is invalid');
    if (!normalized(action.confidence)) issues.push('adaptation action confidence must be 0–1');
  }
  return result(value as unknown as BrandReferenceCompatibilityReport, issues);
};

export const validateAdaptedDesignConstraints = (value: unknown): BrandValidationResult<AdaptedDesignConstraints> => {
  const issues: string[] = [];
  if (!object(value)) return {success: false, issues: ['adapted constraints must be an object']};
  if (!normalized(value.confidence)) issues.push('adapted confidence must be 0–1');
  if (!Array.isArray(value.adaptationActions) || !Array.isArray(value.antiPatterns)) issues.push('adaptation actions and anti-patterns are required');
  issues.push(...validateNormalizedFields(value));
  return result(value as unknown as AdaptedDesignConstraints, issues);
};
