"use client"
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBatchRuns, runBatchSync } from '@/services/misc.api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PlayCircle, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

export default function BatchRecoveryPage() {
  const qc = useQueryClient()
  const [lastRun, setLastRun] = useState<any>(null)
  const [runError, setRunError] = useState('')

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: getBatchRuns,
    refetchInterval: 15000,
  })

  const batchMut = useMutation({
    mutationFn: runBatchSync,
    onSuccess: (data) => {
      setLastRun(data)
      setRunError('')
      qc.invalidateQueries({ queryKey: ['batches'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
    },
    onError: (e: any) => setRunError(e.response?.data?.detail?.error?.message ?? e.message),
  })

  const totalRecovered = batches.reduce((s: number, b: any) => s + (b.total_revenue_recovered || 0), 0)
  const totalAtRisk    = batches.reduce((s: number, b: any) => s + (b.total_revenue_at_risk || 0), 0)
  const overallRate    = totalAtRisk > 0 ? ((totalRecovered / totalAtRisk) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batch Recovery Operations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            AI autonomously processes all open recovery cases and recovers measurable revenue.
          </p>
        </div>
        <Button onClick={() => batchMut.mutate()} disabled={batchMut.isPending} size="lg" className="gap-2">
          {batchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Run Recovery Batch
        </Button>
      </div>

      {/* Aggregate metrics */}
      <div className="grid grid-cols-3 gap-0 rounded-xl border overflow-hidden">
        <div className="p-4 bg-muted/20 border-r">
          <p className="text-xs text-muted-foreground">Total Recovered (All Batches)</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">₹{totalRecovered.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-4 bg-muted/20 border-r">
          <p className="text-xs text-muted-foreground">Total at Risk (Attempted)</p>
          <p className="text-xl font-bold text-red-400 mt-1">₹{totalAtRisk.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-4 bg-muted/20">
          <p className="text-xs text-muted-foreground">Overall Recovery Rate</p>
          <p className="text-xl font-bold mt-1">{overallRate}%</p>
        </div>
      </div>

      {runError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{runError}</div>
      )}

      {/* Last Run Detail */}
      {lastRun && (
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-emerald-500 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Latest Batch Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Processed', value: lastRun.total_cases ?? lastRun.processed ?? 0 },
                { label: 'Recovered', value: lastRun.successful_recoveries ?? lastRun.recovered ?? 0 },
                { label: 'Failed/Stopped', value: lastRun.failed ?? 0 },
                { label: 'Revenue Recovered', value: `₹${(lastRun.total_revenue_recovered || 0).toLocaleString('en-IN')}` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Per-case results */}
            {lastRun.results && lastRun.results.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Per-Case Results</p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {lastRun.results.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs border rounded-md p-2 bg-muted/10">
                      <span className="font-mono text-primary">{r.case_id}</span>
                      <div className="flex items-center gap-2">
                        {r.recovered_amount > 0 && (
                          <span className="text-emerald-400 font-semibold">₹{(r.recovered_amount || 0).toLocaleString('en-IN')}</span>
                        )}
                        <Badge variant={r.status === 'recovered' ? 'success' : r.status === 'stopped' ? 'outline' : 'destructive'} className="text-xs">
                          {r.status}
                        </Badge>
                        {r.action && <span className="text-muted-foreground">{r.action}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historical Batches */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold">Batch Run History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch ID</TableHead>
                <TableHead>Cases</TableHead>
                <TableHead>Recovered</TableHead>
                <TableHead>At Risk</TableHead>
                <TableHead>Revenue Recovered</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">Loading...</TableCell></TableRow>
              ) : batches.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">No batch runs yet. Click "Run Recovery Batch" above.</TableCell></TableRow>
              ) : batches.map((b: any, i: number) => {
                const rate = b.total_revenue_at_risk > 0
                  ? ((b.total_revenue_recovered / b.total_revenue_at_risk) * 100).toFixed(1) : '0'
                return (
                  <TableRow key={b.batch_id || i}>
                    <TableCell className="font-mono text-xs text-primary">{b.batch_id}</TableCell>
                    <TableCell>{b.total_cases ?? '—'}</TableCell>
                    <TableCell className="text-emerald-400 font-medium">{b.successful_recoveries ?? '—'}</TableCell>
                    <TableCell className="text-red-400">₹{(b.total_revenue_at_risk || 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-emerald-400 font-semibold">₹{(b.total_revenue_recovered || 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Badge variant={parseFloat(rate) > 50 ? 'success' : parseFloat(rate) > 20 ? 'warning' : 'outline'} className="text-xs">
                        {rate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.started_at ? new Date(b.started_at).toLocaleString() : b.created_at ? new Date(b.created_at).toLocaleString() : '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
