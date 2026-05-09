"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import NewsTicker from "@/components/NewsTicker";
import NewsCard from "@/components/NewsCard";
import {
  SentimentDoughnut,
  WeeklySentimentBar,
  NewsFrequencyLine,
} from "@/components/SentimentChart";

interface SentimentData {
  overall: {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
    avgScore: number;
  };
  mostPositive: { title: string; score: number; url: string; source: string } | null;
  mostNegative: { title: string; score: number; url: string; source: string } | null;
  weeklyTrend: Array<{
    date: string;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    totalArticles: number;
  }>;
  newsFrequency: Array<{ date: string; count: string | number }>;
}

interface NewsArticle {
  id: number;
  title: string;
  source: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  summary: string | null;
  sentimentScore: number;
  sentimentLabel: string;
  category: string | null;
}

interface ManifestoPromise {
  id: number;
  promise: string;
  category: string;
  status: string;
  progressPercent: number;
}

interface Stats {
  totalMLAs: number;
  totalCriminalCases: number;
  totalNewsArticles: number;
  totalManifestoPromises: number;
}

const VIJAY_PHOTO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Vijay_at_the_launch_of_Bigil_%28cropped%29.jpg/220px-Vijay_at_the_launch_of_Bigil_%28cropped%29.jpg";

export default function Dashboard() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [manifesto, setManifesto] = useState<ManifestoPromise[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [seeded, setSeeded] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [newsRes, sentRes, manifestoRes, statsRes] = await Promise.all([
        axios.get("/api/news?limit=20"),
        axios.get("/api/sentiment"),
        axios.get("/api/manifesto"),
        axios.get("/api/stats"),
      ]);

      setNews(newsRes.data.articles ?? []);
      setSentiment(sentRes.data);
      setManifesto(manifestoRes.data.promises ?? []);
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      const res = await axios.get(
        `/api/news?limit=20${activeCategory !== "All" ? `&category=${activeCategory}` : ""}`
      );
      setNews(res.data.articles ?? []);
    } catch {
      // ignore
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000); // refresh every 60 seconds
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  async function handleSeedData() {
    setSeeding(true);
    try {
      await axios.post("/api/seed");
      setSeeded(true);
      await fetchAll();
    } catch (err) {
      console.error("Seed failed", err);
    } finally {
      setSeeding(false);
    }
  }

  const statusColor: Record<string, string> = {
    Announced: "status-announced",
    InProgress: "status-inprogress",
    Completed: "status-completed",
    NoUpdate: "status-noupdate",
  };

  const categories = ["All", "Leader", "Party", "MLA", "Criminal", "Manifesto"];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-center space-y-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-xl tvk-glow mx-auto"
            style={{ background: "linear-gradient(135deg, #C8102E, #a00d24)" }}
          >
            TVK
          </div>
          <p className="text-gray-400 text-sm animate-pulse">Loading Dashboard...</p>
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

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Seed data prompt */}
          {stats && stats.totalNewsArticles === 0 && !seeded && (
            <div className="bg-gray-900 border border-yellow-800 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-yellow-400 font-semibold text-sm">👋 Welcome! Database is empty.</p>
                <p className="text-gray-400 text-xs mt-1">
                  Load sample data to see the dashboard in action, then use the Fetch News button to get live updates.
                </p>
              </div>
              <button
                onClick={handleSeedData}
                disabled={seeding}
                className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ml-4"
                style={{ background: "linear-gradient(135deg, #C8102E, #a00d24)" }}
              >
                {seeding ? "Loading..." : "Load Sample Data"}
              </button>
            </div>
          )}

          {/* Leader Profile */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div
              className="h-1.5 w-full"
              style={{ background: "linear-gradient(90deg, #C8102E, #FFD700)" }}
            />
            <div className="p-6 flex flex-col md:flex-row gap-6">
              {/* Photo */}
              <div className="flex-shrink-0 flex flex-col items-center gap-3">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 bg-gray-800"
                  style={{ borderColor: "#C8102E" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={VIJAY_PHOTO}
                    alt="Vijay - TVK Party President"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">Vijay</p>
                  <p className="text-xs text-gray-400">(Thalapathy)</p>
                  <span
                    className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: "rgba(200,16,46,0.2)",
                      color: "#C8102E",
                      border: "1px solid rgba(200,16,46,0.4)",
                    }}
                  >
                    Party President
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-1">
                  Tamilaga Vettri Kazhagam (TVK)
                </h2>
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                  Founded on <strong className="text-gray-200">2 February 2024</strong> by actor-politician{" "}
                  <strong className="text-gray-200">Joseph Vijay Chandrasekhar</strong>, TVK is a nascent
                  Tamil Nadu political party aspiring to contest the 2026 state assembly elections. The party
                  advocates for social justice, Tamil identity, and grassroots welfare programs.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <InfoPill label="Founded" value="Feb 2, 2024" icon="📅" />
                  <InfoPill label="State" value="Tamil Nadu" icon="🗺️" />
                  <InfoPill label="Ideology" value="Social Justice" icon="⚖️" />
                  <InfoPill label="Target" value="2026 Elections" icon="🗳️" />
                </div>
              </div>

              {/* Sentiment score */}
              {sentiment && (
                <div className="flex-shrink-0 bg-gray-800 rounded-xl p-4 min-w-[140px] text-center border border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">Overall Sentiment</p>
                  <div
                    className="text-3xl font-black mb-1"
                    style={{
                      color:
                        sentiment.overall.avgScore > 0
                          ? "#10b981"
                          : sentiment.overall.avgScore < 0
                          ? "#ef4444"
                          : "#9ca3af",
                    }}
                  >
                    {sentiment.overall.total > 0
                      ? `${Math.round((sentiment.overall.positive / sentiment.overall.total) * 100)}%`
                      : "—"}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Positive Coverage</p>
                  <div className="space-y-1.5">
                    <MiniSentimentBar label="+" value={sentiment.overall.positive} total={sentiment.overall.total} color="#10b981" />
                    <MiniSentimentBar label="○" value={sentiment.overall.neutral} total={sentiment.overall.total} color="#6b7280" />
                    <MiniSentimentBar label="−" value={sentiment.overall.negative} total={sentiment.overall.total} color="#ef4444" />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Charts Row */}
          {sentiment && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sentiment Doughnut */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <span>📊</span> Sentiment Distribution
                </h3>
                <SentimentDoughnut data={sentiment.overall} />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-green-400 font-bold text-sm">{sentiment.overall.positive}</p>
                    <p className="text-xs text-gray-500">Positive</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-bold text-sm">{sentiment.overall.neutral}</p>
                    <p className="text-xs text-gray-500">Neutral</p>
                  </div>
                  <div>
                    <p className="text-red-400 font-bold text-sm">{sentiment.overall.negative}</p>
                    <p className="text-xs text-gray-500">Negative</p>
                  </div>
                </div>
              </div>

              {/* Weekly Trend */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <span>📈</span> Weekly Sentiment Trend
                </h3>
                <WeeklySentimentBar data={sentiment.weeklyTrend} />
              </div>

              {/* News Frequency */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <span>📰</span> News Frequency (7 Days)
                </h3>
                <NewsFrequencyLine data={sentiment.newsFrequency} />
              </div>
            </div>
          )}

          {/* Best/Worst Headlines */}
          {sentiment && (sentiment.mostPositive || sentiment.mostNegative) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentiment.mostPositive && (
                <a
                  href={sentiment.mostPositive.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-900 border border-green-900 rounded-xl p-4 hover:border-green-700 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-400 text-xs font-bold px-2 py-0.5 rounded-full bg-green-900/30 border border-green-800">
                      😊 Most Positive Headline
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 group-hover:text-green-300 transition-colors line-clamp-2">
                    {sentiment.mostPositive.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{sentiment.mostPositive.source}</p>
                </a>
              )}
              {sentiment.mostNegative && (
                <a
                  href={sentiment.mostNegative.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-900 border border-red-900 rounded-xl p-4 hover:border-red-700 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-400 text-xs font-bold px-2 py-0.5 rounded-full bg-red-900/30 border border-red-800">
                      😟 Most Critical Headline
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 group-hover:text-red-300 transition-colors line-clamp-2">
                    {sentiment.mostNegative.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{sentiment.mostNegative.source}</p>
                </a>
              )}
            </div>
          )}

          {/* Manifesto Preview */}
          {manifesto.length > 0 && (
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📋</span> Manifesto Promises
                </h3>
                <a
                  href="/manifesto"
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  View All →
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {manifesto.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 bg-gray-800 rounded-lg p-3 border border-gray-700"
                  >
                    <div className="flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[p.status] ?? "status-noupdate"}`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 line-clamp-1 flex-1">{p.promise}</p>
                    <span className="text-xs text-gray-500 flex-shrink-0">{p.category}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* News Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 live-dot" />
                Latest News Articles
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-xs px-3 py-1 rounded-full border transition-all ${
                      activeCategory === cat
                        ? "text-white border-red-700"
                        : "text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}
                    style={activeCategory === cat ? { background: "rgba(200,16,46,0.2)" } : {}}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {news.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                <p className="text-4xl mb-3">📰</p>
                <p className="text-gray-400 text-sm">No news articles yet.</p>
                <p className="text-gray-500 text-xs mt-1">
                  Click &quot;Load Sample Data&quot; above or &quot;Fetch News&quot; in the header.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {news.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function InfoPill({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2.5 text-center border border-gray-700">
      <span className="text-base">{icon}</span>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      <p className="text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

function MiniSentimentBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold w-3" style={{ color }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs text-gray-500 w-7 text-right">{pct}%</span>
    </div>
  );
}
