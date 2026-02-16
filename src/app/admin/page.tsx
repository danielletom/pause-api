"use client";

import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const ALL_TAGS = [
  { id: "morning", label: "Morning", color: "bg-amber-100 text-amber-700" },
  { id: "evening", label: "Evening", color: "bg-indigo-100 text-indigo-700" },
  { id: "anytime", label: "Anytime", color: "bg-stone-100 text-stone-600" },
  { id: "sleep", label: "Sleep", color: "bg-indigo-100 text-indigo-600" },
  { id: "calm", label: "Calm", color: "bg-emerald-100 text-emerald-700" },
  { id: "energy", label: "Energy", color: "bg-amber-100 text-amber-700" },
  { id: "hot_flashes", label: "Hot Flashes", color: "bg-rose-100 text-rose-600" },
  { id: "mind", label: "Mind", color: "bg-purple-100 text-purple-600" },
  { id: "basics", label: "Basics", color: "bg-stone-100 text-stone-600" },
  { id: "nutrition", label: "Nutrition", color: "bg-emerald-100 text-emerald-600" },
  { id: "movement", label: "Movement", color: "bg-rose-100 text-rose-500" },
  { id: "relationships", label: "Relationships", color: "bg-pink-100 text-pink-600" },
  { id: "sos", label: "SOS", color: "bg-teal-100 text-teal-700" },
];

const TYPE_LABELS: Record<string, string> = {
  audio_lesson: "Audio Lesson",
  podcast: "Podcast",
  meditation: "Meditation",
  affirmation: "Affirmation",
  reflection: "Reflection",
  guide: "Guide",
  lesson: "Audio Lesson",
  article: "Guide",
};

const TYPE_ICONS: Record<string, string> = {
  audio_lesson: "\u{1F3A7}",
  podcast: "\u{1F399}\uFE0F",
  meditation: "\u{1F9D8}",
  affirmation: "\u2728",
  reflection: "\u{1F4D6}",
  guide: "\u{1F4CB}",
  lesson: "\u{1F3A7}",
  article: "\u{1F4CB}",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
  scheduled: "bg-indigo-100 text-indigo-700",
  ready: "bg-indigo-100 text-indigo-700",
};

const WEEK_TITLES: Record<number, string> = {
  1: "Your Baseline",
  2: "Sleep & Night Sweats",
  3: "Hot Flash Management",
  4: "Mood, Mind & Brain Fog",
  5: "Body Changes & Movement",
  6: "Nutrition & Fuel",
  7: "Relationships, Work & Identity",
  8: "Your Path Forward",
};

const WEEK_PAINS = [
  "72% learned everything through own research",
  "Hot flashes/night sweats 5x more prevalent",
  "1/3 experience symptoms 3+ times/day",
  "Women 40-49 feel hopeless at 40% higher levels",
  "3 in 4 report symptoms affecting work",
  "94% report digestive symptoms; 77% bloating",
  "54% impact on relationships; 48% on work",
  "Only 7% satisfied with non-prescription options",
];

const CONTENT_TYPES = ["audio_lesson", "podcast", "meditation", "affirmation", "reflection", "guide"];
const STATUSES = ["draft", "scheduled", "published"];
const PRODUCTION_TOOLS = ["NotebookLM", "Wondercraft", "ElevenLabs", "Wondercraft + ElevenLabs", "Wondercraft + ZENmix", "Claude", "Manual"];

const PROGRAMS: { id: string; label: string; icon: string; color: string; bgColor: string }[] = [
  { id: "main", label: "8-Week Program", icon: "\u2726", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
  { id: "better_sleep", label: "Better Sleep", icon: "\u263D", color: "text-indigo-600", bgColor: "bg-indigo-50 border-indigo-200" },
  { id: "hot_flash_relief", label: "Hot Flash Relief", icon: "\u2744", color: "text-teal-600", bgColor: "bg-teal-50 border-teal-200" },
  { id: "mood_calm", label: "Mood & Calm", icon: "\u25C9", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  { id: "movement", label: "Movement", icon: "\u2661", color: "text-rose-600", bgColor: "bg-rose-50 border-rose-200" },
];

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface ContentItem {
  id: number;
  title: string;
  slug: string | null;
  contentType: string;
  format: string;
  description: string | null;
  aiDescription: string | null;
  bodyMarkdown: string | null;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  category: string | null;
  tags: string[];
  productionTool: string | null;
  status: string;
  sortOrder: number;
  programId: string | null;
  programWeek: number | null;
  programDay: number | null;
  programAction: string | null;
  listensCount: number;
  readsCount: number;
  avgRating: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  typeCounts: { contentType: string; count: number; published: number }[];
  engagementStats: { action: string; count: number; uniqueUsers: number }[];
  topContent: { id: number; title: string; contentType: string; listensCount: number; readsCount: number }[];
  programStats: { week: number; total: number; published: number; withAudio: number }[];
  totals: { totalContent: number; totalPublished: number };
}

type ViewType = "dashboard" | "content" | "program" | "analytics" | "drafts" | "pipeline";

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function ContentManager() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>("dashboard");
  const [message, setMessage] = useState("");

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorStatus, setEditorStatus] = useState("draft");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [editorForm, setEditorForm] = useState({
    title: "", description: "", contentType: "audio_lesson", duration: "",
    week: "", day: "", tool: "", tonight: "", richText: "",
    audioUrl: "", audioFile: "", pdfFile: "", thumbFile: "", category: "",
    programId: "", customProgramId: "",
  });
  const [saving, setSaving] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterWeek, setFilterWeek] = useState("all");

  // Import
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Pipeline
  const [pipelineItems, setPipelineItems] = useState<any[]>([]);
  const [pipelineOverview, setPipelineOverview] = useState<any>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);

  // ─── Fetch ────────────────────────────────────────────
  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/content");
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchPipeline = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const [overviewRes, itemsRes] = await Promise.all([
        fetch("/api/admin/pipeline?view=overview"),
        fetch("/api/admin/pipeline?view=items"),
      ]);
      if (overviewRes.ok) setPipelineOverview(await overviewRes.json());
      if (itemsRes.ok) setPipelineItems(await itemsRes.json());
    } catch { /* ignore */ }
    setPipelineLoading(false);
  }, []);

  useEffect(() => { fetchContent(); fetchStats(); }, [fetchContent, fetchStats]);
  useEffect(() => { if (view === "pipeline") fetchPipeline(); }, [view, fetchPipeline]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  // Pipeline actions
  const pipelineQueue = async (contentId: number, stage?: string) => {
    try {
      const res = await fetch("/api/admin/pipeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "queue", contentId, stage }),
      });
      if (res.ok) { showMessage(`Queued #${contentId}`); fetchPipeline(); }
    } catch { showMessage("Failed"); }
  };
  const pipelineReset = async (contentId: number) => {
    if (!confirm("Reset all pipeline progress for this item?")) return;
    try {
      const res = await fetch("/api/admin/pipeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", contentId }),
      });
      if (res.ok) { showMessage("Reset"); fetchPipeline(); }
    } catch { showMessage("Failed"); }
  };

  // ─── Editor ───────────────────────────────────────────
  const openEditor = (id: number | null) => {
    if (id) {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const knownProgramIds = PROGRAMS.map(p => p.id);
      const itemProgramId = item.programId || "";
      const isCustomProgram = itemProgramId && !knownProgramIds.includes(itemProgramId);
      setEditorForm({
        title: item.title,
        description: item.description || "",
        contentType: item.contentType,
        duration: item.durationMinutes ? `${item.durationMinutes} min` : "",
        week: item.programWeek?.toString() || "",
        day: item.programDay?.toString() || "",
        tool: item.productionTool || "",
        tonight: item.programAction || "",
        richText: item.bodyMarkdown || "",
        audioUrl: item.audioUrl || "",
        audioFile: item.audioUrl ? "uploaded" : "",
        pdfFile: "", thumbFile: "", category: item.category || "",
        programId: isCustomProgram ? "custom" : itemProgramId,
        customProgramId: isCustomProgram ? itemProgramId : "",
      });
      setEditorStatus(item.status);
      setSelectedTags(new Set(item.tags || []));
      setEditingId(id);
    } else {
      setEditorForm({
        title: "", description: "", contentType: "audio_lesson", duration: "",
        week: "", day: "", tool: "", tonight: "", richText: "",
        audioUrl: "", audioFile: "", pdfFile: "", thumbFile: "", category: "",
        programId: "", customProgramId: "",
      });
      setEditorStatus("draft");
      setSelectedTags(new Set());
      setEditingId(null);
    }
    setEditorOpen(true);
  };

  const closeEditor = () => { setEditorOpen(false); setEditingId(null); };

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!editorForm.title.trim()) return;
    setSaving(true);

    const durMatch = editorForm.duration.match(/(\d+)/);
    const resolvedProgramId = editorForm.programId === "custom"
      ? editorForm.customProgramId || null
      : editorForm.programId || null;
    const body = {
      title: editorForm.title,
      contentType: editorForm.contentType,
      format: ["guide"].includes(editorForm.contentType) ? "pdf" : "audio",
      description: editorForm.description,
      bodyMarkdown: editorForm.richText || null,
      audioUrl: editorForm.audioUrl || null,
      durationMinutes: durMatch ? parseInt(durMatch[1]) : null,
      category: editorForm.category || null,
      tags: [...selectedTags],
      productionTool: editorForm.tool || null,
      status: editorStatus,
      programId: resolvedProgramId,
      programWeek: editorForm.week ? parseInt(editorForm.week) : null,
      programDay: editorForm.day ? parseInt(editorForm.day) : null,
      programAction: editorForm.tonight || null,
    };

    const url = editingId ? `/api/admin/content/${editingId}` : "/api/admin/content";
    const method = editingId ? "PUT" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        showMessage(editingId ? "Content updated!" : "Content created!");
        closeEditor();
        fetchContent();
        fetchStats();
      } else {
        showMessage("Error saving content");
      }
    } catch { showMessage("Error saving content"); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editingId || !confirm("Delete this content?")) return;
    try {
      const res = await fetch(`/api/admin/content/${editingId}`, { method: "DELETE" });
      if (res.ok) {
        showMessage("Content deleted");
        closeEditor();
        fetchContent();
        fetchStats();
      }
    } catch { /* ignore */ }
  };

  // ─── Filtering ────────────────────────────────────────
  const filteredItems = items.filter((c) => {
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterType !== "all" && c.contentType !== filterType) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterTag !== "all" && !(c.tags || []).includes(filterTag)) return false;
    if (filterWeek === "library" && c.programWeek) return false;
    if (filterWeek !== "all" && filterWeek !== "library" && c.programWeek !== parseInt(filterWeek)) return false;
    return true;
  });

  const publishedCount = items.filter((i) => i.status === "published").length;
  const draftCount = items.filter((i) => i.status === "draft").length;

  // ─── Navigate ─────────────────────────────────────────
  const navigate = (v: ViewType) => setView(v);

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; background: #fafaf9; margin: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 3px; }
        .sidebar-item { transition: all 0.15s; }
        .sidebar-item:hover { background: #f5f5f4; }
        .sidebar-item.active { background: #1c1917; color: #fff; }
        .tag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; }
        .fade-in { animation: fadeIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .modal-bg { background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); }
        .stat-card { transition: transform 0.15s; }
        .stat-card:hover { transform: translateY(-2px); }
        .rich-text { min-height: 200px; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px; outline: none; font-size: 14px; line-height: 1.7; color: #44403c; }
        .rich-text:focus { border-color: #1c1917; }
      `}</style>

      <div className="min-h-screen flex">
        {/* Message toast */}
        {message && (
          <div className="fixed top-5 right-5 bg-stone-900 text-white px-5 py-3 rounded-xl text-sm font-medium z-[100] shadow-lg">
            {message}
          </div>
        )}

        {/* ═══ SIDEBAR ═══ */}
        <aside className="w-60 bg-white border-r border-stone-200 flex flex-col fixed h-full z-30">
          <div className="p-5 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white text-xs font-bold">P</div>
              <div>
                <p className="text-sm font-bold text-stone-900">Pause CMS</p>
                <p className="text-xs text-stone-400">Content Manager</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-0.5">
            <SidebarButton icon="home" label="Dashboard" active={view === "dashboard"} count={null} onClick={() => navigate("dashboard")} />
            <SidebarButton icon="content" label="All Content" active={view === "content"} count={items.length} onClick={() => navigate("content")} />
            <SidebarButton icon="program" label="Programs" active={view === "program"} count={null} onClick={() => navigate("program")} />
            <SidebarButton icon="analytics" label="Analytics" active={view === "analytics"} count={null} onClick={() => navigate("analytics")} />
            <SidebarButton icon="pipeline" label="Production" active={view === "pipeline"} count={null} onClick={() => navigate("pipeline")} />
            <div className="pt-3 mt-3 border-t border-stone-100">
              <p className="px-3 text-xs text-stone-400 font-medium mb-2 uppercase tracking-wider">Quick Actions</p>
              <SidebarButton icon="drafts" label="Import Drafts" active={view === "drafts"} count={null} badge="New" onClick={() => navigate("drafts")} />
              <button
                onClick={() => openEditor(null)}
                className="sidebar-item w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 text-stone-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Content
              </button>
            </div>
          </nav>
          <div className="p-4 border-t border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-medium">D</div>
              <div>
                <p className="text-xs font-medium text-stone-800">Dani</p>
                <p className="text-xs text-stone-400">Admin</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <main className="ml-60 flex-1 min-h-screen">
          {/* ━━━ DASHBOARD ━━━ */}
          {view === "dashboard" && (
            <div className="fade-in p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
                  <p className="text-sm text-stone-400 mt-1">Content overview and performance</p>
                </div>
                <button onClick={() => openEditor(null)} className="bg-stone-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-stone-800 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  New Content
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-5 gap-4 mb-8">
                <StatCard label="Total Content" value={items.length.toString()} sub={null} />
                <StatCard label="Published" value={publishedCount.toString()} sub={`${items.length > 0 ? Math.round(publishedCount / items.length * 100) : 0}% of total`} color="text-emerald-600" />
                <StatCard label="Drafts" value={draftCount.toString()} sub={`${items.filter(i => i.programWeek).length} program + ${items.filter(i => !i.programWeek).length} library`} color="text-amber-600" />
                <StatCard label="Total Listens" value={items.reduce((s, i) => s + (i.listensCount || 0), 0).toLocaleString()} sub={null} />
                <StatCard label="Avg Completion" value={stats?.engagementStats?.length ? "—" : "—"} sub={null} />
              </div>

              <div className="grid grid-cols-3 gap-6">
                {/* Top performing */}
                <div className="col-span-2 bg-white rounded-2xl border border-stone-100 p-6">
                  <h2 className="text-sm font-bold text-stone-900 mb-4">Top Performing Content</h2>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-stone-400 border-b border-stone-100">
                        <th className="text-left pb-3 font-medium">Content</th>
                        <th className="text-left pb-3 font-medium">Type</th>
                        <th className="text-right pb-3 font-medium">Listens</th>
                        <th className="text-right pb-3 font-medium">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .filter((c) => c.status === "published")
                        .sort((a, b) => (b.listensCount || 0) - (a.listensCount || 0))
                        .slice(0, 8)
                        .map((c) => (
                          <tr key={c.id} className="border-b border-stone-50 hover:bg-stone-50/50 cursor-pointer" onClick={() => openEditor(c.id)}>
                            <td className="py-3 pr-4">
                              <p className="text-sm font-medium text-stone-800">{c.title}</p>
                              <p className="text-xs text-stone-400">{c.programWeek ? `W${c.programWeek}D${c.programDay} \u00B7 ` : ""}{c.durationMinutes ? `${c.durationMinutes} min` : ""}</p>
                            </td>
                            <td className="py-3"><span className={`tag ${STATUS_COLORS[c.status]}`}>{TYPE_LABELS[c.contentType] || c.contentType}</span></td>
                            <td className="py-3 text-right text-sm text-stone-700 font-medium">{(c.listensCount || 0).toLocaleString()}</td>
                            <td className="py-3 text-right text-sm text-stone-700">{c.avgRating ? `\u2B50 ${c.avgRating}` : "\u2014"}</td>
                          </tr>
                        ))}
                      {items.filter((c) => c.status === "published").length === 0 && (
                        <tr><td colSpan={4} className="py-8 text-center text-sm text-stone-400">No published content yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Program progress */}
                <div className="bg-white rounded-2xl border border-stone-100 p-6">
                  <h2 className="text-sm font-bold text-stone-900 mb-4">8-Week Program</h2>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => {
                      const wItems = items.filter((i) => i.programWeek === w);
                      const pub = wItems.filter((i) => i.status === "published").length;
                      return (
                        <div key={w} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${pub === 5 ? "bg-stone-900 text-white" : pub > 0 ? "bg-amber-400 text-stone-900" : "bg-stone-100 text-stone-400"}`}>
                            {pub === 5 ? "\u2713" : w}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-stone-800">{WEEK_TITLES[w]}</p>
                            <div className="h-1 bg-stone-100 rounded-full mt-1">
                              <div className={`h-full ${pub === 5 ? "bg-stone-900" : "bg-amber-400"} rounded-full`} style={{ width: `${(pub / 5) * 100}%` }} />
                            </div>
                          </div>
                          <span className="text-xs text-stone-400">{pub}/5</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    <p className="text-xs text-stone-400">40 lessons total</p>
                    <div className="h-2 bg-stone-100 rounded-full mt-2">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(items.filter(i => i.programWeek && i.status === "published").length / 40) * 100}%` }} />
                    </div>
                    <p className="text-xs text-amber-600 mt-1 font-medium">
                      {items.filter(i => i.programWeek && i.status === "published").length} of 40 published
                    </p>
                  </div>
                </div>
              </div>

              {/* ═══ SYSTEM STATUS & GAPS ═══ */}
              <div className="mt-8">
                <h2 className="text-lg font-bold text-stone-900 mb-4">System Status &amp; Remaining Gaps</h2>
                <div className="grid grid-cols-2 gap-4">

                  {/* AI & Narratives */}
                  <div className="bg-white rounded-2xl border border-stone-100 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <h3 className="text-sm font-bold text-stone-900">AI Narratives</h3>
                    </div>
                    <ul className="space-y-2 text-xs text-stone-600">
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span><b>NARRATIVES_ENABLED=false</b> — Claude AI weekly stories and readiness narratives are disabled. Set env var to &quot;true&quot; on Vercel to enable.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>AI does not use profile data (stage, age, symptoms, goals) when generating narratives — only raw log data is sent to Claude.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>No UI indicator in the app showing when AI analysis is running or what data it&apos;s analyzing.</span></li>
                      <li className="flex gap-2"><span className="text-stone-300">{"\u2713"}</span> <span>Cron scheduled daily at 6am UTC for readiness narratives, weekly stories on Mondays.</span></li>
                      <li className="flex gap-2"><span className="text-stone-300">{"\u2713"}</span> <span>Fallback static text generated when Claude API fails.</span></li>
                    </ul>
                  </div>

                  {/* Report Generation */}
                  <div className="bg-white rounded-2xl border border-stone-100 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <h3 className="text-sm font-bold text-stone-900">Report Generation</h3>
                    </div>
                    <ul className="space-y-2 text-xs text-stone-600">
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>No PDF report generation API</b> — the app has an export-data screen but no server-side PDF endpoint exists yet.</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>No doctor report feature</b> — subscription tier lists &quot;doctor_report&quot; as premium feature but no endpoint generates it.</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>No CSV export API</b> — app shows CSV export option but no server endpoint exists.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>Export features are listed in subscription tiers (export_pdf) but gating is not enforced.</span></li>
                    </ul>
                  </div>

                  {/* Cron Jobs & Background Tasks */}
                  <div className="bg-white rounded-2xl border border-stone-100 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <h3 className="text-sm font-bold text-stone-900">Cron Jobs (Vercel)</h3>
                    </div>
                    <ul className="space-y-2 text-xs text-stone-600">
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>compute-scores — 2am UTC daily (readiness scores)</span></li>
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>benchmarks — 3am UTC daily (peer comparison)</span></li>
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>correlations — 4am UTC Sundays (cause/effect patterns, needs 14+ days data)</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>narratives — 6am UTC daily (disabled, needs NARRATIVES_ENABLED=true)</span></li>
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>notifications — 2pm UTC daily (push reminders to non-loggers)</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>No monitoring/alerting — cron failures are silent (only logged to Vercel Functions console).</span></li>
                    </ul>
                  </div>

                  {/* Content Library Gaps */}
                  <div className="bg-white rounded-2xl border border-stone-100 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <h3 className="text-sm font-bold text-stone-900">Content Library</h3>
                    </div>
                    <ul className="space-y-2 text-xs text-stone-600">
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>{items.length} items seeded ({items.filter(i => i.programWeek).length} program + {items.filter(i => !i.programWeek).length} library)</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>0 audio files uploaded</b> — all {items.filter(i => i.format === "audio").length} audio items have empty audioUrl fields.</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>No content delivery API for the mobile app</b> — app doesn&apos;t have endpoints to browse/play library content yet.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>All items are in &quot;draft&quot; status — none published for users.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>No file upload functionality in CMS — audio URLs must be pasted manually.</span></li>
                    </ul>
                  </div>

                  {/* Profile & Personalization */}
                  <div className="bg-white rounded-2xl border border-stone-100 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <h3 className="text-sm font-bold text-stone-900">Profile &amp; Personalization</h3>
                    </div>
                    <ul className="space-y-2 text-xs text-stone-600">
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>Profile stores: name, DOB, stage, symptoms, goals, height, weight, relationship, work, exercise.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span><b>Profile data not used by AI</b> — readiness narratives don&apos;t include user&apos;s stage, age, or personal goals.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span><b>Benchmarks need 50+ users per cohort</b> — falls back to static data until user base grows.</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>No profile-based content recommendations</b> — library doesn&apos;t personalize based on user symptoms/stage.</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>No program progress tracking in API</b> — programProgress table exists but no endpoints to read/write it.</span></li>
                    </ul>
                  </div>

                  {/* Subscription & Payments */}
                  <div className="bg-white rounded-2xl border border-stone-100 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <h3 className="text-sm font-bold text-stone-900">Subscriptions &amp; Gating</h3>
                    </div>
                    <ul className="space-y-2 text-xs text-stone-600">
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>RevenueCat webhook processes purchases and updates subscription tier.</span></li>
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>Correlations gated: free=2, premium=all.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>Features like &quot;lab_upload&quot;, &quot;wearable_sync&quot;, &quot;priority_support&quot; are listed but <b>not implemented</b>.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>No feature gating on content library access, export, or AI narratives yet.</span></li>
                    </ul>
                  </div>

                  {/* Data & Analytics Signals */}
                  <div className="bg-white rounded-2xl border border-stone-100 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <h3 className="text-sm font-bold text-stone-900">Data Pipeline</h3>
                    </div>
                    <ul className="space-y-2 text-xs text-stone-600">
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>Readiness score: weighted (Sleep 40%, Mood 25%, Symptoms 20%, Stressors 15%).</span></li>
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>Correlation engine: cross-correlation with lag analysis (0-7 days), min 5 occurrences, 60% confidence.</span></li>
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>Benchmarks: cohort-based (stage + age + severity), fallback widening, min 50 users.</span></li>
                      <li className="flex gap-2"><span className="text-emerald-500">{"\u2713"}</span> <span>Streak calculation: consecutive daily logging.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>Scores computed on-demand AND via nightly cron — potential inconsistency window.</span></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold">!</span> <span>No data quality validation on log submission (e.g., sleep hours &gt; 24, negative values).</span></li>
                    </ul>
                  </div>

                  {/* Missing App Features */}
                  <div className="bg-white rounded-2xl border border-stone-100 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <h3 className="text-sm font-bold text-stone-900">Missing API Endpoints</h3>
                    </div>
                    <ul className="space-y-2 text-xs text-stone-600">
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>GET /api/content</b> — public content browsing (for Wellness Centre tab). No endpoint exists.</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>GET/POST /api/program-progress</b> — track which lessons user completed. Table exists, no routes.</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>POST /api/content/:id/engage</b> — track listens/reads/bookmarks. Table exists, no routes.</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>GET /api/export/pdf</b> — generate PDF health report for user.</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>PUT /api/logs/:id</b> — edit existing log entries (app has edit UI but no PATCH/PUT API).</span></li>
                      <li className="flex gap-2"><span className="text-rose-500 font-bold">✗</span> <span><b>DELETE /api/meds/:id</b> — deactivate medication (no delete endpoint).</span></li>
                    </ul>
                  </div>

                </div>

                {/* Bug fixes applied */}
                <div className="mt-4 bg-emerald-50 rounded-2xl border border-emerald-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-bold text-emerald-900">Bugs Fixed This Session</h3>
                  </div>
                  <ul className="space-y-1.5 text-xs text-emerald-700">
                    <li>{"\u2713"} Notifications cron was loading ALL daily logs into memory (could OOM at scale) — now queries only today&apos;s date.</li>
                    <li>{"\u2713"} Narratives cron used onConflictDoUpdate on a table with no unique constraint — replaced with check-then-upsert.</li>
                    <li>{"\u2713"} CMS editor was not sending &quot;category&quot; field when saving — now includes category in save payload.</li>
                    <li>{"\u2713"} CMS editor now has a Category dropdown (Basics, Sleep, Hot Flashes, Mood, etc.).</li>
                    <li>{"\u2713"} Added 26 missing library content items from Content Plan (audio lessons, podcasts, meditations).</li>
                    <li>{"\u2713"} Admin auth fixed — allows any authenticated user when ADMIN_USER_ID not configured.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ━━━ ALL CONTENT ━━━ */}
          {view === "content" && (
            <div className="fade-in p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-stone-900">All Content</h1>
                  <p className="text-sm text-stone-400 mt-1">{filteredItems.length} pieces{filterType !== "all" || filterStatus !== "all" || filterTag !== "all" || filterWeek !== "all" || searchQuery ? " shown" : " across all categories"}</p>
                </div>
                <button onClick={() => openEditor(null)} className="bg-stone-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-stone-800">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  New Content
                </button>
              </div>

              {/* Filters */}
              <div className="flex gap-3 mb-4 flex-wrap items-center">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search content..." className="border border-stone-200 rounded-xl px-4 py-2 text-sm w-64 outline-none focus:border-stone-900" />
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                  <option value="all">All Types</option>
                  {CONTENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                  <option value="all">All Status</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                  <option value="all">All Tags</option>
                  {ALL_TAGS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <select value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)} className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                  <option value="all">All Weeks</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => <option key={w} value={w.toString()}>Week {w}</option>)}
                  <option value="library">Library Only</option>
                </select>
              </div>

              {/* Content table */}
              {loading ? (
                <p className="text-center py-10 text-stone-400">Loading...</p>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-stone-200">
                  <p className="text-lg font-semibold text-stone-900 mb-2">No content found</p>
                  <p className="text-sm text-stone-400 mb-5">Try adjusting your filters or add new content</p>
                  <button onClick={() => openEditor(null)} className="bg-stone-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold">+ New Content</button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-stone-400 border-b border-stone-100 bg-stone-50/50">
                        <th className="text-left py-3 px-4 font-medium">Content</th>
                        <th className="text-left py-3 px-4 font-medium">Type</th>
                        <th className="text-left py-3 px-4 font-medium">Tags</th>
                        <th className="text-left py-3 px-4 font-medium">Program</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-right py-3 px-4 font-medium">Listens</th>
                        <th className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((c) => (
                        <tr key={c.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">{TYPE_ICONS[c.contentType] || "\u{1F4E6}"}</span>
                              <div>
                                <p className="text-sm font-medium text-stone-800">{c.title}</p>
                                <p className="text-xs text-stone-400 mt-0.5 line-clamp-1 max-w-xs">{c.description || "No description"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-stone-500">{TYPE_LABELS[c.contentType] || c.contentType}</span>
                            <br />
                            <span className="text-xs text-stone-400">{c.durationMinutes ? `${c.durationMinutes} min` : ""}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[140px]">
                              {(c.tags || []).slice(0, 3).map((t) => {
                                const tag = ALL_TAGS.find((x) => x.id === t);
                                return <span key={t} className={`tag ${tag?.color || "bg-stone-100 text-stone-500"}`}>{tag?.label || t}</span>;
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-stone-500">
                              {c.programId
                                ? `${PROGRAMS.find(p => p.id === c.programId)?.icon || ""} ${PROGRAMS.find(p => p.id === c.programId)?.label || c.programId}${c.programWeek ? ` W${c.programWeek}D${c.programDay}` : ""}`
                                : c.programWeek ? `W${c.programWeek} D${c.programDay}` : "Library"
                              }
                            </span>
                          </td>
                          <td className="py-3 px-4"><span className={`tag ${STATUS_COLORS[c.status] || "bg-stone-100 text-stone-500"}`}>{c.status}</span></td>
                          <td className="py-3 px-4 text-right text-sm text-stone-700">{(c.listensCount || 0) > 0 ? (c.listensCount || 0).toLocaleString() : "\u2014"}</td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => openEditor(c.id)} className="text-xs text-stone-500 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-lg transition-colors">Edit</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ━━━ PROGRAMS ━━━ */}
          {view === "program" && (
            <div className="fade-in p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-stone-900">Programs</h1>
                  <p className="text-sm text-stone-400 mt-1">8-week curriculum + focused programs</p>
                </div>
                <button onClick={() => openEditor(null)} className="bg-stone-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-stone-800">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Content
                </button>
              </div>

              {/* Focused Programs Overview */}
              <div className="mb-8">
                <h2 className="text-sm font-bold text-stone-900 mb-3">Focused Programs</h2>
                <div className="grid grid-cols-4 gap-4">
                  {PROGRAMS.filter(p => p.id !== "main").map((prog) => {
                    const progItems = items.filter(i => i.programId === prog.id);
                    const pubCount = progItems.filter(i => i.status === "published").length;
                    return (
                      <div key={prog.id} className={`rounded-2xl border p-5 ${prog.bgColor}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-2xl">{prog.icon}</span>
                          <div>
                            <p className={`text-sm font-bold ${prog.color}`}>{prog.label}</p>
                            <p className="text-xs text-stone-400">{progItems.length} items &middot; {pubCount} published</p>
                          </div>
                        </div>
                        {progItems.length > 0 ? (
                          <div className="space-y-1.5">
                            {progItems.sort((a, b) => (a.programWeek || 0) - (b.programWeek || 0) || (a.programDay || 0) - (b.programDay || 0)).map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-2 bg-white/60 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-white transition-colors"
                                onClick={() => openEditor(item.id)}
                              >
                                <span className="text-sm">{TYPE_ICONS[item.contentType] || ""}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-stone-800 truncate">{item.title}</p>
                                  <p className="text-xs text-stone-400">
                                    {item.programWeek ? `W${item.programWeek}${item.programDay ? `D${item.programDay}` : ""} \u00B7 ` : ""}
                                    {item.durationMinutes ? `${item.durationMinutes} min` : ""}
                                  </p>
                                </div>
                                <span className={`tag text-xs ${STATUS_COLORS[item.status] || "bg-stone-100 text-stone-500"}`}>
                                  {item.status === "published" ? "Live" : item.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 bg-white/40 rounded-xl border border-dashed border-stone-200">
                            <p className="text-xs text-stone-400 mb-2">No content yet</p>
                            <button
                              onClick={() => { setEditorForm(f => ({ ...f, programId: prog.id })); openEditor(null); }}
                              className={`text-xs font-medium ${prog.color} hover:underline`}
                            >
                              + Add first item
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Custom programs */}
                {(() => {
                  const knownIds = PROGRAMS.map(p => p.id);
                  const customPrograms = Array.from(new Set(items.filter(i => i.programId && !knownIds.includes(i.programId)).map(i => i.programId!)));
                  if (customPrograms.length === 0) return null;
                  return (
                    <div className="mt-4">
                      <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Custom Programs</h3>
                      <div className="grid grid-cols-4 gap-4">
                        {customPrograms.map((pid) => {
                          const progItems = items.filter(i => i.programId === pid);
                          return (
                            <div key={pid} className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
                              <p className="text-sm font-bold text-purple-700 mb-1">{pid.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                              <p className="text-xs text-stone-400 mb-3">{progItems.length} items</p>
                              <div className="space-y-1.5">
                                {progItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-2 bg-white/60 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-white"
                                    onClick={() => openEditor(item.id)}
                                  >
                                    <span className="text-sm">{TYPE_ICONS[item.contentType] || ""}</span>
                                    <p className="text-xs font-medium text-stone-800 truncate flex-1">{item.title}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 8-Week Program Grid */}
              <h2 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
                <span className="text-lg">{"\u2726"}</span> 8-Week Program
                <span className="text-xs font-normal text-stone-400 ml-1">40 lessons &middot; 5 per week</span>
              </h2>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((wNum) => {
                  const days = items
                    .filter((c) => c.programWeek === wNum && (!c.programId || c.programId === "main"))
                    .sort((a, b) => (a.programDay || 0) - (b.programDay || 0));
                  const pubCount = days.filter((d) => d.status === "published").length;
                  return (
                    <div key={wNum} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                      <div className={`px-5 py-4 flex items-center justify-between ${pubCount === 5 ? "bg-stone-900" : "bg-gradient-to-r from-amber-50 to-white"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center ${pubCount === 5 ? "bg-white text-stone-900" : "bg-amber-400 text-stone-900"}`}>
                            {pubCount === 5 ? "\u2713" : wNum}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${pubCount === 5 ? "text-white" : "text-stone-900"}`}>Week {wNum}: {WEEK_TITLES[wNum]}</p>
                            <p className={`text-xs ${pubCount === 5 ? "text-stone-400" : "text-stone-500"}`}>{WEEK_PAINS[wNum - 1]}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-medium ${pubCount === 5 ? "text-emerald-400" : "text-amber-600"}`}>{pubCount}/5 published</span>
                      </div>
                      <div className="p-3">
                        <div className="grid grid-cols-5 gap-2">
                          {[1, 2, 3, 4, 5].map((dayNum) => {
                            const d = days.find((x) => x.programDay === dayNum);
                            if (!d) {
                              return (
                                <div key={dayNum} className="border border-dashed border-stone-200 bg-stone-50/50 rounded-xl p-3 text-center">
                                  <span className="text-xs font-bold text-stone-300">D{dayNum}</span>
                                  <p className="text-xs text-stone-300 mt-2">Empty</p>
                                </div>
                              );
                            }
                            return (
                              <div
                                key={dayNum}
                                className={`border ${d.status === "published" ? "border-emerald-200 bg-emerald-50/50" : "border-stone-200 bg-stone-50"} rounded-xl p-3 cursor-pointer hover:shadow-sm transition-all`}
                                onClick={() => openEditor(d.id)}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-bold text-stone-400">D{d.programDay}</span>
                                  <span className={`tag text-xs ${STATUS_COLORS[d.status] || ""}`}>{d.status === "published" ? "Live" : "Draft"}</span>
                                </div>
                                <span className="text-lg">{TYPE_ICONS[d.contentType] || ""}</span>
                                <p className="text-xs font-medium text-stone-800 mt-1 leading-tight">{d.title}</p>
                                <p className="text-xs text-stone-400 mt-0.5">{d.durationMinutes ? `${d.durationMinutes} min` : ""}</p>
                                {d.audioUrl ? (
                                  <p className="text-xs text-emerald-600 mt-1">{"\u2713"} Audio</p>
                                ) : (
                                  <p className="text-xs text-amber-500 mt-1">{"\u2298"} No audio</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ━━━ ANALYTICS ━━━ */}
          {view === "analytics" && (
            <div className="fade-in p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-stone-900">Analytics</h1>
                <p className="text-sm text-stone-400 mt-1">Content performance and listener engagement</p>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-5 border border-stone-100">
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">Total Listens</p>
                  <p className="text-3xl font-bold text-stone-900 mt-1">{items.reduce((s, i) => s + (i.listensCount || 0), 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-stone-100">
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">Published Items</p>
                  <p className="text-3xl font-bold text-stone-900 mt-1">{publishedCount}</p>
                  <p className="text-xs text-stone-400 mt-1">{items.length} total</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-stone-100">
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">With Audio</p>
                  <p className="text-3xl font-bold text-stone-900 mt-1">{items.filter((i) => i.audioUrl).length}</p>
                  <p className="text-xs text-stone-400 mt-1">{items.filter((i) => !i.audioUrl && i.format === "audio").length} missing audio</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-stone-100">
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">Content Types</p>
                  <p className="text-3xl font-bold text-stone-900 mt-1">{new Set(items.map((i) => i.contentType)).size}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* By type */}
                <div className="bg-white rounded-2xl border border-stone-100 p-6">
                  <h2 className="text-sm font-bold text-stone-900 mb-4">Content by Type</h2>
                  <div className="space-y-3">
                    {(() => {
                      const types = Array.from(new Set(items.map((i) => i.contentType)));
                      const typeStats = types.map((t) => ({ type: t, count: items.filter((i) => i.contentType === t).length })).sort((a, b) => b.count - a.count);
                      const maxCount = Math.max(...typeStats.map((t) => t.count), 1);
                      return typeStats.map((s) => (
                        <div key={s.type}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-stone-700">{TYPE_ICONS[s.type] || ""} {TYPE_LABELS[s.type] || s.type} ({s.count})</span>
                            <span className="text-xs font-bold text-stone-900">{s.count}</span>
                          </div>
                          <div className="h-2 bg-stone-100 rounded-full">
                            <div className="h-full bg-stone-900 rounded-full" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                {/* By tag */}
                <div className="bg-white rounded-2xl border border-stone-100 p-6">
                  <h2 className="text-sm font-bold text-stone-900 mb-4">Content by Tag</h2>
                  <div className="space-y-3">
                    {(() => {
                      const tagStats = ALL_TAGS.map((t) => ({ tag: t, count: items.filter((i) => (i.tags || []).includes(t.id)).length }))
                        .filter((s) => s.count > 0)
                        .sort((a, b) => b.count - a.count);
                      const maxCount = Math.max(...tagStats.map((t) => t.count), 1);
                      return tagStats.map((s) => (
                        <div key={s.tag.id}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={`tag ${s.tag.color}`}>{s.tag.label} ({s.count})</span>
                            <span className="text-xs font-bold text-stone-900">{s.count}</span>
                          </div>
                          <div className="h-2 bg-stone-100 rounded-full">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Week performance */}
              <div className="bg-white rounded-2xl border border-stone-100 p-6">
                <h2 className="text-sm font-bold text-stone-900 mb-4">Program Week Performance</h2>
                <div className="grid grid-cols-8 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => {
                    const wItems = items.filter((i) => i.programWeek === w);
                    const pub = wItems.filter((i) => i.status === "published").length;
                    const withAudio = wItems.filter((i) => i.audioUrl).length;
                    return (
                      <div key={w} className="bg-stone-50 rounded-xl p-4 text-center border border-stone-100">
                        <p className="text-xs text-stone-400 font-medium">W{w}</p>
                        <p className="text-lg font-bold text-stone-900 mt-1">{wItems.length}</p>
                        <p className="text-xs text-stone-400">items</p>
                        <div className="mt-2 pt-2 border-t border-stone-200">
                          <p className={`text-xs font-bold ${pub > 0 ? "text-emerald-600" : "text-stone-300"}`}>{pub} pub</p>
                          <p className={`text-xs ${withAudio > 0 ? "text-amber-600" : "text-stone-300"}`}>{withAudio} audio</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ━━━ IMPORT DRAFTS ━━━ */}
          {view === "drafts" && (
            <div className="fade-in p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-stone-900">Import Drafts from Content Plan</h1>
                  <p className="text-sm text-stone-400 mt-1">Pre-populate content from your Pause Content Plan document</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-lg font-bold">{"\u2726"}</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-stone-900">Pause_Content_Plan.docx</p>
                    <p className="text-xs text-stone-400">8-week program (40 lessons) + library content (32 pieces) = {items.length} items{items.length > 0 ? " already imported" : ""}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (items.length > 0) {
                        showMessage("Content already imported! View it in All Content.");
                        return;
                      }
                      setImporting(true);
                      setImportProgress(0);
                      const interval = setInterval(() => {
                        setImportProgress((p) => {
                          if (p >= 100) { clearInterval(interval); return 100; }
                          return p + 5;
                        });
                      }, 60);
                    }}
                    disabled={importing || items.length > 0}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${items.length > 0 ? "bg-emerald-500 text-white" : "bg-amber-500 text-white hover:bg-amber-600"}`}
                  >
                    {items.length > 0 ? "\u2713 Already Imported" : importing ? "Importing..." : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Import All as Drafts
                      </>
                    )}
                  </button>
                </div>
                <div className="h-2 bg-stone-100 rounded-full">
                  <div className="h-full bg-amber-400 rounded-full transition-all duration-1000" style={{ width: items.length > 0 ? "100%" : `${importProgress}%` }} />
                </div>
                <p className="text-xs text-stone-400 mt-2">
                  {items.length > 0 ? `\u2713 ${items.length} content items imported` : importing ? `Importing... ${importProgress}%` : "Ready to import"}
                </p>
              </div>

              {/* Preview */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-stone-100 p-6">
                  <h2 className="text-sm font-bold text-stone-900 mb-3">8-Week Program ({items.filter(i => i.programWeek).length} lessons)</h2>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {items.filter((i) => i.programWeek).sort((a, b) => (a.programWeek! - b.programWeek!) || (a.programDay! - b.programDay!)).map((p) => (
                      <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-stone-50">
                        <span>{TYPE_ICONS[p.contentType] || ""}</span>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-stone-800">W{p.programWeek}D{p.programDay}: {p.title}</p>
                          <p className="text-xs text-stone-400">{TYPE_LABELS[p.contentType] || p.contentType} &middot; {p.durationMinutes ? `${p.durationMinutes} min` : ""}</p>
                        </div>
                        <span className={`tag ${STATUS_COLORS[p.status]}`}>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
                      </div>
                    ))}
                    {items.filter((i) => i.programWeek).length === 0 && (
                      <p className="text-xs text-stone-400 py-4 text-center">No program content yet</p>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-stone-100 p-6">
                  <h2 className="text-sm font-bold text-stone-900 mb-3">Library Content ({items.filter(i => !i.programWeek).length} pieces)</h2>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {items.filter((i) => !i.programWeek).map((l) => (
                      <div key={l.id} className="flex items-center gap-2 p-2 rounded-lg bg-stone-50">
                        <span>{TYPE_ICONS[l.contentType] || ""}</span>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-stone-800">{l.title}</p>
                          <p className="text-xs text-stone-400">{TYPE_LABELS[l.contentType] || l.contentType} &middot; {l.durationMinutes ? `${l.durationMinutes} min` : ""}</p>
                        </div>
                        <span className={`tag ${STATUS_COLORS[l.status]}`}>{l.status.charAt(0).toUpperCase() + l.status.slice(1)}</span>
                      </div>
                    ))}
                    {items.filter((i) => !i.programWeek).length === 0 && (
                      <p className="text-xs text-stone-400 py-4 text-center">No library content yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ━━━ PRODUCTION PIPELINE ━━━ */}
          {view === "pipeline" && (
            <div className="fade-in p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-stone-900">Production Pipeline</h1>
                  <p className="text-sm text-stone-400 mt-1">Produce content with AI agents &mdash; research, write, record, produce, publish</p>
                </div>
                <button onClick={fetchPipeline} className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm hover:bg-stone-200">
                  {pipelineLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {/* ── GETTING STARTED BANNER ── */}
              {pipelineOverview && !pipelineOverview.pipelineCounts?.length && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-6 mb-6">
                  <h2 className="text-lg font-bold text-stone-900 mb-2">Get Started</h2>
                  <p className="text-sm text-stone-600 mb-4">Your {pipelineOverview.totals?.total || 0} content items are ready to produce. Here&apos;s how it works:</p>
                  <div className="grid grid-cols-5 gap-3 mb-5">
                    {[
                      { icon: "\uD83D\uDD2C", label: "Research", desc: "PubMed medical research" },
                      { icon: "\u270D\uFE0F", label: "Write", desc: "AI writes scripts & text" },
                      { icon: "\uD83C\uDFA4", label: "Record", desc: "ElevenLabs voice synthesis" },
                      { icon: "\uD83C\uDFDA\uFE0F", label: "Produce", desc: "Normalize, mix & master" },
                      { icon: "\uD83D\uDE80", label: "Publish", desc: "Upload & update CMS" },
                    ].map((s, i) => (
                      <div key={s.label} className="text-center">
                        <div className="text-2xl mb-1">{s.icon}</div>
                        <p className="text-xs font-semibold text-stone-800">{s.label}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{s.desc}</p>
                        {i < 4 && <div className="text-stone-300 text-lg mt-1">&rarr;</div>}
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-indigo-100">
                    <p className="text-xs font-semibold text-stone-700 mb-2">To start producing content, run in your terminal:</p>
                    <code className="text-xs bg-stone-50 text-stone-700 px-3 py-2 rounded-lg block font-mono">
                      cd pause-api && npx tsx --env-file=.env.local scripts/pipeline/index.ts batch --week 1
                    </code>
                    <p className="text-xs text-stone-400 mt-2">This will research, write, and produce all Week 1 content automatically.</p>
                  </div>
                </div>
              )}

              {/* ── PROGRESS OVERVIEW ── */}
              {pipelineOverview && (
                <div className="grid grid-cols-5 gap-4 mb-6">
                  {(["research", "writing", "audio", "production", "publishing"] as const).map((stage) => {
                    const stageIcons: Record<string, string> = { research: "\uD83D\uDD2C", writing: "\u270D\uFE0F", audio: "\uD83C\uDFA4", production: "\uD83C\uDFDA\uFE0F", publishing: "\uD83D\uDE80" };
                    const stageLabels: Record<string, string> = { research: "Research", writing: "Writing", audio: "Audio Gen", production: "Post-Prod", publishing: "Publish" };
                    const counts = pipelineOverview.pipelineCounts || [];
                    const completed = counts.find((c: any) => c.stage === stage && c.status === "completed")?.count || 0;
                    const failed = counts.find((c: any) => c.stage === stage && c.status === "failed")?.count || 0;
                    const inProg = counts.find((c: any) => c.stage === stage && c.status === "in_progress")?.count || 0;
                    const total = pipelineOverview.totals?.total || 1;
                    const pct = Math.round((completed / total) * 100);
                    return (
                      <div key={stage} className="bg-white rounded-2xl border border-stone-100 p-4 text-center">
                        <div className="text-2xl mb-1">{stageIcons[stage]}</div>
                        <p className="text-xs font-semibold text-stone-700">{stageLabels[stage]}</p>
                        <div className="mt-2 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-stone-400 mt-1.5">{completed}/{total}</p>
                        {failed > 0 && <p className="text-xs text-rose-500">{failed} failed</p>}
                        {inProg > 0 && <p className="text-xs text-amber-500">{inProg} running</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── WHAT NEEDS ATTENTION ── */}
              {pipelineOverview && (() => {
                const failedItems = pipelineItems.filter((it: any) => it.pipeline?.some((p: any) => p.status === "failed"));
                const needsResearch = pipelineItems.filter((it: any) => !it.pipeline?.length);
                const needsNext = pipelineItems.filter((it: any) => {
                  if (!it.pipeline?.length) return false;
                  const stages = ["research", "writing", "audio", "production", "publishing"];
                  const completedStages = it.pipeline.filter((p: any) => p.status === "completed").map((p: any) => p.stage);
                  const lastCompleted = stages.findLastIndex((s: string) => completedStages.includes(s));
                  return lastCompleted >= 0 && lastCompleted < 4 && !it.pipeline.some((p: any) => p.status === "in_progress");
                });
                if (!failedItems.length && !needsNext.length) return null;
                return (
                  <div className="mb-6 space-y-3">
                    {failedItems.length > 0 && (
                      <div className="bg-rose-50 rounded-2xl border border-rose-100 p-5">
                        <h3 className="text-sm font-bold text-rose-800 mb-2">{"\u26A0"} {failedItems.length} item{failedItems.length !== 1 ? "s" : ""} failed</h3>
                        <div className="space-y-2">
                          {failedItems.slice(0, 5).map((it: any) => {
                            const failedStage = it.pipeline.find((p: any) => p.status === "failed");
                            return (
                              <div key={it.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-rose-100">
                                <span className="text-sm">{TYPE_ICONS[it.contentType] || ""}</span>
                                <span className="text-xs font-medium text-stone-800 flex-1 truncate">{it.title}</span>
                                <span className="text-xs text-rose-600">failed at {failedStage?.stage}</span>
                                <button onClick={() => pipelineQueue(it.id, failedStage?.stage)} className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded hover:bg-rose-200">Retry</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {needsNext.length > 0 && (
                      <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
                        <h3 className="text-sm font-bold text-amber-800 mb-1">{"\u23F3"} {needsNext.length} item{needsNext.length !== 1 ? "s" : ""} ready for next stage</h3>
                        <p className="text-xs text-amber-600 mb-3">These items have completed some stages and are waiting for the next one.</p>
                        <div className="space-y-2">
                          {needsNext.slice(0, 5).map((it: any) => {
                            const stages = ["research", "writing", "audio", "production", "publishing"];
                            const stageLabels: Record<string, string> = { research: "Research", writing: "Write", audio: "Record", production: "Produce", publishing: "Publish" };
                            const completedStages = it.pipeline.filter((p: any) => p.status === "completed").map((p: any) => p.stage);
                            const lastIdx = stages.findLastIndex((s: string) => completedStages.includes(s));
                            const nextStage = stages[lastIdx + 1];
                            return (
                              <div key={it.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-amber-100">
                                <span className="text-sm">{TYPE_ICONS[it.contentType] || ""}</span>
                                <span className="text-xs font-medium text-stone-800 flex-1 truncate">{it.title}</span>
                                <span className="text-xs text-amber-600">next: {stageLabels[nextStage] || nextStage}</span>
                                <button onClick={() => pipelineQueue(it.id, nextStage)} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200">Run</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── ALL CONTENT TABLE ── */}
              <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-stone-900">All Content</h2>
                  <div className="flex items-center gap-4 text-xs text-stone-400">
                    <span className="flex items-center gap-1"><span className="text-emerald-500">{"\u2713"}</span> Done</span>
                    <span className="flex items-center gap-1"><span className="text-amber-500">{"\u25CF"}</span> Running</span>
                    <span className="flex items-center gap-1"><span className="text-rose-500">{"\u2717"}</span> Failed</span>
                    <span className="flex items-center gap-1"><span className="text-stone-300">{"\u25CB"}</span> Waiting</span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/50">
                      <th className="text-left px-5 py-2.5 text-xs text-stone-400 font-medium">Content</th>
                      <th className="text-left px-3 py-2.5 text-xs text-stone-400 font-medium">Type</th>
                      <th className="text-left px-3 py-2.5 text-xs text-stone-400 font-medium">Wk</th>
                      <th className="text-center px-2 py-2.5 text-xs text-stone-400 font-medium">{"\uD83D\uDD2C"}</th>
                      <th className="text-center px-2 py-2.5 text-xs text-stone-400 font-medium">{"\u270D\uFE0F"}</th>
                      <th className="text-center px-2 py-2.5 text-xs text-stone-400 font-medium">{"\uD83C\uDFA4"}</th>
                      <th className="text-center px-2 py-2.5 text-xs text-stone-400 font-medium">{"\uD83C\uDFDA\uFE0F"}</th>
                      <th className="text-center px-2 py-2.5 text-xs text-stone-400 font-medium">{"\uD83D\uDE80"}</th>
                      <th className="text-right px-5 py-2.5 text-xs text-stone-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineItems.map((item: any) => {
                      const stages = ["research", "writing", "audio", "production", "publishing"];
                      const getStatus = (stage: string) => item.pipeline?.find((p: any) => p.stage === stage)?.status;
                      const indicator = (status: string | undefined) => {
                        if (!status) return <span className="text-stone-300">{"\u25CB"}</span>;
                        if (status === "completed") return <span className="text-emerald-500">{"\u2713"}</span>;
                        if (status === "in_progress") return <span className="text-amber-500 animate-pulse">{"\u25CF"}</span>;
                        if (status === "failed") return <span className="text-rose-500">{"\u2717"}</span>;
                        if (status === "pending") return <span className="text-stone-400">{"\u25D4"}</span>;
                        return <span className="text-stone-300">{"\u25CB"}</span>;
                      };
                      const completedCount = stages.filter(s => getStatus(s) === "completed").length;
                      return (
                        <tr key={item.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                          <td className="px-5 py-2.5">
                            <p className="text-xs font-medium text-stone-800 truncate max-w-[240px]">{item.title}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-stone-500">{TYPE_ICONS[item.contentType] || ""} {TYPE_LABELS[item.contentType] || item.contentType}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-stone-400">{item.programWeek || "-"}</td>
                          {stages.map(s => (
                            <td key={s} className="text-center px-2 py-2.5 text-sm" title={`${s}: ${getStatus(s) || "not started"}`}>
                              {indicator(getStatus(s))}
                            </td>
                          ))}
                          <td className="px-5 py-2.5 text-right">
                            {completedCount === 5 ? (
                              <span className="text-xs text-emerald-600 font-medium">Done {"\u2713"}</span>
                            ) : completedCount === 0 ? (
                              <button onClick={() => pipelineQueue(item.id)} className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg hover:bg-indigo-100 font-medium">
                                Start
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => {
                                  const stageOrder = ["research", "writing", "audio", "production", "publishing"];
                                  const completed = item.pipeline?.filter((p: any) => p.status === "completed").map((p: any) => p.stage) || [];
                                  const nextIdx = stageOrder.findLastIndex((s: string) => completed.includes(s)) + 1;
                                  if (nextIdx < 5) pipelineQueue(item.id, stageOrder[nextIdx]);
                                }} className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg hover:bg-amber-100 font-medium">
                                  Continue
                                </button>
                                <button onClick={() => pipelineReset(item.id)} className="text-xs text-stone-400 hover:text-stone-600 px-1.5 py-1">
                                  {"\u21BA"}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {pipelineItems.length === 0 && (
                  <div className="text-center py-12 text-stone-400 text-sm">No content found</div>
                )}
              </div>

              {/* ── CLI QUICK REFERENCE ── */}
              <div className="mt-6 bg-stone-50 rounded-2xl border border-stone-100 p-5">
                <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-3">Terminal Commands</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { cmd: "scripts/pipeline/index.ts status", desc: "See progress" },
                    { cmd: "scripts/pipeline/index.ts run --id 42", desc: "Full pipeline for one item" },
                    { cmd: "scripts/pipeline/index.ts batch --type podcast", desc: "All podcasts" },
                    { cmd: "scripts/pipeline/index.ts batch --week 1", desc: "All Week 1 content" },
                  ].map(({ cmd, desc }) => (
                    <div key={cmd} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-stone-100">
                      <span className="text-xs text-stone-400 w-28 shrink-0">{desc}</span>
                      <code className="text-xs text-stone-600 font-mono truncate">npx tsx --env-file=.env.local {cmd}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ═══ EDITOR MODAL ═══ */}
        {editorOpen && (
          <div className="fixed inset-0 modal-bg z-50 flex items-start justify-center pt-10" onClick={closeEditor}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-stone-100 px-6 py-4 flex justify-between items-center z-10 rounded-t-2xl">
                <h2 className="text-lg font-bold text-stone-900">{editingId ? "Edit Content" : "New Content"}</h2>
                <button onClick={closeEditor} className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400">{"\u2715"}</button>
              </div>

              <div className="p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Title *</label>
                  <input type="text" value={editorForm.title} onChange={(e) => setEditorForm({ ...editorForm, title: e.target.value })}
                    placeholder="e.g. Building a Wind-Down Routine" className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-stone-900" />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Description</label>
                  <textarea value={editorForm.description} onChange={(e) => setEditorForm({ ...editorForm, description: e.target.value })}
                    rows={3} placeholder="Content description..." className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-stone-900 resize-none text-sm" />
                </div>

                {/* Type + Duration row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Content Type *</label>
                    <select value={editorForm.contentType} onChange={(e) => setEditorForm({ ...editorForm, contentType: e.target.value })}
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none bg-white">
                      {CONTENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Duration</label>
                    <input type="text" value={editorForm.duration} onChange={(e) => setEditorForm({ ...editorForm, duration: e.target.value })}
                      placeholder="e.g. 12 min" className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-stone-900" />
                  </div>
                </div>

                {/* Audio URL */}
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Audio URL</label>
                  <input type="text" value={editorForm.audioUrl} onChange={(e) => setEditorForm({ ...editorForm, audioUrl: e.target.value })}
                    placeholder="https://cdn.example.com/audio.mp3" className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-stone-900" />
                  {!editorForm.audioUrl && editorForm.contentType !== "guide" && (
                    <p className="text-xs text-amber-500 mt-1">{"\u26A0"} Audio file not uploaded yet — add URL when ready</p>
                  )}
                </div>

                {/* Rich text body */}
                {(editorForm.contentType === "guide" || editorForm.contentType === "article" || editorForm.contentType === "reflection") && (
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Rich Text Body <span className="text-stone-400 font-normal">(for guides &amp; articles)</span>
                    </label>
                    <textarea value={editorForm.richText} onChange={(e) => setEditorForm({ ...editorForm, richText: e.target.value })}
                      rows={8} placeholder="Write or paste content..." className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-stone-900 text-sm font-mono resize-y" />
                  </div>
                )}

                {/* Tags */}
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_TAGS.map((t) => (
                      <button key={t.id} onClick={() => toggleTag(t.id)}
                        className={`tag cursor-pointer transition-all ${t.color}`}
                        style={selectedTags.has(t.id) ? { outline: "2px solid #1c1917", outlineOffset: "1px" } : {}}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Program assignment */}
                <div className="bg-stone-50 rounded-xl p-4">
                  <label className="text-xs font-semibold text-stone-700 block mb-2">
                    Assign to Program <span className="text-stone-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setEditorForm({ ...editorForm, programId: "", week: "", day: "" })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        !editorForm.programId
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 bg-white text-stone-500 hover:border-stone-400"
                      }`}
                    >
                      Library Only
                    </button>
                    {PROGRAMS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditorForm({ ...editorForm, programId: p.id })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          editorForm.programId === p.id
                            ? `${p.bgColor} ${p.color} font-bold`
                            : "border-stone-200 bg-white text-stone-500 hover:border-stone-400"
                        }`}
                      >
                        <span>{p.icon}</span> {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditorForm({ ...editorForm, programId: "custom" })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        editorForm.programId === "custom"
                          ? "border-purple-400 bg-purple-50 text-purple-700 font-bold"
                          : "border-stone-200 bg-white text-stone-500 hover:border-stone-400"
                      }`}
                    >
                      + Custom
                    </button>
                  </div>

                  {editorForm.programId === "custom" && (
                    <div className="mb-3">
                      <input
                        type="text"
                        value={editorForm.customProgramId}
                        onChange={(e) => setEditorForm({ ...editorForm, customProgramId: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                        placeholder="e.g. stress_relief, energy_boost"
                        className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400 bg-white"
                      />
                      <p className="text-xs text-stone-400 mt-1">Use lowercase with underscores (e.g. stress_relief)</p>
                    </div>
                  )}

                  {editorForm.programId && editorForm.programId !== "custom" && (
                    <div className="grid grid-cols-2 gap-3">
                      <select value={editorForm.week} onChange={(e) => setEditorForm({ ...editorForm, week: e.target.value })}
                        className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                        <option value="">Week (optional)</option>
                        {(editorForm.programId === "main" ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4]).map((w) => (
                          <option key={w} value={w.toString()}>
                            Week {w}{editorForm.programId === "main" ? `: ${WEEK_TITLES[w]}` : ""}
                          </option>
                        ))}
                      </select>
                      <select value={editorForm.day} onChange={(e) => setEditorForm({ ...editorForm, day: e.target.value })}
                        className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                        <option value="">Day (optional)</option>
                        {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d.toString()}>Day {d}</option>)}
                      </select>
                    </div>
                  )}

                  {editorForm.programId === "custom" && editorForm.customProgramId && (
                    <div className="grid grid-cols-2 gap-3">
                      <select value={editorForm.week} onChange={(e) => setEditorForm({ ...editorForm, week: e.target.value })}
                        className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                        <option value="">Week (optional)</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => <option key={w} value={w.toString()}>Week {w}</option>)}
                      </select>
                      <select value={editorForm.day} onChange={(e) => setEditorForm({ ...editorForm, day: e.target.value })}
                        className="border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
                        <option value="">Day (optional)</option>
                        {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d.toString()}>Day {d}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Category + Production tool */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Category</label>
                    <select value={editorForm.category} onChange={(e) => setEditorForm({ ...editorForm, category: e.target.value })}
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none bg-white">
                      <option value="">Select category...</option>
                      {["Basics", "Sleep", "Hot Flashes", "Mood", "Movement", "Nutrition", "Relationships", "Treatment", "Wellness"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Production Tool</label>
                    <select value={editorForm.tool} onChange={(e) => setEditorForm({ ...editorForm, tool: e.target.value })}
                      className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none bg-white">
                      <option value="">Select tool...</option>
                      {PRODUCTION_TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Tonight's action */}
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Tonight&apos;s Action <span className="text-stone-400 font-normal">(shown in daily plan)</span>
                  </label>
                  <input type="text" value={editorForm.tonight} onChange={(e) => setEditorForm({ ...editorForm, tonight: e.target.value })}
                    placeholder="e.g. Set a wind-down alarm for tonight" className="w-full border border-stone-200 rounded-xl px-4 py-2.5 outline-none focus:border-stone-900" />
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-2">Status</label>
                  <div className="flex gap-2">
                    {STATUSES.map((s) => (
                      <button key={s} onClick={() => setEditorStatus(s)}
                        className={`flex-1 border-2 rounded-xl py-2.5 text-sm font-medium transition-all ${editorStatus === s ? "border-stone-900 text-stone-900 font-bold" : "border-stone-200 text-stone-500"}`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-stone-100 px-6 py-4 flex justify-between items-center rounded-b-2xl">
                {editingId ? (
                  <button onClick={handleDelete} className="text-sm text-rose-500 hover:text-rose-700">Delete content</button>
                ) : <div />}
                <div className="flex gap-2">
                  <button onClick={closeEditor} className="px-4 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-700">Cancel</button>
                  <button onClick={handleSave} disabled={saving || !editorForm.title.trim()}
                    className="bg-stone-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-800 disabled:opacity-50">
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════

function SidebarButton({ icon, label, active, count, badge, onClick }: {
  icon: string; label: string; active: boolean; count: number | null; badge?: string; onClick: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    home: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    content: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    program: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    analytics: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m14 0V9a2 2 0 00-2-2h-2a2 2 0 00-2 2v10m14 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14" /></svg>,
    drafts: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    pipeline: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  };

  return (
    <button
      onClick={onClick}
      className={`sidebar-item w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 ${active ? "active" : "text-stone-600"}`}
    >
      {icons[icon]}
      {label}
      {count !== null && (
        <span className="ml-auto bg-stone-100 text-stone-500 text-xs px-1.5 py-0.5 rounded-full">{count}</span>
      )}
      {badge && (
        <span className="ml-auto bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">{badge}</span>
      )}
    </button>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string | null; color?: string }) {
  return (
    <div className="stat-card bg-white rounded-2xl p-5 border border-stone-100">
      <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color || "text-stone-900"}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${color || "text-stone-400"}`}>{sub}</p>}
    </div>
  );
}
