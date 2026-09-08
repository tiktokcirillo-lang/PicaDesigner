import { Archive, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import type { DurableProjectRecord } from "../../domain/project-persistence/index.js";
import { Badge } from "../primitives/Status.js";
import { IconButton } from "../primitives/Button.js";
export function ProjectCard({
  project,
  onArchive,
}: {
  project: DurableProjectRecord;
  onArchive: (project: DurableProjectRecord) => void;
}) {
  const approved = Boolean(project.latestProductionAuthorityId);
  return (
    <article className="project-card">
      <Link
        to={`/projects/${project.projectId}`}
        className="project-card__preview"
      >
        <div className="format-placeholder">
          <span>{approved ? "PRODUCTION" : "DRAFT"}</span>
        </div>
      </Link>
      <div className="project-card__body">
        <div>
          <h3>
            {project.name === "Untitled Project"
              ? "Projeto sem título"
              : project.name}
          </h3>
          <p>
            Atualizado{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(project.updatedAt))}
          </p>
        </div>
        <Badge
          tone={
            project.status === "archived"
              ? "neutral"
              : approved
                ? "success"
                : "info"
          }
        >
          {project.status === "archived"
            ? "Arquivado"
            : approved
              ? "Aprovado"
              : "Em andamento"}
        </Badge>
      </div>
      <footer>
        <Link to={`/projects/${project.projectId}`}>
          Abrir <ArrowUpRight size={14} />
        </Link>
        <IconButton label="Arquivar projeto" onClick={() => onArchive(project)}>
          <Archive size={15} />
        </IconButton>
        <IconButton label="Mais ações">
          <MoreHorizontal size={15} />
        </IconButton>
      </footer>
    </article>
  );
}
