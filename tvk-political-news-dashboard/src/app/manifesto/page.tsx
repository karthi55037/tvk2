"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import NewsTicker from "@/components/NewsTicker";

interface ManifestoPromise {
  id: number;
  promise: string;
  category: string;
  status: string;
  progressPercent: number;
  details: string | null;
  targetDate: string | null;
  relatedNews: Array<{
    id: number;
    title: string;
    url: string;
    publishedAt: string | null;
  }>;
}

const STATUS_OPTIONS = ["All", "Announced", "InProgress", "Completed", "NoUpdate"];
const CATEGORIES = ["All", "Education", "Employment", "Housing", "Healthcare", "Transport", "Agriculture", "Women Empowerment", "Social Welfare", "Culture & Language", "Governance", "Religion & Culture"];

const statusConfig: Record<string, { label: string; className: string; icon: string; color: string }> = {
  Announced: { label: "Announced", className: "status-announced", icon: "📢", color: "#60a5fa" },
  InProgress: { label: "In Progress", className: "status-inprogress", icon: "🔄", color: "#fbbf24" },
  Completed: { label: "Completed", className: "status-completed", icon: "✅", color: "#34d399" },
  NoUpdate: { label: "No Update", className: "status-noupdate", icon: "⏸️", color: "#9ca3af" },
};

const categoryIcon: Record<string, string> = {
  Education: "🎓",
  Employment: "💼",
  Housing: "🏠",
  Healthcare: "🏥",
  Transport: "🚌",
  Agriculture: "🌾",
  "Women Empowerment": "👩",
  "Social Welfare": "🤝",
  "Culture & Language": "🎭",
  Governance: "🏛️",
  "Religion & Culture": "🙏",
  General: "📋",
};

export default function ManifestoPage() {
  const [promises, setPromises] = useState<ManifestoPromise[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchManifesto() {
      try {
        const res = await axios.get("/api/manifesto");
        setPromises(res.data.promises ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchManifesto();
  }, []);

  const filtered = promises.filter((p) => {
    if (status !== "All" && p.status !== status) return false;
    if (category !== "All" && p.category !== category) return false;
    if (search && !p.promise.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Status summary
  const statusCounts = STATUS_OPTIONS.filter((s) => s !== "All").reduce<Record<string, number>>(
    (acc, s) => {
      acc[s] = promises.filter((p) => p.status === s).length;
      return acc;
    },
    {}
  );

  // Overall progress
  const completedCount = promises.filter((p) => p.status === "Completed").length;
  const inProgressCount = promises.filter((p) => p.status === "InProgress").length;
  const overallProgress =
    promises.length > 0
      ? Math.round(((completedCount + inProgressCount * 0.5) / promises.length) * 100)
      : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <NewsTicker />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📋</span> Manifesto Tracker
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Tracking TVK&apos;s official manifesto promises and their current implementation status.
            </p>
          </div>

          {/* Overall progress */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-400">Overall Manifesto Progress</p>
                <p className="text-3xl font-black text-white mt-1">
                  {overallProgress}
                  <span className="text-lg text-gray-400">%</span>
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {STATUS_OPTIONS.filter((s) => s !== "All").map((s) => (
                  <div key={s} className="text-center">
                    <p
                      className="text-xl font-bold"
                      style={{ color: statusConfig[s]?.color ?? "#9ca3af" }}
                    >
                      {statusCounts[s] ?? 0}
                    </p>
                    <p className="text-xs text-gray-500">{statusConfig[s]?.label ?? s}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${overallProgress}%`,
                  background: "linear-gradient(90deg, #C8102E, #FFD700)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-600">0%</span>
              <span className="text-xs text-gray-600">100% (2026 Election Target)</span>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <input
              type="text"
              placeholder="Search promises..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-700"
            />
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        status === s
                          ? "text-white border-gray-500 bg-gray-700"
                          : "text-gray-400 border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      {s !== "All" && statusConfig[s]?.icon} {s === "All" ? "All Status" : statusConfig[s]?.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">Category</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.slice(0, 7).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        category === c
                          ? "text-white border-red-700"
                          : "text-gray-400 border-gray-700 hover:border-gray-500"
                      }`}
                      style={category === c ? { background: "rgba(200,16,46,0.2)" } : {}}
                    >
                      {c !== "All" && categoryIcon[c]} {c === "All" ? "All Categories" : c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Showing <strong className="text-gray-300">{filtered.length}</strong> of{" "}
            <strong className="text-gray-300">{promises.length}</strong> promises
          </p>

          {/* Promises List */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-28 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <p className="text-5xl mb-4">📋</p>
              <p className="text-gray-300 font-semibold">No promises found</p>
              <p className="text-gray-500 text-sm mt-2">
                Load sample data from the dashboard to populate manifesto records.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((p) => {
                const config = statusConfig[p.status] ?? statusConfig.NoUpdate;
                return (
                  <div
                    key={p.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-5 card-hover"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Category icon */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: "rgba(200,16,46,0.15)" }}
                      >
                        {categoryIcon[p.category] ?? "📋"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="text-sm font-semibold text-white leading-snug">
                            {p.promise}
                          </h3>
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1 ${config.className}`}
                          >
                            {config.icon} {config.label}
                          </span>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 flex-wrap mb-3">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            {categoryIcon[p.category] ?? "📋"} {p.category}
                          </span>
                          {p.targetDate && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <span>📅</span> {p.targetDate}
                            </span>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{p.progressPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full progress-bar"
                              style={{
                                width: `${p.progressPercent}%`,
                                background:
                                  p.status === "Completed"
                                    ? "#10b981"
                                    : p.status === "InProgress"
                                    ? "linear-gradient(90deg, #C8102E, #FFD700)"
                                    : "#374151",
                              }}
                            />
                          </div>
                        </div>

                        {/* Details */}
                        {p.details && (
                          <p className="text-xs text-gray-400 leading-relaxed">{p.details}</p>
                        )}

                        {/* Related news */}
                        {p.relatedNews && p.relatedNews.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-800">
                            <p className="text-xs text-gray-500 mb-2 font-medium">📰 Related News</p>
                            <div className="flex flex-wrap gap-2">
                              {p.relatedNews.map((n) => (
                                <a
                                  key={n.id}
                                  href={n.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-[300px] flex items-center gap-1"
                                >
                                  <span>↗</span>
                                  <span className="truncate">{n.title}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Source note */}
          <div className="bg-gray-900 border border-blue-900/50 rounded-xl p-4">
            <p className="text-xs text-blue-400 font-semibold mb-1">ℹ️ Data Source</p>
            <p className="text-xs text-gray-500">
              Manifesto promises listed here are sourced from TVK&apos;s official public announcements,
              party press releases, and documented policy positions. Progress status reflects
              party-stated positions and is updated based on news aggregation.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
