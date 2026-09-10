# Deterministic Renderer

`ReviewedDesignPackage` is the production source of truth. The Design Specification is documentation and is intentionally excluded from render fingerprints. The engine maps final LayoutPlan pixel geometry, final route, approved message references and brand rules into serializable RenderScenes and typed nodes. It makes no AI call and costs `$0`.

SVG is the canonical vector intermediate: exact dimensions/viewBox, stable node order, escaped text and SHA-256 checksum. The same fingerprint yields the same logical SVG. Rendering supports text, image slots, rectangles, ellipses, lines and allowlisted basic paths; definitions reserve gradients, clips, masks and justified shadows.

RenderSession caching invalidates on review, route, layout, approved messages, brand/assets, font availability, format, schema or renderer policy—not zoom, debug state or Design Spec wording.
# Campaign families

Each campaign variant receives its own render session and canonical artifact. The renderer never manufactures missing family formats during export.
