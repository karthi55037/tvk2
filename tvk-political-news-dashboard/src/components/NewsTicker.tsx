"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";

interface TickerArticle {
  id: number;
  title: string;
  source: string;
  url: string;
  sentimentLabel: string;
}

export default function NewsTicker() {
  const [articles, setArticles] = useState<TickerArticle[]>([]);

  const fetchTicker = useCallback(async () => {
    try {
      const res = await axios.get("/api/stats");
      setArticles(res.data.recentNews ?? []);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchTicker();
    const interval = setInterval(fetchTicker, 60000);
    return () => clearInterval(interval);
  }, [fetchTicker]);

  const sentimentColor = (label: string) => {
    if (label === "Positive") return "#10b981";
    if (label === "Negative") return "#ef4444";
    return "#9ca3af";
  };

  if (articles.length === 0) return null;

  return (
    <div
      className="w-full overflow-hidden flex items-center h-9 border-b border-gray-800"
      style={{ background: "rgba(200,16,46,0.08)" }}
    >
      {/* LIVE label */}
      <div
        className="flex-shrink-0 flex items-center gap-1.5 px-3 h-full text-xs font-bold border-r border-gray-700"
        style={{ color: "#FFD700", background: "rgba(200,16,46,0.2)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-dot" />
        LIVE
      </div>

      {/* Scrolling text */}
      <div className="flex-1 overflow-hidden relative">
        <div className="ticker-animation flex items-center gap-8 text-sm">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-yellow-400 transition-colors"
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: sentimentColor(article.sentimentLabel) }}
              />
              <span className="text-gray-300 text-xs">{article.title}</span>
              <span className="text-gray-600 text-xs">— {article.source}</span>
              <span className="text-gray-700">|</span>
            </a>
          ))}
          {/* Duplicate for seamless loop */}
          {articles.map((article) => (
            <a
              key={`dup-${article.id}`}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-yellow-400 transition-colors"
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: sentimentColor(article.sentimentLabel) }}
              />
              <span className="text-gray-300 text-xs">{article.title}</span>
              <span className="text-gray-600 text-xs">— {article.source}</span>
              <span className="text-gray-700">|</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
