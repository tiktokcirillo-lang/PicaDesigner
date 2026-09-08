import type { WorkspaceDraft } from "../state/workspace-types.js";
import { Field, Input, Switch, Textarea } from "../primitives/Field.js";
export function BrandPanel({
  draft,
  onChange,
}: {
  draft: WorkspaceDraft;
  onChange: (patch: Partial<WorkspaceDraft>) => void;
}) {
  return (
    <div className="panel-form">
      <Switch
        label="Usar identidade existente"
        checked={draft.brandEnabled}
        onChange={(brandEnabled) => onChange({ brandEnabled })}
      />
      {draft.brandEnabled ? (
        <>
          <div className="color-fields">
            <Field label="Cor primária">
              <Input
                type="color"
                value={draft.primaryColor}
                onChange={(e) => onChange({ primaryColor: e.target.value })}
              />
            </Field>
            <Field label="Cor secundária">
              <Input
                type="color"
                value={draft.secondaryColor}
                onChange={(e) => onChange({ secondaryColor: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Fonte de títulos">
            <Input
              value={draft.titleFont}
              onChange={(e) => onChange({ titleFont: e.target.value })}
              placeholder="Ex.: Helvetica Neue"
            />
          </Field>
          <Field label="Fonte de texto">
            <Input
              value={draft.bodyFont}
              onChange={(e) => onChange({ bodyFont: e.target.value })}
              placeholder="Ex.: Arial"
            />
          </Field>
          <Field label="URL da marca">
            <Input
              type="url"
              value={draft.brandUrl}
              onChange={(e) => onChange({ brandUrl: e.target.value })}
              placeholder="https://"
            />
          </Field>
          <Field label="Notas visuais">
            <Textarea
              rows={4}
              value={draft.visualNotes}
              onChange={(e) => onChange({ visualNotes: e.target.value })}
            />
          </Field>
        </>
      ) : (
        <p className="muted-copy">
          O projeto usará uma identidade provisória, sem inventar uma biblioteca
          de marca.
        </p>
      )}
    </div>
  );
}
