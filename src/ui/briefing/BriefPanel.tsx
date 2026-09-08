import { WandSparkles } from "lucide-react";
import type { WorkspaceDraft } from "../state/workspace-types.js";
import { Button } from "../primitives/Button.js";
import { Field, Select, Textarea } from "../primitives/Field.js";
export function BriefPanel({
  draft,
  onChange,
}: {
  draft: WorkspaceDraft;
  onChange: (patch: Partial<WorkspaceDraft>) => void;
}) {
  return (
    <div className="panel-form">
      <Field label="Texto / copy" hint={`${draft.copyText.length} caracteres`}>
        <Textarea
          rows={10}
          value={draft.copyText}
          onChange={(e) => onChange({ copyText: e.target.value })}
          placeholder="Cole aqui a mensagem principal, oferta ou conteúdo…"
        />
      </Field>
      <Button
        variant="secondary"
        type="button"
        title="Ação paga, executada somente quando solicitada"
      >
        <WandSparkles size={15} /> Refinar copy
      </Button>
      <Field label="Tom">
        <Select
          value={draft.tone}
          onChange={(e) => onChange({ tone: e.target.value })}
        >
          <option value="premium">Premium</option>
          <option value="professional">Profissional</option>
          <option value="bold">Ousado</option>
          <option value="minimal">Minimalista</option>
          <option value="editorial">Editorial</option>
        </Select>
      </Field>
    </div>
  );
}
