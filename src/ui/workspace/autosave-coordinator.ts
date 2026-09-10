export async function flushWorkspaceAutosave(input: {
  cancelPendingTimer: () => void;
  pendingSave?: Promise<void>;
  persistCurrentDraft: () => Promise<void>;
}) {
  input.cancelPendingTimer();
  if (input.pendingSave) await input.pendingSave;
  await input.persistCurrentDraft();
}
export function workspaceFailureMessage(error: unknown) {
  if (!(error instanceof ApiClientError))
    return error instanceof Error
      ? error.message
      : "Não foi possível concluir o pipeline.";
  if (error.code?.startsWith("SOURCE_")) return error.message;
  if (error.status === 402)
    return "Limite de orçamento atingido antes da próxima etapa.";
  if (error.status === 409)
    return error.message.includes("upstream")
      ? "A revisão upstream mudou; recarregue o projeto antes de continuar."
      : "Conflito com uma versão mais nova do projeto.";
  if (error.status === 503)
    return "Falha de persistência ou infraestrutura. Nenhum novo gasto deve ser iniciado.";
  if (error.status === 422)
    return "A etapa de validação ou QA bloqueou o workflow.";
  if ([429, 500, 502, 504].includes(error.status))
    return "Falha do provider de IA. Tente novamente para reutilizar resultados seguros.";
  return error.message;
}
import { ApiClientError } from "../../client/api-response.js";
