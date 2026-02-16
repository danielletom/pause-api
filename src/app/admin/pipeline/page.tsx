"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Totals {
  total: number;
  draft: number;
  ready: number;
  published: number;
  withAudio: number;
  withBody: number;
}

interface ContentCount {
  contentType: string;
  status: string;
  count: number;
}

interface PipelineCount {
  stage: string;
  status: string;
  count: number;
}

interface RecentActivity {
  id: number;
  contentId: number;
  stage: string;
  status: string;
  tool: string | null;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface PipelineRecord {
  id: number;
  contentId: number;
  stage: string;
  status: string;
  tool: string | null;
  outputPath: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ContentItemWithPipeline {
  id: number;
  title: string;
  slug: string;
  contentType: string;
  format: string | null;
  status: string;
  category: string | null;
  programWeek: number | null;
  programDay: number | null;
  durationMinutes: number | null;
  audioUrl: string | null;
  bodyMarkdown: string | null;
  pipeline: PipelineRecord[];
}

interface OverviewData {
  totals: Totals;
  contentCounts: ContentCount[];
  pipelineCounts: PipelineCount[];
  recentActivity: RecentActivity[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const STAGES = ["research", "writing", "audio", "production", "publishing"] as const;

const STAGE_LABELS: Record<string, string> = {
  research: "Research",
  writing: "Writing",
  audio: "Audio Gen",
  production: "Post-Prod",
  publishing: "Publish",
};

const STAGE_ICONS: Record<string, string> = {
  research: "\uD83D\uDD2C",
  writing: "\u270D\uFE0F",
  audio: "\uD83C\uDFA4",
  production: "\uD83C\uDFDA\uFE0F",
  publishing: "\uD83D\uDE80",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-stone-100 text-stone-600",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  waiting_manual: "bg-purple-100 text-purple-700",
};

const CONTENT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  ready: "bg-indigo-100 text-indigo-700",
  published: "bg-emerald-100 text-emerald-700",
};

const TYPE_ICONS: Record<string, string> = {
  podcast: "\uD83C\uDFA7",
  lesson: "\uD83D\uDCDA",
  audio_lesson: "\uD83D\uDCDA",
  meditation: "\uD83E\uDDD8",
  affirmation: "\u2728",
  article: "\uD83D\uDCDD",
  guide: "\uD83D\uDCD6",
};

type ViewType = "overview" | "items";

// ── Main Component ───────────────────────────────────────────────────────────

export default function PipelineDashboard() {
  const [view, setView] = useState<ViewType>("overview");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [items, setItems] = useState<ContentItemWithPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterWeek, setFilterWeek] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected items for batch actions
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 4000);
  };

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pipeline?view=overview");
      if (res.ok) setOverview(await res.json());
    } catch {
      /* silent */
    }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams({ view: "items" });
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterWeek !== "all") params.set("week", filterWeek);
      const res = await fetch(`/api/admin/pipeline?${params}`);
      if (res.ok) setItems(await res.json());
    } catch {
      /* silent */
    }
  }, [filterType, filterStatus, filterWeek]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchOverview(), fetchItems()]).finally(() =>
      setLoading(false)
    );
  }, [fetchOverview, fetchItems]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const queueItem = async (contentId: number, stage?: string) => {
    try {
      const res = await fetch("/api/admin/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "queue", contentId, stage }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message);
        fetchItems();
        fetchOverview();
      }
    } catch {
      showMessage("Failed to queue item");
    }
  };

  const queueBatch = async (stage?: string) => {
    if (selected.size === 0) {
      showMessage("No items selected");
      return;
    }
    try {
      const res = await fetch("/api/admin/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "queue-batch",
          contentIds: Array.from(selected),
          stage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message);
        setSelected(new Set());
        fetchItems();
        fetchOverview();
      }
    } catch {
      showMessage("Failed to queue batch");
    }
  };

  const resetItem = async (contentId: number) => {
    if (!confirm(`Reset pipeline for content #${contentId}?`)) return;
    try {
      const res = await fetch("/api/admin/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", contentId }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message);
        fetchItems();
        fetchOverview();
      }
    } catch {
      showMessage("Failed to reset");
    }
  };

  // ── Filtered items ───────────────────────────────────────────────────────

  const filteredItems = items.filter((item) => {
    if (
      searchQuery &&
      !item.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  // ── Stage helpers ────────────────────────────────────────────────────────

  function getStageStatus(
    pipeline: PipelineRecord[],
    stage: string
  ): string | null {
    const record = pipeline.find((p) => p.stage === stage);
    return record?.status || null;
  }

  function getStageIndicator(status: string | null): string {
    if (!status) return "\u25CB"; // empty circle
    switch (status) {
      case "completed":
        return "\u2713";
      case "in_progress":
        return "\u25CF";
      case "failed":
        return "\u2717";
      case "pending":
        return "\u25D4";
      case "waiting_manual":
        return "\u25C6";
      default:
        return "\u25CB";
    }
  }

  function getStageColor(status: string | null): string {
    if (!status) return "text-stone-300";
    switch (status) {
      case "completed":
        return "text-emerald-500";
      case "in_progress":
        return "text-amber-500";
      case "failed":
        return "text-rose-500";
      case "pending":
        return "text-stone-400";
      case "waiting_manual":
        return "text-purple-500";
      default:
        return "text-stone-300";
    }
  }

  function getPipelineProgress(pipeline: PipelineRecord[]): number {
    if (pipeline.length === 0) return 0;
    const completed = pipeline.filter((p) => p.status === "completed").length;
    return Math.round((completed / 5) * 100);
  }

  // Aggregate stage counts from pipelineCounts
  function getStageSummary(stage: string) {
    if (!overview) return { completed: 0, inProgress: 0, pending: 0, failed: 0, total: 0 };
    const records = overview.pipelineCounts.filter((p) => p.stage === stage);
    const completed = records.find((r) => r.status === "completed")?.count || 0;
    const inProgress = records.find((r) => r.status === "in_progress")?.count || 0;
    const pending = records.find((r) => r.status === "pending")?.count || 0;
    const failed = records.find((r) => r.status === "failed")?.count || 0;
    return { completed, inProgress, pending, failed, total: completed + inProgress + pending + failed };
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-lg">Loading pipeline...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Toast */}
      {message && (
        <div className="fixed top-4 right-4 z-50 bg-stone-800 text-white px-4 py-2 rounded-xl shadow-lg text-sm">
          {message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <a
                href="/admin"
                className="text-stone-400 hover:text-stone-600 text-sm"
              >
                &larr; CMS
              </a>
              <h1 className="text-2xl font-semibold text-stone-800">
                Content Pipeline
              </h1>
            </div>
            <p className="text-sm text-stone-500">
              Multi-agent production pipeline &mdash; research, write, record,
              produce, publish
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("overview")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === "overview"
                  ? "bg-stone-800 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setView("items")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === "items"
                  ? "bg-stone-800 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              Items
            </button>
            <button
              onClick={() => {
                fetchOverview();
                fetchItems();
                showMessage("Refreshed");
              }}
              className="ml-2 px-3 py-2 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* ── Overview View ────────────────────────────────────────────────── */}
        {view === "overview" && overview && (
          <div className="space-y-6">
            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard
                label="Total Content"
                value={overview.totals.total}
                color="stone"
              />
              <StatCard
                label="Draft"
                value={overview.totals.draft}
                color="amber"
              />
              <StatCard
                label="Ready"
                value={overview.totals.ready}
                color="indigo"
              />
              <StatCard
                label="Published"
                value={overview.totals.published}
                color="emerald"
              />
              <StatCard
                label="Has Audio"
                value={overview.totals.withAudio}
                color="pink"
              />
              <StatCard
                label="Has Body"
                value={overview.totals.withBody}
                color="teal"
              />
            </div>

            {/* Content by Type */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="text-lg font-semibold text-stone-800 mb-4">
                Content by Type
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(
                  overview.contentCounts.reduce(
                    (acc, c) => {
                      if (!acc[c.contentType])
                        acc[c.contentType] = { total: 0, draft: 0, ready: 0, published: 0 };
                      acc[c.contentType].total += c.count;
                      if (c.status === "draft")
                        acc[c.contentType].draft += c.count;
                      if (c.status === "ready")
                        acc[c.contentType].ready += c.count;
                      if (c.status === "published")
                        acc[c.contentType].published += c.count;
                      return acc;
                    },
                    {} as Record<string, { total: number; draft: number; ready: number; published: number }>
                  )
                ).map(([type, counts]) => (
                  <div
                    key={type}
                    className="bg-stone-50 rounded-lg p-4 text-center"
                  >
                    <div className="text-2xl mb-1">
                      {TYPE_ICONS[type] || "\uD83D\uDCC4"}
                    </div>
                    <div className="text-sm font-medium text-stone-700 capitalize">
                      {type.replace("_", " ")}
                    </div>
                    <div className="text-2xl font-bold text-stone-800 mt-1">
                      {counts.total}
                    </div>
                    <div className="flex justify-center gap-2 mt-2 text-xs">
                      {counts.draft > 0 && (
                        <span className="text-amber-600">
                          {counts.draft} draft
                        </span>
                      )}
                      {counts.ready > 0 && (
                        <span className="text-indigo-600">
                          {counts.ready} ready
                        </span>
                      )}
                      {counts.published > 0 && (
                        <span className="text-emerald-600">
                          {counts.published} pub
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline Stage Progress */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="text-lg font-semibold text-stone-800 mb-4">
                Pipeline Stages
              </h2>
              <div className="grid grid-cols-5 gap-4">
                {STAGES.map((stage) => {
                  const summary = getStageSummary(stage);
                  const pct =
                    summary.total > 0
                      ? Math.round(
                          (summary.completed / overview.totals.total) * 100
                        )
                      : 0;
                  return (
                    <div
                      key={stage}
                      className="bg-stone-50 rounded-lg p-4 text-center"
                    >
                      <div className="text-2xl mb-1">
                        {STAGE_ICONS[stage]}
                      </div>
                      <div className="text-sm font-medium text-stone-700">
                        {STAGE_LABELS[stage]}
                      </div>
                      <div className="mt-3 h-2 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-stone-500 mt-2">
                        {summary.completed} / {overview.totals.total} done
                      </div>
                      <div className="flex justify-center gap-2 mt-1 text-xs">
                        {summary.inProgress > 0 && (
                          <span className="text-amber-500">
                            {summary.inProgress} running
                          </span>
                        )}
                        {summary.pending > 0 && (
                          <span className="text-stone-400">
                            {summary.pending} queued
                          </span>
                        )}
                        {summary.failed > 0 && (
                          <span className="text-rose-500">
                            {summary.failed} failed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="text-lg font-semibold text-stone-800 mb-4">
                Recent Activity
              </h2>
              {overview.recentActivity.length === 0 ? (
                <div className="text-center py-8 text-stone-400">
                  No pipeline activity yet. Queue items to start processing.
                </div>
              ) : (
                <div className="space-y-2">
                  {overview.recentActivity.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50"
                    >
                      <span className="text-lg">
                        {STAGE_ICONS[a.stage] || "\u25CF"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] || "bg-stone-100 text-stone-600"}`}
                      >
                        {a.status}
                      </span>
                      <span className="text-sm text-stone-700 font-medium">
                        #{a.contentId}
                      </span>
                      <span className="text-sm text-stone-500">
                        {STAGE_LABELS[a.stage] || a.stage}
                      </span>
                      {a.tool && (
                        <span className="text-xs text-stone-400">
                          via {a.tool}
                        </span>
                      )}
                      {a.errorMessage && (
                        <span className="text-xs text-rose-500 truncate max-w-xs">
                          {a.errorMessage}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-stone-400">
                        {new Date(a.createdAt).toLocaleDateString()}{" "}
                        {new Date(a.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CLI Reference */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="text-lg font-semibold text-stone-800 mb-3">
                CLI Commands
              </h2>
              <p className="text-sm text-stone-500 mb-4">
                Run pipeline stages from the terminal. The dashboard queues
                work; the CLI executes it.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    cmd: "npx tsx --env-file=.env.local scripts/pipeline/index.ts status",
                    desc: "View pipeline status",
                  },
                  {
                    cmd: "npx tsx --env-file=.env.local scripts/pipeline/index.ts run --id 42",
                    desc: "Full pipeline for one item",
                  },
                  {
                    cmd: "npx tsx --env-file=.env.local scripts/pipeline/index.ts batch --type article",
                    desc: "All articles at once",
                  },
                  {
                    cmd: "npx tsx --env-file=.env.local scripts/pipeline/index.ts batch --week 1",
                    desc: "All Week 1 content",
                  },
                ].map(({ cmd, desc }) => (
                  <div key={cmd} className="bg-stone-50 rounded-lg p-3">
                    <div className="text-xs text-stone-500 mb-1">{desc}</div>
                    <code className="text-xs text-stone-700 font-mono break-all">
                      {cmd}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Items View ───────────────────────────────────────────────────── */}
        {view === "items" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Search by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-stone-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                >
                  <option value="all">All Types</option>
                  <option value="podcast">Podcast</option>
                  <option value="lesson">Lesson</option>
                  <option value="audio_lesson">Audio Lesson</option>
                  <option value="meditation">Meditation</option>
                  <option value="affirmation">Affirmation</option>
                  <option value="article">Article</option>
                  <option value="guide">Guide</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                  <option value="published">Published</option>
                </select>
                <select
                  value={filterWeek}
                  onChange={(e) => setFilterWeek(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                >
                  <option value="all">All Weeks</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
                    <option key={w} value={String(w)}>
                      Week {w}
                    </option>
                  ))}
                </select>

                <div className="ml-auto flex items-center gap-2">
                  {selected.size > 0 && (
                    <>
                      <span className="text-sm text-stone-500">
                        {selected.size} selected
                      </span>
                      <button
                        onClick={() => queueBatch()}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                      >
                        Queue All Stages
                      </button>
                      <button
                        onClick={() => queueBatch("research")}
                        className="px-3 py-1.5 bg-stone-600 text-white rounded-lg text-sm hover:bg-stone-700"
                      >
                        Queue Research
                      </button>
                      <button
                        onClick={() => setSelected(new Set())}
                        className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-sm hover:bg-stone-200"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="text-left px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={
                          filteredItems.length > 0 &&
                          selected.size === filteredItems.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelected(
                              new Set(filteredItems.map((i) => i.id))
                            );
                          } else {
                            setSelected(new Set());
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-stone-500 font-medium">
                      ID
                    </th>
                    <th className="text-left px-4 py-3 text-stone-500 font-medium">
                      Title
                    </th>
                    <th className="text-left px-4 py-3 text-stone-500 font-medium">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 text-stone-500 font-medium">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-stone-500 font-medium">
                      Wk
                    </th>
                    <th className="text-center px-2 py-3 text-stone-500 font-medium">
                      {STAGE_ICONS.research}
                    </th>
                    <th className="text-center px-2 py-3 text-stone-500 font-medium">
                      {STAGE_ICONS.writing}
                    </th>
                    <th className="text-center px-2 py-3 text-stone-500 font-medium">
                      {STAGE_ICONS.audio}
                    </th>
                    <th className="text-center px-2 py-3 text-stone-500 font-medium">
                      {STAGE_ICONS.production}
                    </th>
                    <th className="text-center px-2 py-3 text-stone-500 font-medium">
                      {STAGE_ICONS.publishing}
                    </th>
                    <th className="text-center px-4 py-3 text-stone-500 font-medium">
                      Progress
                    </th>
                    <th className="text-right px-4 py-3 text-stone-500 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const progress = getPipelineProgress(item.pipeline);
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-stone-100 hover:bg-stone-50"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={(e) => {
                              const next = new Set(selected);
                              if (e.target.checked) next.add(item.id);
                              else next.delete(item.id);
                              setSelected(next);
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3 text-stone-400 font-mono text-xs">
                          {item.id}
                        </td>
                        <td className="px-4 py-3 text-stone-800 font-medium max-w-xs truncate">
                          {item.title}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">
                            {TYPE_ICONS[item.contentType] || ""}{" "}
                            <span className="text-stone-600 capitalize">
                              {item.contentType.replace("_", " ")}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONTENT_STATUS_COLORS[item.status] || "bg-stone-100 text-stone-600"}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-500 text-xs">
                          {item.programWeek || "-"}
                        </td>
                        {STAGES.map((stage) => {
                          const st = getStageStatus(item.pipeline, stage);
                          return (
                            <td
                              key={stage}
                              className={`text-center px-2 py-3 text-lg ${getStageColor(st)}`}
                              title={`${STAGE_LABELS[stage]}: ${st || "not started"}`}
                            >
                              {getStageIndicator(st)}
                            </td>
                          );
                        })}
                        <td className="text-center px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-stone-400 w-8 text-right">
                              {progress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => queueItem(item.id)}
                              className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs hover:bg-indigo-100"
                              title="Queue all stages"
                            >
                              Queue
                            </button>
                            <button
                              onClick={() => resetItem(item.id)}
                              className="px-2 py-1 bg-stone-50 text-stone-500 rounded text-xs hover:bg-stone-100"
                              title="Reset pipeline"
                            >
                              Reset
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredItems.length === 0 && (
                <div className="text-center py-12 text-stone-400">
                  No items match your filters.
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-stone-500 px-2">
              <span>
                <span className="text-emerald-500">{"\u2713"}</span> Completed
              </span>
              <span>
                <span className="text-amber-500">{"\u25CF"}</span> In Progress
              </span>
              <span>
                <span className="text-stone-400">{"\u25D4"}</span> Pending
              </span>
              <span>
                <span className="text-rose-500">{"\u2717"}</span> Failed
              </span>
              <span>
                <span className="text-purple-500">{"\u25C6"}</span> Waiting
                Manual
              </span>
              <span>
                <span className="text-stone-300">{"\u25CB"}</span> Not Started
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

const STAT_CARD_COLORS: Record<string, { bg: string; text: string; bold: string }> = {
  stone: { bg: "bg-stone-50", text: "text-stone-600", bold: "text-stone-800" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", bold: "text-amber-800" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", bold: "text-indigo-800" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", bold: "text-emerald-800" },
  pink: { bg: "bg-pink-50", text: "text-pink-600", bold: "text-pink-800" },
  teal: { bg: "bg-teal-50", text: "text-teal-600", bold: "text-teal-800" },
};

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const c = STAT_CARD_COLORS[color] || STAT_CARD_COLORS.stone;

  return (
    <div className={`${c.bg} rounded-xl p-4`}>
      <div className={`text-xs font-medium ${c.text} mb-1`}>{label}</div>
      <div className={`text-2xl font-bold ${c.bold}`}>{value}</div>
    </div>
  );
}
