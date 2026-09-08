# Production artifact formats

- PNG: lossless sRGB production raster, exact approved dimensions and alpha where applicable.
- WebP: sRGB, exact dimensions, explicit `EXPORT_WEBP_QUALITY` (default 92).
- PDF: digital delivery/proof, ordered pages with each scene's native aspect ratio.
- SVG: self-contained derivative with safe embedded image data; fonts may produce a portability warning.
- ZIP: stable entry ordering containing requested formats and optionally `manifest.json`.

No format is resized, cropped, stretched, watermarked or decorated during export. Default limits are 40 MB per artifact and 150 MB per package.
