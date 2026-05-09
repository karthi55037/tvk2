"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import NewsTicker from "@/components/NewsTicker";
import NewsCard from "@/components/NewsCard";

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

const CATEGORIES = ["All", "Leader", "Party", "MLA", "Criminal", "Manifesto", "General"];
const SENTIMENTS = ["All", "Positive", "Neutral", "Negative"];

export default function LiveNewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [category, setCategory] = useState("All");
  const [sentiment, setSentiment] = useState("All");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastFetch, setLastFetch] = useState<string>("");
  const [countdown, setCountdown] = useState(60);

  const fetchNews = useCallback(async (pg = page) => {
    try {
      const params = new URLSearchParams({
        page: String(pg),
        limit: "24",
      });
      if (category !== "All") params.append("category", category);
      if (sentiment !== "All") params.append("sentiment", sentiment);

      const res = await axios.get(`/api/news?${params}`);
      setArticles(res.data.articles ?? []);
      setTotalPages(res.data.pagination?.pages ?? 1);
      setTotal(res.data.pagination?.total ?? 0);
      setLastFetch(new Date().toLocaleTimeString("en-IN"));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [category, sentiment, page]);

  useEffect(() => {
    setPage(1);
  }, [category, sentiment]);

  useEffect(() => {
    fetchNews(page);
    setCountdown(60);
    const interval = setInterval(() => {
      fetchNews(page);
      setCountdown(60);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNews, page]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleFetchLive() {
    setFetching(true);
    try {
      await axios.post("/api/news/fetch");
      await fetchNews(1);
      setPage(1);
    } catch {
      // ignore
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <NewsTicker />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Page header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 live-dot" />
                Live News Feed
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                {total} articles • Auto-refreshes every 60s
                {lastFetch && ` • Last updated: ${lastFetch}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Countdown */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Next refresh: {countdown}s
              </div>

              <button
                onClick={handleFetchLive}
                disabled={fetching}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg, #C8102E, #a00d24)" }}
              >
                <span className={fetching ? "animate-spin" : ""}>🔄</span>
                {fetching ? "Fetching RSS..." : "Fetch Latest News"}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-2 font-medium">Category</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      category === cat
                        ? "text-white border-red-700"
                        : "text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}
                    style={category === cat ? { background: "rgba(200,16,46,0.2)" } : {}}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">Sentiment</p>
              <div className="flex gap-2">
                {SENTIMENTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSentiment(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      sentiment === s
                        ? s === "Positive"
                          ? "bg-green-900/30 text-green-400 border-green-700"
                          : s === "Negative"
                          ? "bg-red-900/30 text-red-400 border-red-700"
                          : "text-white border-gray-500 bg-gray-800"
                        : "text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    {s === "Positive" ? "😊" : s === "Negative" ? "😟" : s === "Neutral" ? "😐" : ""}
                    {" "}{s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* News Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-64 animate-pulse" />
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <p className="text-5xl mb-4">📡</p>
              <p className="text-gray-300 font-semibold">No articles found</p>
              <p className="text-gray-500 text-sm mt-2">
                Try changing filters or click &quot;Fetch Latest News&quot; to load RSS feeds
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {articles.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = page <= 3 ? i + 1 : page - 2 + i;
                if (pg > totalPages) return null;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`w-9 h-9 text-sm rounded-lg border transition-all ${
                      pg === page
                        ? "text-white border-red-700"
                        : "text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}
                    style={pg === page ? { background: "rgba(200,16,46,0.2)" } : {}}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next →
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
