# React workspace architecture

index.html is only the Vite bootstrap. App.tsx owns routing for the durable project dashboard, workspace and read-only history. UI code lives under src/ui; API access stays in src/client; design decisions remain in domain/application services.

The workspace separates the last server snapshot, local draft, transient pipeline state, preview state and UI state. The browser is never production authority. Project creation, restore, checkpoints, approval, preview and exports resolve through server APIs backed by the configured durable repository.

The controller preserves the existing sequence: workspace checkpoint, reference intelligence, brand intelligence, creative direction, layout, art-director review, render, required image assets and visual QA. Opening panels, zooming and preview refresh do not invoke AI.
# Campaign mode

Selecting Meta Ads Package exposes an accessible four-variant navigator. The selected card changes preview geometry while server state remains authoritative for statuses and package readiness.
