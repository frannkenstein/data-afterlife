"""Generate a reproducible, fictional hydrogen plant dataset for app demos."""

import csv
import math
from datetime import date, timedelta
from pathlib import Path
from random import Random


OUTPUT = Path(__file__).resolve().parents[1] / "public/examples/synthetic-hydrogen-plant-1000x50.csv"
HEADERS = [
    "date", "plant_id", "record_id", "region", "shift", "electrolyzer_unit", "electrolyzer_type",
    "operating_status", "hydrogen_produced_kg", "hydrogen_delivered_kg", "hydrogen_stored_kg",
    "hydrogen_vented_kg", "electricity_used_kwh", "renewable_electricity_kwh", "grid_electricity_kwh",
    "specific_energy_kwh_per_kg", "water_used_liters", "water_recycled_liters", "water_purity_microsiemens_cm",
    "electrolyzer_runtime_hours", "planned_downtime_hours", "unplanned_downtime_hours",
    "stack_temperature_c", "stack_pressure_bar", "hydrogen_purity_pct", "oxygen_produced_kg",
    "cooling_water_m3", "ambient_temperature_c", "compressor_energy_kwh", "compressor_runtime_hours",
    "storage_tank_pressure_bar", "storage_capacity_kg", "storage_utilization_pct", "delivery_truck_count",
    "customer_sector", "contract_type", "hydrogen_price_usd_per_kg", "hydrogen_revenue_usd",
    "electricity_cost_usd", "water_cost_usd", "maintenance_cost_usd", "total_operating_cost_usd",
    "gross_margin_usd", "carbon_intensity_kgco2e_per_kgh2", "avoided_emissions_kgco2e",
    "safety_incidents", "alarms_count", "maintenance_work_orders", "operator_count", "synthetic_flag",
]


def main() -> None:
    rng = Random(20261027)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(HEADERS)
        for i in range(1000):
            day = date(2024, 1, 1) + timedelta(days=i)
            unit = i % 4 + 1
            shift = ("Day", "Evening", "Night")[i % 3]
            maintenance = i % 97 == 0
            planned = 5.0 if maintenance else (2.0 if i % 31 == 0 else 0.0)
            unplanned = round(rng.uniform(0.5, 3.0), 2) if i % 41 == 0 else 0.0
            runtime = round(24 - planned - unplanned, 2)
            output = round(max(0, runtime * (38 + unit * 2 + 4 * math.sin(i / 29) + rng.uniform(-3, 3))), 2)
            vented = round(output * rng.uniform(0.0005, 0.003), 2)
            delivered = round(output * rng.uniform(0.72, 0.93), 2)
            stored = round(output - delivered - vented, 2)
            specific_energy = round(rng.uniform(49, 56), 2)
            electricity = round(output * specific_energy, 2)
            renewable_share = rng.uniform(0.55, 0.98)
            renewable = round(electricity * renewable_share, 2)
            grid = round(electricity - renewable, 2)
            water = round(output * rng.uniform(10.0, 12.2), 2)
            recycled = round(water * rng.uniform(0.08, 0.25), 2)
            oxygen = round(output * 7.94, 2)
            compressor_energy = round(delivered * rng.uniform(2.0, 3.8), 2)
            price = round(rng.uniform(5.0, 8.5), 2)
            revenue = round(delivered * price, 2)
            electricity_cost = round(electricity * rng.uniform(0.045, 0.095), 2)
            water_cost = round(water * rng.uniform(0.001, 0.003), 2)
            maintenance_cost = round(rng.uniform(80, 220) + (500 if maintenance else 0), 2)
            operating_cost = round(electricity_cost + water_cost + maintenance_cost, 2)
            capacity = 3000
            tank_pressure = round(rng.uniform(160, 350), 2)
            carbon_intensity = round((grid / electricity) * rng.uniform(9.0, 12.0), 3)
            row = [
                day.isoformat(), "H2-DEMO-01", f"H2-{i + 1:05d}", "North", shift, f"EL-{unit:02d}",
                "PEM" if unit <= 2 else "Alkaline", "Maintenance" if maintenance else "Running",
                output, delivered, stored, vented, electricity, renewable, grid, specific_energy,
                water, recycled, round(rng.uniform(0.05, 0.35), 3), runtime, planned, unplanned,
                round(rng.uniform(58, 72), 2), round(rng.uniform(25, 34), 2),
                round(rng.uniform(99.95, 99.999), 3), oxygen, round(rng.uniform(8, 16), 2),
                round(rng.uniform(12, 39), 2), compressor_energy, round(runtime * rng.uniform(0.6, 0.9), 2),
                tank_pressure, capacity, round(min(100, stored / capacity * 100), 2),
                max(1, round(delivered / 300)), ("Mobility", "Industrial", "Power")[i % 3],
                "Spot" if i % 5 == 0 else "Long-term", price, revenue, electricity_cost,
                water_cost, maintenance_cost, operating_cost, round(revenue - operating_cost, 2),
                carbon_intensity, round(output * max(0, 10 - carbon_intensity), 2),
                1 if i % 173 == 0 else 0, rng.randint(0, 3), 1 if maintenance or unplanned else 0,
                3 + i % 3, "TRUE",
            ]
            assert len(row) == len(HEADERS) == 50
            writer.writerow(row)


if __name__ == "__main__":
    main()
