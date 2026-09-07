import type {DesignDNA} from '../art-direction/index.js';
import type {AIUsageResult} from '../../infrastructure/ai/types.js';

export const BRAND_DNA_SCHEMA_VERSION = '1.0.0' as const;
export const BRAND_INTELLIGENCE_SESSION_SCHEMA_VERSION = '1.0.0' as const;
export type BrandIdentityMode = 'none' | 'basic' | 'defined' | 'verified';
export type BrandEvidenceSourceType = 'manual_input' | 'brand_guideline' | 'logo_asset' | 'brand_asset' | 'existing_campaign' | 'website_metadata' | 'inferred' | 'unknown';
export type BrandAuthority = 'explicit_brand_guideline' | 'explicit_user_constraint' | 'verified_brand_asset' | 'repeated_existing_brand_pattern' | 'inferred_brand_property';
export type BrandConfidenceAuthority = 'explicit' | 'verified' | 'repeated' | 'inferred' | 'speculative';
export type BrandConstraintSeverity = 'required' | 'preferred' | 'avoid' | 'forbidden';
export type BrandDomain = 'identity' | 'logo' | 'color' | 'typography' | 'spacing' | 'shape' | 'iconography' | 'photography' | 'illustration' | 'material' | 'texture' | 'composition' | 'motion' | 'accessibility' | 'legal';

export interface BrandEvidenceSource {id: string; type: BrandEvidenceSourceType; description: string; assetId?: string; authority: BrandAuthority; confidence: number}
export interface BrandConstraint {id: string; domain: BrandDomain; rule: string; authority: BrandAuthority; severity: BrandConstraintSeverity; confidence: number; evidenceIds?: string[]}
export interface BrandAsset {id: string; type: 'logo' | 'brand_board' | 'existing_campaign' | 'graphic_asset' | 'guideline_pdf'; mediaType?: string; fileName?: string; fingerprint: string; source: BrandEvidenceSourceType; verified?: boolean}
export interface BrandPatternEvidence {id: string; description: string; occurrences: number; sourceAssetIds: string[]; consistency: number; confidence: number}

export type LogoTransformation = 'stretch' | 'skew' | 'rotate' | 'unauthorized_recolor' | 'drop_shadow' | 'outline' | 'glow' | 'crop' | 'recompose' | 'redraw';
export interface LogoVariant {assetId?: string; aspectRatio?: number; allowedBackgrounds?: string[]; minimumSize?: number; clearSpace?: number; safeArea?: number; approvedColors?: string[]; prohibitedTransformations: LogoTransformation[]}
export interface LogoSystem {primaryLogo?: LogoVariant; secondaryLogo?: LogoVariant; symbol?: LogoVariant; wordmark?: LogoVariant; monochromeVariant?: LogoVariant; inverseVariant?: LogoVariant; preserveLogoFidelity: true}

export type BrandColorRole = 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text' | 'inverse' | 'functional' | 'neutral';
export interface BrandColorToken {id: string; name: string; value: string; role: BrandColorRole; usage?: string[]; priority: number; allowedPairings?: string[]; prohibitedPairings?: string[]; coverageRange?: {min: number; max: number}; authority: BrandConfidenceAuthority; confidence: number}
export interface BrandColorSystem {tokens: BrandColorToken[]; dominanceStrategy?: string; contrastStrategy?: string; temperature?: 'warm' | 'neutral' | 'cool' | 'mixed'; saturationCharacter?: string; brandColorCoverage?: number}

export type BrandTypographyRoleId = 'display' | 'headline' | 'subheadline' | 'body' | 'caption' | 'data' | 'cta' | 'legal';
export interface TypographyFallbackStrategy {fallbacks: string[]; substitutionRequired: boolean; reason?: string}
export interface BrandTypographyRole {role: BrandTypographyRoleId; fontFamily?: string; classification: 'serif' | 'sans_serif' | 'display' | 'script' | 'monospace' | 'unknown'; weightRange?: {min: number; max: number}; width?: string; caseBehavior?: string; trackingCharacter?: string; leadingCharacter?: string; fallbackStrategy?: TypographyFallbackStrategy; usageRules?: string[]; personality?: Array<{trait: string; confidence: number}>; authority: BrandConfidenceAuthority; confidence: number}
export interface BrandTypographySystem {roles: BrandTypographyRole[]; consistencyRule?: string}

export interface BrandSpacingCharacter {density?: number; whitespacePreference?: number; marginCharacter?: string; gutterCharacter?: string; componentSpacingRhythm?: string; contentCompressionTolerance?: number}
export interface BrandShapeLanguage {cornerRadiusCharacter?: string; geometricity?: number; angularity?: number; curvature?: number; strokeCharacter?: string; containerStyle?: string; borderBehavior?: string; repetition?: number; signatureShapes?: string[]}
export interface BrandIconography {style?: 'outline' | 'filled' | 'duotone' | 'mixed'; strokeWeight?: string; cornerStyle?: string; geometricCharacter?: string; detailLevel?: number; preferredLibraries?: string[]; sizeBehavior?: string; colorBehavior?: string}
export interface HumanImagePolicy {authenticity?: 'authentic' | 'staged' | 'mixed'; audienceRepresentation?: string; portraitDistance?: string; eyeContact?: string; skinRetouchingLevel?: number; expression?: string; wardrobeCharacter?: string}
export interface BrandPhotographyStyle {subjectBehavior?: string; cameraCharacter?: string; framing?: string; cropCharacter?: string; lighting?: string; contrast?: string; colorGrade?: string; depthOfField?: string; humanPresence?: string; backgroundCharacter?: string; authenticity?: string; retouchingLevel?: number; humanImagePolicy?: HumanImagePolicy}
export interface BrandCompositionCharacter {alignmentCharacter?: string; symmetryPreference?: string; visualDensity?: number; negativeSpacePreference?: number; heroScalePreference?: number; editorialness?: number; modularity?: number; layeringCharacter?: string}
export interface ConfidenceTrait {value: number; confidence: number}
export type BrandPersonality = Partial<Record<'premium' | 'technical' | 'human' | 'playful' | 'institutional' | 'innovative' | 'bold' | 'minimal' | 'editorial' | 'energetic' | 'trustworthy' | 'accessible' | 'exclusive', ConfidenceTrait>>;
export interface SophisticationProfile {visualRestraint?: ConfidenceTrait; detailDensity?: ConfidenceTrait; ornamentation?: ConfidenceTrait; materialPolish?: ConfidenceTrait; typographicRefinement?: ConfidenceTrait; photographicPolish?: ConfidenceTrait; perceivedPriceLevel?: ConfidenceTrait}
export interface DistinctiveBrandAsset {id: string; type: 'color' | 'shape' | 'pattern' | 'logo_behavior' | 'typographic_behavior' | 'composition' | 'photographic_treatment' | 'graphic_device' | 'iconography'; description: string; strength: number; mustPreserve: boolean; confidence: number; evidenceIds?: string[]}
export interface BrandUncertainty {id: string; domain: BrandDomain; description: string; confidence: number}

export interface BrandDNA {
  schemaVersion: typeof BRAND_DNA_SCHEMA_VERSION;
  brandId: string;
  metadata: {brandName?: string; createdAt: string; updatedAt?: string; sourceUrl?: string};
  identityMode: Exclude<BrandIdentityMode, 'none'>;
  logoSystem?: LogoSystem;
  colorSystem?: BrandColorSystem;
  typographySystem?: BrandTypographySystem;
  spacingCharacter?: BrandSpacingCharacter;
  shapeLanguage?: BrandShapeLanguage;
  iconography?: BrandIconography;
  photographyStyle?: BrandPhotographyStyle;
  illustrationStyle?: string[];
  materialLanguage?: string[];
  textureLanguage?: string[];
  compositionCharacter?: BrandCompositionCharacter;
  motionCharacter?: string[];
  visualPersonality?: BrandPersonality;
  sophisticationProfile?: SophisticationProfile;
  accessibilityProfile?: {contrastCommitment?: number; legibilityPriority?: number; motionSensitivity?: number};
  brandDistinctiveness?: DistinctiveBrandAsset[];
  hardConstraints: BrandConstraint[];
  softPreferences: BrandConstraint[];
  prohibitedBehaviors: BrandConstraint[];
  observedFacts: string[];
  inferredProperties: string[];
  uncertainties: BrandUncertainty[];
  evidence: BrandEvidenceSource[];
  sourceProvenance: BrandEvidenceSourceType[];
  confidence: number;
}

export interface LegacyBrandInput {colors?: string[]; headlineFont?: string; bodyFont?: string; lineHeight?: string; letterSpacing?: string; wordSpacing?: string; url?: string}
export interface BrandInput extends LegacyBrandInput {brandName?: string; typography?: Partial<Record<BrandTypographyRoleId, Partial<BrandTypographyRole>>>; logoAssets?: BrandAsset[]; visualRules?: Array<{domain: BrandDomain; rule: string; severity: BrandConstraintSeverity}>; personality?: BrandPersonality; imageStyle?: BrandPhotographyStyle; distinctiveAssets?: DistinctiveBrandAsset[]; prohibitedBehaviors?: string[]; assets?: BrandAsset[]}

export interface BrandIntelligenceSession {schemaVersion: typeof BRAND_INTELLIGENCE_SESSION_SCHEMA_VERSION; sessionId: string; brandId: string; projectId?: string; status: 'ready' | 'partial' | 'failed'; identityMode: BrandIdentityMode; inputFingerprint: string; assetFingerprints: string[]; brandDNA?: BrandDNA; evidenceQuality: number; confidence: number; warnings: string[]; aiUsage?: AIUsageResult; schemaVersions: {brandDNA: string; session: string}}
export interface ProvisionalBrandSystem {provisional: true; projectId: string; rules: string[]; confidence: number}

export type BrandAdaptationActionType = 'preserve' | 'translate' | 'reinterpret' | 'override' | 'reject';
export interface BrandAdaptationAction {id: string; domain: BrandDomain; action: BrandAdaptationActionType; referenceTrait?: string; brandRule?: string; instruction: string; confidence: number; sourceConstraintIds?: string[]}
export interface BrandReferenceConflict {domain: BrandDomain; referenceTrait: string; brandRule: string; winningAuthority: BrandAuthority; resolution: string}
export interface BrandReferenceCompatibilityReport {compatibilityScore: number; compatiblePatterns: string[]; adaptablePatterns: string[]; conflicts: BrandReferenceConflict[]; rejectedReferenceTraits: string[]; requiredBrandOverrides: string[]; adaptationPlan: BrandAdaptationAction[]; brandDriftRisk: number; referenceImitationRisk: number}
export interface AdaptedDesignConstraints {composition?: unknown; hierarchy?: unknown; color?: BrandColorSystem; typography?: BrandTypographySystem; spacing?: BrandSpacingCharacter; shape?: BrandShapeLanguage; photography?: BrandPhotographyStyle; materials?: string[]; iconography?: BrandIconography; brandDistinctiveAssets: DistinctiveBrandAsset[]; antiPatterns: string[]; adaptationActions: BrandAdaptationAction[]; confidence: number}
export interface BrandAssetAnalysis {patterns: BrandPatternEvidence[]; inferredConstraints: BrandConstraint[]; confidence: number; warnings: string[]}
export interface BrandAssetAnalyzer {readonly id: string; analyze(assets: BrandAsset[]): Promise<BrandAssetAnalysis>}
export interface BrandReferenceInput {brandDNA: BrandDNA; referenceDNA?: DesignDNA}
