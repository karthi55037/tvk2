"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import axios from "axios";

interface Stats {
  totalMLAs: number;
  totalCriminalCases: number;
  totalNewsArticles: number;
  totalManifestoPromises: number;
}

export default function Header() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      const res = await axios.get("/api/stats");
      setStats(res.data.stats);
      setLastUpdated(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      // silently fail
    }
  }

  async function handleRefreshNews() {
    setRefreshing(true);
    try {
      await axios.post("/api/news/fetch");
      await fetchStats();
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="border-b border-gray-800 bg-gray-900">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: Party branding */}
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm tvk-glow flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #C8102E, #a00d24)" }}
          >
            TVK
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">
              Tamilaga Vettri Kazhagam
            </h1>
            <p className="text-xs text-gray-400">
              Political News Analysis Dashboard • Tamil Nadu, India
            </p>
          </div>
        </div>

        {/* Center: Quick stats */}
        {stats && (
          <div className="hidden md:flex items-center gap-6">
            <StatPill label="News Articles" value={stats.totalNewsArticles} color="#C8102E" />
            <StatPill label="MLAs" value={stats.totalMLAs} color="#FFD700" />
            <StatPill label="Criminal Cases" value={stats.totalCriminalCases} color="#ef4444" />
            <StatPill label="Promises" value={stats.totalManifestoPromises} color="#10b981" />
          </div>
        )}

        {/* Right: Leader profile + refresh */}
        <div className="flex items-center gap-3">
          {/* Vijay profile micro */}
          <div className="hidden lg:flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-700">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #C8102E, #a00d24)" }}
            >
              V
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Vijay</p>
              <p className="text-xs text-gray-400">Party President</p>
            </div>
          </div>

          {/* Last updated */}
          {lastUpdated && (
            <span className="hidden md:block text-xs text-gray-500">
              Updated: {lastUpdated}
            </span>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefreshNews}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-red-700 hover:text-white transition-all disabled:opacity-50"
          >
            <span className={refreshing ? "animate-spin" : ""}>🔄</span>
            {refreshing ? "Fetching..." : "Fetch News"}
          </button>
        </div>
      </div>
    </header>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold" style={{ color }}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
