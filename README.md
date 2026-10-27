# DataAfterlife

DataAfterlife turns historical CSV files into charts, grounded answers, and evidence-linked stories with a local Gemma model.

The app is in [data-afterlife](data-afterlife/). See its [README](data-afterlife/README.md) for setup, demo steps, data limits, and privacy details.

```bash
cd data-afterlife
npm install
ollama pull gemma3:4b
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000> and select **Explore the cinema archive** to try the fictional sample.
