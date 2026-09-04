"use client"
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, Brain, ShieldCheck, CreditCard, Link2, Zap,
  CheckCircle2, AlertTriangle, XCircle, Clock, Loader2,
  User, FileText, Activity, TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getRecoveryCase, runAIDecision, generatePaymentLink, getRecoveryActions } from '@/services/recovery.api'
import { getAuditLogs } from '@/services/dashboard.api'

const STATUS_VARIANT: Record<string, any> = {
  recovered: 'success', open: 'warning', stopped: 'outline',
  failed: 'destructive', escalated: 'destructive', in_progress: 'default'
}
const PRIORITY_VARIANT: Record<string, any> = {
  HIGH: 'destructive', MEDIUM: 'warning', LOW: 'outline', CRITICAL: 'destructive'
}

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const [decision, setDecision] = useState<any>(null)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState('')

  const { data: caseData, isLoading, isError } = useQuery({
    queryKey: ['case', id],
    queryFn: () => getRecoveryCase(id),
    enabled: !!id,
  })

  const { data: actions = [] } = useQuery({
    queryKey: ['recovery-actions', id],
    queryFn: () => getRecoveryActions(id),
    refetchInterval: 10000,
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs', 'recovery_case', id],
    queryFn: () => getAuditLogs(20, 'recovery_case', id),
    refetchInterval: 10000,
  })

  const decideMutation = useMutation({
    mutationFn: () => runAIDecision(id),
    onSuccess: (data) => {
      setDecision(data)
      setActionStatus('AI decision generated successfully.')
      qc.invalidateQueries({ queryKey: ['case', id] })
    },
    onError: (e: any) => setActionStatus(`AI error: ${e.response?.data?.detail?.error?.message ?? e.message}`),
  })

  const linkMutation = useMutation({
    mutationFn: () => generatePaymentLink(id),
    onSuccess: (data) => {
      setPaymentLink(data.payment_link_url ?? data.url ?? data.short_url ?? JSON.stringify(data))
      setActionStatus('Payment link generated.')
      qc.invalidateQueries({ queryKey: ['audit-logs', 'recovery_case', id] })
    },
    onError: (e: any) => setActionStatus(`Error: ${e.response?.data?.detail?.error?.message ?? e.message}`),
  })

  if (isLoading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )

  if (isError || !caseData) return (
    <div className="flex h-full items-center justify-center flex-col gap-3">
      <XCircle className="h-8 w-8 text-red-500" />
      <p className="text-sm text-muted-foreground">Case not found or backend unreachable.</p>
      <Button variant="outline" size="sm" onClick={() => router.back()}>Go back</Button>
    </div>
  )

  const c = caseData
  const lastAction = actions[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{id}</h1>
            <Badge variant={STATUS_VARIANT[c.status] ?? 'outline'}>{c.status?.toUpperCase()}</Badge>
            <Badge variant={PRIORITY_VARIANT[c.priority] ?? 'outline'}>{c.priority}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Detected {new Date(c.created_at).toLocaleString()} · {c.attempt_count ?? 0} attempt(s)
          </p>
        </div>
      </div>

      {/* Recovery Story — judge-facing summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 rounded-xl border overflow-hidden">
        {[
          { label: 'Amount at Risk', value: fmt(c.amount_at_risk), icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Amount Recovered', value: fmt(c.amount_recovered), icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Risk Score', value: `${Math.round((c.risk_score ?? 0) * 100)}/100`, icon: TrendingUp, color: 'text-amber-500' },
          { label: 'Escalation Level', value: c.escalation_level ?? 0, icon: ShieldCheck, color: 'text-purple-500' },
        ].map((item, i) => (
          <div key={item.label} className={`p-4 bg-muted/20 ${i < 3 ? 'border-r' : ''}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
            <p className="text-lg font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer + Revenue Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" /> Customer & Revenue Context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Customer ID',     value: c.customer_id },
              { label: 'Invoice ID',      value: c.invoice_id ?? '—' },
              { label: 'Payment ID',      value: c.payment_id ?? '—' },
              { label: 'Revenue Source',  value: c.risk_type ?? '—' },
              { label: 'Currency',        value: c.currency ?? 'INR' },
              { label: 'Stop Reason',     value: c.stop_reason ?? 'Not stopped' },
              { label: 'Recovery Action', value: c.recovery_action ?? lastAction?.action_type ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium font-mono text-xs">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Decision Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" /> AI Diagnosis & Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {decision ? (
              <div className="space-y-3">
                {[
                  { label: 'Strategy',        value: decision.decision?.decision },
                  { label: 'Priority',        value: decision.decision?.priority },
                  { label: 'Channel',         value: decision.decision?.channel ?? '—' },
                  { label: 'Next Action',     value: decision.decision?.next_action ?? '—' },
                  { label: 'Needs Escalation',value: decision.decision?.requires_escalation ? 'Yes' : 'No' },
                  { label: 'Should Stop',     value: decision.decision?.should_stop ? 'Yes ⛔' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{String(value ?? '—')}</span>
                  </div>
                ))}
                {decision.decision?.reason && (
                  <div className="mt-3 rounded-md bg-muted/30 border p-3">
                    <p className="text-xs text-muted-foreground mb-1">AI Reasoning</p>
                    <p className="text-xs leading-relaxed">{decision.decision.reason}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 gap-3">
                <Brain className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground text-center">
                  Run AI diagnosis to get a recovery recommendation.
                </p>
                <Button 
                  size="sm"
                  onClick={() => decideMutation.mutate()}
                  disabled={decideMutation.isPending}
                  className="gap-2"
                >
                  {decideMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                  Run AI Diagnosis
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recovery Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-500" /> Execute Recovery Action
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <Button onClick={() => decideMutation.mutate()} disabled={decideMutation.isPending} variant="outline" className="gap-2">
              {decideMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Run AI Decision
            </Button>
            <Button onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending} variant="outline" className="gap-2">
              {linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Generate Payment Link
            </Button>
          </div>

          {actionStatus && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-primary mb-4">{actionStatus}</div>
          )}

          {paymentLink && (
            <div className="rounded-md border bg-emerald-500/10 border-emerald-500/30 p-3 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Payment Link (Razorpay Test Mode)</p>
              <a href={paymentLink} target="_blank" rel="noopener noreferrer"
                className="text-sm text-emerald-400 underline break-all">{paymentLink}</a>
            </div>
          )}

          {/* Action History */}
          {actions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Action History</p>
              <div className="space-y-2">
                {actions.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs border rounded-md p-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3 w-3 text-cyan-500" />
                      <span className="font-medium">{a.action_type}</span>
                      <span className="text-muted-foreground">{a.channel ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.status === 'executed' ? 'success' : 'outline'} className="text-xs">{a.status}</Badge>
                      <span className="text-muted-foreground">{new Date(a.executed_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recovery Workflow Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" /> Recovery Workflow Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No audit events for this case.</p>
          ) : (
            <div className="relative space-y-4">
              {auditLogs.map((log: any, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-cyan-500 mt-1.5" />
                    {i < auditLogs.length - 1 && <div className="w-px h-full bg-border mt-1" />}
                  </div>
                  <div className="pb-3 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">{log.action}</p>
                      <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{log.details || log.detail || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
