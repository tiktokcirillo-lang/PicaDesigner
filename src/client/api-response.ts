export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = status === 409 ? "ConflictError" : "ApiClientError";
  }
}
export async function parseApiResponse<T>(response: Response): Promise<T> {
  const type = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!type.includes("application/json")) {
    await response.text();
    throw new ApiClientError(
      `HTTP ${response.status}: resposta inesperada da infraestrutura.`,
      response.status,
    );
  }
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new ApiClientError(
      payload.error ?? `Falha HTTP ${response.status}.`,
      response.status,
    );
  return payload;
}
