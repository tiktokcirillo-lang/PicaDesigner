# Image generation billing lifecycle

Before generation, storage health and durability are checked and a complete budget preflight admits all mandatory jobs or none. Optional jobs consume only remaining stage, project and monthly capacity. Every admitted call still receives an atomic reservation.

Provider rejection before a known result releases the reservation. Ambiguous timeout becomes `unknown_provider_outcome`. Once provider output returns, actual cost—or the conservative authorized estimate—is committed before validation/storage. Therefore corrupt output and failed Blob writes retain their billable cost. Storage retry reuses identical bytes, checksum and pathname and never invokes the image provider again. Session cost is the sum of calls from that session, not historical stage spend.
