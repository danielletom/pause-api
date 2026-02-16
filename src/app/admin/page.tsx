"use client";

import { useState, useEffect, useCallback } from "react";

const CONTENT_TYPES = ["podcast", "lesson", "meditation", "affirmation", "article", "guide"];
const FORMATS = ["audio", "text", "pdf"];
const STATUSES = ["draft", "ready", "published"];
const CATEGORIES = ["Sleep", "Hot Flashes", "Mood", "Nutrition", "Movement", "Basics", "Relationships", "Wellness", "Treatment"];
const TAGS = ["morning", "evening", "anytime", "sleep", "calm", "energy", "hot flashes", "mind", "basics", "nutrition", "sos"];
const PRODUCTION_TOOLS = ["NotebookLM", "Wondercraft", "ElevenLabs", "ZENmix", "Claude", "Manual"];

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

const EMPTY_FORM = {
  title: "",
  contentType: "article",
  format: "text",
  description: "",
  aiDescription: "",
  bodyMarkdown: "",
  audioUrl: "",
  thumbnailUrl: "",
  durationMinutes: "",
  category: "",
  tags: [] as string[],
  productionTool: "",
  status: "draft",
  sortOrder: "0",
  programWeek: "",
  programDay: "",
  programAction: "",
};

export default function ContentManager() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form" | "stats" | "program">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterWeek, setFilterWeek] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchContent = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    if (filterWeek) params.set("week", filterWeek);
    if (searchQuery) params.set("search", searchQuery);

    const res = await fetch(`/api/admin/content?${params}`);
    if (res.ok) {
      setItems(await res.json());
    }
    setLoading(false);
  }, [filterType, filterStatus, filterWeek, searchQuery]);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats");
    if (res.ok) {
      setStats(await res.json());
    }
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setView("form");
  };

  const handleEdit = (item: ContentItem) => {
    setForm({
      title: item.title,
      contentType: item.contentType,
      format: item.format,
      description: item.description || "",
      aiDescription: item.aiDescription || "",
      bodyMarkdown: item.bodyMarkdown || "",
      audioUrl: item.audioUrl || "",
      thumbnailUrl: item.thumbnailUrl || "",
      durationMinutes: item.durationMinutes?.toString() || "",
      category: item.category || "",
      tags: item.tags || [],
      productionTool: item.productionTool || "",
      status: item.status,
      sortOrder: item.sortOrder?.toString() || "0",
      programWeek: item.programWeek?.toString() || "",
      programDay: item.programDay?.toString() || "",
      programAction: item.programAction || "",
    });
    setEditingId(item.id);
    setView("form");
  };

  const handleSave = async () => {
    setSaving(true);
    const url = editingId ? `/api/admin/content/${editingId}` : "/api/admin/content";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      showMessage(editingId ? "Content updated!" : "Content created!");
      setView("list");
      fetchContent();
    } else {
      showMessage("Error saving content");
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this content?")) return;
    const res = await fetch(`/api/admin/content/${id}`, { method: "DELETE" });
    if (res.ok) {
      showMessage("Content deleted");
      fetchContent();
    }
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const typeIcon = (type: string) => {
    const icons: Record<string, string> = {
      podcast: "🎙️",
      lesson: "🎧",
      meditation: "🧘",
      affirmation: "✨",
      article: "📄",
      guide: "📋",
    };
    return icons[type] || "📦";
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "#a8a29e",
      ready: "#f59e0b",
      published: "#22c55e",
    };
    return colors[status] || "#78716c";
  };

  // Group items by program week for program view
  const programItems = items
    .filter((i) => i.programWeek)
    .sort((a, b) => (a.programWeek! - b.programWeek!) || (a.programDay! - b.programDay!));

  const weekTitles: Record<number, string> = {
    1: "Your Baseline",
    2: "Sleep & Night Sweats",
    3: "Hot Flash Management",
    4: "Mood, Mind & Brain Fog",
    5: "Body Changes & Movement",
    6: "Nutrition & Fuel",
    7: "Relationships, Work & Identity",
    8: "Your Path Forward",
  };

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", backgroundColor: "#fafaf9", minHeight: "100vh" }}>
      {/* Message toast */}
      {message && (
        <div style={{
          position: "fixed", top: 20, right: 20, background: "#1c1917", color: "#fff",
          padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 100,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>
          {message}
        </div>
      )}

      {/* Header */}
      <div style={{
        background: "#1c1917", padding: "20px 32px", display: "flex",
        justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 }}>
            Pause Content Manager
          </h1>
          <p style={{ color: "#78716c", fontSize: 12, margin: "4px 0 0" }}>
            Manage your wellness content library & 8-week program
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["list", "program", "stats"] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setView(v); if (v === "stats") fetchStats(); }}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                background: view === v ? "#fbbf24" : "#44403c",
                color: view === v ? "#1c1917" : "#d6d3d1",
                fontSize: 13, fontWeight: 600,
              }}
            >
              {v === "list" ? "All Content" : v === "program" ? "8-Week Program" : "Analytics"}
            </button>
          ))}
          <button
            onClick={handleNew}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "#fbbf24", color: "#1c1917", fontSize: 13, fontWeight: 700,
            }}
          >
            + Add Content
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>
        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <>
            {/* Filters */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "1px solid #e7e5e4",
                  fontSize: 13, width: 240, outline: "none",
                }}
              />
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 13 }}>
                <option value="">All Types</option>
                {CONTENT_TYPES.map((t) => <option key={t} value={t}>{typeIcon(t)} {t}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 13 }}>
                <option value="">All Statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 13 }}>
                <option value="">All Weeks</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => <option key={w} value={w}>Week {w}</option>)}
              </select>
              <span style={{ fontSize: 12, color: "#a8a29e" }}>
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Content table */}
            {loading ? (
              <p style={{ textAlign: "center", padding: 40, color: "#a8a29e" }}>Loading...</p>
            ) : items.length === 0 ? (
              <div style={{
                textAlign: "center", padding: 60, background: "#fff",
                borderRadius: 16, border: "2px dashed #e7e5e4",
              }}>
                <p style={{ fontSize: 18, fontWeight: 600, color: "#1c1917", marginBottom: 8 }}>
                  No content yet
                </p>
                <p style={{ fontSize: 13, color: "#a8a29e", marginBottom: 20 }}>
                  Add your first piece of content to get started
                </p>
                <button onClick={handleNew} style={{
                  padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: "#1c1917", color: "#fff", fontSize: 14, fontWeight: 600,
                }}>
                  + Add Content
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "#fff", borderRadius: 12, padding: "14px 18px",
                      display: "flex", alignItems: "center", gap: 14,
                      border: "1px solid #f5f5f4", cursor: "pointer",
                      transition: "box-shadow 0.15s",
                    }}
                    onClick={() => handleEdit(item)}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                  >
                    <span style={{ fontSize: 20 }}>{typeIcon(item.contentType)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#1c1917" }}>
                          {item.title}
                        </span>
                        {item.programWeek && (
                          <span style={{
                            fontSize: 10, background: "#fef3c7", color: "#d97706",
                            padding: "2px 8px", borderRadius: 10, fontWeight: 600,
                          }}>
                            W{item.programWeek}D{item.programDay}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2, display: "flex", gap: 8 }}>
                        <span>{item.contentType}</span>
                        {item.durationMinutes && <span>{item.durationMinutes} min</span>}
                        {item.category && <span>{item.category}</span>}
                        {(item.tags as string[])?.length > 0 && (
                          <span>{(item.tags as string[]).join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {(item.listensCount > 0 || item.readsCount > 0) && (
                        <span style={{ fontSize: 11, color: "#a8a29e" }}>
                          {item.listensCount > 0 ? `${item.listensCount} listens` : `${item.readsCount} reads`}
                        </span>
                      )}
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px",
                        borderRadius: 8, background: `${statusColor(item.status)}20`,
                        color: statusColor(item.status),
                      }}>
                        {item.status}
                      </span>
                      {!item.audioUrl && item.format === "audio" && (
                        <span style={{ fontSize: 10, color: "#f59e0b" }}>⚠ No audio</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 14, color: "#d6d3d1", padding: 4,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── FORM VIEW ── */}
        {view === "form" && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1c1917", margin: 0 }}>
                {editingId ? "Edit Content" : "Add New Content"}
              </h2>
              <button onClick={() => setView("list")} style={{
                background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#a8a29e",
              }}>
                ← Back to list
              </button>
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #f5f5f4" }}>
              {/* Title */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Body Scan for Sleep"
                  style={inputStyle}
                />
              </div>

              {/* Type + Format row */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Content Type</label>
                  <select value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                    style={inputStyle}>
                    {CONTENT_TYPES.map((t) => <option key={t} value={t}>{typeIcon(t)} {t}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Format</label>
                  <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}
                    style={inputStyle}>
                    {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    style={inputStyle}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Category + Duration */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={inputStyle}>
                    <option value="">None</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Duration (minutes)</label>
                  <input
                    type="number"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                    placeholder="e.g., 15"
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Production Tool</label>
                  <select value={form.productionTool} onChange={(e) => setForm({ ...form, productionTool: e.target.value })}
                    style={inputStyle}>
                    <option value="">None</option>
                    {PRODUCTION_TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Tags</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: "5px 12px", borderRadius: 14, border: "1px solid",
                        borderColor: form.tags.includes(tag) ? "#1c1917" : "#e7e5e4",
                        background: form.tags.includes(tag) ? "#1c1917" : "#fff",
                        color: form.tags.includes(tag) ? "#fff" : "#78716c",
                        fontSize: 12, fontWeight: 500, cursor: "pointer",
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of this content"
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" as any }}
                />
              </div>

              {/* AI Description */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>AI Description</label>
                <textarea
                  value={form.aiDescription}
                  onChange={(e) => setForm({ ...form, aiDescription: e.target.value })}
                  placeholder="AI-generated summary for content matching"
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" as any }}
                />
              </div>

              {/* Audio URL */}
              {(form.format === "audio" || form.contentType === "meditation" || form.contentType === "podcast" || form.contentType === "lesson" || form.contentType === "affirmation") && (
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Audio URL</label>
                  <input
                    value={form.audioUrl}
                    onChange={(e) => setForm({ ...form, audioUrl: e.target.value })}
                    placeholder="https://cdn.example.com/audio.mp3"
                    style={inputStyle}
                  />
                  {!form.audioUrl && (
                    <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                      ⚠ Audio file not uploaded yet — add URL when ready
                    </p>
                  )}
                </div>
              )}

              {/* Body for text content */}
              {(form.format === "text" || form.contentType === "article" || form.contentType === "guide") && (
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Body (Markdown)</label>
                  <textarea
                    value={form.bodyMarkdown}
                    onChange={(e) => setForm({ ...form, bodyMarkdown: e.target.value })}
                    placeholder="Article or guide content in markdown..."
                    rows={8}
                    style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12, resize: "vertical" as any }}
                  />
                </div>
              )}

              {/* Program assignment */}
              <div style={{
                marginBottom: 16, padding: 16, background: "#fffbeb",
                borderRadius: 12, border: "1px solid #fef3c7",
              }}>
                <label style={{ ...labelStyle, color: "#d97706" }}>
                  8-Week Program Assignment (optional)
                </label>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, fontSize: 11 }}>Week</label>
                    <select value={form.programWeek} onChange={(e) => setForm({ ...form, programWeek: e.target.value })}
                      style={inputStyle}>
                      <option value="">Not in program</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
                        <option key={w} value={w}>Week {w}: {weekTitles[w]}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, fontSize: 11 }}>Day</label>
                    <select value={form.programDay} onChange={(e) => setForm({ ...form, programDay: e.target.value })}
                      style={inputStyle}>
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>Day {d}</option>)}
                    </select>
                  </div>
                </div>
                {form.programWeek && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 11 }}>Tonight&apos;s Plan Action</label>
                    <input
                      value={form.programAction}
                      onChange={(e) => setForm({ ...form, programAction: e.target.value })}
                      placeholder="e.g., Do this meditation before bed"
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>

              {/* Save button */}
              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title}
                  style={{
                    padding: "12px 32px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: saving ? "#a8a29e" : "#1c1917", color: "#fff",
                    fontSize: 14, fontWeight: 600, opacity: !form.title ? 0.5 : 1,
                  }}
                >
                  {saving ? "Saving..." : editingId ? "Update Content" : "Create Content"}
                </button>
                <button
                  onClick={() => setView("list")}
                  style={{
                    padding: "12px 24px", borderRadius: 10, border: "1px solid #e7e5e4",
                    background: "#fff", color: "#78716c", fontSize: 14, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PROGRAM VIEW ── */}
        {view === "program" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1c1917", marginBottom: 20 }}>
              8-Week Program
            </h2>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((week) => {
              const weekItems = programItems.filter((i) => i.programWeek === week);
              return (
                <div key={week} style={{
                  marginBottom: 16, background: "#fff", borderRadius: 16,
                  padding: 20, border: "1px solid #f5f5f4",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <span style={{
                        display: "inline-block", width: 28, height: 28, borderRadius: 14,
                        background: weekItems.length > 0 ? "#fbbf24" : "#e7e5e4",
                        color: weekItems.length > 0 ? "#1c1917" : "#a8a29e",
                        textAlign: "center", lineHeight: "28px", fontSize: 12, fontWeight: 700,
                        marginRight: 10,
                      }}>
                        {week}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1c1917" }}>
                        Week {week}: {weekTitles[week]}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "#a8a29e" }}>
                      {weekItems.length}/5 pieces
                    </span>
                  </div>
                  {weekItems.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 38 }}>
                      {weekItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleEdit(item)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                            padding: "6px 10px", borderRadius: 8,
                            background: item.audioUrl || item.format !== "audio" ? "transparent" : "#fffbeb",
                          }}
                        >
                          <span style={{ fontSize: 11, color: "#a8a29e", width: 40 }}>Day {item.programDay}</span>
                          <span style={{ fontSize: 14 }}>{typeIcon(item.contentType)}</span>
                          <span style={{ fontSize: 13, color: "#1c1917", flex: 1 }}>{item.title}</span>
                          <span style={{ fontSize: 11, color: "#a8a29e" }}>
                            {item.durationMinutes ? `${item.durationMinutes} min` : ""}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                            background: `${statusColor(item.status)}20`, color: statusColor(item.status),
                          }}>
                            {item.status}
                          </span>
                          {!item.audioUrl && item.format === "audio" && (
                            <span style={{ fontSize: 10, color: "#f59e0b" }}>⚠ No audio</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: "#d6d3d1", paddingLeft: 38 }}>
                      No content added for this week yet
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── STATS VIEW ── */}
        {view === "stats" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1c1917", marginBottom: 20 }}>
              Content Analytics
            </h2>
            {!stats ? (
              <p style={{ textAlign: "center", padding: 40, color: "#a8a29e" }}>Loading analytics...</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {/* Totals card */}
                <div style={{ background: "#1c1917", borderRadius: 16, padding: 24, color: "#fff" }}>
                  <p style={{ fontSize: 11, color: "#78716c", textTransform: "uppercase", letterSpacing: 1 }}>
                    Total Content
                  </p>
                  <p style={{ fontSize: 36, fontWeight: 300, marginTop: 8 }}>
                    {stats.totals.totalContent}
                  </p>
                  <p style={{ fontSize: 12, color: "#78716c", marginTop: 4 }}>
                    {stats.totals.totalPublished} published
                  </p>
                </div>

                {/* Type breakdown */}
                <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #f5f5f4" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#1c1917", marginBottom: 12 }}>
                    By Content Type
                  </p>
                  {stats.typeCounts.map((tc) => (
                    <div key={tc.contentType} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0", borderBottom: "1px solid #f5f5f4",
                    }}>
                      <span style={{ fontSize: 13, color: "#44403c" }}>
                        {typeIcon(tc.contentType)} {tc.contentType}
                      </span>
                      <span style={{ fontSize: 12, color: "#a8a29e" }}>
                        {tc.count} ({tc.published} published)
                      </span>
                    </div>
                  ))}
                </div>

                {/* Top content */}
                <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #f5f5f4" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#1c1917", marginBottom: 12 }}>
                    Most Engaged Content
                  </p>
                  {stats.topContent.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#d6d3d1" }}>No engagement data yet</p>
                  ) : (
                    stats.topContent.map((tc, i) => (
                      <div key={tc.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 0", borderBottom: "1px solid #f5f5f4",
                      }}>
                        <span style={{ fontSize: 11, color: "#a8a29e", width: 16 }}>{i + 1}.</span>
                        <span style={{ fontSize: 13, color: "#44403c", flex: 1 }}>{tc.title}</span>
                        <span style={{ fontSize: 11, color: "#a8a29e" }}>
                          {(tc.listensCount || 0) + (tc.readsCount || 0)} total
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Engagement stats */}
                <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #f5f5f4" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#1c1917", marginBottom: 12 }}>
                    User Engagement
                  </p>
                  {stats.engagementStats.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#d6d3d1" }}>No engagement data yet</p>
                  ) : (
                    stats.engagementStats.map((es) => (
                      <div key={es.action} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "6px 0", borderBottom: "1px solid #f5f5f4",
                      }}>
                        <span style={{ fontSize: 13, color: "#44403c" }}>{es.action}</span>
                        <span style={{ fontSize: 12, color: "#a8a29e" }}>
                          {es.count} ({es.uniqueUsers} users)
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#44403c",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e7e5e4",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};
