import type { AIAnalysisTelemetry } from "../types.js";
export interface TelemetryCollector {
  record(event: AIAnalysisTelemetry): void | Promise<void>;
}
export class InMemoryTelemetryCollector implements TelemetryCollector {
  readonly events: AIAnalysisTelemetry[] = [];
  record(event: AIAnalysisTelemetry): void {
    this.events.push(structuredClone(event));
  }
}
export class NoopTelemetryCollector implements TelemetryCollector {
  record(): void {}
}
