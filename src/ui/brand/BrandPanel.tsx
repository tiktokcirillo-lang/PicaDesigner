import type { ProjectSourceAssetSummary } from "../../domain/source-assets/index.js";
import type { WorkspaceDraft } from "../state/workspace-types.js";
import { Field, Input, Switch, Textarea } from "../primitives/Field.js";
import { SourceAssetField, type SourceAssetFieldState } from "../source-assets/SourceAssetField.js";

const append = (list: ProjectSourceAssetSummary[], asset: ProjectSourceAssetSummary) => [
  ...list.filter((item) => item.assetId !== asset.assetId), asset,
];
type Props = { projectId: string; draft: WorkspaceDraft; onChange: (patch: Partial<WorkspaceDraft>) => void; onError: (message: string) => void; onUploadState?: (fieldId: string, state: SourceAssetFieldState) => void };

export function BrandPanel({ projectId, draft, onChange, onError, onUploadState }: Props) {
  return <div className="panel-form">
    <Switch label="Usar identidade existente" checked={draft.brandEnabled} onChange={(brandEnabled) => onChange({ brandEnabled })} />
    {draft.brandEnabled ? <>
      <SourceAssetField fieldId="brand:logo" projectId={projectId} role="official_logo" label="Logo oficial" value={draft.logoAsset} onChange={(logoAsset) => onChange({ logoAsset })} onError={onError} onStateChange={onUploadState} />
      <SourceAssetField fieldId="brand:product:new" projectId={projectId} role="product_image" label="Adicionar imagem de produto" onChange={(asset) => asset && onChange({ productAssets: append(draft.productAssets, asset) })} onError={onError} onStateChange={onUploadState} />
      {draft.productAssets.map((asset) => <SourceAssetField key={asset.assetId} fieldId={`brand:product:${asset.assetId}`} projectId={projectId} role="product_image" label="Imagem de produto" value={asset} onChange={(next) => onChange({ productAssets: next ? append(draft.productAssets, next) : draft.productAssets.filter((item) => item.assetId !== asset.assetId) })} onError={onError} onStateChange={onUploadState} />)}
      <details><summary>Mais assets oficiais</summary>
        <SourceAssetField fieldId="brand:photo:new" projectId={projectId} role="brand_photo" label="Fotografia da marca" onChange={(asset) => asset && onChange({ brandPhotoAssets: append(draft.brandPhotoAssets, asset) })} onError={onError} onStateChange={onUploadState} />
        <SourceAssetField fieldId="brand:graphic:new" projectId={projectId} role="graphic_asset" label="Asset gráfico" onChange={(asset) => asset && onChange({ graphicAssets: append(draft.graphicAssets, asset) })} onError={onError} onStateChange={onUploadState} />
      </details>
      <div className="color-fields"><Field label="Cor primária"><Input type="color" value={draft.primaryColor} onChange={(event) => onChange({ primaryColor: event.target.value })} /></Field><Field label="Cor secundária"><Input type="color" value={draft.secondaryColor} onChange={(event) => onChange({ secondaryColor: event.target.value })} /></Field></div>
      <Field label="Fonte de títulos"><Input value={draft.titleFont} onChange={(event) => onChange({ titleFont: event.target.value })} /></Field>
      <Field label="Fonte de texto"><Input value={draft.bodyFont} onChange={(event) => onChange({ bodyFont: event.target.value })} /></Field>
      <Field label="URL da marca"><Input type="url" value={draft.brandUrl} onChange={(event) => onChange({ brandUrl: event.target.value })} /></Field>
      <Field label="Notas visuais"><Textarea rows={4} value={draft.visualNotes} onChange={(event) => onChange({ visualNotes: event.target.value })} /></Field>
    </> : <p className="muted-copy">O projeto usará uma identidade provisória, sem inventar uma biblioteca de marca.</p>}
  </div>;
}
