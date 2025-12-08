"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Edit, Trash2, Download } from "lucide-react"

const DEMO_LOGS = [
  {
    _id: "1",
    call_id: "call-001",
    from_number: "+12125551234",
    to_number: "+12125551001",
    duration: 245,
    status: "ended",
    disposition: "completed",
    notes: "Customer agreed to follow-up",
    tags: ["qualified", "follow-up"],
    recording_url: "https://example.com/recording1.wav",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    _id: "2",
    call_id: "call-002",
    from_number: "+12125551234",
    to_number: "+12125551002",
    duration: 0,
    status: "ended",
    disposition: "no_answer",
    notes: "Left voicemail",
    tags: ["voicemail"],
    created_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    _id: "3",
    call_id: "call-003",
    from_number: "+12125551234",
    to_number: "+12125551003",
    duration: 180,
    status: "ended",
    disposition: "completed",
    notes: "Scheduled demo for next week",
    tags: ["demo", "scheduled"],
    created_at: new Date().toISOString(),
  },
  {
    _id: "4",
    call_id: "call-004",
    from_number: "+12125551234",
    to_number: "+12125551004",
    duration: 0,
    status: "ended",
    disposition: "busy",
    notes: "Line was busy",
    tags: ["retry"],
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
]

interface CallLog {
  _id: string
  call_id: string
  from_number: string
  to_number: string
  duration: number
  status: string
  disposition?: string
  notes?: string
  tags?: string[]
  recording_url?: string
  created_at: string
}

interface EditingLog {
  _id: string
  notes: string
  disposition: string
  tags: string
}

export default function CallLogsPage() {
  const [logs, setLogs] = useState<CallLog[]>(DEMO_LOGS)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, busy: 0, noAnswer: 0 })
  const [useDemo, setUseDemo] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditingLog>({ _id: "", notes: "", disposition: "", tags: "" })
  const [filterDisposition, setFilterDisposition] = useState<string>("all")

  useEffect(() => {
    fetchCallLogs()
  }, [])

  const fetchCallLogs = async () => {
    try {
      setLoading(true)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${apiUrl}/api/calls/logs`)

      if (!response.ok) throw new Error("API not available")

      const data = await response.json()
      const callLogs = data.logs || DEMO_LOGS
      setLogs(callLogs)
      setUseDemo(false)
      calculateStats(callLogs)
    } catch (error) {
      console.log("Using demo logs:", error)
      setLogs(DEMO_LOGS)
      setUseDemo(true)
      calculateStats(DEMO_LOGS)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (callLogs: CallLog[]) => {
    const stats = {
      total: callLogs.length,
      completed: callLogs.filter((log) => log.disposition === "completed").length,
      failed: callLogs.filter((log) => log.disposition === "failed").length,
      busy: callLogs.filter((log) => log.disposition === "busy").length,
      noAnswer: callLogs.filter((log) => log.disposition === "no_answer").length,
    }
    setStats(stats)
  }

  const startEditing = (log: CallLog) => {
    setEditingId(log._id)
    setEditForm({
      _id: log._id,
      notes: log.notes || "",
      disposition: log.disposition || "completed",
      tags: log.tags?.join(", ") || "",
    })
  }

  const saveEdit = async (logId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${apiUrl}/api/calls/${logId}/log`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: editForm.notes,
          disposition: editForm.disposition,
          tags: editForm.tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t),
        }),
      })

      if (response.ok) {
        const updatedLogs = logs.map((log) =>
          log._id === logId
            ? {
                ...log,
                notes: editForm.notes,
                disposition: editForm.disposition,
                tags: editForm.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter((t) => t),
              }
            : log,
        )
        setLogs(updatedLogs)
        calculateStats(updatedLogs)
        setEditingId(null)
      }
    } catch (error) {
      console.error("Error saving call log:", error)
    }
  }

  const deleteLog = (logId: string) => {
    const updatedLogs = logs.filter((log) => log._id !== logId)
    setLogs(updatedLogs)
    calculateStats(updatedLogs)
  }

  const filteredLogs = filterDisposition === "all" ? logs : logs.filter((log) => log.disposition === filterDisposition)

  const dispositionData = [
    { name: "Completed", value: stats.completed },
    { name: "Failed", value: stats.failed },
    { name: "Busy", value: stats.busy },
    { name: "No Answer", value: stats.noAnswer },
  ]

  const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"]

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {useDemo && (
          <div className="mb-6 p-4 bg-ring/10 border border-ring rounded-lg text-sm">
            <p className="font-medium text-ring">Demo Mode - Showing sample data</p>
          </div>
        )}

        <h1 className="text-3xl font-bold mb-8">Call Logs & Analytics</h1>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase">Total</p>
            <p className="text-2xl font-bold text-accent">{stats.total}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase">Completed</p>
            <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase">Failed</p>
            <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase">Busy</p>
            <p className="text-2xl font-bold text-yellow-500">{stats.busy}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase">No Answer</p>
            <p className="text-2xl font-bold text-ring">{stats.noAnswer}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-card rounded-lg border border-border p-4">
            <h2 className="font-bold mb-4">Disposition Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dispositionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {COLORS.map((color) => (
                    <Cell key={`cell-${color}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-lg border border-border p-4">
            <h2 className="font-bold mb-4">Call Duration Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dispositionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex gap-4 items-center justify-between">
            <h2 className="font-bold">Recent Calls</h2>
            <div className="flex gap-2">
              <select
                value={filterDisposition}
                onChange={(e) => setFilterDisposition(e.target.value)}
                className="px-3 py-1 bg-input border border-border rounded text-sm"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="busy">Busy</option>
                <option value="no_answer">No Answer</option>
              </select>
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-input border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left">From</th>
                    <th className="px-4 py-2 text-left">To</th>
                    <th className="px-4 py-2 text-left">Duration</th>
                    <th className="px-4 py-2 text-left">Disposition</th>
                    <th className="px-4 py-2 text-left">Notes</th>
                    <th className="px-4 py-2 text-left">Tags</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log._id} className="border-b border-border hover:bg-input transition-colors">
                      <td className="px-4 py-2 font-mono text-xs">{log.from_number}</td>
                      <td className="px-4 py-2 font-mono text-xs">{log.to_number}</td>
                      <td className="px-4 py-2">{log.duration}s</td>
                      <td className="px-4 py-2">
                        {editingId === log._id ? (
                          <select
                            value={editForm.disposition}
                            onChange={(e) => setEditForm({ ...editForm, disposition: e.target.value })}
                            className="px-2 py-1 bg-input border border-border rounded text-xs"
                          >
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                            <option value="busy">Busy</option>
                            <option value="no_answer">No Answer</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              log.disposition === "completed"
                                ? "bg-green-500/20 text-green-500"
                                : log.disposition === "failed"
                                  ? "bg-destructive/20 text-destructive"
                                  : log.disposition === "busy"
                                    ? "bg-yellow-500/20 text-yellow-500"
                                    : "bg-ring/20 text-ring"
                            }`}
                          >
                            {log.disposition || "N/A"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs max-w-xs truncate">
                        {editingId === log._id ? (
                          <input
                            type="text"
                            value={editForm.notes}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            className="w-full px-2 py-1 bg-input border border-border rounded text-xs"
                            placeholder="Notes"
                          />
                        ) : (
                          log.notes || "-"
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {editingId === log._id ? (
                          <input
                            type="text"
                            value={editForm.tags}
                            onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                            className="w-full px-2 py-1 bg-input border border-border rounded text-xs"
                            placeholder="Tags (comma-separated)"
                          />
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {log.tags?.map((tag) => (
                              <span key={tag} className="bg-ring/20 text-ring px-1.5 py-0.5 rounded text-xs">
                                {tag}
                              </span>
                            )) || "-"}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <div className="flex gap-2 items-center">
                          {editingId === log._id ? (
                            <>
                              <button
                                onClick={() => saveEdit(log._id)}
                                className="px-2 py-1 bg-accent text-accent-foreground rounded text-xs hover:opacity-80"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 bg-input border border-border rounded text-xs hover:bg-muted"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(log)}
                                className="p-1 hover:bg-input rounded"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteLog(log._id)}
                                className="p-1 hover:bg-destructive/10 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                              {log.recording_url && (
                                <a
                                  href={log.recording_url}
                                  className="p-1 hover:bg-input rounded"
                                  title="Download Recording"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
