import {
  campaignFingerprint,
  deriveFamilyApproval,
  type CampaignFamilyAuthority,
  type CampaignFamilyRepository,
  type CampaignVariantFamily,
} from "../../domain/campaign-variants/index.js";

export async function approveCampaignFamily(
  family: CampaignVariantFamily,
  repository: CampaignFamilyRepository,
) {
  const approval = deriveFamilyApproval(family);
  if (!approval.metaAdsPackageReady)
    throw new Error("All four visual production authorities are required.");
  const variantAuthorityIds: Record<string, string> = {};
  const packageFingerprints: Record<string, string> = {};
  for (const variant of family.variants) {
    if (
      variant.status !== "approved" ||
      !variant.productionAuthorityId ||
      !variant.visualApprovedPackageFingerprint
    )
      throw new Error(
        "Variant authority or approved package fingerprint is missing.",
      );
    variantAuthorityIds[variant.formatId] = variant.productionAuthorityId;
    packageFingerprints[variant.formatId] =
      variant.visualApprovedPackageFingerprint;
  }
  const fingerprint = campaignFingerprint({
    family: family.inputFingerprint,
    invariants: family.invariants.fingerprint,
    policyVersion: family.policyVersion,
    variantAuthorityIds,
    packageFingerprints,
  });
  const authority: CampaignFamilyAuthority = {
    familyAuthorityId: `campaign_authority_${fingerprint.slice(0, 24)}`,
    familyId: family.familyId,
    projectId: family.projectId,
    operationId: `campaign-authority:${fingerprint}`,
    fingerprint,
    variantAuthorityIds,
    status: "valid",
    invariantsFingerprint: family.invariants.fingerprint,
    approvedAt: new Date().toISOString(),
  };
  const next: CampaignVariantFamily = {
    ...family,
    status: "approved",
    approval: {
      ...approval,
      familyAuthorityId: authority.familyAuthorityId,
      approvedAt: authority.approvedAt,
    },
    updatedAt: authority.approvedAt,
  };
  return (await repository.approve(next, authority, family.revision)).authority;
}
