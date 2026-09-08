# Render Readiness

Readiness separates technical renderability from production completion. `ready` requires valid geometry, safe assets, resolved required assets/fonts and text fit. `partial` may be rendered with neutral development placeholders but is not production-ready. `blocked` represents unsafe assets, invalid linkage or geometry.

Missing required photography or logo keeps `productionReady=false`; optional decorative slots may remain absent. RenderDocument supports multiple scenes and independent SVG artifacts, preparing responsive Meta Ads variants without raster-cropping a master. Post-render pixel QA and final raster/PDF export remain future phases.
