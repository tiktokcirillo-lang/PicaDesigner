import {BRAND_DNA_SCHEMA_VERSION, BRAND_INTELLIGENCE_SESSION_SCHEMA_VERSION, type BrandColorToken, type BrandConstraint, type BrandDNA, type BrandInput, type BrandIntelligenceSession, type BrandTypographyRole} from './types.js';
import {PRESERVE_LOGO_FIDELITY} from './constraints.js';

const HEX = /^#[0-9a-f]{6}$/i;
const classification = (family?: string): BrandTypographyRole['classification'] => family ? 'unknown' : 'unknown';
const constraint = (id: string, domain: BrandConstraint['domain'], rule: string, severity: BrandConstraint['severity']): BrandConstraint => ({id, domain, rule, severity, authority: 'explicit_user_constraint', confidence: 1, evidenceIds: ['manual-input']});
const normalize = (value: unknown): unknown => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalize(item)])) : value;
const stableFingerprint = (value: unknown): string => {const text = JSON.stringify(normalize(value)); let hash = 2166136261; for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619); return (hash >>> 0).toString(16).padStart(8, '0');};

export const createBrandDNAFromInput = (input?: BrandInput, brandId = crypto.randomUUID()): BrandDNA | undefined => {
  const colors = (input?.colors ?? []).filter((value) => HEX.test(value));
  const hasInput = Boolean(input && (input.brandName || colors.length || input.headlineFont || input.bodyFont || input.logoAssets?.length || input.assets?.length || input.visualRules?.length || input.distinctiveAssets?.length || input.prohibitedBehaviors?.length || input.typography || input.personality || input.imageStyle));
  if (!hasInput) return undefined;
  const evidence = [{id: 'manual-input', type: 'manual_input' as const, description: 'Brand information explicitly supplied by the user.', authority: 'explicit_user_constraint' as const, confidence: 1}];
  const tokens: BrandColorToken[] = colors.map((value, index) => ({id: `brand-color-${index + 1}`, name: `Brand color ${index + 1}`, value: value.toUpperCase(), role: index === 0 ? 'primary' : index === 1 ? 'secondary' : 'accent', priority: index + 1, authority: 'explicit', confidence: 1}));
  const roles: BrandTypographyRole[] = [];
  if (input?.headlineFont) roles.push({role: 'headline', fontFamily: input.headlineFont, classification: classification(input.headlineFont), authority: 'explicit', confidence: 1, fallbackStrategy: {fallbacks: [], substitutionRequired: false}});
  if (input?.bodyFont) roles.push({role: 'body', fontFamily: input.bodyFont, classification: classification(input.bodyFont), authority: 'explicit', confidence: 1, fallbackStrategy: {fallbacks: [], substitutionRequired: false}});
  for (const [role, value] of Object.entries(input?.typography ?? {})) roles.push({role: role as BrandTypographyRole['role'], classification: 'unknown', authority: 'explicit', confidence: 1, ...value});
  const visualRules = (input?.visualRules ?? []).map((rule, index) => constraint(`brand-rule-${index + 1}`, rule.domain, rule.rule, rule.severity));
  const logoAssets = [...(input?.logoAssets ?? []), ...(input?.assets ?? []).filter(({type}) => type === 'logo')];
  const verified = [...logoAssets, ...(input?.assets ?? [])].some(({verified: isVerified}) => isVerified === true);
  const logoConstraint = logoAssets.length ? constraint('preserve-logo-fidelity', 'logo', PRESERVE_LOGO_FIDELITY, 'required') : undefined;
  const logoMisuseConstraint = logoAssets.length ? constraint('forbid-logo-transformations', 'logo', 'Never distort, redraw, recolor, crop, rotate, outline, shadow, or glow the official logo.', 'forbidden') : undefined;
  const prohibited = [...(input?.prohibitedBehaviors ?? []).map((rule, index) => constraint(`brand-prohibited-${index + 1}`, 'identity', rule, 'forbidden')), ...visualRules.filter(({severity}) => severity === 'forbidden'), ...(logoMisuseConstraint ? [logoMisuseConstraint] : [])];
  return {
    schemaVersion: BRAND_DNA_SCHEMA_VERSION,
    brandId,
    metadata: {brandName: input?.brandName, createdAt: new Date().toISOString(), sourceUrl: input?.url},
    identityMode: verified ? 'verified' : logoAssets.length || visualRules.length || input?.personality || input?.imageStyle || input?.distinctiveAssets?.length ? 'defined' : 'basic',
    logoSystem: logoAssets.length ? {primaryLogo: {assetId: logoAssets[0]?.id, prohibitedTransformations: ['stretch', 'skew', 'rotate', 'unauthorized_recolor', 'drop_shadow', 'outline', 'glow', 'crop', 'recompose', 'redraw']}, preserveLogoFidelity: true} : undefined,
    colorSystem: tokens.length ? {tokens, dominanceStrategy: 'Use primary color as the dominant brand carrier; secondary/accent colors retain their declared roles.'} : undefined,
    typographySystem: roles.length ? {roles, consistencyRule: 'Use exact declared families when available; record any fallback instead of silently substituting.'} : undefined,
    spacingCharacter: input?.lineHeight || input?.letterSpacing || input?.wordSpacing ? {componentSpacingRhythm: [input.lineHeight, input.letterSpacing, input.wordSpacing].filter(Boolean).join(' / ')} : undefined,
    photographyStyle: input?.imageStyle,
    visualPersonality: input?.personality,
    brandDistinctiveness: input?.distinctiveAssets,
    hardConstraints: [...visualRules.filter(({severity}) => severity === 'required'), ...(logoConstraint ? [logoConstraint] : [])],
    softPreferences: visualRules.filter(({severity}) => severity === 'preferred' || severity === 'avoid'),
    prohibitedBehaviors: prohibited,
    observedFacts: [...tokens.map(({value, role}) => `${role} color explicitly set to ${value}`), ...roles.map(({role, fontFamily}) => `${role} typography explicitly set to ${fontFamily}`)],
    inferredProperties: [],
    uncertainties: [],
    evidence,
    sourceProvenance: ['manual_input'],
    confidence: 1,
  };
};

export const createBrandIntelligenceSession = (input: BrandInput | undefined, projectId?: string, existing?: BrandIntelligenceSession): BrandIntelligenceSession => {
  const inputFingerprint = stableFingerprint(input ?? {});
  if (existing?.schemaVersion === BRAND_INTELLIGENCE_SESSION_SCHEMA_VERSION && existing.schemaVersions.brandDNA === BRAND_DNA_SCHEMA_VERSION && existing.inputFingerprint === inputFingerprint) return existing;
  const brandDNA = createBrandDNAFromInput(input);
  return {schemaVersion: BRAND_INTELLIGENCE_SESSION_SCHEMA_VERSION, sessionId: crypto.randomUUID(), brandId: brandDNA?.brandId ?? `none-${projectId ?? 'brand'}`, projectId, status: 'ready', identityMode: brandDNA?.identityMode ?? 'none', inputFingerprint, assetFingerprints: [...(input?.assets ?? []), ...(input?.logoAssets ?? [])].map(({fingerprint}) => fingerprint), brandDNA, evidenceQuality: brandDNA ? 1 : 0, confidence: brandDNA?.confidence ?? 1, warnings: [], schemaVersions: {brandDNA: BRAND_DNA_SCHEMA_VERSION, session: BRAND_INTELLIGENCE_SESSION_SCHEMA_VERSION}};
};

export const isBrandSessionReusable = (session: BrandIntelligenceSession | undefined, input: BrandInput | undefined): boolean => Boolean(session && session.schemaVersion === BRAND_INTELLIGENCE_SESSION_SCHEMA_VERSION && session.schemaVersions.brandDNA === BRAND_DNA_SCHEMA_VERSION && session.inputFingerprint === stableFingerprint(input ?? {}));
