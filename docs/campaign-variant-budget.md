# Campaign family budget

The family uses the existing US$0.75 project hard cap. Before variant-specific provider work, preflight accounts for the remaining Terra reviews, per-variant pixel QA, one shared image-generation allowance and verification reserve, and checks the project, monthly and family-adjusted stage caps. A correction is only applicable after a pixel finding exists; at that point the existing atomic budget coordinator must reserve it before execution. Shared upstream calls are never multiplied by four. Completed legitimate work and actual costs remain recorded after a partial failure.

`npm run ai:cost-sim` reports LOW, NORMAL and HIGH Meta family scenarios for 20 projects, including completion, provider calls, generation reuse, QA batching, correction and budget-blocked rates. The current safe implementation performs independent QA per variant, so its batching rate is reported as zero rather than claiming unrealized savings.
