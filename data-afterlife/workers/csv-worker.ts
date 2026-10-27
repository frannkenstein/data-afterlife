import { analyze, type Mapping } from "@/lib/analysis";
import { MAX_BYTES, parseCsvText } from "@/lib/csv";
import { executeGenericQuery, type GenericPlan } from "@/lib/query";

type WorkerRequest = { kind: "parse"; file: File } | { kind: "analyze"; rows: Record<string, string>[]; mapping: Mapping } | { kind: "query"; rows: Record<string, string>[]; columns: string[]; mapping: Mapping; plan: GenericPlan };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const request = event.data;
    if (request.kind === "parse") {
      if (request.file.size > MAX_BYTES) throw new Error("Choose a CSV smaller than 5 MB.");
      const bytes = await request.file.arrayBuffer();
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { throw new Error("This CSV must use UTF-8 encoding."); }
      self.postMessage({ ok: true, data: parseCsvText(text, request.file.name) });
    } else if (request.kind === "analyze") {
      self.postMessage({ ok: true, data: analyze(request.rows, request.mapping) });
    } else {
      self.postMessage({ ok: true, data: executeGenericQuery(request.rows, request.columns, request.plan, request.mapping) });
    }
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : "Processing failed." });
  }
};
