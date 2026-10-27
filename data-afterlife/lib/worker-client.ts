import type { Analysis, Mapping } from "./analysis";
import type { Dataset } from "./csv";
import type { GenericPlan, QueryResult } from "./query";

type WorkerRequest =
  | { kind: "parse"; file: File }
  | { kind: "analyze"; rows: Record<string, string>[]; mapping: Mapping }
  | { kind: "query"; rows: Record<string, string>[]; columns: string[]; mapping: Mapping; plan: GenericPlan };

export function runCsvWorker<T extends Dataset | Analysis | QueryResult>(request: WorkerRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/csv-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ ok: boolean; data?: T; error?: string }>) => {
      worker.terminate();
      if (event.data.ok && event.data.data !== undefined) resolve(event.data.data);
      else reject(new Error(event.data.error ?? "Processing failed."));
    };
    worker.onerror = () => { worker.terminate(); reject(new Error("The CSV worker could not start. Try refreshing the page.")); };
    worker.postMessage(request);
  });
}
