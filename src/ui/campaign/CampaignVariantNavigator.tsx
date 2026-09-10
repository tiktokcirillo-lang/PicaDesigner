import type { CampaignVariantFamily } from "../../domain/campaign-variants/index.js";
import { Badge } from "../primitives/Status.js";
const labels: Record<string, string> = {
  meta_ads_square: "1:1",
  meta_ads_feed_portrait: "4:5",
  meta_ads_story_reels: "9:16",
  meta_ads_landscape: "1.91:1",
};
export function CampaignVariantNavigator({
  family,
  selectedFormatId,
  onSelect,
  onRetry,
}: {
  family?: CampaignVariantFamily;
  selectedFormatId: string;
  onSelect: (formatId: string) => void;
  onRetry?: (formatId: string) => void;
}) {
  if (!family)
    return (
      <div className="campaign-empty">
        O pacote criará quatro composições nativas.
      </div>
    );
  return (
    <section className="campaign-variants" aria-label="Variantes da campanha">
      <header>
        <strong>Campanha Meta Ads</strong>
        <span>{family.approval.approvedVariantIds.length} de 4 aprovadas</span>
      </header>
      <div role="tablist" aria-label="Selecionar formato da campanha">
        {family.variants.map((variant) => (
          <div key={variant.variantId} className="campaign-variant-item">
            <button
              role="tab"
              aria-selected={selectedFormatId === variant.formatId}
              className={
                selectedFormatId === variant.formatId ? "selected" : ""
              }
              onClick={() => onSelect(variant.formatId)}
            >
              <strong>{labels[variant.formatId] ?? variant.formatId}</strong>
              <small>
                {variant.width}×{variant.height}
              </small>
              <Badge
                tone={
                  variant.status === "approved"
                    ? "success"
                    : variant.status === "failed" ||
                        variant.status === "blocked"
                      ? "error"
                      : "info"
                }
              >
                {variant.status.replaceAll("_", " ")}
              </Badge>
            </button>
            {(variant.status === "failed" || variant.status === "blocked") &&
            !family.warnings.includes("campaign_upstream_revision_required") ? (
              <button
                className="campaign-variant-retry"
                onClick={() => onRetry?.(variant.formatId)}
              >
                Tentar novamente
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {family.warnings.includes("campaign_upstream_revision_required") ? (
        <p role="alert">
          A campanha precisa ser atualizada antes de continuar.
        </p>
      ) : family.status === "partial" ? (
        <p role="status">
          {family.approval.missingFormatIds.length} formato precisa de correção.
        </p>
      ) : null}
    </section>
  );
}
