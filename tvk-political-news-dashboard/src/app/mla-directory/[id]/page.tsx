"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { use } from "react";
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

interface CriminalCase {
  id: number;
  caseType: string;
  ipcSections: string | null;
  courtName: string | null;
  district: string | null;
  year: number | null;
  status: string;
  description: string | null;
  sourceReference: string | null;
}

interface NewsItem {
  id: number;
  title: string;
  url: string;
  source: string | null;
  publishedAt: string | null;
  sentimentLabel: string;
}

export default function MLAProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [mla, setMla] = useState<MLA | null>(null);
  const [cases, setCases] = useState<CriminalCase[]>([]);
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await axios.get(`/api/mlas/${id}`);
        setMla(res.data.mla);
        setCases(res.data.cases ?? []);
        setRelatedNews(res.data.relatedNews ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const statusColor: Record<string, string> = {
    Pending: "text-yellow-400 bg-yellow-900/20 border-yellow-800",
    Acquitted: "text-green-400 bg-green-900/20 border-green-800",
    Convicted: "text-red-400 bg-red-900/20 border-red-800",
    Withdrawn: "text-gray-400 bg-gray-800/50 border-gray-700",
  };

  const caseTypeIcon: Record<string, string> = {
    Corruption: "🏛️",
    Assault: "👊",
    Financial: "💰",
    Other: "📋",
  };

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-950">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <NewsTicker />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!mla) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-950">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <NewsTicker />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-6xl mb-4">👤</p>
              <p className="text-gray-300 font-semibold">Profile Not Found</p>
              <Link href="/mla-directory" className="text-red-400 text-sm mt-2 block hover:text-red-300">
                ← Back to Directory
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <NewsTicker />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Link href="/mla-directory" className="hover:text-gray-300 transition-colors">
              MLA Directory
            </Link>
            <span>→</span>
            <span className="text-gray-300">{mla.name}</span>
          </div>

          {/* Profile Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="h-1.5" style={{ background: "linear-gradient(90deg, #C8102E, #FFD700)" }} />
            <div className="p-6 flex flex-col md:flex-row gap-6">
              {/* Photo */}
              <div className="flex-shrink-0 flex flex-col items-center gap-3">
                {mla.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mla.photoUrl}
                    alt={mla.name}
                    className="w-32 h-32 rounded-full object-cover border-4"
                    style={{ borderColor: "#C8102E" }}
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      t.style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className="w-32 h-32 rounded-full flex items-center justify-center text-white text-4xl font-bold border-4"
                    style={{ background: "linear-gradient(135deg, #C8102E, #a00d24)", borderColor: "#C8102E" }}
                  >
                    {mla.name.charAt(0)}
                  </div>
                )}
                <span
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{
                    background: "rgba(200,16,46,0.2)",
                    color: "#C8102E",
                    border: "1px solid rgba(200,16,46,0.4)",
                  }}
                >
                  {mla.party}
                </span>
              </div>

              {/* Details */}
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">{mla.name}</h1>
                {mla.designation && (
                  <p className="text-sm text-yellow-400 mt-1">{mla.designation}</p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  <ProfileField label="Constituency" value={mla.constituency} />
                  <ProfileField label="District" value={mla.district} />
                  <ProfileField label="Education" value={mla.education ?? "N/A"} />
                  <ProfileField label="Assets" value={mla.assets ?? "N/A"} />
                  <ProfileField label="Liabilities" value={mla.liabilities ?? "N/A"} />
                  <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-500">Criminal Cases</p>
                    <p
                      className={`text-sm font-bold mt-0.5 ${
                        mla.criminalCaseCount > 0 ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {mla.criminalCaseCount > 0 ? `⚠️ ${mla.criminalCaseCount} Declared` : "✅ None Declared"}
                    </p>
                  </div>
                </div>

                {mla.bio && (
                  <p className="text-sm text-gray-400 mt-4 leading-relaxed">{mla.bio}</p>
                )}

                {mla.affidavitLink && (
                  <a
                    href={mla.affidavitLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-4 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <span>📄</span>
                    View Official Affidavit (ECI / MyNeta)
                    <span>↗</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Criminal Cases */}
            <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span>⚖️</span> Declared Criminal Cases
                <span className="text-xs text-gray-500 font-normal">(from official affidavits only)</span>
              </h2>

              {cases.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-gray-400 text-sm">No criminal cases declared in affidavit</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cases.map((c) => (
                    <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{caseTypeIcon[c.caseType] ?? "📋"}</span>
                          <div>
                            <p className="text-sm font-semibold text-white">{c.caseType}</p>
                            {c.ipcSections && (
                              <p className="text-xs text-gray-400 mt-0.5">{c.ipcSections}</p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                            statusColor[c.status] ?? "text-gray-400 bg-gray-800 border-gray-700"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                        {c.courtName && (
                          <span className="flex items-center gap-1">
                            <span>🏛️</span> {c.courtName}
                          </span>
                        )}
                        {c.year && (
                          <span className="flex items-center gap-1">
                            <span>📅</span> FIR Year: {c.year}
                          </span>
                        )}
                        {c.district && (
                          <span className="flex items-center gap-1">
                            <span>🗺️</span> {c.district}
                          </span>
                        )}
                      </div>

                      {c.description && (
                        <p className="text-xs text-gray-500 mt-2 border-t border-gray-700 pt-2">
                          {c.description}
                        </p>
                      )}

                      {c.sourceReference && (
                        <a
                          href={c.sourceReference}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 mt-2 flex items-center gap-1"
                        >
                          <span>📄</span> Source: Affidavit
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Related News */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span>📰</span> Related News
              </h2>

              {relatedNews.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-gray-400 text-sm">No related news found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {relatedNews.map((article) => (
                    <a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-gray-800 border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-colors group"
                    >
                      <p className="text-xs font-medium text-gray-200 group-hover:text-red-400 transition-colors line-clamp-2">
                        {article.title}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{article.source ?? "Unknown"}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            article.sentimentLabel === "Positive"
                              ? "badge-positive"
                              : article.sentimentLabel === "Negative"
                              ? "badge-negative"
                              : "badge-neutral"
                          }`}
                        >
                          {article.sentimentLabel}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-white mt-0.5 truncate">{value}</p>
    </div>
  );
}
