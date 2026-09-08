# Image Budgeting

Image generation uses the existing atomic project/month budget coordinator under stage `image_generation`. Defaults are target `$0.22`, stage hard limit `$0.35`, and the existing project hard limit `$0.75`. A reservation is made before each provider call and committed only after validated output.

No paid request runs without a positive estimate. Exact cost is recorded when supplied by the provider; otherwise the pre-authorized estimate is committed. Values retain micro-dollar precision in the shared ledger.
