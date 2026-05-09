"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SentimentData {
  overall: {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
    avgScore: number;
  };
  weeklyTrend: Array<{
    date: string;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    totalArticles: number;
  }>;
  newsFrequency: Array<{ date: string; count: string | number }>;
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: "#9ca3af",
        font: { size: 11 },
        boxWidth: 12,
      },
    },
    tooltip: {
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      borderWidth: 1,
      titleColor: "#f9fafb",
      bodyColor: "#9ca3af",
    },
  },
};

export function SentimentDoughnut({ data }: { data: SentimentData["overall"] }) {
  const chartData = {
    labels: ["Positive", "Neutral", "Negative"],
    datasets: [
      {
        data: [data.positive, data.neutral, data.negative],
        backgroundColor: ["rgba(16,185,129,0.8)", "rgba(107,114,128,0.8)", "rgba(239,68,68,0.8)"],
        borderColor: ["#10b981", "#6b7280", "#ef4444"],
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    ...CHART_DEFAULTS,
    cutout: "65%",
    plugins: {
      ...CHART_DEFAULTS.plugins,
      legend: {
        ...CHART_DEFAULTS.plugins.legend,
        position: "bottom" as const,
      },
    },
  };

  if (data.total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        No data yet — fetch news to populate
      </div>
    );
  }

  return (
    <div className="relative">
      <div style={{ height: "220px" }}>
        <Doughnut data={chartData} options={options} />
      </div>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-2xl font-bold text-white">
          {data.total > 0
            ? `${Math.round((data.positive / data.total) * 100)}%`
            : "0%"}
        </p>
        <p className="text-xs text-gray-400">Positive</p>
      </div>
    </div>
  );
}

export function WeeklySentimentBar({ data }: { data: SentimentData["weeklyTrend"] }) {
  const labels = data.map((d) => {
    const date = new Date(d.date);
    return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: "Positive",
        data: data.map((d) => d.positiveCount),
        backgroundColor: "rgba(16,185,129,0.7)",
        borderColor: "#10b981",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: "Neutral",
        data: data.map((d) => d.neutralCount),
        backgroundColor: "rgba(107,114,128,0.7)",
        borderColor: "#6b7280",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: "Negative",
        data: data.map((d) => d.negativeCount),
        backgroundColor: "rgba(239,68,68,0.7)",
        borderColor: "#ef4444",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    ...CHART_DEFAULTS,
    scales: {
      x: {
        stacked: true,
        grid: { color: "rgba(55,65,81,0.5)" },
        ticks: { color: "#6b7280", font: { size: 10 } },
      },
      y: {
        stacked: true,
        grid: { color: "rgba(55,65,81,0.5)" },
        ticks: { color: "#6b7280", font: { size: 10 } },
      },
    },
  };

  return (
    <div style={{ height: "220px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export function NewsFrequencyLine({ data }: { data: SentimentData["newsFrequency"] }) {
  const labels = data.map((d) => {
    const date = new Date(String(d.date));
    return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: "Articles Published",
        data: data.map((d) => Number(d.count)),
        fill: true,
        backgroundColor: "rgba(200,16,46,0.1)",
        borderColor: "#C8102E",
        borderWidth: 2,
        pointBackgroundColor: "#C8102E",
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
      },
    ],
  };

  const options = {
    ...CHART_DEFAULTS,
    scales: {
      x: {
        grid: { color: "rgba(55,65,81,0.5)" },
        ticks: { color: "#6b7280", font: { size: 10 } },
      },
      y: {
        grid: { color: "rgba(55,65,81,0.5)" },
        ticks: { color: "#6b7280", font: { size: 10 }, stepSize: 1 },
        beginAtZero: true,
      },
    },
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        No frequency data yet
      </div>
    );
  }

  return (
    <div style={{ height: "220px" }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

export function CaseTypeBar({
  data,
}: {
  data: { caseType: string; count: number }[];
}) {
  const chartData = {
    labels: data.map((d) => d.caseType),
    datasets: [
      {
        label: "Cases",
        data: data.map((d) => d.count),
        backgroundColor: [
          "rgba(239,68,68,0.7)",
          "rgba(245,158,11,0.7)",
          "rgba(59,130,246,0.7)",
          "rgba(107,114,128,0.7)",
        ],
        borderColor: ["#ef4444", "#f59e0b", "#3b82f6", "#6b7280"],
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    ...CHART_DEFAULTS,
    indexAxis: "y" as const,
    scales: {
      x: {
        grid: { color: "rgba(55,65,81,0.5)" },
        ticks: { color: "#6b7280", font: { size: 10 } },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
        ticks: { color: "#9ca3af", font: { size: 11 } },
      },
    },
  };

  return (
    <div style={{ height: "200px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export function DistrictCaseBar({
  data,
}: {
  data: { district: string | null; total_cases: string | number }[];
}) {
  const chartData = {
    labels: data.map((d) => d.district ?? "Unknown"),
    datasets: [
      {
        label: "Total Cases",
        data: data.map((d) => Number(d.total_cases)),
        backgroundColor: "rgba(200,16,46,0.6)",
        borderColor: "#C8102E",
        borderWidth: 2,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    ...CHART_DEFAULTS,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#9ca3af", font: { size: 10 } },
      },
      y: {
        grid: { color: "rgba(55,65,81,0.5)" },
        ticks: { color: "#6b7280", font: { size: 10 }, stepSize: 1 },
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={{ height: "220px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
