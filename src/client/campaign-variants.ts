import type { CampaignVariantFamily } from "../domain/campaign-variants/index.js";
import { parseApiResponse } from "./api-response.js";
const headers = { "Content-Type": "application/json" };
export const createCampaignFamily = async (input: {
  projectId: string;
  expectedRevision: number;
  operationId: string;
  primaryFormatId?: string;
}) =>
  parseApiResponse<{ family: CampaignVariantFamily; cacheHit: boolean }>(
    await fetch(
      `/api/projects/${encodeURIComponent(input.projectId)}/campaign-family`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          familyDefinitionId: "meta_ads_family",
          primaryFormatId: input.primaryFormatId,
          expectedRevision: input.expectedRevision,
          operationId: input.operationId,
        }),
      },
    ),
  );
export const getLatestCampaignFamily = async (
  projectId: string,
  signal?: AbortSignal,
) =>
  parseApiResponse<{ family: CampaignVariantFamily }>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/campaign-family/latest`,
      { signal },
    ),
  );
export const retryCampaignFormat = async (
  projectId: string,
  familyId: string,
  formatId: string,
) =>
  parseApiResponse<{ family: CampaignVariantFamily }>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/campaign-family/${encodeURIComponent(familyId)}/variants/${encodeURIComponent(formatId)}/retry`,
      { method: "POST", headers },
    ),
  );
export const runCampaignFamily = async (projectId: string, familyId: string) =>
  parseApiResponse<{ family: CampaignVariantFamily }>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/campaign-family/${encodeURIComponent(familyId)}/run`,
      { method: "POST", headers },
    ),
  );
export const createCampaignFamilyExport = async (
  projectId: string,
  familyId: string,
  projectSlug?: string,
) =>
  parseApiResponse<{
    exportSessionId: string;
    artifact: { artifactId: string; filename: string };
  }>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/campaign-family/${encodeURIComponent(familyId)}/export`,
      { method: "POST", headers, body: JSON.stringify({ projectSlug }) },
    ),
  );
export const getCampaignFamilyDownload = async (
  projectId: string,
  familyId: string,
  exportSessionId: string,
) =>
  parseApiResponse<{ url: string; filename: string }>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/campaign-family/${encodeURIComponent(familyId)}/exports/${encodeURIComponent(exportSessionId)}/read-handle`,
      { method: "POST", headers },
    ),
  );
