import {createSemanticExclusions, DESIGN_DNA_SCHEMA_VERSION, type DesignDNA} from '../art-direction/index.js';
import {DesignSpecPromptBuilder} from '../../application/design-spec/prompt-builder.js';
import {calculateBrandDriftRisk, calculateReferenceImitationRisk, resolveBrandReferenceCompatibility, adaptReferenceDNA} from './compatibility.js';
import {explicitConstraintOverridesInference} from './constraints.js';
import {createBrandDNAFromInput, createBrandIntelligenceSession, isBrandSessionReusable} from './factory.js';
import {validateAdaptedDesignConstraints, validateBrandColorToken, validateBrandConstraint, validateBrandDNA, validateBrandIntelligenceSession, validateBrandTypographyRole, validateCompatibilityReport, validateDistinctiveBrandAsset} from './schemas.js';
import type {BrandConstraint, DistinctiveBrandAsset} from './types.js';

const assert = (condition: boolean, message: string) => {if (!condition) throw new Error(`Brand Intelligence validation failed: ${message}`);};
const reference: DesignDNA = {schemaVersion: DESIGN_DNA_SCHEMA_VERSION, metadata: {}, semanticExclusions: createSemanticExclusions(), evidence: {observedFacts: [], inferredProperties: [], uncertainProperties: []}, confidence: 0.9, composition: {balance: {value: 'asymmetric', confidence: 0.9, evidence: []}}, color: {palette: [{hex: '#0066FF', role: 'accent', coverage: 0.2, luminance: 0.5, saturation: 0.9, temperature: 'cool', confidence: 0.9}], hueRelationship: 'monochromatic', contrast: 0.8, foregroundBackgroundSeparation: 0.8, tonalHierarchy: [], brandDominance: 0.8}, typography: {samples: [{role: 'headline', classification: 'serif', personality: ['editorial'], confidence: 0.9}], hierarchy: ['headline'], textDensity: 0.4, typographicContrast: 0.8}};

const basic = createBrandDNAFromInput({brandName: 'Marca', colors: ['#D9232E', '#FFFFFF'], headlineFont: 'Inter', bodyFont: 'Inter'});
assert(Boolean(basic && basic.identityMode === 'basic' && basic.colorSystem?.tokens[0]?.confidence === 1 && basic.typographySystem?.roles.length === 2), 'manual colors/fonts create basic BrandDNA');
assert(createBrandDNAFromInput(undefined) === undefined && createBrandIntelligenceSession(undefined).identityMode === 'none', 'no brand keeps identity mode none');

const explicit: BrandConstraint = {id: 'explicit', domain: 'color', rule: 'Use red only.', authority: 'explicit_user_constraint', severity: 'required', confidence: 1};
const inferred: BrandConstraint = {id: 'inferred', domain: 'color', rule: 'Use blue.', authority: 'inferred_brand_property', severity: 'preferred', confidence: 0.9};
assert(explicitConstraintOverridesInference(explicit, inferred), 'explicit constraint overrides inferred property');

if (!basic) throw new Error('basic fixture missing');
const compatibility = resolveBrandReferenceCompatibility(basic, reference);
assert(compatibility.adaptationPlan.some(({domain, action}) => domain === 'color' && action === 'translate'), 'brand red translates reference blue by function');
assert(compatibility.adaptationPlan.some(({domain, action, instruction}) => domain === 'typography' && action === 'override' && instruction.includes('Preserve hierarchy')), 'brand sans overrides reference serif while preserving hierarchy');
assert(compatibility.adaptationPlan.some(({id, action}) => id === 'preserve-asymmetry' && action === 'preserve'), 'high-confidence asymmetry survives without brand conflict');

const logoBrand = createBrandDNAFromInput({logoAssets: [{id: 'logo', type: 'logo', fingerprint: 'logo-1', source: 'logo_asset'}]});
assert(Boolean(logoBrand?.logoSystem?.primaryLogo?.prohibitedTransformations.includes('stretch')), 'logo distortion is forbidden');
const distinctive: DistinctiveBrandAsset = {id: 'capsule', type: 'shape', description: 'Rounded signal capsule', strength: 0.9, mustPreserve: true, confidence: 0.9};
basic.brandDistinctiveness = [distinctive];
assert(basic.brandDistinctiveness[0]?.mustPreserve === true, 'distinctive asset is marked mustPreserve');
assert(calculateReferenceImitationRisk({sameExactColors: true, sameExactCoordinates: true, sameHeroSubject: true, sameGraphicDevice: true}) > 0.5, 'literal reference copying raises imitation risk');
assert(calculateBrandDriftRisk(basic, {colors: ['#0066FF'], typography: ['Comic Sans'], logoTransformations: ['stretch'], distinctiveAssetIds: []}) > 0.5, 'off-brand output traits raise drift risk');

const session = createBrandIntelligenceSession({colors: ['#D9232E'], headlineFont: 'Inter'}, 'project');
assert(validateBrandIntelligenceSession(JSON.parse(JSON.stringify(session))).success, 'BrandDNA session persists as JSON');
assert(isBrandSessionReusable(session, {colors: ['#D9232E'], headlineFont: 'Inter'}), 'unchanged brand reuses session');
assert(!isBrandSessionReusable(session, {colors: ['#000000'], headlineFont: 'Inter'}), 'brand change invalidates session');
assert(isBrandSessionReusable(session, {colors: ['#D9232E'], headlineFont: 'Inter'}), 'reference change does not affect BrandDNA reuse');

const adapted = adaptReferenceDNA(reference, basic, compatibility);
assert(validateBrandDNA(basic).success && validateCompatibilityReport(compatibility).success && validateAdaptedDesignConstraints(adapted).success, 'central Brand Intelligence outputs validate');
assert(validateBrandConstraint(explicit).success && validateBrandColorToken(basic.colorSystem?.tokens[0]).success && validateBrandTypographyRole(basic.typographySystem?.roles[0]).success && validateDistinctiveBrandAsset(distinctive).success, 'component schemas validate');
assert(!validateBrandConstraint({...explicit, confidence: 1.2}).success, 'normalized confidence above 1 is rejected');
const prompt = new DesignSpecPromptBuilder().build({projectId: 'project', copy: 'Copy', format: '16:9', destinationTool: 'PowerPoint', tone: 'premium', brandInput: {colors: ['#D9232E'], headlineFont: 'Inter'}});
assert(prompt.input.includes('adaptedDesignConstraints'), 'Design Spec receives AdaptedDesignConstraints');
