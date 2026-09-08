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
}: {
  pipeline: WorkspacePipelineState;
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
                {status === "approved"
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
