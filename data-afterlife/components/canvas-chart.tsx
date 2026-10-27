"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { ChartConfiguration } from "chart.js";

type ChartType = "line" | "bar" | "area" | "pie";
type Group = { label: string; total: number };

const sliceColors = ["#285640", "#56806a", "#8aac94", "#b7cda8", "#d4ad79", "#8b9db1", "#957e9d", "#b97874", "#6b927e", "#c1a867"];
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

export function CanvasChart({ title, chartType, groups, format }: { title: string; chartType: ChartType; groups: Group[]; format: (value: number) => string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isPie = chartType === "pie";
    const isArea = chartType === "area";
    const isCategoryBar = title === "Category totals" && chartType === "bar";
    const values = groups.map((group) => group.total);
    const highIndex = values.indexOf(Math.max(...values));
    const lowIndex = values.indexOf(Math.min(...values));
    const gradient = canvas.getContext("2d")?.createLinearGradient(0, 0, 0, 280);
    if (gradient) {
      gradient.addColorStop(0, "rgba(86, 128, 106, 0.48)");
      gradient.addColorStop(1, "rgba(86, 128, 106, 0.03)");
    }

    const config: ChartConfiguration = {
      type: isArea ? "line" : chartType,
      data: {
        labels: groups.map((group) => group.label),
        datasets: [{
          label: "Total",
          data: values,
          borderColor: isPie ? "#fff" : "#285640",
          backgroundColor: isPie ? sliceColors : isArea ? gradient ?? "#a9c5b2" : chartType === "line" ? "#285640" : "#56806a",
          borderWidth: isPie ? 3 : chartType === "bar" ? 0 : 3,
          borderRadius: chartType === "bar" ? 6 : undefined,
          maxBarThickness: 38,
          fill: isArea ? "origin" : false,
          tension: 0.35,
          pointRadius: values.map((_, index) => index === highIndex || index === lowIndex ? 6 : groups.length > 20 ? 0 : 3),
          pointHoverRadius: 6,
          pointBackgroundColor: values.map((_, index) => index === highIndex ? "#d4ad79" : index === lowIndex ? "#8b9db1" : "#fff"),
          pointBorderColor: "#285640",
          pointBorderWidth: 2,
          hoverOffset: isPie ? 8 : undefined,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450 },
        indexAxis: isCategoryBar ? "y" : "x",
        interaction: { mode: "nearest", intersect: false },
        layout: { padding: { top: 8, right: 8, bottom: 2, left: 2 } },
        plugins: {
          legend: { display: isPie, position: "bottom", labels: { color: "#526358", usePointStyle: true, boxWidth: 9, padding: 16, font: { size: 11 } } },
          tooltip: {
            backgroundColor: "#20372b",
            padding: 12,
            cornerRadius: 8,
            displayColors: isPie,
            callbacks: { label: (context) => `${isPie ? `${context.label}: ` : ""}${format(Number(context.raw))}` },
          },
        },
        scales: isPie ? {} : {
          x: {
            grid: { display: isCategoryBar, color: "#e7ece6" },
            border: { display: false },
            ticks: { color: "#657168", maxRotation: 0, autoSkip: true, maxTicksLimit: isCategoryBar ? 5 : 8, callback: isCategoryBar ? (value) => compact.format(Number(value)) : undefined },
          },
          y: {
            beginAtZero: true,
            grid: { display: !isCategoryBar, color: "#e7ece6" },
            border: { display: false, dash: [4, 4] },
            ticks: { color: "#657168", maxTicksLimit: 5, callback: isCategoryBar ? undefined : (value) => compact.format(Number(value)) },
          },
        },
      },
    };

    const chart = new Chart(canvas, config);
    const beforePrint = () => chart.resize(560, 280);
    const afterPrint = () => chart.resize();
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      chart.destroy();
    };
  }, [title, chartType, groups, format]);

  return <div className="relative mt-5 h-72 w-full min-w-0"><canvas ref={canvasRef} role="img" aria-label={`${title} ${chartType} chart`} /></div>;
}
