import { FileImage, UploadCloud, X } from "lucide-react";
import type { ChangeEvent } from "react";
import type { WorkspaceDraft } from "../state/workspace-types.js";
import { Field, Select } from "../primitives/Field.js";
import { IconButton } from "../primitives/Button.js";
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
async function read(file: File) {
  if (!allowed.has(file.type)) throw new Error("Use JPEG, PNG ou WebP.");
  if (file.size > 20 * 1024 * 1024) throw new Error("O arquivo excede 20 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
  const bitmap = await createImageBitmap(file);
  return {
    name: file.name,
    mimeType: file.type,
    size: file.size,
    width: bitmap.width,
    height: bitmap.height,
    data,
  };
}
export function ReferencePanel({
  draft,
  onChange,
  onError,
}: {
  draft: WorkspaceDraft;
  onChange: (patch: Partial<WorkspaceDraft>) => void;
  onError: (message: string) => void;
}) {
  async function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      onChange({ reference: await read(file) });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Arquivo inválido.");
    }
  }
  return (
    <div className="panel-form">
      {draft.reference ? (
        <div className="file-ready">
          <FileImage />
          <div>
            <strong>{draft.reference.name}</strong>
            <span>
              {draft.reference.width}×{draft.reference.height} ·{" "}
              {(draft.reference.size / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          <IconButton
            label="Remover referência"
            onClick={() => onChange({ reference: undefined })}
          >
            <X size={16} />
          </IconButton>
        </div>
      ) : (
        <label className="dropzone">
          <UploadCloud size={24} />
          <strong>Adicionar referência visual</strong>
          <span>JPEG, PNG ou WebP · até 20 MB</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={select}
          />
        </label>
      )}
      <Field label="Profundidade da análise">
        <Select
          value={draft.analysisDepth}
          onChange={(e) =>
            onChange({
              analysisDepth: e.target.value as WorkspaceDraft["analysisDepth"],
            })
          }
        >
          <option value="quick">Rápida</option>
          <option value="standard">Padrão</option>
          <option value="deep">Profunda</option>
          <option value="forensic">Forense</option>
        </Select>
      </Field>
      <p className="firewall-note">
        A referência orienta estrutura visual e composição; o sistema não deve
        copiar identidade, pessoas ou marcas.
      </p>
    </div>
  );
}
