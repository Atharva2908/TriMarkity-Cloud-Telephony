"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Download, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCallLogs } from "@/hooks/use-call-logs"

export function CallLogsScreen() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
  const { logs, isLoading, error, searchLogs, getCallStats, mutate } = useCallLogs(apiUrl)

  const [filterStatus, setFilterStatus] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredLogs, setFilteredLogs] = useState(logs)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    const loadStats = async () => {
      const stats = await getCallStats()
      setStats(stats)
    }
    loadStats()
  }, [getCallStats])

  useEffect(() => {
    let result = logs

    if (filterStatus !== "all") {
      result = result.filter((log) => log.status === filterStatus)
    }

    if (searchQuery) {
      result = result.filter(
        (log) =>
          log.to_number?.includes(searchQuery) ||
          log.from_number?.includes(searchQuery) ||
          log.notes?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    setFilteredLogs(result)
  }, [logs, filterStatus, searchQuery])

  const formatDuration = (seconds: number) => {
    if (seconds === 0 || !seconds) return "--:--"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-"
    try {
      const date = new Date(dateStr)
      return date.toLocaleString()
    } catch {
      return dateStr
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ended":
      case "completed":
        return "text-green-500"
      case "failed":
      case "missed":
        return "text-red-500"
      case "active":
      case "dialing":
        return "text-yellow-500"
      default:
        return "text-slate-400"
    }
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="text-xs text-muted-foreground font-semibold">Total Calls</div>
            <div className="text-2xl font-bold text-foreground mt-1">{stats.total_calls}</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <div className="text-xs text-muted-foreground font-semibold">Completed</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.completed_calls}</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <div className="text-xs text-muted-foreground font-semibold">Failed</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.failed_calls}</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <div className="text-xs text-muted-foreground font-semibold">Avg Duration</div>
            <div className="text-2xl font-bold text-accent mt-1">{formatDuration(stats.average_duration)}</div>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <Input
          placeholder="Search by number or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Button onClick={() => mutate()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "ended", "active", "failed"].map((status) => (
          <Button
            key={status}
            onClick={() => setFilterStatus(status)}
            variant={filterStatus === status ? "default" : "outline"}
            size="sm"
            className={filterStatus === status ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {isLoading && (
        <Card className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading call logs...</p>
        </Card>
      )}

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/20">
          <p className="text-destructive text-sm">Failed to load call logs. Please try again.</p>
        </Card>
      )}

      <div className="space-y-2">
        {!isLoading && filteredLogs.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No call logs found</Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log._id} className="p-4 hover:bg-secondary/50 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{log.to_number}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                  {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">{formatDuration(log.duration)}</p>
                  <span className={`text-xs font-semibold ${getStatusColor(log.status)}`}>
                    {log.status.toUpperCase()}
                  </span>
                </div>
                {log.recording_url && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={log.recording_url} download target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
