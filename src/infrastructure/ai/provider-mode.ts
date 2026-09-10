export type PicaDesignerProviderMode = "openai" | "mock";
export function resolvePicaDesignerProviderMode(
  env: NodeJS.ProcessEnv = process.env,
): PicaDesignerProviderMode {
  const requested = (
    env.PICADESIGNER_E2E_PROVIDER_MODE ?? "openai"
  ).toLowerCase();
  if (requested !== "mock") return "openai";
  const production = env.NODE_ENV === "production",
    safePreview = env.VERCEL_ENV === "preview";
  if (production && !safePreview)
    throw new Error("Mock provider mode is forbidden in production.");
  return "mock";
}
