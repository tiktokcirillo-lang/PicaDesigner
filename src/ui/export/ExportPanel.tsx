import { Download, PackageOpen } from "lucide-react";
import { useState } from "react";
import type { SafeProjectState } from "../../domain/project-persistence/index.js";
import {
  createProductionExport,
  getProductionDownload,
} from "../../client/production-export.js";
import { Button } from "../primitives/Button.js";
import type { CampaignVariantFamily } from "../../domain/campaign-variants/index.js";
import {
  createCampaignFamilyExport,
  getCampaignFamilyDownload,
} from "../../client/campaign-variants.js";
import { useToast } from "../primitives/Toast.js";
export function ExportPanel({
  projectId,
  state,
  campaignFamily,
}: {
  projectId: string;
  state: SafeProjectState;
  campaignFamily?: CampaignVariantFamily;
}) {
  const [busy, setBusy] = useState(""),
    { notify } = useToast(),
    approved = state.latestProductionAuthority?.status === "valid";
  async function downloadCampaign() {
    if (!campaignFamily) return;
    setBusy("campaign");
    try {
      const session = await createCampaignFamilyExport(
          projectId,
          campaignFamily.familyId,
          state.project.name,
        ),
        handle = await getCampaignFamilyDownload(
          projectId,
          campaignFamily.familyId,
          session.exportSessionId,
        ),
        link = document.createElement("a");
      link.href = handle.url;
      link.download = handle.filename;
      link.click();
      notify("Pacote Meta Ads pronto");
    } catch {
      notify("Não foi possível preparar o pacote Meta Ads.");
    } finally {
      setBusy("");
    }
  }
  async function download(format: "png" | "webp" | "pdf" | "zip" | "svg") {
    setBusy(format);
    try {
      const session = await createProductionExport({
        projectId,
        formats:
          format === "zip"
            ? ["png", "webp"]
            : format === "pdf"
              ? ["pdf"]
              : [format],
        profile:
          format === "zip"
            ? "campaign_package"
            : format === "pdf"
              ? "client_proof_pdf"
              : format === "webp"
                ? "social_webp"
                : "social_png",
        includeZip: format === "zip",
        includeManifest: format === "zip",
        operationId: `workspace-export:${projectId}:${format}`,
      });
      const artifact =
        format === "zip"
          ? session.packageArtifact
          : session.artifacts.find((x) => x.format === format);
      if (!artifact) throw new Error("Artefato indisponível.");
      const handle = await getProductionDownload({
        projectId,
        exportSessionId: session.sessionId,
        artifactId: artifact.artifactId,
      });
      const link = document.createElement("a");
      link.href = handle.url!;
      link.download = handle.filename ?? artifact.filename;
      link.click();
      notify("Export pronto");
    } catch {
      notify("Não foi possível preparar o export.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="export-panel">
      {campaignFamily ? (
        <section className="campaign-export">
          <strong>Pacote Meta Ads</strong>
          {campaignFamily.variants.map((variant) => (
            <p key={variant.variantId}>
              {variant.width}×{variant.height} —{" "}
              {variant.status === "approved" ? "Ready" : variant.status}
            </p>
          ))}
          <Button
            disabled={
              !campaignFamily.approval.metaAdsPackageReady || Boolean(busy)
            }
            onClick={downloadCampaign}
          >
            <Download size={15} />
            {busy === "campaign" ? "Preparando…" : "Baixar pacote Meta Ads"}
          </Button>
        </section>
      ) : null}
      {!approved ? (
        <div className="export-gate">
          <PackageOpen />
          <strong>Exportação bloqueada</strong>
          <p>A revisão visual precisa ser aprovada antes da exportação.</p>
        </div>
      ) : (
        <>
          <p>Baixe arquivos produzidos pela authority aprovada no servidor.</p>
          <div className="export-actions">
            {(["png", "webp", "pdf", "zip", "svg"] as const).map((format) => (
              <Button
                key={format}
                variant={format === "png" ? "primary" : "secondary"}
                disabled={Boolean(busy)}
                onClick={() => download(format)}
              >
                <Download size={15} />
                {busy === format ? "Preparando…" : format.toUpperCase()}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
