# SVG Rendering Security

User copy is escaped centrally and never concatenated as raw markup. Arbitrary HTTP, file, localhost, private/internal fetches, `javascript:` and HTML data payloads are rejected. Uploaded SVG is unsupported until a robust tag/attribute sanitizer exists; scripts, foreignObject, iframe, events, external href/CSS/fonts/images are never inserted.

The SVG builder emits only typed nodes and stable attributes. Basic paths use a strict command/number allowlist. Debug placeholders are neutral diagnostics and cannot imply a final production asset.
