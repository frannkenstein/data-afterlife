# DataAfterlife

Explore a historical CSV in your browser, then ask a local Gemma model to select useful aggregate facts and interpret a small set of questions. All numbers are calculated from CSV rows in browser-side TypeScript.

## Run locally

Requires Node.js 20+, npm, and [Ollama](https://ollama.com/). From this directory:

```bash
npm install
ollama pull gemma3:4b
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Use **Try synthetic sample** for the six-row fictional expense CSV. It should total 3,800 units; monthly totals are 800, 1,000, and 2,000. AI controls remain optional if Ollama is unavailable.

## Checks

```bash
npx vitest run
npm run lint
npx tsc --noEmit
npm run build
```

## Data boundaries and limits

CSV bytes and rows stay in browser memory and disappear on reload. Parsing and aggregation run in a browser Web Worker so they do not block the interface. The two local API routes receive only selected aggregate facts or a question plus mapping availability. Fact packets may include category labels; questions and labels can contain sensitive information, so preview the packet and use the AI controls only when comfortable sending them to your local Ollama service. A hosted deployment has different privacy properties and cannot use a visitor's local Ollama through these server routes.

Input is limited to one UTF-8 CSV under 5 MB, 10,000 rows, and 50 columns. Numeric parsing does not infer currencies or grouping separators; enable those options explicitly. Dates default to ISO `YYYY-MM-DD`; choose `DD/MM/YYYY` or `MM/DD/YYYY` explicitly for slash dates. Missing and invalid numeric values are excluded and counted. Invalid dates are excluded from monthly groups but still count toward overall numeric statistics. Data quality in the source remains the user's responsibility.

Ask DataAfterlife accepts open-ended questions about columns in the CSV. Gemma translates them into a constrained plan for whole-column statistics, filters, ranked rows, and grouped summaries; the browser executes the plan in a Web Worker. For example, the average of the three lowest `amount` values in the large synthetic CSV is 18.32. Clear half-total and second-highest-month requests are interpreted locally. Second-highest means the second distinct monthly total; tied months at that total are listed together. Questions requiring unsupported calculations or outside information may receive an "unsupported" response. The model sees the question and column names, never raw rows; it cannot run code or change calculated values. The model selects evidence IDs for insights, and the app renders fixed, verified statements from the corresponding facts.
