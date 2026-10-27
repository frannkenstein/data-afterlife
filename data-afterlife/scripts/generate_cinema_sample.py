"""Generate the fictional community cinema ledger used in the guided demo."""

import csv
from pathlib import Path


OUTPUT = Path(__file__).resolve().parents[1] / "public/examples/forgotten-cinema-ledger.csv"


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["date", "category", "amount", "tickets_sold", "event", "record_id"])
        for year in (1999, 2000):
            for month in range(1, 13):
                for index, category in enumerate(("Screenings", "Memberships", "Concessions")):
                    base = (1420, 560, 380)[index]
                    seasonal = (month % 4) * (75, 25, 18)[index]
                    amount = base + seasonal + (year - 1999) * (55, 25, 20)[index]
                    event = "Regular program"
                    if year == 2000 and month in (3, 4):
                        amount = round(amount * 0.22)
                        event = "Renovation closure"
                    if year == 2000 and month == 10:
                        amount = round(amount * (2.9, 2.2, 2.5)[index])
                        event = "Archive revival festival"
                    writer.writerow([
                        f"{year}-{month:02d}-{7 + index * 8:02d}", category, amount,
                        round(amount / (8, 12, 6)[index]), event,
                        f"CIN-{year}-{month:02d}-{index + 1}",
                    ])


if __name__ == "__main__":
    main()
