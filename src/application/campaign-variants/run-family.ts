import type { BrandIntelligenceSession } from "../../domain/brand-intelligence/index.js";
import type { CreativeDirectionSession } from "../../domain/creative-direction/index.js";
import type { ProjectAssetRegistry } from "../../domain/render-engine/index.js";
import type { ReferenceIntelligenceSession } from "../reference-intelligence/index.js";
import {
  deriveFamilyApproval,
  evaluateCampaignFamilyConsistency,
  type CampaignFamilyRepository,
  type CampaignVariant,
  type CampaignVariantFamily,
} from "../../domain/campaign-variants/index.js";
import { approveCampaignFamily } from "./approval.js";
import {
  runCampaignVariant,
  type CampaignVariantEngineAdapters,
} from "./run-variant.js";
export async function runCampaignFamily(
  input: {
    family: CampaignVariantFamily;
    currentFamilyFingerprint: string;
    creative: CreativeDirectionSession;
    brand?: BrandIntelligenceSession;
    reference?: ReferenceIntelligenceSession;
    sourceRegistry: ProjectAssetRegistry;
    onlyFormatId?: string;
  },
  deps: {
    repository: CampaignFamilyRepository;
    engines: CampaignVariantEngineAdapters;
  },
) {
  if (input.currentFamilyFingerprint !== input.family.inputFingerprint)
    throw new Error("campaign_upstream_revision_required");
  let family = input.family,
    registry = input.sourceRegistry,
    correctionAvailable = true,
    costs = family.costBreakdown ?? {
      sharedUpstreamUsd: 0,
      layoutReviewUsd: 0,
      imageGenerationUsd: 0,
      postRenderQaUsd: 0,
      correctionUsd: 0,
      verificationUsd: 0,
      totalAiUsd: 0,
    };
  const targets = family.variants.filter(
    (v) =>
      (!input.onlyFormatId || v.formatId === input.onlyFormatId) &&
      v.status !== "approved",
  );
  if (input.onlyFormatId && !targets.length) {
    const existing = family.variants.find(
      (v) => v.formatId === input.onlyFormatId,
    );
    if (existing?.status === "approved") return { family, cacheHit: true };
    throw new Error("Campaign retry target is unavailable.");
  }
  const queue = targets.map((variant) => variant.variantId),
    processed = new Set<string>();
  while (queue.length) {
    const targetId = queue.shift()!,
      target = family.variants.find(
        (variant) => variant.variantId === targetId,
      );
    if (!target || processed.has(targetId)) continue;
    processed.add(targetId);
    const result = await runCampaignVariant(
      {
        family,
        variant: target,
        creative: input.creative,
        brand: input.brand,
        reference: input.reference,
        registry,
        correctionAllowed: correctionAvailable,
      },
      deps.engines,
    );
    registry = result.registry;
    costs = {
      ...costs,
      layoutReviewUsd: costs.layoutReviewUsd + (result.review?.cost ?? 0),
      imageGenerationUsd:
        costs.imageGenerationUsd + (result.assets?.cost.actualUsd ?? 0),
      postRenderQaUsd:
        costs.postRenderQaUsd +
        (result.qa?.costBreakdown
          ? result.qa.costBreakdown.initialQaUsd +
            result.qa.costBreakdown.escalationUsd
          : (result.qa?.cost ?? 0)),
      correctionUsd:
        costs.correctionUsd + (result.qa?.costBreakdown?.regenerationUsd ?? 0),
      verificationUsd:
        costs.verificationUsd +
        (result.qa?.costBreakdown?.verificationUsd ?? 0),
      totalAiUsd: 0,
    };
    costs.totalAiUsd =
      costs.sharedUpstreamUsd +
      costs.layoutReviewUsd +
      costs.imageGenerationUsd +
      costs.postRenderQaUsd +
      costs.correctionUsd +
      costs.verificationUsd;
    if (result.qa?.regenerationRounds?.length) correctionAvailable = false;
    const upstreamFailure =
      result.qa?.outcome === "upstream_revision_required" ||
      result.variant.warnings?.includes("campaign_upstream_revision_required");
    if (upstreamFailure) queue.length = 0;
    const usedAssetIds = new Set(
      result.render?.renderDocument.scenes.flatMap((scene) =>
        scene.assetManifest.requirements
          .map((requirement) => requirement.assetRef)
          .filter((id): id is string => Boolean(id)),
      ) ?? [],
    );
    const sourceAssets = { ...family.dependencyGraph.sourceAssets },
      generatedAssets = { ...family.dependencyGraph.generatedAssets };
    for (const asset of registry.assets.filter((item) =>
      usedAssetIds.has(item.id),
    )) {
      const graph =
        asset.source === "generated" ? generatedAssets : sourceAssets;
      graph[asset.id] = [
        ...new Set([...(graph[asset.id] ?? []), target.variantId]),
      ];
    }
    const rounds = result.qa?.regenerationRounds ?? [],
      affected = new Set<string>();
    const lineage = [...(family.dependencyGraph.generatedAssetLineage ?? [])];
    for (const round of rounds)
      for (let index = 0; index < round.sourceAssetIds.length; index++) {
        const oldId = round.sourceAssetIds[index]!,
          dependents = generatedAssets[oldId] ?? [];
        dependents.forEach((id) => affected.add(id));
        const replacementId = round.newAssetIds[index];
        if (replacementId) generatedAssets[replacementId] = [...dependents];
        lineage.push({
          supersedesAssetId: oldId,
          replacementAssetId: replacementId,
          oldChecksum: round.sourceAssetChecksums[index],
          newChecksum: round.newAssetChecksums[index],
          affectedVariantIds: [...dependents],
        });
      }
    for (const id of affected)
      if (id !== target.variantId) {
        processed.delete(id);
        if (!queue.includes(id)) queue.push(id);
      }
    const variants: CampaignVariant[] = family.variants.map((v) =>
        v.variantId === target.variantId
          ? (result.variant as CampaignVariant)
          : affected.has(v.variantId)
            ? {
                ...v,
                status: "pending",
                productionAuthorityId: undefined,
                visualApprovedPackageFingerprint: undefined,
                postRenderReviewSessionId: undefined,
                readiness: {
                  ...v.readiness,
                  visualQa: false,
                  authority: false,
                  blockers: ["shared_asset_revision"],
                },
                warnings: [...v.warnings, "shared_asset_revision"],
              }
            : v,
      ),
      approval = deriveFamilyApproval({ ...family, variants });
    const familyReview = evaluateCampaignFamilyConsistency({
      ...family,
      variants,
      warnings: upstreamFailure
        ? [...family.warnings, "campaign_upstream_revision_required"]
        : family.warnings,
    });
    family = await deps.repository.save(
      {
        ...family,
        variants,
        approval,
        familyReview,
        status: upstreamFailure
          ? "blocked"
          : approval.metaAdsPackageReady
            ? "approved"
            : variants.some((v) => v.status === "approved")
              ? "partial"
              : variants.some((v) => v.status === "blocked")
                ? "blocked"
                : "running",
        dependencyGraph: {
          ...family.dependencyGraph,
          sourceAssets,
          generatedAssets,
          generatedAssetLineage: lineage,
          variants: Object.fromEntries(
            variants.map((v) => [
              v.variantId,
              {
                layoutId: v.layoutSessionId,
                renderId: v.renderSessionId,
                qaId: v.postRenderReviewSessionId,
                authorityId: v.productionAuthorityId,
              },
            ]),
          ),
        },
        costBreakdown: costs,
        warnings: upstreamFailure
          ? [
              ...new Set([
                ...family.warnings,
                "campaign_upstream_revision_required",
              ]),
            ]
          : family.warnings,
        updatedAt: new Date().toISOString(),
      },
      family.revision,
    );
  }
  if (family.approval.metaAdsPackageReady) {
    const authority = await approveCampaignFamily(family, deps.repository),
      restored = await deps.repository.get(family.projectId, family.familyId);
    if (!restored?.approval.familyAuthorityId)
      throw new Error("Transactional family approval failed.");
    return { family: restored, authority, cacheHit: false };
  }
  return { family, cacheHit: false };
}
