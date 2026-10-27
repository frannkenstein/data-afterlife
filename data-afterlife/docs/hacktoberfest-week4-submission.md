# DataAfterlife: the ghost in a forgotten CSV

> Draft for the [Hacktoberfest 2026 Week 4 challenge](https://dev.to/challenges/hacktoberfest-week4-2026-10-26). Add a public repository URL, screenshots or a short video, and a verified demo link before publishing. The app runs locally with Ollama; a static hosted front end alone cannot reach a visitor's local model through its current API routes.

## The moment I wanted to recover

An old CSV can look like a wall of cells. I wanted the person who finds it to see the shape of what happened, without handing every row to a remote service or trusting a model to invent the arithmetic.

For the demo, I made a **fictional** community cinema ledger from 1999–2000. It contains 72 records across screenings, memberships, and concessions. The computed monthly total drops to 541 in April 2000 and reaches 7,199 in October 2000. The ledger has event notes, but the app does not claim those notes caused the change. It says what the numbers establish and lets a person investigate further.

That is my interpretation of Week 4's *Ghost in the Machine*: give dormant records a voice while keeping their evidence visible.

## What DataAfterlife does

1. You choose or drop a CSV. A browser Web Worker parses it, checks limits, and calculates totals, averages, monthly trends, and category totals.
2. Local Gemma 3, through Ollama, receives a small packet of aggregate facts. The app anchors the low point, largest rise, and high point when available; Gemma selects a further contextual fact for **What this data remembers**. The app writes each story card from verified facts and links it to the relevant chart.
3. You can ask a question in natural language. Gemma proposes a constrained query plan; the browser validates and executes the calculation against the rows. The model never receives the raw CSV rows and cannot run arbitrary code.
4. Canvas charts switch between line, bar, area, and pie views. The summary, story, charts, and tables can be saved through the browser's PDF print flow.

**Try it:** [PUBLIC_REPOSITORY_URL] · [DEMO_VIDEO_OR_SCREENSHOTS]

## Why open AI matters here

Gemma runs through a local Ollama instance, so this workflow can run on a laptop without sending the CSV to a hosted model. The source code and model choice are inspectable and replaceable. The model makes an editorial choice about which verified facts tell the clearest story; deterministic code remains responsible for every displayed number. That split matters for historical records: a memorable narrative is useful only when readers can check it.

The app shows the exact fact packet before the model call. Category labels and questions can still be sensitive, so the AI actions are deliberate opt-in controls. The CSV stays in browser memory and is cleared on reload.

## A build challenge I hit

An early version answered “half of the total” with a value resembling the average, and it could repeat the same month for first and second place. I moved the arithmetic into validated browser-side plans and made “second highest” mean the second **distinct** monthly total. The story uses the same principle: Gemma selects evidence IDs, while the displayed claims come from calculated facts. It also refuses to infer causes or forecasts from recorded rows alone.

## How to run and test

```bash
npm install
ollama pull gemma3:4b
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`, click **Explore the cinema archive**, then **Recover its story with Gemma**. The README documents CSV limits and the privacy boundary. The repository includes unit tests for the calculations and the cinema turning points.

## Prize category

- Best Use of Gemma: local Gemma 3 curates the evidence-backed story and interprets natural-language analysis questions.

## What I would build next

I would add more source formats and a model adapter for other local open-weight models. I would also make it easier to compare two archives without merging away their provenance.

---

### Two-minute recording script

1. **0:00–0:15:** Show the blank app and say, “An old CSV deserves more than a table.”
2. **0:15–0:35:** Click **Explore the cinema archive**. Point out the automatic analysis and the 72-row fictional ledger.
3. **0:35–1:05:** Show the low and high markers on Monthly trend. Switch Line to Area.
4. **1:05–1:30:** Show `gemma3:4b ready`, open the fact preview, then click **Recover its story with Gemma**. Follow an evidence link to the chart.
5. **1:30–1:50:** Ask which month had the highest amount. Note that the browser computes the result from a validated plan.
6. **1:50–2:00:** Save the report as PDF and close with the privacy boundary: raw rows stay in the browser.
