"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight } from "lucide-react";
import api from "@/lib/api";

interface Announcement {
  id: string;
  text: string;
  active: boolean;
  createdAt: string;
}

export default function AdminAnnouncementsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [text, setText] = useState("");

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["admin-announcements"],
    queryFn: () => api.get("/admin/announcements").then((r) => r.data.announcements ?? []),
  });

  const save = useMutation({
    mutationFn: (data: { text: string; active: boolean }) =>
      editing
        ? api.patch(`/admin/announcements/${editing.id}`, data)
        : api.post("/admin/announcements", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      setShowModal(false); setEditing(null); setText("");
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/admin/announcements/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/announcements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });

  function openAdd() { setEditing(null); setText(""); setShowModal(true); }
  function openEdit(a: Announcement) { setEditing(a); setText(a.text); setShowModal(true); }

  const activeMessages = announcements.filter((a) => a.active);
  const tickerText = activeMessages.length > 0
    ? activeMessages.map((a) => a.text).join(" · ")
    : "No active announcements";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-grotesk font-bold text-2xl text-ink">Announcements</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue hover:bg-blue-dark text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} /> Add Announcement
        </button>
      </div>

      {/* Live ticker preview */}
      <div className="rounded-2xl overflow-hidden border border-blue border-dashed">
        <div className="bg-blue-pale px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-medium text-blue uppercase tracking-wide">Ticker Preview</span>
          <span className="text-xs text-blue">{activeMessages.length} active</span>
        </div>
        <div className="bg-blue py-2.5 overflow-hidden">
          <div className="ticker-track whitespace-nowrap text-white text-xs font-medium px-4">
            {tickerText} · {tickerText}
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-blue-pale rounded-2xl animate-pulse" />)}
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
          <p>No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`bg-white border rounded-2xl p-4 flex items-center gap-4 transition-colors ${a.active ? "border-blue" : "border-gray-200"}`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${a.active ? "text-ink" : "text-gray-400"}`}>{a.text}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(a.createdAt).toLocaleDateString("en-NP")}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${a.active ? "bg-green-light text-green" : "bg-gray-200 text-gray-400"}`}>
                  {a.active ? "Active" : "Inactive"}
                </span>
                <button onClick={() => toggleActive.mutate({ id: a.id, active: !a.active })} className={a.active ? "text-green" : "text-gray-400"}>
                  {a.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue hover:bg-blue-pale transition-colors">
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => { if (confirm("Delete this announcement?")) remove.mutate(a.id); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50" onClick={() => setShowModal(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-grotesk font-semibold text-base text-ink">
                {editing ? "Edit Announcement" : "New Announcement"}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Message</label>
                <textarea
                  rows={3} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Free delivery on orders above Rs 5,000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue resize-none"
                />
              </div>
              {text && (
                <div className="bg-blue py-2.5 rounded-xl overflow-hidden">
                  <p className="text-white text-xs text-center font-medium">{text}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => save.mutate({ text, active: editing ? editing.active : true })}
                  disabled={!text.trim() || save.isPending}
                  className="flex-1 bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-xl transition-colors text-sm"
                >
                  {save.isPending ? "Saving…" : editing ? "Save Changes" : "Add Announcement"}
                </button>
                <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-sm text-gray-600 hover:bg-off-white py-3 rounded-xl transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
