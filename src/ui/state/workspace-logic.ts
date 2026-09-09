import type {
  DurableProjectRecord,
  SafeProjectState,
  WorkflowStage,
} from "../../domain/project-persistence/index.js";
import type {
  WorkspaceDraft,
  WorkspaceInputState,
  WorkspacePipelineState,
} from "./workspace-types.js";
export const formatContextFor = (id: string) =>
  id.startsWith("meta_ads_")
    ? { platform: "meta", usage: "advertising" }
    : undefined;
export const toWorkspaceInput = (
  draft: WorkspaceDraft,
): WorkspaceInputState => ({
  copyText: draft.copyText,
  tone: draft.tone,
  formatId: draft.formatId,
  formatContext: formatContextFor(draft.formatId),
  destinationTool: draft.destinationTool,
  analysisDepth: draft.analysisDepth,
  brandEnabled: draft.brandEnabled,
  primaryColor: draft.primaryColor,
  secondaryColor: draft.secondaryColor,
  titleFont: draft.titleFont,
  bodyFont: draft.bodyFont,
  brandUrl: draft.brandUrl,
  visualNotes: draft.visualNotes,
  customWidth: draft.customWidth,
  customHeight: draft.customHeight,
  referenceAssetId: draft.referenceAsset?.assetId,
  logoAssetId: draft.logoAsset?.assetId,
  productAssetIds: draft.productAssets.map((asset) => asset.assetId),
  brandPhotoAssetIds: draft.brandPhotoAssets.map((asset) => asset.assetId),
  graphicAssetIds: draft.graphicAssets.map((asset) => asset.assetId),
});
export const fingerprintWorkspaceInput = async (input: WorkspaceInputState) => {
  const bytes = new TextEncoder().encode(JSON.stringify(input)),
    digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
};
const stageOrder: WorkflowStage[] = [
  "workspace_input",
  "reference_intelligence",
  "brand_intelligence",
  "creative_direction",
  "layout",
  "art_director_review",
  "render_session",
  "image_asset_session",
  "post_render_review",
];
export function resolveWorkflowInvalidation(
  kind: "brief" | "brand" | "reference" | "format",
): WorkflowStage[] {
  const start = {
    brief: "creative_direction",
    brand: "brand_intelligence",
    reference: "reference_intelligence",
    format: "layout",
  }[kind] as WorkflowStage;
  return stageOrder.slice(stageOrder.indexOf(start));
}
export function deriveProjectWorkspaceStatus(
  state:
    | SafeProjectState
    | {
        project: DurableProjectRecord;
        workflow?: Record<string, unknown>;
        latestProductionAuthority?: { status: string };
        exports?: unknown[];
      },
): string {
  if (state.project.status === "archived") return "Arquivado";
  if (state.latestProductionAuthority?.status === "degraded")
    return "Degradado";
  if (state.latestProductionAuthority?.status === "valid")
    return (state.exports?.length ?? 0) > 0
      ? "Pronto para exportar"
      : "Aprovado";
  const workflow = state.workflow ?? {};
  if (workflow.post_render_review) return "Revisão necessária";
  if (workflow.render_session) return "Produção";
  if (workflow.layout) return "Em revisão";
  if (workflow.workspace_input) return "Configurando";
  return "Rascunho";
}
export function pipelineFromSnapshot(
  state: SafeProjectState,
): WorkspacePipelineState {
  const w = state.workflow,
    a = Boolean(state.latestProductionAuthority?.status === "valid");
  return {
    running: false,
    stages: {
      preparation: w.workspace_input ? "approved" : "ready",
      reference: w.reference_intelligence ? "approved" : "idle",
      creative: w.creative_direction ? "approved" : "idle",
      layout: w.layout ? "approved" : "idle",
      review: w.art_director_review ? "approved" : "idle",
      production: w.render_session ? "approved" : "idle",
      qa: a ? "approved" : w.post_render_review ? "failed" : "idle",
      delivery: a ? "ready" : "blocked",
    },
  };
}
