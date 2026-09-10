import { Grid3X3, Maximize, Shield } from "lucide-react";
import { IconButton } from "../primitives/Button.js";
import { Badge, Skeleton } from "../primitives/Status.js";
import type { ReactNode } from "react";
export function ArtboardViewport({
  projectId,
  hasRender,
  approved,
  formatId,
  ratio,
  scene,
  zoom,
  showGrid,
  showSafeArea,
  onChange,
  accessory,
  campaignPreview,
}: {
  projectId: string;
  hasRender: boolean;
  approved: boolean;
  formatId: string;
  ratio: number;
  scene: number;
  zoom: number;
  showGrid: boolean;
  showSafeArea: boolean;
  onChange: (patch: {
    zoom?: number;
    showGrid?: boolean;
    showSafeArea?: boolean;
  }) => void;
  accessory?: ReactNode;
  campaignPreview?: { familyId: string; formatId: string };
}) {
  return (
    <section className="viewport">
      {accessory}
      <header>
        <div>
          <Badge tone={approved ? "success" : hasRender ? "info" : "neutral"}>
            {approved
              ? "Aprovado visualmente"
              : hasRender
                ? campaignPreview
                  ? "Prévia — ainda não aprovada"
                  : "Render atual"
                : "Prévia de layout"}
          </Badge>
          <span>{formatId}</span>
        </div>
        <div className="viewport-tools">
          <IconButton
            label="Ajustar à tela"
            onClick={() => onChange({ zoom: 0 })}
          >
            <Maximize size={16} />
          </IconButton>
          {[25, 50, 75, 100].map((value) => (
            <button
              className={zoom === value ? "active" : ""}
              key={value}
              onClick={() => onChange({ zoom: value })}
            >
              {value}%
            </button>
          ))}
          <IconButton
            label="Alternar safe area"
            onClick={() => onChange({ showSafeArea: !showSafeArea })}
          >
            <Shield size={16} />
          </IconButton>
          <IconButton
            label="Alternar grade"
            onClick={() => onChange({ showGrid: !showGrid })}
          >
            <Grid3X3 size={16} />
          </IconButton>
        </div>
      </header>
      <div className="canvas">
        <div
          className={`artboard ${showGrid ? "show-grid" : ""}`}
          style={{
            aspectRatio: String(ratio),
            transform: zoom ? `scale(${zoom / 100})` : undefined,
          }}
        >
          {hasRender ? (
            <img
              src={`/api/projects/${encodeURIComponent(projectId)}/preview?scene=${scene}${campaignPreview ? `&familyId=${encodeURIComponent(campaignPreview.familyId)}&formatId=${encodeURIComponent(campaignPreview.formatId)}` : ""}`}
              alt="Prévia atual da arte"
              onLoad={(e) => e.currentTarget.classList.add("loaded")}
            />
          ) : (
            <div className="wireframe">
              <Skeleton className="wireframe__eyebrow" />
              <Skeleton className="wireframe__headline" />
              <Skeleton className="wireframe__copy" />
              <div className="wireframe__image" />
            </div>
          )}
          {showSafeArea ? (
            <div className="safe-area" aria-label="Área segura" />
          ) : null}
        </div>
      </div>
    </section>
  );
}
