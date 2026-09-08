import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FileOutput, Layers3 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  getProjectHistory,
  type ProjectHistoryResponse,
} from "../../client/project-persistence.js";
import { ErrorState, Skeleton } from "../primitives/Status.js";
const stageNames: Record<string, string> = {
  workspace_input: "Configuração atualizada",
  reference_intelligence: "Referência analisada",
  brand_intelligence: "Marca configurada",
  creative_direction: "Direção criativa",
  layout: "Composição",
  art_director_review: "Revisão",
  render_session: "Render",
  image_asset_session: "Asset produzido",
  post_render_review: "QA visual",
};
export function ProjectHistory() {
  const { projectId = "" } = useParams(),
    [history, setHistory] = useState<ProjectHistoryResponse>(),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getProjectHistory(projectId, controller.signal)
      .then(setHistory)
      .catch(() => setError("Não foi possível carregar o histórico durável."));
    return () => controller.abort();
  }, [projectId]);
  if (error) return <ErrorState message={error} />;
  return (
    <section className="history-page">
      <header>
        <Link to={`/projects/${projectId}`}>
          <ArrowLeft size={16} />
          Voltar ao workspace
        </Link>
        <span className="eyebrow">Histórico durável</span>
        <h1>Linha do tempo do projeto</h1>
        <p>
          Eventos somente leitura. Restaurar versões não é oferecido sem um
          snapshot reconstruível completo.
        </p>
      </header>
      {!history ? (
        <Skeleton className="history-skeleton" />
      ) : (
        <ol className="history-timeline">
          {history.exports.map((e) => (
            <li key={e.exportSessionId}>
              <FileOutput />
              <div>
                <strong>Export preparado</strong>
                <span>
                  {e.artifacts.map((a) => a.format.toUpperCase()).join(", ")}
                </span>
                <time>{new Date(e.createdAt).toLocaleString("pt-BR")}</time>
              </div>
            </li>
          ))}
          {history.authorities.map((a) => (
            <li key={a.authorityId}>
              <CheckCircle2 />
              <div>
                <strong>Produção aprovada</strong>
                <span>{a.status}</span>
                <time>{new Date(a.createdAt).toLocaleString("pt-BR")}</time>
              </div>
            </li>
          ))}
          {history.checkpoints.map((c) => (
            <li key={c.checkpointId}>
              <Layers3 />
              <div>
                <strong>{stageNames[c.stage] ?? c.stage}</strong>
                <span>Revisão {c.revision}</span>
                <time>{new Date(c.createdAt).toLocaleString("pt-BR")}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
