import type { ReactNode } from "react";

/** Keeps long-running field lifecycles alive while switching visual tabs. */
export function MountedWorkspacePanel({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return <section hidden={!active}>{children}</section>;
}
