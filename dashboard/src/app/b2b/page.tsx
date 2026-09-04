"use client"
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInvoices, runB2BChaser } from '@/services/misc.api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Building2, Loader2, PlayCircle, AlertTriangle } from 'lucide-react'

export default function B2BPage() {
  const qc = useQueryClient()
  const [chaserResult, setChaserResult] = useState<any>(null)
  const [statusMsg, setStatusMsg] = useState('')

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: getInvoices,
    refetchInterval: 20000,
  })

  const overdueInvoices = invoices.filter((inv: any) => {
    if (!inv.due_date) return false
    return new Date(inv.due_date) < new Date() && inv.status !== 'paid'
  })

  const chaserMut = useMutation({
    mutationFn: runB2BChaser,
    onSuccess: (data) => {
      setChaserResult(data)
      setStatusMsg(`B2B chaser ran: ${data.processed ?? 0} invoices processed, ${data.chasers_sent ?? 0} chasers sent.`)
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: any) => setStatusMsg(`Error: ${e.response?.data?.detail?.error?.message ?? e.message}`),
  })

  const daysOverdue = (due: string) => {
    const d = Math.floor((Date.now() - new Date(due).getTime()) / 86400000)
    return d > 0 ? d : 0
  }

  const riskLevel = (days: number) =>
    days > 60 ? 'CRITICAL' : days > 30 ? 'HIGH' : days > 14 ? 'MEDIUM' : 'LOW'
  const riskVariant = (days: number): any =>
    days > 60 ? 'destructive' : days > 30 ? 'destructive' : days > 14 ? 'warning' : 'outline'

  const totalOverdue = overdueInvoices.reduce((s: number, inv: any) => s + (inv.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">B2B Overdue Receivables</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Overdue invoices — run AI chaser to send personalised collection emails.</p>
        </div>
        <Button onClick={() => chaserMut.mutate()} disabled={chaserMut.isPending} className="gap-2">
          {chaserMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Run B2B AI Chaser
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-0 rounded-xl border overflow-hidden">
        <div className="p-4 bg-muted/20 border-r">
          <p className="text-xs text-muted-foreground">Total Overdue</p>
          <p className="text-xl font-bold text-red-400 mt-1">₹{totalOverdue.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-4 bg-muted/20 border-r">
          <p className="text-xs text-muted-foreground">Overdue Invoices</p>
          <p className="text-xl font-bold mt-1">{overdueInvoices.length}</p>
        </div>
        <div className="p-4 bg-muted/20">
          <p className="text-xs text-muted-foreground">Critical ({'>'}60 days)</p>
          <p className="text-xl font-bold text-red-500 mt-1">
            {overdueInvoices.filter((inv: any) => daysOverdue(inv.due_date) > 60).length}
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-primary">{statusMsg}</div>
      )}

      {chaserResult && chaserResult.results?.length > 0 && (
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-emerald-500">Chaser Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chaserResult.results.map((r: any, i: number) => (
                <div key={i} className="rounded-md border bg-muted/20 p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-primary">{r.invoice_id}</span>
                    <Badge variant={r.status === 'sent' ? 'success' : 'outline'} className="text-xs">{r.status}</Badge>
                  </div>
                  {r.chaser_email && <p className="text-muted-foreground line-clamp-2">{r.chaser_email}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold">Overdue Invoice Registry</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Days Overdue</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">Loading...</TableCell></TableRow>
              ) : overdueInvoices.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">No overdue invoices found.</TableCell></TableRow>
              ) : overdueInvoices
                  .sort((a: any, b: any) => daysOverdue(b.due_date) - daysOverdue(a.due_date))
                  .map((inv: any, i: number) => {
                    const days = daysOverdue(inv.due_date)
                    return (
                      <TableRow key={inv.id || i}>
                        <TableCell className="font-mono text-xs text-primary">{inv.id}</TableCell>
                        <TableCell className="text-xs">{inv.customer_id}</TableCell>
                        <TableCell className="font-semibold text-sm text-red-400">₹{(inv.amount || 0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-xs">{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span className={`font-bold text-sm ${days > 30 ? 'text-red-500' : days > 14 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {days}d
                          </span>
                        </TableCell>
                        <TableCell><Badge variant={riskVariant(days)} className="text-xs">{riskLevel(days)}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{inv.status?.toUpperCase() ?? 'UNPAID'}</Badge></TableCell>
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
