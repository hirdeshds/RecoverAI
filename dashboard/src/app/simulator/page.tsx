"use client"
import React, { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Play, Zap, Brain, ShieldCheck, CreditCard, 
  Workflow, CheckCircle2, XCircle, Loader2,
  ArrowRight, ReceiptText, RefreshCw
} from 'lucide-react'

const API_BASE = '/api/v2'
const HEADERS = { 'X-API-Key': 'track03_dev_key', 'Content-Type': 'application/json' }

type PipelineStatus = 'pending' | 'active' | 'completed' | 'failed' | 'skipped'

interface PipelineNode {
  id: number
  label: string
  desc: string
  status: PipelineStatus
  detail?: string
}

const INITIAL_NODES: PipelineNode[] = [
  { id: 1, label: 'Payment Detected',    desc: 'Webhook / checkout event ingested',  status: 'pending' },
  { id: 2, label: 'Risk Analysis',       desc: 'Scoring the revenue at risk',         status: 'pending' },
  { id: 3, label: 'AI Decision',         desc: 'Groq LLM selects recovery strategy', status: 'pending' },
  { id: 4, label: 'Guardrail Check',     desc: 'Frequency, limits & stop conditions', status: 'pending' },
  { id: 5, label: 'Recovery Executed',   desc: 'Action dispatched to customer',      status: 'pending' },
]

export default function SimulatorPage() {
  const [amount, setAmount]         = useState(1499)
  const [email, setEmail]           = useState('demo@recoverai.in')
  const [customerName, setCustomerName] = useState('Demo Customer')
  const [scenario, setScenario]     = useState('PAYMENT_FAILURE')
  const [statusMsg, setStatusMsg]   = useState('')
  const [isRunning, setIsRunning]   = useState(false)
  const [logs, setLogs]             = useState<string[]>([])
  const [nodes, setNodes]           = useState<PipelineNode[]>(INITIAL_NODES)
  const [decision, setDecision]     = useState<any>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const log = (msg: string) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`
    setLogs(prev => [...prev, line])
    setTimeout(() => logRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 50)
  }

  const setNode = (id: number, status: PipelineStatus, detail?: string) =>
    setNodes(prev => prev.map(n => n.id === id ? { ...n, status, ...(detail ? { detail } : {}) } : n))

  const reset = () => {
    setLogs([])
    setDecision(null)
    setStatusMsg('')
    setNodes(INITIAL_NODES.map(n => ({ ...n, status: 'pending', detail: undefined })))
  }

  // ─── Main pipeline without Razorpay ─────────────────────────────────────────
  const runPipeline = async (overrideAmount?: number, overrideEmail?: string) => {
    const amt   = overrideAmount ?? amount
    const em    = overrideEmail  ?? email
    reset()
    setIsRunning(true)
    setStatusMsg('Starting pipeline...')

    try {
      // Step 1 — Create customer + invoice (simulate payment failure event)
      setNode(1, 'active')
      log(`Creating customer (${em})...`)
      const custRes = await fetch(`${API_BASE}/customers`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ name: customerName, email: em, phone: '+919876543210' })
      })
      if (!custRes.ok) throw new Error('Customer creation failed: ' + await custRes.text())
      const cust = await custRes.json()
      log(`✓ Customer created: ${cust.customer_id}`)

      const due = new Date()
      if (scenario === 'OVERDUE_INVOICE') due.setDate(due.getDate() - 30)
      const invRes = await fetch(`${API_BASE}/invoices`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ customer_id: cust.customer_id, amount: amt, currency: 'INR', due_date: due.toISOString() })
      })
      if (!invRes.ok) throw new Error('Invoice creation failed: ' + await invRes.text())
      const inv = await invRes.json()
      log(`✓ Invoice created: ${inv.invoice_id}`)
      setNode(1, 'completed', `Customer: ${cust.customer_id} | Invoice: ${inv.invoice_id}`)

      // Step 2 — Risk event
      setNode(2, 'active')
      log('Detecting revenue risk event...')
      const evtType = scenario === 'CHECKOUT_ABANDON' ? 'checkout.abandoned'
                    : scenario === 'OVERDUE_INVOICE'  ? 'payment.error'
                    : 'invoice.payment_failed'
      const riskRes = await fetch(`${API_BASE}/risk-events`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({
          event_type: evtType,
          customer_id: cust.customer_id,
          invoice_id: inv.invoice_id,
          amount: amt, currency: 'INR',
          days_overdue: scenario === 'OVERDUE_INVOICE' ? 30 : 5
        })
      })
      if (!riskRes.ok) throw new Error('Risk event failed: ' + await riskRes.text())
      const risk = await riskRes.json()
      log(`✓ Risk Case: ${risk.case_id} | Score: ${risk.risk_score} | Priority: ${risk.priority}`)
      setNode(2, 'completed', `Case: ${risk.case_id} | Score: ${(risk.risk_score * 100).toFixed(0)}`)

      // Step 3 — AI decision
      setNode(3, 'active')
      log('Calling Groq AI for recovery decision...')
      const decRes = await fetch(`${API_BASE}/recovery-cases/${risk.case_id}/decide`, {
        method: 'POST', headers: HEADERS
      })
      if (!decRes.ok) throw new Error('AI decision failed: ' + await decRes.text())
      const decData = await decRes.json()
      setDecision(decData)
      log(`✓ AI Decision: ${decData.decision?.decision ?? decData.decision?.action_type ?? JSON.stringify(decData.decision)}`)
      setNode(3, 'completed', `Strategy: ${decData.decision?.decision ?? 'N/A'}`)

      // Step 4 — Guardrail
      setNode(4, 'active')
      log('Running guardrail checks...')
      await new Promise(r => setTimeout(r, 500))
      if (decData.status === 'stopped') {
        log(`⛔ Guardrail BLOCKED: ${decData.reason}`)
        setNode(4, 'failed', `Blocked: ${decData.reason}`)
        setNode(5, 'skipped', 'Blocked by guardrail')
        setStatusMsg('Pipeline stopped by guardrail.')
        return
      }
      log('✓ Guardrail APPROVED execution')
      setNode(4, 'completed', 'Frequency ✓ | Limits ✓ | Stop-condition ✓')

      // Step 5 — Recovery action executed
      setNode(5, 'active')
      log(`Executing recovery: ${decData.decision?.decision ?? 'action'}`)
      await new Promise(r => setTimeout(r, 400))
      const channel = decData.decision?.channel ?? decData.decision?.decision ?? 'email'
      log(`✓ Recovery action dispatched via ${channel}`)
      setNode(5, 'completed', `Dispatched via: ${channel}`)
      setStatusMsg(`Pipeline complete — recovery action dispatched via ${channel}.`)
    } catch (e: any) {
      log(`❌ Error: ${e.message}`)
      setStatusMsg('Pipeline failed. See log for details.')
    } finally {
      setIsRunning(false)
    }
  }

  // ─── Razorpay Checkout ───────────────────────────────────────────────────────
  const launchRazorpay = async () => {
    setStatusMsg('Creating Razorpay order...')
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, customer_name: customerName, customer_email: email, customer_contact: '+919876543210' })
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.detail || 'Failed to create order')

      const rzp = new (window as any).Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'RecoverAI Platform',
        description: `Recovery simulation — ₹${amount}`,
        order_id: order.order_id,
        prefill: { name: order.customer.name, email: order.customer.email, contact: order.customer.contact },
        theme: { color: '#0f172a' },
        handler: async (response: any) => {
          setStatusMsg('Verifying payment signature...')
          const vRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response)
          })
          const vData = await vRes.json()
          if (vRes.ok) {
            setStatusMsg(`✅ Payment verified! ID: ${vData.payment_id}`)
          } else {
            setStatusMsg(`❌ Verification failed: ${vData.detail}`)
          }
        },
        modal: {
          ondismiss: () => {
            setStatusMsg('Checkout closed — running AI failure recovery pipeline...')
            runPipeline(amount, email)
          }
        }
      })
      rzp.on('payment.failed', (evt: any) => {
        setStatusMsg(`Payment failed: ${evt.error.description}`)
        runPipeline(amount, email)
      })
      rzp.open()
      setStatusMsg('Razorpay checkout opened...')
    } catch (e: any) {
      setStatusMsg(`Error: ${e.message}`)
    }
  }

  const nodeIcon = (status: PipelineStatus) => {
    if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
    if (status === 'failed')    return <XCircle      className="h-5 w-5 text-red-500" />
    if (status === 'active')    return <Loader2      className="h-5 w-5 text-blue-500 animate-spin" />
    if (status === 'skipped')   return <XCircle      className="h-5 w-5 text-muted-foreground" />
    return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
  }

  return (
    <>
      {/* Load Razorpay SDK */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="flex-1 space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Demo Simulator</h2>
          <p className="text-muted-foreground mt-1">
            End-to-end hackathon demo — real Razorpay checkout + live AI recovery pipeline.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>Simulation Parameters</CardTitle>
              <CardDescription>Configure and trigger a live recovery scenario.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Customer Name</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Customer Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Amount (INR)</label>
                <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Failure Scenario</label>
                <select value={scenario} onChange={e => setScenario(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="PAYMENT_FAILURE">Payment Failure (insufficient funds)</option>
                  <option value="CHECKOUT_ABANDON">Checkout Abandonment</option>
                  <option value="OVERDUE_INVOICE">B2B Overdue Invoice (30 days)</option>
                  <option value="HIGH_VALUE">High-Value Transaction (guardrail test)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button onClick={() => launchRazorpay()} disabled={isRunning} variant="outline" className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" /> Razorpay Checkout
                </Button>
                <Button onClick={() => runPipeline()} disabled={isRunning} className="w-full">
                  {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Run AI Pipeline
                </Button>
              </div>
              <Button onClick={reset} variant="ghost" size="sm" className="w-full text-muted-foreground">
                <RefreshCw className="h-3 w-3 mr-2" /> Reset
              </Button>

              {statusMsg && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium text-primary">
                  {statusMsg}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pipeline Visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" /> Live Pipeline Execution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {nodes.map((node, idx) => (
                  <div key={node.id}>
                    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      node.status === 'active'    ? 'border-blue-500/50 bg-blue-500/5' :
                      node.status === 'completed' ? 'border-emerald-500/30 bg-emerald-500/5' :
                      node.status === 'failed'    ? 'border-red-500/30 bg-red-500/5' :
                      'border-border bg-muted/10'
                    }`}>
                      {nodeIcon(node.status)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{node.label}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {node.detail ?? node.desc}
                        </div>
                      </div>
                      <Badge variant={
                        node.status === 'completed' ? 'success' :
                        node.status === 'active' ? 'default' :
                        node.status === 'failed' ? 'destructive' : 'outline'
                      } className="text-xs shrink-0">
                        {node.status.toUpperCase()}
                      </Badge>
                    </div>
                    {idx < nodes.length - 1 && (
                      <div className="flex justify-center py-0.5">
                        <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Decision Card */}
        {decision && (
          <Card className="border-emerald-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-500">
                <Brain className="h-5 w-5" /> AI Recovery Decision
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { label: 'Strategy',       value: decision.decision?.decision ?? decision.decision?.action_type ?? '—' },
                  { label: 'Priority',       value: decision.decision?.priority ?? '—' },
                  { label: 'Escalation',     value: decision.decision?.requires_escalation ? 'Yes' : 'No' },
                  { label: 'Stop Recovery',  value: decision.decision?.should_stop ? 'Yes' : 'No' },
                  { label: 'Channel',        value: decision.decision?.channel ?? '—' },
                  { label: 'Next Action',    value: decision.decision?.next_action ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-md border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground mb-1">{label}</div>
                    <div className="text-sm font-semibold">{String(value)}</div>
                  </div>
                ))}
              </div>
              {decision.decision?.reason && (
                <div className="mt-4 rounded-md border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground mb-1">AI Reasoning</div>
                  <div className="text-sm">{decision.decision.reason}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Execution Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" /> Execution Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={logRef}
              className="rounded-md border bg-zinc-950 p-4 font-mono text-xs text-emerald-400 h-48 overflow-y-auto space-y-0.5"
            >
              {logs.length === 0
                ? <span className="text-zinc-600">Waiting for execution — click a button above to start...</span>
                : logs.map((l, i) => <div key={i}>{l}</div>)
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
