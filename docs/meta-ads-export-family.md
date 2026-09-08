# Meta Ads export family

The complete family requires `meta_ads_square`, `meta_ads_feed_portrait`, `meta_ads_story_reels` and `meta_ads_landscape`, each independently visually approved. Missing or rejected variants keep `metaAdsPackageReady` false and are reported as `missingVariants`/`rejectedVariants`.

A single approved placement remains exportable normally. Missing placements are never synthesized through crop, stretch or resize.
