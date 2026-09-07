# Responsive Layout System

Crop is not responsive design. `reflowLayoutPlan()` preserves semantic topology—selected route, hero role, primary-message priority, creative-device identity, brand treatment and message content—while resolving a new safe area, grid, regions, type scale, line capacity, spacing and crop behavior for each target format.

A 16:9 twelve-column composition can therefore become a 9:16 four-column composition. Axis, alignment, region proportions, line breaks and device trajectory may change; approved copy and conceptual hierarchy may not. `ResponsiveLayoutFamily` groups independently solved variants and records invariants and reflow provenance.

`META_ADS_FAMILY` groups square, feed portrait, Stories/Reels and 1.91:1 landscape placements. `createResponsiveLayoutFamilyFromPreset()` re-solves each variant from the same route; it never copies master pixels or treats the campaign family as a set of crops.

Multi-frame contracts are represented by `LayoutDocument`, `ContentSequencePlan` and `KeepTogetherGroup`. Frame count is content/capacity driven rather than hardcoded. Current Phase 6 produces one frame for single-frame formats and prepares, but does not render, carousel sequencing.
