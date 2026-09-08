import { Check } from "lucide-react";
import { FORMAT_REGISTRY } from "../../domain/layout-engine/formats.js";
import type { WorkspaceDraft } from "../state/workspace-types.js";
import { Field, Input, Select } from "../primitives/Field.js";
const groups = [
  {
    label: "Meta Ads",
    ids: [
      "meta_ads_square",
      "meta_ads_feed_portrait",
      "meta_ads_story_reels",
      "meta_ads_landscape",
    ],
  },
  {
    label: "Social",
    ids: [
      "generic_square_1080",
      "generic_portrait_1080_1350",
      "generic_vertical_1080_1920",
    ],
  },
  { label: "Apresentação", ids: ["presentation_full_hd"] },
];
const legacyFormats = [
  "Apresentação (16:9 - 1920x1080)",
  "Carrossel Vertical (1080x1350)",
  "Carrossel Quadrado (1080x1080)",
  "Post Estático Vertical (1080x1350)",
  "Post Estático Quadrado (1080x1080)",
  "Stories / Reels (1080x1920)",
  "Vídeo Curto / Post-roll (1080x1920)",
  "LinkedIn Banner (1584x396)",
  "Twitter Header (1500x500)",
];
export const formatLabel = (id: string) =>
  FORMAT_REGISTRY[id]?.label ??
  (id.startsWith("custom_") ? "Formato personalizado" : id);
export function FormatSelector({
  draft,
  onChange,
}: {
  draft: WorkspaceDraft;
  onChange: (patch: Partial<WorkspaceDraft>) => void;
}) {
  return (
    <div className="panel-form">
      <div className="format-groups">
        {groups.map((group) => (
          <section key={group.label}>
            <h3>{group.label}</h3>
            <div className="format-grid">
              {group.ids.map((id) => {
                const f = FORMAT_REGISTRY[id]!,
                  selected = draft.formatId === id;
                return (
                  <button
                    type="button"
                    className={`format-card ${selected ? "selected" : ""}`}
                    key={id}
                    onClick={() => onChange({ formatId: id })}
                  >
                    <span
                      className="format-card__shape"
                      style={{ aspectRatio: String(f.aspectRatio) }}
                    />
                    {selected ? <Check size={14} /> : null}
                    <strong>{f.label.replace(/^Meta Ads — /, "")}</strong>
                    <small>
                      {f.width}×{f.height} · {f.aspectLabel}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <section>
        <h3>Personalizado</h3>
        <div className="custom-size">
          <Field label="Largura">
            <Input
              type="number"
              min={64}
              max={16384}
              value={draft.customWidth ?? 1080}
              onChange={(e) =>
                onChange({
                  formatId: "custom",
                  customWidth: Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Altura">
            <Input
              type="number"
              min={64}
              max={16384}
              value={draft.customHeight ?? 1080}
              onChange={(e) =>
                onChange({
                  formatId: "custom",
                  customHeight: Number(e.target.value),
                })
              }
            />
          </Field>
        </div>
      </section>
      <Field label="Formatos legados / outros">
        <Select
          value={legacyFormats.includes(draft.formatId) ? draft.formatId : ""}
          onChange={(event) =>
            event.target.value && onChange({ formatId: event.target.value })
          }
        >
          <option value="">Selecionar outro formato</option>
          {legacyFormats.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </Field>
      <details>
        <summary>Opções avançadas</summary>
        <Field label="Ferramenta de destino">
          <Select
            value={draft.destinationTool}
            onChange={(e) => onChange({ destinationTool: e.target.value })}
          >
            <option>Canva</option>
            <option>Figma</option>
            <option>Adobe Illustrator</option>
            <option>PowerPoint</option>
          </Select>
        </Field>
      </details>
    </div>
  );
}
