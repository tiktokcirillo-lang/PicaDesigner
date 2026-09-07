import type {BrandConstraint, BrandAuthority} from './types.js';

export const BRAND_AUTHORITY_PRIORITY: Readonly<Record<BrandAuthority, number>> = {
  explicit_brand_guideline: 5,
  explicit_user_constraint: 4,
  verified_brand_asset: 3,
  repeated_existing_brand_pattern: 2,
  inferred_brand_property: 1,
};

export const BRAND_ADAPTATION_PRIORITY = [
  'legal_safety_accessibility',
  'brand_required_forbidden',
  'format_platform_hard_constraints',
  'high_confidence_reference_structure',
  'brand_soft_characteristics',
  'communication_objective',
  'creative_interpretation',
] as const;

export const selectAuthoritativeConstraint = (constraints: BrandConstraint[]): BrandConstraint | undefined => [...constraints].sort((left, right) => BRAND_AUTHORITY_PRIORITY[right.authority] - BRAND_AUTHORITY_PRIORITY[left.authority] || right.confidence - left.confidence)[0];
export const explicitConstraintOverridesInference = (explicit: BrandConstraint, inferred: BrandConstraint): boolean => BRAND_AUTHORITY_PRIORITY[explicit.authority] > BRAND_AUTHORITY_PRIORITY[inferred.authority];
export const PRESERVE_LOGO_FIDELITY = 'Use the original approved logo asset. Never regenerate, redraw, distort, recompose, recolor, crop, rotate, outline, shadow, or glow it.' as const;
export const TRANSFER_PRINCIPLES_NOT_IDENTITY = 'Transfer structural principles; never transfer another brand identity, logo, exact colors, typography, signature assets, or decorative symbols.' as const;
