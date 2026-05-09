"use client";

import { formatDistanceToNow } from "date-fns";

interface NewsArticle {
  id: number;
  title: string;
  source: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string | Date | null;
  summary: string | null;
  sentimentScore: number;
  sentimentLabel: string;
  category: string | null;
}

interface NewsCardProps {
  article: NewsArticle;
  compact?: boolean;
}

const categoryColors: Record<string, string> = {
  Leader: "#C8102E",
  Party: "#FFD700",
  MLA: "#3b82f6",
  Criminal: "#ef4444",
  Manifesto: "#10b981",
  General: "#6b7280",
};

export default function NewsCard({ article, compact = false }: NewsCardProps) {
  const publishedDate = article.publishedAt ? new Date(article.publishedAt) : null;
  const timeAgo = publishedDate ? formatDistanceToNow(publishedDate, { addSuffix: true }) : "Unknown";
  const categoryColor = categoryColors[article.category ?? "General"] ?? "#6b7280";

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden card-hover group"
    >
      {/* Image */}
      {article.imageUrl && !compact && (
        <div className="w-full h-40 overflow-hidden bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      <div className={compact ? "p-3" : "p-4"}>
        {/* Category & Sentiment */}
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: `${categoryColor}22`,
              color: categoryColor,
              border: `1px solid ${categoryColor}44`,
            }}
          >
            {article.category ?? "General"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              article.sentimentLabel === "Positive"
                ? "badge-positive"
                : article.sentimentLabel === "Negative"
                ? "badge-negative"
                : "badge-neutral"
            }`}
          >
            {article.sentimentLabel === "Positive" ? "😊" : article.sentimentLabel === "Negative" ? "😟" : "😐"}{" "}
            {article.sentimentLabel}
          </span>
        </div>

        {/* Title */}
        <h3
          className={`font-semibold text-white group-hover:text-red-400 transition-colors leading-snug line-clamp-2 mb-2 ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          {article.title}
        </h3>

        {/* Summary */}
        {!compact && article.summary && (
          <p className="text-xs text-gray-400 line-clamp-2 mb-3">{article.summary}</p>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span>📰</span>
            <span>{article.source ?? "Unknown"}</span>
          </span>
          <span>{timeAgo}</span>
        </div>

        {/* Sentiment bar */}
        {!compact && (
          <div className="mt-3">
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.abs(article.sentimentScore) * 100}%`,
                  background:
                    article.sentimentLabel === "Positive"
                      ? "#10b981"
                      : article.sentimentLabel === "Negative"
                      ? "#ef4444"
                      : "#6b7280",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </a>
  );
}
