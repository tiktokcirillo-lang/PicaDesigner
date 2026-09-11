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
  sourceAssetResolution?: "resolved" | "conditional" | "missing";
  correctionRequired?: boolean;
}
export function evaluateCampaignBudgetPreflight(
  input: CampaignBudgetPreflightInput,
) {
  const reviewUsd = input.remainingVariants * input.reviewCostUsd,
    qaUsd = input.remainingVariants * input.qaCostUsd,
    sourceResolution = input.sourceAssetResolution ??
      (input.hasResolvedSourceAsset ? "resolved" : "missing"),
    imageMandatory =
      sourceResolution === "missing" && !input.hasReusableGeneratedAsset,
    imageConditional =
      sourceResolution === "conditional" && !input.hasReusableGeneratedAsset,
    mandatoryImageUsd = imageMandatory ? input.imageCostUsd : 0,
    mandatoryVerificationUsd = input.correctionRequired
      ? input.verificationCostUsd
      : 0,
    estimatedMandatoryRemaining =
      reviewUsd + qaUsd + mandatoryImageUsd + mandatoryVerificationUsd,
    conditionalReserve =
      (input.correctionRequired ? 0 : input.verificationCostUsd) +
      (imageConditional ? input.imageCostUsd : 0),
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
      imageConditional,
      sourceAssetResolution: sourceResolution,
      sourceAssetReuse: sourceResolution === "resolved",
      generatedAssetReuse: input.hasReusableGeneratedAsset,
      correctionConditional: !input.correctionRequired,
    },
  };
}
