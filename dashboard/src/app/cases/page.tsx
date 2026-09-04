"use client"
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getRecoveryCases } from '@/services/recovery.api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Filter, ArrowRight, AlertTriangle, CheckCircle2, Activity } from 'lucide-react'

const STATUS_VARIANT: Record<string, any> = {
  recovered: 'success', open: 'warning', stopped: 'outline',
  failed: 'destructive', escalated: 'destructive', in_progress: 'default'
}
const PRIORITY_VARIANT: Record<string, any> = {
  HIGH: 'destructive', MEDIUM: 'warning', LOW: 'outline', CRITICAL: 'destructive'
}

export default function RecoveryCasesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['cases', statusFilter, priorityFilter],
    queryFn: () => getRecoveryCases(statusFilter || undefined, priorityFilter || undefined),
    refetchInterval: 10000,
  })

  const filtered = cases.filter((c: any) =>
    !search ||
    c.id?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_id?.toLowerCase().includes(search.toLowerCase()) ||
    c.risk_type?.toLowerCase().includes(search.toLowerCase())
  )

  const totals = {
    all: cases.length,
    open: cases.filter((c: any) => c.status === 'open').length,
    recovered: cases.filter((c: any) => c.status === 'recovered').length,
    escalated: cases.filter((c: any) => c.escalation_level > 0).length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recovery Cases</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Click any case to view the full AI recovery detail and execute actions.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-0 rounded-xl border overflow-hidden">
        {[
          { label: 'Total Cases', value: totals.all, icon: Activity, color: 'text-primary' },
          { label: 'Open', value: totals.open, icon: AlertTriangle, color: 'text-amber-500' },
          { label: 'Recovered', value: totals.recovered, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Escalated', value: totals.escalated, icon: AlertTriangle, color: 'text-red-500' },
        ].map((item, i) => (
          <div key={item.label} className={`p-4 bg-muted/20 ${i < 3 ? 'border-r' : ''}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
            <p className="text-2xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4">
          <CardTitle className="text-sm font-semibold">All Cases</CardTitle>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search ID, customer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-background pl-8 rounded-md border h-8 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="rounded-md border bg-background h-8 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="recovered">Recovered</option>
              <option value="stopped">Stopped</option>
              <option value="escalated">Escalated</option>
              <option value="failed">Failed</option>
            </select>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
              className="rounded-md border bg-background h-8 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Risk Type</TableHead>
                <TableHead>At Risk</TableHead>
                <TableHead>Recovered</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="h-24 text-center text-sm text-muted-foreground">Loading cases...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="h-24 text-center text-sm text-muted-foreground">No cases found. Run the simulator to create one.</TableCell></TableRow>
              ) : filtered.map((c: any) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/cases/${c.id}`)}
                >
                  <TableCell className="font-mono text-xs text-primary">{c.id}</TableCell>
                  <TableCell className="text-xs">{c.customer_id}</TableCell>
                  <TableCell className="text-xs">{c.risk_type ?? '—'}</TableCell>
                  <TableCell className="font-semibold text-sm text-red-400">₹{(c.amount_at_risk || 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell className="font-semibold text-sm text-emerald-400">₹{(c.amount_recovered || 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell><Badge variant={PRIORITY_VARIANT[c.priority] ?? 'outline'} className="text-xs">{c.priority}</Badge></TableCell>
                  <TableCell>
                    <span className={`font-semibold text-sm ${(c.risk_score ?? 0) > 0.7 ? 'text-red-500' : 'text-amber-500'}`}>
                      {Math.round((c.risk_score ?? 0) * 100)}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[c.status] ?? 'outline'} className="text-xs">{c.status?.toUpperCase()}</Badge></TableCell>
                  <TableCell className="text-xs">{c.attempt_count ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
