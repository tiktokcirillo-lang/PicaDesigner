import type { AnalysisDepth } from "../../domain/visual-forensics/index.js";
import type { SafeProjectState } from "../../domain/project-persistence/index.js";
import type { ProjectSourceAssetSummary } from "../../domain/source-assets/index.js";
export type WorkspaceTab = "briefing" | "reference" | "brand" | "format";
export type RightTab = "pipeline" | "details" | "export";
export interface WorkspaceDraft {
  copyText: string;
  tone: string;
  formatId: string;
  customWidth?: number;
  customHeight?: number;
  destinationTool: string;
  analysisDepth: AnalysisDepth;
  brandEnabled: boolean;
  primaryColor: string;
  secondaryColor: string;
  titleFont: string;
  bodyFont: string;
  brandUrl: string;
  visualNotes: string;
  referenceAsset?: ProjectSourceAssetSummary;
  logoAsset?: ProjectSourceAssetSummary;
  productAssets: ProjectSourceAssetSummary[];
  brandPhotoAssets: ProjectSourceAssetSummary[];
  graphicAssets: ProjectSourceAssetSummary[];
}
export interface WorkspaceInputState extends Omit<WorkspaceDraft,"referenceAsset"|"logoAsset"|"productAssets"|"brandPhotoAssets"|"graphicAssets"> {
  formatContext?: { platform: string; usage: string };
  referenceAssetId?: string;
  logoAssetId?: string;
  productAssetIds: string[];
  brandPhotoAssetIds: string[];
  graphicAssetIds: string[];
}
export type PipelineStageId =
  | "preparation"
  | "reference"
  | "creative"
  | "layout"
  | "review"
  | "production"
  | "qa"
  | "delivery";
export type PipelineStageStatus =
  "idle" | "ready" | "running" | "stale" | "blocked" | "failed" | "approved";
export interface WorkspacePipelineState {
  active?: PipelineStageId;
  running: boolean;
  error?: string;
  stages: Record<PipelineStageId, PipelineStageStatus>;
}
export interface WorkspaceState {
  serverSnapshot: SafeProjectState;
  draft: WorkspaceDraft;
  pipelineRuntime: WorkspacePipelineState;
  previewState: {
    scene: number;
    zoom: number;
    showSafeArea: boolean;
    showGrid: boolean;
  };
  uiState: {
    leftTab: WorkspaceTab;
    rightTab: RightTab;
    saveStatus: "idle" | "saving" | "saved" | "conflict" | "error";
  };
}
export const DEFAULT_DRAFT: WorkspaceDraft = {
  copyText: "",
  tone: "premium",
  formatId: "meta_ads_square",
  destinationTool: "Canva",
  analysisDepth: "standard",
  brandEnabled: false,
  primaryColor: "#0a1628",
  secondaryColor: "#c9a84c",
  titleFont: "",
  bodyFont: "",
  brandUrl: "",
  visualNotes: "",
  productAssets: [],
  brandPhotoAssets: [],
  graphicAssets: [],
};
