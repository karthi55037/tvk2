"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import NewsTicker from "@/components/NewsTicker";
import { DistrictCaseBar } from "@/components/SentimentChart";

interface CaseRecord {
  id: number;
  mlaId: number;
  mlaName: string | null;
  mlaConstituency: string | null;
  mlaDistrict: string | null;
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

const TAMIL_NADU_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
  "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
  "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
  "Vellore", "Villupuram", "Virudhunagar",
];

export default function DistrictFIRPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [districtSummary, setDistrictSummary] = useState<DistrictSummary[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
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
    fetchData();
  }, []);

  // Group cases by district
  const districtGroups = districtSummary.reduce<
    Record<string, { summary: DistrictSummary; cases: CaseRecord[] }>
  >((acc, d) => {
    const key = d.district ?? "Unknown";
    acc[key] = {
      summary: d,
      cases: cases.filter((c) => c.district === d.district || c.mlaDistrict === d.district),
    };
    return acc;
  }, {});

  const selectedCases = selectedDistrict
    ? cases.filter(
        (c) => c.district === selectedDistrict || c.mlaDistrict === selectedDistrict
      )
    : [];

  const statusColor: Record<string, string> = {
    Pending: "text-yellow-400 bg-yellow-900/20 border-yellow-800",
    Acquitted: "text-green-400 bg-green-900/20 border-green-800",
    Convicted: "text-red-500 bg-red-900/30 border-red-700",
    Withdrawn: "text-gray-400 bg-gray-800 border-gray-700",
  };

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
              <span>🗺️</span> District FIR Tracker
            </h1>
            <p className="text-xs text-yellow-500 mt-1">
              District-wise breakdown of officially declared criminal cases from ECI affidavits.
            </p>
          </div>

          {/* Map/Chart */}
          {districtSummary.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span> District-wise Case Distribution
              </h3>
              <DistrictCaseBar data={districtSummary} />
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Districts list */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-sm font-bold text-white">Tamil Nadu Districts</h3>
                <p className="text-xs text-gray-500 mt-0.5">Click to view FIR details</p>
              </div>
              <div className="overflow-y-auto max-h-[600px]">
                {TAMIL_NADU_DISTRICTS.map((dist) => {
                  const summary = districtGroups[dist];
                  const caseCount = summary ? Number(summary.summary.total_cases) : 0;
                  const hasData = caseCount > 0;

                  return (
                    <button
                      key={dist}
                      onClick={() => setSelectedDistrict(dist === selectedDistrict ? null : dist)}
                      className={`
                        w-full text-left px-4 py-3 flex items-center justify-between border-b border-gray-800/50
                        transition-colors hover:bg-gray-800
                        ${selectedDistrict === dist ? "bg-gray-800" : ""}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            hasData ? "bg-red-500" : "bg-gray-700"
                          }`}
                        />
                        <span className="text-sm text-gray-300">{dist}</span>
                      </div>
                      {hasData && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(200,16,46,0.2)",
                            color: "#C8102E",
                          }}
                        >
                          {caseCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* District Detail */}
            <div className="lg:col-span-2">
              {selectedDistrict ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div
                    className="p-4 border-b border-gray-800 flex items-center justify-between"
                    style={{ background: "rgba(200,16,46,0.08)" }}
                  >
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>📍</span> {selectedDistrict} — FIR Details
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {selectedCases.length} declared case(s) in affidavits
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedDistrict(null)}
                      className="text-gray-500 hover:text-gray-300 text-lg"
                    >
                      ✕
                    </button>
                  </div>

                  {selectedCases.length === 0 ? (
                    <div className="p-12 text-center">
                      <p className="text-4xl mb-3">✅</p>
                      <p className="text-gray-400 text-sm">
                        No declared cases in {selectedDistrict}
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        Based on available ECI affidavit data
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {selectedCases.map((c) => (
                        <div key={c.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Link
                                  href={`/mla-directory/${c.mlaId}`}
                                  className="text-sm font-semibold text-white hover:text-red-400 transition-colors"
                                >
                                  {c.mlaName ?? "Unknown"}
                                </Link>
                                {c.mlaConstituency && (
                                  <span className="text-xs text-gray-500">({c.mlaConstituency})</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400">{c.caseType} Case</p>
                              {c.ipcSections && (
                                <p className="text-xs text-gray-500 mt-0.5">IPC: {c.ipcSections}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full border ${
                                  statusColor[c.status] ?? "text-gray-400 bg-gray-800 border-gray-700"
                                }`}
                              >
                                {c.status}
                              </span>
                              {c.year && (
                                <p className="text-xs text-gray-500 mt-1">FIR: {c.year}</p>
                              )}
                            </div>
                          </div>
                          {c.courtName && (
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                              <span>🏛️</span> {c.courtName}
                            </p>
                          )}
                          {c.description && (
                            <p className="text-xs text-gray-600 mt-2">{c.description}</p>
                          )}
                          {c.sourceReference && (
                            <a
                              href={c.sourceReference}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 mt-2 flex items-center gap-1"
                            >
                              <span>📄</span> Official Source: Affidavit
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center h-full flex flex-col items-center justify-center">
                  <p className="text-5xl mb-4">🗺️</p>
                  <p className="text-gray-300 font-semibold">Select a District</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Click any district in the left panel to view its FIR records
                  </p>

                  {/* District summary cards */}
                  {districtSummary.length > 0 && (
                    <div className="mt-6 w-full grid grid-cols-2 gap-3">
                      {districtSummary.slice(0, 4).map((d) => (
                        <button
                          key={d.district}
                          onClick={() => setSelectedDistrict(d.district ?? null)}
                          className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-left hover:border-red-800 transition-colors"
                        >
                          <p className="text-sm font-semibold text-white">{d.district ?? "Unknown"}</p>
                          <p className="text-xs text-red-400 font-bold mt-0.5">{d.total_cases} case(s)</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-gray-900 border border-yellow-900/50 rounded-xl p-4">
            <p className="text-xs text-yellow-600 font-semibold mb-1">📋 Data Source & Ethics</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              FIR data is sourced only from{" "}
              <strong className="text-gray-400">sworn affidavits</strong> submitted to ECI.
              This is public information that candidates are legally required to disclose.
              We follow{" "}
              <strong className="text-gray-400">ethical political reporting guidelines</strong> and
              do not show unverified allegations. All convicted/acquitted status reflects court
              judgments, not editorial opinion.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
