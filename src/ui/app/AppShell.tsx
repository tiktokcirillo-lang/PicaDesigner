import { FolderKanban, Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { PRODUCT_NAME, PRODUCT_SUBTITLE } from "../copy/product.js";
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation(),
    inProject = location.pathname.startsWith("/projects/");
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="wordmark">
          <strong>{PRODUCT_NAME}</strong>
          <span>{PRODUCT_SUBTITLE}</span>
        </Link>
        <div className="topbar__context">
          {inProject ? "Workspace do projeto" : "Projetos"}
        </div>
        <div className="topbar__state">
          <span className="sync-dot" />
          Sincronizado com o servidor
        </div>
      </header>
      <aside className="global-nav" aria-label="Navegação principal">
        <Link className={location.pathname === "/" ? "active" : ""} to="/">
          <FolderKanban size={17} />
          Projetos
        </Link>
        <Link to="/?new=1">
          <Plus size={17} />
          Novo projeto
        </Link>
        <div className="global-nav__note">
          A autoridade de produção permanece no servidor.
        </div>
      </aside>
      <main className="app-content">{children}</main>
    </div>
  );
}
