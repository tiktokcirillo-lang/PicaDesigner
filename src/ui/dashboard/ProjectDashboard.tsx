import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { DurableProjectRecord } from "../../domain/project-persistence/index.js";
import {
  createProject,
  listProjects,
  updateProject,
} from "../../client/project-persistence.js";
import { Button } from "../primitives/Button.js";
import { EmptyState, ErrorState, Skeleton } from "../primitives/Status.js";
import { ProjectCard } from "./ProjectCard.js";
import { NewProjectDialog } from "./NewProjectDialog.js";
import { useToast } from "../primitives/Toast.js";
export function ProjectDashboard() {
  const [params, setParams] = useSearchParams(),
    [projects, setProjects] = useState<DurableProjectRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("updated"),
    [busy, setBusy] = useState(false),
    [legacyProjects, setLegacyProjects] = useState<Array<{ label?: string }>>(
      () => {
        try {
          const value = JSON.parse(
            localStorage.getItem("aria_projects") ?? "[]",
          ) as unknown;
          return Array.isArray(value) ? value.slice(0, 50) : [];
        } catch {
          return [];
        }
      },
    ),
    navigate = useNavigate(),
    { notify } = useToast(),
    open = params.get("new") === "1";
  const load = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    listProjects(controller.signal)
      .then((x) => setProjects(x.projects))
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Não foi possível carregar os projetos persistidos.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  useEffect(load, [load]);
  const visible = useMemo(
    () =>
      projects
        .filter(
          (p) =>
            (filter === "all" ||
              (filter === "archived"
                ? p.status === "archived"
                : filter === "approved"
                  ? Boolean(p.latestProductionAuthorityId)
                  : p.status !== "archived" &&
                    !p.latestProductionAuthorityId)) &&
            p.name.toLowerCase().includes(query.toLowerCase()),
        )
        .slice()
        .sort((a, b) =>
          sort === "oldest"
            ? a.createdAt.localeCompare(b.createdAt)
            : sort === "newest"
              ? b.createdAt.localeCompare(a.createdAt)
              : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [projects, query, filter, sort],
  );
  async function create(name: string) {
    setBusy(true);
    try {
      const project = await createProject(name);
      navigate(`/projects/${project.projectId}`);
    } catch {
      setError("Não foi possível criar o projeto.");
    } finally {
      setBusy(false);
    }
  }
  async function archive(project: DurableProjectRecord) {
    try {
      const result = await updateProject({
        projectId: project.projectId,
        expectedRevision: project.revision,
        status: "archived",
      });
      setProjects((all) =>
        all.map((p) =>
          p.projectId === project.projectId ? result.project : p,
        ),
      );
      notify("Projeto arquivado");
    } catch {
      setError("Não foi possível arquivar o projeto.");
    }
  }
  async function importLegacyProjects() {
    setBusy(true);
    try {
      const imported = await Promise.all(
        legacyProjects.map((item) =>
          createProject(
            typeof item.label === "string" ? item.label : "Projeto importado",
          ),
        ),
      );
      setProjects((current) => [...imported, ...current]);
      localStorage.removeItem("aria_projects");
      setLegacyProjects([]);
      notify("Projetos locais importados sem transferir aprovações");
    } catch {
      setError("Não foi possível importar os projetos locais.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dashboard">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Workspace</span>
          <h1>Seus projetos</h1>
          <p>
            Crie, revise e entregue peças com authority de produção preservada
            no servidor.
          </p>
        </div>
        <Button onClick={() => setParams({ new: "1" })}>
          <Plus size={16} /> Novo projeto
        </Button>
      </header>
      <div className="dashboard-toolbar">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Buscar projetos"
            placeholder="Buscar por nome"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar projetos"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todos</option>
          <option value="progress">Em andamento</option>
          <option value="approved">Aprovados</option>
          <option value="archived">Arquivados</option>
        </select>
        <select
          aria-label="Ordenar projetos"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">Última alteração</option>
          <option value="newest">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
        </select>
      </div>
      {legacyProjects.length ? (
        <div className="legacy-banner">
          <div>
            <strong>Projetos locais encontrados</strong>
            <span>
              {legacyProjects.length} item(ns). Aprovações locais não serão
              transferidas.
            </span>
          </div>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={importLegacyProjects}
          >
            Importar
          </Button>
        </div>
      ) : null}
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError("");
            load();
          }}
        />
      ) : loading ? (
        <div className="project-grid">
          {[1, 2, 3].map((x) => (
            <Skeleton key={x} className="project-card skeleton-card" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="Crie um projeto para começar."
          description="Configure o briefing, gere uma direção e acompanhe a produção em um único workspace."
          action={
            <Button onClick={() => setParams({ new: "1" })}>
              Criar primeiro projeto
            </Button>
          }
        />
      ) : (
        <div className="project-grid">
          {visible.map((p) => (
            <ProjectCard key={p.projectId} project={p} onArchive={archive} />
          ))}
        </div>
      )}
      <NewProjectDialog
        open={open}
        busy={busy}
        onClose={() => setParams({})}
        onCreate={create}
      />
    </section>
  );
}
