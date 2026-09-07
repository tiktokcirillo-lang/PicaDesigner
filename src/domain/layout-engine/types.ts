import type {AIUsageResult} from '../../infrastructure/ai/types.js';

export const LAYOUT_PLAN_SCHEMA_VERSION = '1.0.0' as const;
export type Orientation = 'square'|'portrait'|'landscape';
export type FormatCategory = 'social_square'|'social_portrait'|'social_story'|'social_landscape'|'presentation'|'carousel'|'banner'|'custom';
export interface Insets {top:number;right:number;bottom:number;left:number}
export interface NormalizedPoint {x:number;y:number}
export interface NormalizedRect extends NormalizedPoint {width:number;height:number}
export interface PixelRect extends NormalizedPoint {width:number;height:number}
export interface PlatformInsetPolicy {id:string;insets:Insets;configurable:true}
export interface SafeAreaPolicy {minimum:Insets;maximum:Insets;platformInsets?:PlatformInsetPolicy[]}
export interface GridRecommendation {kind:'column'|'modular'|'manuscript'|'hybrid';columnRange:[number,number];rowRange?:[number,number]}
export interface FormatContext {platform?:string;placement?:string;usage?:string}
export interface FormatMetadata {recommended?:boolean;advertising?:boolean;organic?:boolean;presentation?:boolean}
export interface FormatDefinition {id:string;label:string;platform?:string;placement?:string;usage?:string;width:number;height:number;aspectRatio:number;aspectLabel:string;orientation:Orientation;category:FormatCategory;baseSafeArea:Insets;platformInsets?:PlatformInsetPolicy[];recommendedGrid:GridRecommendation;aliases:string[];commonPlacements?:string[];metadata?:FormatMetadata}
export interface CustomFormatDefinition extends FormatDefinition {category:'custom';derivedAspectRatio:number}
export interface FormatFamily {id:string;label:string;platform?:string;variants:string[]}
export interface CanvasSpec {width:number;height:number;aspectRatio:number;orientation:Orientation;safeArea:Insets;contentArea:NormalizedRect}
export interface SpacingScale {baseUnit:number;normalizedBaseUnit:number;tokens:Record<'xxs'|'xs'|'sm'|'md'|'lg'|'xl'|'2xl'|'3xl',number>}
export interface BaselineGrid {unit:number;origin:number;snapTolerance:number}
export interface GridDefinition {kind:GridRecommendation['kind'];columns:number;rows?:number;gutter:number;margin:Insets;baseline:BaselineGrid;modularUnits:number[]}
export type ContentRole='logo'|'eyebrow'|'headline'|'subheadline'|'body'|'benefit'|'offer'|'proof'|'data'|'cta'|'legal'|'hero_image'|'product'|'human'|'graphic_device'|'icon'|'badge'|'background'|'decorative'|'custom';
export interface LayoutContentBlock {id:string;role:ContentRole;contentRef?:string;assetRef?:string;priority:number;mandatory:boolean;visualImportance:number;preferredRegion?:string;minSize?:number;maxSize?:number;maxLines?:number;canCrop?:boolean;canOverlap?:boolean;canHide?:boolean;layerRole:string;groupId?:string}
export type RelationshipType='align_left'|'align_right'|'align_top'|'align_bottom'|'align_center_x'|'align_center_y'|'above'|'below'|'left_of'|'right_of'|'contains'|'overlaps'|'avoids'|'anchors_to'|'groups_with'|'same_width'|'same_height'|'proportional_to';
export type ConstraintPriority='required'|'strong'|'preferred'|'weak';
export interface LayoutConstraint {id:string;type:string;priority:ConstraintPriority;sourceRef?:string;description:string}
export interface LayoutRelationship {id:string;sourceId:string;targetId:string;type:RelationshipType;priority:ConstraintPriority}
export interface LayoutIntent {heroRegionPreference:'top'|'bottom'|'left'|'right'|'center'|'full_bleed';textRegionPreference:'top'|'bottom'|'left'|'right'|'center'|'overlay';axisPreference:'horizontal'|'vertical'|'mixed';balancePreference:'symmetric'|'asymmetric'|'controlled_imbalance';density:number;negativeSpaceTarget:number;overlapTolerance:number;layeringIntent:'flat'|'layered'|'deep';alignmentCharacter:'strict'|'optical'|'mixed';modularity:number;focalOrder:ContentRole[]}
export type LayoutArchetypeId='split_hero'|'editorial_asymmetric'|'centered_statement'|'typographic_poster'|'data_dominant'|'full_bleed_overlay'|'modular_cards'|'product_stage'|'framed_editorial'|'stacked_story'|'balanced_dual_zone';
export interface RankedArchetype {id:LayoutArchetypeId;score:number;reasons:string[]}
export interface LayoutRegion {id:string;purpose:'hero'|'primary_message'|'secondary_message'|'brand'|'offer'|'cta'|'legal'|'negative_space'|'supporting_visual';rect:NormalizedRect;priority:number;occupancy:number;constraints:LayoutConstraint[]}
export interface TypographyToken {role:'display'|'headline'|'subheadline'|'body'|'data'|'cta'|'caption'|'legal';minSize:number;preferredSize:number;maxSize:number;lineHeightRatio:number;trackingRange:[number,number];maxLines:number;weightRole:string}
export interface TypographyScale {ratio:number;baseSize:number;tokens:TypographyToken[];fontResolutionStatus:'approved'|'fallback'|'unresolved'}
export interface ImagePlacementPlan {elementId:string;region:NormalizedRect;fit:'cover'|'contain';cropBehavior:string;focalAnchor:'center'|'top'|'bottom'|'left'|'right'|'face_safe'|'product_safe'|'custom';bleed:boolean;mask?:string;overlay?:string}
export interface LogoPlacementPlan {elementId:string;assetRef:string;region:NormalizedRect;clearSpace:number;minimumSize:number;allowedBackground?:string;confidence:number;fidelityPreserved:true}
export interface OpticalAdjustment {dx:number;dy:number;reason:string;magnitude:number}
export interface LayoutElementPlan {id:string;role:ContentRole;contentRef?:string;assetRef?:string;rect:NormalizedRect;pixelRect:PixelRect;layer:string;alignment:string;typographyToken?:TypographyToken['role'];colorRole?:string;spacingToken?:keyof SpacingScale['tokens'];constraints:LayoutConstraint[];visibility:'visible'|'hidden';confidence:number;mandatory:boolean;canOverlap:boolean;opticalAdjustment?:OpticalAdjustment}
export interface LayerStack {order:string[]}
export interface OccupancyCell {row:number;column:number;visualOccupancy:number;textDensity:number;heroDensity:number;negativeSpace:number;edgePressure:number}
export interface OccupancyMap {columns:number;rows:number;cells:OccupancyCell[]}
export interface Collision {a:string;b?:string;type:'hard_collision'|'allowed_overlap'|'unsafe_overlap'|'text_image_conflict'|'safe_area_violation';severity:'error'|'warning'}
export interface LayoutQualityMetrics {hierarchy:number;alignment:number;spacingConsistency:number;grouping:number;negativeSpace:number;balance:number;safeAreaCompliance:number;collisionSafety:number;textFit:number;brandCompliance:number;routeFidelity:number;formatSuitability:number;overall:number}
export interface LayoutDecisionProvenance {decision:string;source:'creative_route'|'message_hierarchy'|'brand_constraint'|'reference_structure'|'format'|'grid_rule'|'typography_rule'|'collision_resolution'|'responsive_reflow'|'optical_adjustment';sourceRef?:string}
export interface LayoutPlan {schemaVersion:typeof LAYOUT_PLAN_SCHEMA_VERSION;layoutId:string;projectId:string;creativeDirectionSessionId:string;selectedRouteId:string;archetype:LayoutArchetypeId;format:FormatDefinition;canvas:CanvasSpec;grid:GridDefinition;spacingScale:SpacingScale;typographyScale:TypographyScale;regions:LayoutRegion[];elements:LayoutElementPlan[];relationships:LayoutRelationship[];layers:LayerStack;imagePlacements:ImagePlacementPlan[];logoPlacements:LogoPlacementPlan[];occupancyMap:OccupancyMap;negativeSpaceRatio:number;negativeSpaceDistribution:Record<string,number>;visualMassCenter:NormalizedPoint;opticalCenter:NormalizedPoint;collisions:Collision[];quality:LayoutQualityMetrics;warnings:string[];provenance:LayoutDecisionProvenance[];eligible:boolean;gateFailures:string[];responsiveMetadata?:{sourceLayoutId:string;invariants:string[]}}
export interface ContentSequencePlan {frameIds:string[];messageRefsByFrame:Record<string,string[]>}
export interface KeepTogetherGroup {id:string;contentRefs:string[];reason:string}
export interface LayoutDocument {documentId:string;projectId:string;formatFamily:string;frames:LayoutPlan[];contentSequence?:ContentSequencePlan;keepTogetherGroups:KeepTogetherGroup[]}
export interface ResponsiveLayoutFamily {familyId:string;sourceLayoutId:string;variants:LayoutPlan[];invariants:string[]}
export interface LayoutCandidate {id:string;archetype:LayoutArchetypeId;plan:LayoutPlan}
export interface LayoutIntelligenceSession {schemaVersion:typeof LAYOUT_PLAN_SCHEMA_VERSION;sessionId:string;projectId:string;createdAt:string;inputFingerprint:string;layoutDocument?:LayoutDocument;candidates?:LayoutCandidate[];selectedLayoutId?:string;quality?:LayoutQualityMetrics;warnings:string[];status:'ready'|'partial'|'failed';failureReason?:string;sourceVersions:{creativeDirection:string;brandDNA?:string;referenceDNA?:string;layoutSchema:string};aiUsage?:AIUsageResult;cost:0}
