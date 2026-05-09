"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import NewsTicker from "@/components/NewsTicker";

interface MLA {
  id: number;
  name: string;
  constituency: string;
  district: string;
  party: string;
  photoUrl: string | null;
  education: string | null;
  assets: string | null;
  liabilities: string | null;
  criminalCaseCount: number;
  affidavitLink: string | null;
  designation: string | null;
  bio: string | null;
}

const DISTRICTS = ["All", "Chennai", "Cuddalore", "Salem", "Erode", "Chengalpattu", "Coimbatore", "Madurai", "Vellore"];

export default function MLADirectoryPage() {
  const [mlas, setMlas] = useState<MLA[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("All");

  useEffect(() => {
    async function fetchMLAs() {
      try {
        const res = await axios.get("/api/mlas");
        setMlas(res.data.mlas ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchMLAs();
  }, []);

  const filtered = mlas.filter((m) => {
    const matchesSearch =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.constituency.toLowerCase().includes(search.toLowerCase());
    const matchesDistrict = district === "All" || m.district === district;
    return matchesSearch && matchesDistrict;
  });

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
              <span>👥</span> MLA Directory
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              TVK party leaders and constituency representatives.{" "}
              <span className="text-yellow-500">
                Data sourced from publicly available ECI affidavits via ADR/MyNeta.
              </span>
            </p>
          </div>

          {/* Filters */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Search by name or constituency..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-700"
            />
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-700"
            >
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d === "All" ? "All Districts" : d}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{filtered.length}</span> of <span>{mlas.length}</span> records
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Leaders" value={mlas.length} icon="👥" color="#C8102E" />
            <StatCard label="With Cases" value={mlas.filter((m) => m.criminalCaseCount > 0).length} icon="⚖️" color="#ef4444" />
            <StatCard label="Clean Record" value={mlas.filter((m) => m.criminalCaseCount === 0).length} icon="✅" color="#10b981" />
            <StatCard label="Districts" value={new Set(mlas.map((m) => m.district)).size} icon="🗺️" color="#FFD700" />
          </div>

          {/* MLA Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-56 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <p className="text-5xl mb-4">👤</p>
              <p className="text-gray-300 font-semibold">No MLAs found</p>
              <p className="text-gray-500 text-sm mt-2">
                Load sample data from the dashboard to populate MLA records.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((mla) => (
                <Link
                  key={mla.id}
                  href={`/mla-directory/${mla.id}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 card-hover group block"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {mla.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mla.photoUrl}
                          alt={mla.name}
                          className="w-14 h-14 rounded-full object-cover border-2"
                          style={{ borderColor: "#C8102E" }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold border-2"
                        style={{
                          background: "linear-gradient(135deg, #C8102E, #a00d24)",
                          borderColor: "#C8102E",
                          display: mla.photoUrl ? "none" : "flex",
                        }}
                      >
                        {mla.name.charAt(0)}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-sm group-hover:text-red-400 transition-colors truncate">
                        {mla.name}
                      </h3>
                      <p className="text-xs text-gray-400 truncate">{mla.constituency}</p>
                      <p className="text-xs text-gray-500">{mla.district}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {mla.designation && (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span>🏷️</span>
                        <span className="truncate">{mla.designation}</span>
                      </p>
                    )}
                    {mla.education && (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span>🎓</span>
                        <span className="truncate">{mla.education}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Assets</p>
                      <p className="text-xs font-semibold text-green-400">{mla.assets ?? "N/A"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Criminal Cases</p>
                      <p
                        className={`text-sm font-bold ${
                          mla.criminalCaseCount > 0 ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {mla.criminalCaseCount > 0 ? `⚠️ ${mla.criminalCaseCount}` : "✅ 0"}
                      </p>
                    </div>
                  </div>

                  {mla.affidavitLink && (
                    <div className="mt-3">
                      <span className="text-xs text-blue-400 flex items-center gap-1">
                        <span>📄</span> Affidavit Available
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-gray-900 border border-yellow-900/50 rounded-xl p-4">
            <p className="text-xs text-yellow-600 font-semibold mb-1">⚠️ Data Disclaimer</p>
            <p className="text-xs text-gray-500">
              All criminal case data shown here is sourced exclusively from{" "}
              <strong className="text-gray-400">officially declared affidavits</strong> submitted to the
              Election Commission of India (ECI). No unverified allegations are shown. Acquitted cases are
              clearly marked. Source: ADR India / MyNeta public database.
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
