export interface CampaignBudgetPreflightInput {
  actualSpentUsd: number;
  remainingHardCapUsd: number;
  monthlyRemainingUsd: number;
  remainingVariants: number;
  reviewCostUsd: number;
  qaCostUsd: number;
  imageCostUsd: number;
  verificationCostUsd: number;
  hasResolvedSourceAsset: boolean;
  hasReusableGeneratedAsset: boolean;
  correctionRequired?: boolean;
}
export function evaluateCampaignBudgetPreflight(
  input: CampaignBudgetPreflightInput,
) {
  const reviewUsd = input.remainingVariants * input.reviewCostUsd,
    qaUsd = input.remainingVariants * input.qaCostUsd,
    imageMandatory =
      !input.hasResolvedSourceAsset && !input.hasReusableGeneratedAsset,
    mandatoryImageUsd = imageMandatory ? input.imageCostUsd : 0,
    mandatoryVerificationUsd = input.correctionRequired
      ? input.verificationCostUsd
      : 0,
    estimatedMandatoryRemaining =
      reviewUsd + qaUsd + mandatoryImageUsd + mandatoryVerificationUsd,
    conditionalReserve = input.correctionRequired
      ? 0
      : input.verificationCostUsd,
    available = Math.min(input.remainingHardCapUsd, input.monthlyRemainingUsd),
    allowed = estimatedMandatoryRemaining <= available;
  return {
    allowed,
    actualSpentUsd: input.actualSpentUsd,
    remainingHardCapUsd: input.remainingHardCapUsd,
    monthlyRemainingUsd: input.monthlyRemainingUsd,
    estimatedMandatoryRemaining,
    conditionalReserve,
    projectedMandatoryTotalUsd:
      input.actualSpentUsd + estimatedMandatoryRemaining,
    breakdown: {
      reviewUsd,
      qaUsd,
      mandatoryImageUsd,
      mandatoryVerificationUsd,
      conditionalVerificationUsd: conditionalReserve,
    },
    assumptions: {
      imageMandatory,
      sourceAssetReuse: input.hasResolvedSourceAsset,
      generatedAssetReuse: input.hasReusableGeneratedAsset,
      correctionConditional: !input.correctionRequired,
    },
  };
}
