"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  DragDropContext, Droppable, Draggable,
  type DropResult, type DroppableProvided, type DraggableProvided,
} from "@hello-pangea/dnd";
import {
  X, Trash2, MessageSquare, ChevronRight, ChevronDown, MapPin, Building2, Link as LinkIcon,
} from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import { supabase } from "@/lib/supabase";
import { deleteLeadsFromDB, computeStatsFromLeads, getMessages, logActivity, fetchLeadsFromDB } from "@/lib/db";
import type { Lead, Message } from "@/lib/types";

const COLUMNS = [
  { id: "New", label: "New" },
  { id: "Contacted", label: "Contacted" },
  { id: "Replied", label: "Replied" },
  { id: "Hot Lead", label: "Hot Lead" },
  { id: "Meeting Booked", label: "Meeting Booked" },
  { id: "Closed Won", label: "Closed Won" },
  { id: "Closed Lost", label: "Closed Lost" },
];

const ICON_COLORS = ["var(--accent)", "var(--info)", "var(--negative)", "var(--positive)", "var(--info)", "#a78bfa"];

function getAvatarColor(name: string): string {
  const idx = (name.charCodeAt(0) || 0) % ICON_COLORS.length;
  return ICON_COLORS[idx];
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "?";
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function getScoreColor(score: number): string {
  if (score >= 85) return "var(--positive)";
  if (score >= 70) return "var(--negative)";
  return "var(--negative)";
}

export default function KanbanPage() {
  const { state, dispatch } = useApp();
  const { leads: allLeads } = state;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  };

  const selected = allLeads.find(l => l.id === selectedId);

  // Load messages and notes when selecting a lead
  useEffect(() => {
    if (selectedId) {
      getMessages(selectedId).then(setMessages).catch(() => {});
      const lead = allLeads.find(l => l.id === selectedId);
      setNotes(lead?.notes || "");
    }
  }, [selectedId]);

  // Group leads by kanban column
  const columns = COLUMNS.map(col => ({
    ...col,
    leads: allLeads.filter(l => l.kanbanColumn === col.id || (!l.kanbanColumn && col.id === "New")),
  }));

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newColumn = destination.droppableId;

    // Map kanban column to status
    const statusMap: Record<string, string> = {
      "New": "new", "Contacted": "contacted", "Replied": "replied",
      "Hot Lead": "hot", "Meeting Booked": "meeting", "Closed Won": "won", "Closed Lost": "lost",
    };

    try {
      await supabase.from("leads").update({
        kanban_column: newColumn,
        status: statusMap[newColumn] || "new",
        updated_at: new Date().toISOString(),
      }).eq("id", draggableId);

      // Refetch to sync
      const refreshed = await fetchLeadsFromDB();
      dispatch({ type: "SET_LEADS", payload: refreshed });
      const lead = refreshed.find(l => l.id === draggableId);
      await logActivity({
        type: "lead_moved",
        text: `${lead?.name || "Lead"} moved to ${newColumn}`,
      });
    } catch {
      showToast("Failed to move lead", "error");
    }
  };

  const handleNotesSave = useCallback(async (leadId: string, value: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await supabase.from("leads").update({ notes: value }).eq("id", leadId);
      } catch { /* silent */ }
    }, 500);
  }, []);

  const handleMoveToColumn = async (leadId: string, column: string) => {
    const statusMap: Record<string, string> = {
      "New": "new", "Contacted": "contacted", "Replied": "replied",
      "Hot Lead": "hot", "Meeting Booked": "meeting", "Closed Won": "won", "Closed Lost": "lost",
    };
    await supabase.from("leads").update({ kanban_column: column, status: statusMap[column] || "new" }).eq("id", leadId);
    const refreshed = await fetchLeadsFromDB();
    dispatch({ type: "SET_LEADS", payload: refreshed });
    await logActivity({ type: "lead_moved", text: `Lead moved to ${column}` });
    showToast(`Moved to ${column}`);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const stored = await deleteLeadsFromDB([selectedId]);
    dispatch({ type: "DELETE_LEADS", payload: { stored, deletedIds: [selectedId] } });
    const stats = await computeStatsFromLeads(stored);
    dispatch({ type: "SET_STATS", payload: stats });
    closeDetail();
    showToast("Lead deleted");
  };

  const openDetail = (id: string) => {
    if (selectedId === id) return;
    setSelectedId(id);
    requestAnimationFrame(() => setDetailOpen(true));
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setTimeout(() => setSelectedId(null), 220);
  };

  const currentCol = selected ? COLUMNS.find(c => c.id === (selected.kanbanColumn || "New"))?.label || "New" : "";

  return (
    <>
      <TopBar title="Kanban Pipeline" subtitle={`${allLeads.length} leads across 7 stages`} />

      <div className="flex-1 flex overflow-hidden">
        {/* Board */}
        <div className="flex-1 overflow-x-auto">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 p-5 min-h-full" style={{ minWidth: 7 * 256 }}>
              {columns.map(col => (
                <div key={col.id} className="w-[240px] shrink-0 flex flex-col">
                  {/* Column Header */}
                  <div
                    className="h-10 flex items-center gap-2 px-3 rounded-t-lg shrink-0"
                    style={{
                      borderTop: col.id === "Hot Lead" ? "3px solid var(--negative)"
                        : col.id === "Closed Won" ? "3px solid var(--positive)"
                        : col.id === "Closed Lost" ? "3px solid var(--ink-3)"
                        : "3px solid transparent",
                      background: col.id === "Hot Lead" ? "var(--surface)"
                        : col.id === "Closed Won" ? "var(--surface)"
                        : col.id === "Closed Lost" ? "var(--surface)"
                        : "var(--surface)",
                    }}
                  >
                    <span className="text-xs font-semibold text-ink">{col.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-ink-3 font-bold tabular-nums">
                      {col.leads.length}
                    </span>
                  </div>

                  {/* Column Body */}
                  <Droppable droppableId={col.id}>
                    {(provided: DroppableProvided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 bg-surface border border-line rounded-b-lg p-2 space-y-2 overflow-y-auto"
                        style={{
                          minHeight: 500,
                          boxShadow: col.id === "Hot Lead" ? "inset 0 2px 20px rgba(255,107,53,0.06)" : undefined,
                        }}
                      >
                        {col.leads.map((lead, idx) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                            {(provided: DraggableProvided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => openDetail(lead.id)}
                                className="bg-surface2 border border-line rounded-lg p-3 cursor-pointer hover:border-white/20 transition-colors"
                                style={{
                                  ...provided.draggableProps.style,
                                  transform: snapshot.isDragging
                                    ? `${provided.draggableProps.style?.transform || ""} rotate(1.5deg)`
                                    : provided.draggableProps.style?.transform,
                                  opacity: snapshot.isDragging ? 0.88 : (col.id === "Closed Lost" ? 0.7 : 1),
                                }}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                                    style={{ background: `${getAvatarColor(lead.name)}20`, color: getAvatarColor(lead.name) }}
                                  >
                                    {getInitials(lead.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-ink truncate">{lead.name}</p>
                                    <p className="text-[11px] text-ink-3 truncate">{lead.title}</p>
                                  </div>
                                </div>
                                <p className="text-[11px] text-ink-3 truncate mb-2">{lead.company}</p>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded font-bold tabular-nums"
                                    style={{ background: `${getScoreColor(lead.score)}20`, color: getScoreColor(lead.score) }}
                                  >
                                    {lead.score}
                                  </span>
                                  <span className="text-[10px] text-ink-3/50">· {relativeTime(lead.savedAt)}</span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div
            className="w-[360px] shrink-0 border-l border-line bg-surface overflow-y-auto transition-transform duration-200"
            style={{ transform: detailOpen ? "translateX(0)" : "translateX(360px)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-line sticky top-0 bg-surface z-10">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: `${getAvatarColor(selected.name)}20`, color: getAvatarColor(selected.name) }}
                >
                  {getInitials(selected.name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{selected.name}</p>
                  <p className="text-[11px] text-ink-3">{selected.title}</p>
                </div>
              </div>
              <button onClick={closeDetail} className="text-ink-3 hover:text-ink">
                <X size={16} />
              </button>
            </div>

            {/* Fields */}
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company" value={selected.company} icon={<Building2 size={11} />} />
                <Field label="Location" value={selected.location} icon={<MapPin size={11} />} />
                <Field label="Industry" value={selected.industry} />
                <Field label="Email" value={selected.email} />
                <Field label="Score" value={String(selected.score)} />
                <Field label="Source" value={selected.source} />
                <Field label="Column" value={currentCol} />
              </div>

              {selected.linkedin && (
                <a href={selected.linkedin} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors">
                  <LinkIcon size={10} /> LinkedIn Profile
                </a>
              )}

              {/* Notes */}
              <div>
                <label className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => {
                    setNotes(e.target.value);
                    handleNotesSave(selected.id, e.target.value);
                  }}
                  placeholder="Add notes about this lead…"
                  rows={3}
                  className="w-full rounded-md bg-white/5 border border-line px-3 py-2 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-blue/40 resize-y mt-1"
                />
              </div>

              {/* Message History */}
              {messages.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">Message History</label>
                  <div className="space-y-2 mt-1">
                    {messages.slice(0, 3).map(m => (
                      <div key={m.id} className="p-2 rounded bg-surface2 border border-line">
                        <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${m.messageType === "cold_email" ? "bg-accent/15 text-accent" : "bg-info/15 text-info"}`}>
                          {m.messageType.replace(/_/g, " ")}
                        </span>
                        <p className="text-[11px] text-ink-3 mt-1 line-clamp-2">{m.body.slice(0, 100)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t border-line">
                <Link
                  href={`/message-lab`}
                  className="flex items-center gap-2 w-full h-9 rounded-md bg-info/10 text-info text-xs font-medium hover:bg-info/20 transition-colors justify-center"
                >
                  <MessageSquare size={12} /> Generate Message
                </Link>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ink-3">Move to:</span>
                  <Dropdown
                    options={COLUMNS.map(c => ({ label: c.label, value: c.id }))}
                    value={selected.kanbanColumn || "New"}
                    onChange={v => handleMoveToColumn(selected.id, v)}
                  />
                </div>

                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-2 w-full h-9 rounded-md bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors justify-center"
                >
                  <Trash2 size={12} /> Delete Lead
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-surface border border-line rounded-xl p-6 shadow-2xl animate-fade-up" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-ink mb-1">Delete {selected?.name}?</p>
            <p className="text-xs text-ink-3 mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="px-4 py-2 rounded-md bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30">Delete</button>
              <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 rounded-md bg-white/5 text-ink-3 text-xs hover:bg-white/[0.08]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <span className="text-[9px] text-ink-3 uppercase tracking-wider block">{label}</span>
      <span className="text-xs text-ink flex items-center gap-1 mt-0.5">
        {icon} {value || "—"}
      </span>
    </div>
  );
}
