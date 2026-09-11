import { Check, Clock3, LoaderCircle, ShieldAlert } from "lucide-react";
import type {
  PipelineStageId,
  WorkspacePipelineState,
} from "../state/workspace-types.js";
const labels: Record<PipelineStageId, string> = {
  preparation: "Preparação",
  reference: "Referência",
  creative: "Direção criativa",
  layout: "Composição",
  review: "Revisão",
  production: "Produção",
  qa: "QA visual",
  delivery: "Entrega",
};
export function PipelineTimeline({
  pipeline,
  referenceState,
}: {
  pipeline: WorkspacePipelineState;
  referenceState?: "optional" | "uploading" | "ready" | "failed";
}) {
  return (
    <ol className="pipeline-list">
      {(Object.keys(labels) as PipelineStageId[]).map((id) => {
        const status = pipeline.stages[id],
          Icon =
            status === "approved"
              ? Check
              : status === "running"
                ? LoaderCircle
                : status === "failed" || status === "blocked"
                  ? ShieldAlert
                  : Clock3;
        return (
          <li key={id} className={`stage stage--${status}`}>
            <span>
              <Icon size={15} />
            </span>
            <div>
              <strong>{labels[id]}</strong>
              <small>
                {id === "reference" && referenceState
                  ? referenceState === "optional"
                    ? "não fornecida / opcional"
                    : referenceState === "uploading"
                      ? "upload em andamento"
                      : referenceState === "ready"
                        ? "pronta"
                        : "requer atenção"
                  : status === "approved"
                  ? "concluída"
                  : status === "running"
                    ? "em andamento"
                    : status === "failed"
                      ? "requer atenção"
                      : status === "blocked"
                        ? "bloqueada"
                        : "aguardando"}
              </small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
