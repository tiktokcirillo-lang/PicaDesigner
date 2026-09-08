import { useEffect, useState } from "react";
import { Dialog } from "../primitives/Dialog.js";
import { Button } from "../primitives/Button.js";
import { Field, Input } from "../primitives/Field.js";
export function NewProjectDialog({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);
  return (
    <Dialog open={open} title="Novo projeto" onClose={onClose}>
      <p className="dialog__intro">
        Dê um nome ao projeto. O ID e o registro durável serão criados pelo
        servidor.
      </p>
      <Field label="Nome do projeto">
        <Input
          autoFocus
          maxLength={160}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Campanha de lançamento"
        />
      </Field>
      <div className="dialog__actions">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={busy} onClick={() => onCreate(name)}>
          {busy ? "Criando…" : "Criar projeto"}
        </Button>
      </div>
    </Dialog>
  );
}
