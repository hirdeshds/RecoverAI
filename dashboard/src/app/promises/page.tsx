"use client"
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPromises, createPromise, fulfillPromise, breakPromise, cancelPromise, getCustomers } from '@/services/misc.api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Handshake, CheckCircle2, AlertTriangle, Clock, Plus, Loader2, XCircle } from 'lucide-react'

const STATUS_VARIANT: Record<string, any> = {
  pending: 'warning', fulfilled: 'success', broken: 'destructive',
  cancelled: 'outline', overdue: 'destructive', expired: 'outline',
}

export default function PromisesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ customer_id: '', promised_amount: '', promised_date: '', notes: '', recovery_case_id: '' })
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState<Record<string, string>>({})
  const [breakReason, setBreakReason] = useState<Record<string, string>>({})
  const [showBreak, setShowBreak] = useState<Record<string, boolean>>({})

  const { data: promises = [], isLoading } = useQuery({
    queryKey: ['promises'],
    queryFn: () => getPromises(),
    refetchInterval: 15000,
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  })

  const createMut = useMutation({
    mutationFn: () => createPromise({
      customer_id: form.customer_id,
      promised_amount: parseFloat(form.promised_amount),
      promised_date: form.promised_date,
      recovery_case_id: form.recovery_case_id || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promises'] })
      setShowCreate(false)
      setForm({ customer_id: '', promised_amount: '', promised_date: '', notes: '', recovery_case_id: '' })
      setFormError('')
    },
    onError: (e: any) => setFormError(e.response?.data?.detail?.error?.message ?? e.message),
  })

  const fulfillMut = useMutation({
    mutationFn: ({ id, paymentId }: { id: string; paymentId: string }) => fulfillPromise(id, paymentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promises'] }),
    onError: (e: any, vars) => setActionError(prev => ({ ...prev, [vars.id]: e.response?.data?.detail?.error?.message ?? e.message })),
  })

  const breakMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => breakPromise(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promises'] }),
    onError: (e: any, vars) => setActionError(prev => ({ ...prev, [vars.id]: e.response?.data?.detail?.error?.message ?? e.message })),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelPromise(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promises'] }),
    onError: (e: any) => console.error(e),
  })

  const totals = {
    active: promises.filter((p: any) => p.status === 'pending').length,
    fulfilled: promises.filter((p: any) => p.status === 'fulfilled').length,
    overdue: promises.filter((p: any) => ['overdue', 'broken'].includes(p.status)).length,
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promise-to-Pay</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Customer payment commitments tracked by the AI recovery agent.</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
          <Plus className="h-4 w-4" /> Create Promise
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-0 rounded-xl border overflow-hidden">
        {[
          { label: 'Active Promises', value: totals.active, icon: Handshake, color: 'text-blue-500' },
          { label: 'Fulfilled', value: totals.fulfilled, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Overdue / Broken', value: totals.overdue, icon: AlertTriangle, color: 'text-red-500' },
        ].map((kpi, i) => (
          <div key={kpi.label} className={`p-4 bg-muted/20 ${i < 2 ? 'border-r' : ''}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Create New Promise</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Customer *</label>
                <select
                  value={form.customer_id}
                  onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                  className="w-full rounded-md border bg-background h-9 text-sm px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select customer...</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Promised Amount (INR) *</label>
                <input
                  type="number"
                  placeholder="1500"
                  value={form.promised_amount}
                  onChange={e => setForm(f => ({ ...f, promised_amount: e.target.value }))}
                  className="w-full rounded-md border bg-background h-9 text-sm px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Promise Date *</label>
                <input
                  type="date"
                  value={form.promised_date}
                  min={today}
                  onChange={e => setForm(f => ({ ...f, promised_date: e.target.value }))}
                  className="w-full rounded-md border bg-background h-9 text-sm px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Recovery Case ID (optional)</label>
                <input
                  placeholder="case_..."
                  value={form.recovery_case_id}
                  onChange={e => setForm(f => ({ ...f, recovery_case_id: e.target.value }))}
                  className="w-full rounded-md border bg-background h-9 text-sm px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium">Notes</label>
                <input
                  placeholder="Customer agreed to pay via UPI..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-md border bg-background h-9 text-sm px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            {formError && <p className="text-xs text-red-400 mt-2">{formError}</p>}
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !form.customer_id || !form.promised_amount || !form.promised_date}
                className="gap-2"
              >
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Promise
              </Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setFormError('') }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm font-semibold">All Promises</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promise ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Promise Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">Loading...</TableCell></TableRow>
              ) : promises.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">No promises yet. Create one above or run the AI pipeline.</TableCell></TableRow>
              ) : promises.map((p: any) => (
                <React.Fragment key={p.id}>
                  <TableRow>
                    <TableCell className="font-mono text-xs text-primary">{p.id}</TableCell>
                    <TableCell className="text-xs">{p.customer_id}</TableCell>
                    <TableCell className="font-semibold text-sm">₹{(p.promised_amount || 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-xs">{p.promised_date ? new Date(p.promised_date).toLocaleDateString() : '—'}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[p.status] ?? 'outline'} className="text-xs">{p.status?.toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{p.recovery_case_id ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {p.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded px-2 py-0.5"
                            onClick={() => setShowBreak(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                          >
                            Break
                          </button>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-0.5"
                            onClick={() => cancelMut.mutate(p.id)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {showBreak[p.id] && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/20 py-2 px-4">
                        <div className="flex gap-2 items-center">
                          <input
                            className="flex-1 text-xs rounded border bg-background px-2 h-7 focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Reason for breaking promise..."
                            value={breakReason[p.id] ?? ''}
                            onChange={e => setBreakReason(prev => ({ ...prev, [p.id]: e.target.value }))}
                          />
                          <button
                            className="text-xs bg-red-500 text-white rounded px-3 py-1 hover:bg-red-600"
                            onClick={() => {
                              breakMut.mutate({ id: p.id, reason: breakReason[p.id] ?? 'Not paid' })
                              setShowBreak(prev => ({ ...prev, [p.id]: false }))
                            }}
                          >
                            Confirm Break
                          </button>
                        </div>
                        {actionError[p.id] && <p className="text-xs text-red-400 mt-1">{actionError[p.id]}</p>}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
