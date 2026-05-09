"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import NewsTicker from "@/components/NewsTicker";
import { CaseTypeBar, DistrictCaseBar } from "@/components/SentimentChart";

interface CaseRecord {
  id: number;
  mlaId: number;
  mlaName: string | null;
  mlaConstituency: string | null;
  mlaDistrict: string | null;
  mlaPhotoUrl: string | null;
  caseType: string;
  ipcSections: string | null;
  courtName: string | null;
  district: string | null;
  year: number | null;
  status: string;
  description: string | null;
  sourceReference: string | null;
}

interface DistrictSummary {
  district: string | null;
  total_cases: string;
  corruption: string;
  assault: string;
  financial: string;
  other: string;
}

const CASE_TYPES = ["All", "Corruption", "Assault", "Financial", "Other"];
const STATUSES = ["All", "Pending", "Acquitted", "Convicted", "Withdrawn"];

const statusColor: Record<string, string> = {
  Pending: "text-yellow-400 bg-yellow-900/20 border-yellow-800",
  Acquitted: "text-green-400 bg-green-900/20 border-green-800",
  Convicted: "text-red-500 bg-red-900/30 border-red-700",
  Withdrawn: "text-gray-400 bg-gray-800 border-gray-700",
};

const caseTypeColor: Record<string, string> = {
  Corruption: "#ef4444",
  Assault: "#f59e0b",
  Financial: "#3b82f6",
  Other: "#6b7280",
};

const caseTypeIcon: Record<string, string> = {
  Corruption: "🏛️",
  Assault: "👊",
  Financial: "💰",
  Other: "📋",
};

export default function CriminalCasesPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [districtSummary, setDistrictSummary] = useState<DistrictSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [caseType, setCaseType] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchCases() {
      try {
        const res = await axios.get("/api/criminal-cases");
        setCases(res.data.cases ?? []);
        setDistrictSummary(res.data.districtSummary ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, []);

  const filtered = cases.filter((c) => {
    if (caseType !== "All" && c.caseType !== caseType) return false;
    if (statusFilter !== "All" && c.status !== statusFilter) return false;
    if (search && !(c.mlaName ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Aggregate by type
  const caseTypeSummary = CASE_TYPES.filter((t) => t !== "All").map((type) => ({
    caseType: type,
    count: cases.filter((c) => c.caseType === type).length,
  }));

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
              <span>⚖️</span> Criminal Case Tracker
            </h1>
            <p className="text-xs text-yellow-500 mt-1">
              ⚠️ Only officially declared affidavit data shown. No unverified allegations. Source: ECI / ADR India.
            </p>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Cases" value={cases.length} icon="📁" color="#C8102E" />
            <StatCard label="Pending" value={cases.filter((c) => c.status === "Pending").length} icon="⏳" color="#f59e0b" />
            <StatCard label="Acquitted" value={cases.filter((c) => c.status === "Acquitted").length} icon="✅" color="#10b981" />
            <StatCard label="Withdrawn" value={cases.filter((c) => c.status === "Withdrawn").length} icon="🔙" color="#6b7280" />
          </div>

          {/* Charts */}
          {cases.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <span>📊</span> Cases by Type
                </h3>
                <CaseTypeBar data={caseTypeSummary} />
              </div>

              {districtSummary.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <span>🗺️</span> Cases by District
                  </h3>
                  <DistrictCaseBar data={districtSummary} />
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Search by MLA name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-700"
            />
            <div className="flex flex-wrap gap-2">
              {CASE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setCaseType(t)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    caseType === t
                      ? "text-white border-red-700"
                      : "text-gray-400 border-gray-700 hover:border-gray-500"
                  }`}
                  style={
                    caseType === t
                      ? { background: "rgba(200,16,46,0.2)" }
                      : {}
                  }
                >
                  {t !== "All" && caseTypeIcon[t]} {t}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    statusFilter === s
                      ? "text-white border-gray-500 bg-gray-800"
                      : "text-gray-400 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-gray-500">
            Showing <strong className="text-gray-300">{filtered.length}</strong> of{" "}
            <strong className="text-gray-300">{cases.length}</strong> cases
          </p>

          {/* Cases Table */}
          {loading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Loading cases...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <p className="text-5xl mb-4">⚖️</p>
              <p className="text-gray-300 font-semibold">No cases found</p>
              <p className="text-gray-500 text-sm mt-2">Load sample data from the dashboard first.</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="px-4 py-3 text-xs text-gray-500 font-semibold">MLA</th>
                      <th className="px-4 py-3 text-xs text-gray-500 font-semibold">Case Type</th>
                      <th className="px-4 py-3 text-xs text-gray-500 font-semibold">IPC Sections</th>
                      <th className="px-4 py-3 text-xs text-gray-500 font-semibold">Court</th>
                      <th className="px-4 py-3 text-xs text-gray-500 font-semibold">District</th>
                      <th className="px-4 py-3 text-xs text-gray-500 font-semibold">Year</th>
                      <th className="px-4 py-3 text-xs text-gray-500 font-semibold">Status</th>
                      <th className="px-4 py-3 text-xs text-gray-500 font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={`/mla-directory/${c.mlaId}`}
                            className="text-white hover:text-red-400 transition-colors font-medium text-xs"
                          >
                            {c.mlaName ?? "Unknown"}
                          </Link>
                          {c.mlaConstituency && (
                            <p className="text-xs text-gray-500">{c.mlaConstituency}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="flex items-center gap-1 text-xs font-medium"
                            style={{ color: caseTypeColor[c.caseType] ?? "#9ca3af" }}
                          >
                            {caseTypeIcon[c.caseType] ?? "📋"} {c.caseType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px]">
                          <span className="line-clamp-1">{c.ipcSections ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[180px]">
                          <span className="line-clamp-1">{c.courtName ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{c.district ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{c.year ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${
                              statusColor[c.status] ?? "text-gray-400 bg-gray-800 border-gray-700"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.sourceReference ? (
                            <a
                              href={c.sourceReference}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              📄 Affidavit
                            </a>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* District Breakdown Table */}
          {districtSummary.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🗺️</span> District-wise Case Breakdown
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="px-4 py-3 text-xs text-gray-500 font-semibold">District</th>
                      <th className="px-4 py-3 text-xs text-gray-500 font-semibold text-center">Total</th>
                      <th className="px-4 py-3 text-xs text-red-400 font-semibold text-center">🏛️ Corruption</th>
                      <th className="px-4 py-3 text-xs text-yellow-400 font-semibold text-center">👊 Assault</th>
                      <th className="px-4 py-3 text-xs text-blue-400 font-semibold text-center">💰 Financial</th>
                      <th className="px-4 py-3 text-xs text-gray-400 font-semibold text-center">📋 Other</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {districtSummary.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-white font-medium">{d.district ?? "Unknown"}</td>
                        <td className="px-4 py-3 text-sm text-red-400 font-bold text-center">{d.total_cases}</td>
                        <td className="px-4 py-3 text-sm text-gray-300 text-center">{d.corruption}</td>
                        <td className="px-4 py-3 text-sm text-gray-300 text-center">{d.assault}</td>
                        <td className="px-4 py-3 text-sm text-gray-300 text-center">{d.financial}</td>
                        <td className="px-4 py-3 text-sm text-gray-300 text-center">{d.other}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Legal Disclaimer */}
          <div className="bg-gray-900 border border-yellow-900/50 rounded-xl p-4">
            <p className="text-xs text-yellow-600 font-semibold mb-1">⚠️ Important Legal Disclaimer</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              All data displayed here is sourced exclusively from{" "}
              <strong className="text-gray-400">sworn affidavits</strong> officially submitted to the{" "}
              <strong className="text-gray-400">Election Commission of India (ECI)</strong> during elections.
              Cases marked &quot;Pending&quot; are not convictions. Cases marked &quot;Acquitted&quot; mean the individual
              was found not guilty by a court of law. This platform does not make any independent allegations.
              For official records, visit{" "}
              <a
                href="https://myneta.info"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                myneta.info
              </a>{" "}
              or the{" "}
              <a
                href="https://eci.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                ECI website
              </a>
              .
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: `${color}22` }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold" style={{ color }}>
          {value}
        </p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
