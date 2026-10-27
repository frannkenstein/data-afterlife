# DataAfterlife

Explore a historical CSV in your browser, then ask a local Gemma model to curate a short, evidence-backed story and interpret questions. All numbers are calculated from CSV rows in browser-side TypeScript.

## Run locally

Requires Node.js 20+, npm, and [Ollama](https://ollama.com/). From this directory:

```bash
npm install
ollama pull gemma3:4b
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Click **Explore the cinema archive** to load and analyze a fictional 1999–2000 community cinema ledger in one step. It has 72 rows and totals 62,477 units. April 2000 is its lowest month (541); October 2000 is its highest (7,199). Click **Recover its story with Gemma** to let the local model add context to verified turning points. Each story card links to its source chart. AI controls remain optional if Ollama is unavailable.

You can also choose or drop your own CSV. After analysis, use **Save report as PDF** and select a PDF destination in the browser's print dialog. The report includes the computed summary, any recovered story, charts, and data tables.

## Checks

```bash
npx vitest run
npm run lint
npx tsc --noEmit
npm run build
```

## Data boundaries and limits

CSV bytes and rows stay in browser memory and disappear on reload. Parsing and aggregation run in a browser Web Worker so they do not block the interface. The local AI routes receive only selected aggregate facts or a question plus mapping availability. Fact packets may include category labels; questions and labels can contain sensitive information, so preview the packet and use the AI controls only when comfortable sending them to your local Ollama service. A hosted deployment has different privacy properties and cannot use a visitor's local Ollama through these server routes.

Input is limited to one UTF-8 CSV under 5 MB, 10,000 rows, and 50 columns. Numeric parsing does not infer currencies or grouping separators; enable those options explicitly. Dates default to ISO `YYYY-MM-DD`; choose `DD/MM/YYYY` or `MM/DD/YYYY` explicitly for slash dates. Missing and invalid numeric values are excluded and counted. Invalid dates are excluded from monthly groups but still count toward overall numeric statistics. Data quality in the source remains the user's responsibility.

Ask DataAfterlife accepts open-ended questions about columns in the CSV. Gemma translates them into a constrained plan for whole-column statistics, filters, ranked rows, and grouped summaries; the browser executes the plan in a Web Worker. For example, the average of the three lowest `amount` values in the large synthetic CSV is 18.32. Clear half-total and second-highest-month requests are interpreted locally. Second-highest means the second distinct monthly total; tied months at that total are listed together. Questions requiring unsupported calculations or outside information may receive an "unsupported" response. The model sees the question and column names, never raw rows; it cannot run code or change calculated values. For the story, the app anchors the low point, largest rise, and high point when present; Gemma selects an additional contextual fact. The app renders fixed statements from verified totals, extrema, and consecutive monthly changes. A note in the cinema CSV names events, but the story does not infer that an event caused a change.

## Week 4 demo

1. Click **Explore the cinema archive**. The app loads and analyzes the sample, then scrolls to the results.
2. Show the April 2000 low and October 2000 high on the monthly canvas chart.
3. Click **Recover its story with Gemma**. The model status badge must show `gemma3:4b ready` first. Open **Preview facts sent to local Ollama** to show the data boundary.
4. Ask “Which month had the highest amount?” or “What is the average of the three lowest amount values?”
5. Switch the monthly chart to Area and the category chart to Pie, then save the report as PDF.

See [the Week 4 submission draft](docs/hacktoberfest-week4-submission.md) for a write-up and a short recording script. Replace its repository and demo placeholders before publishing.
