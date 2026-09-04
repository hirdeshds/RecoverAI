"use client"
import React, { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRecoveryCases } from '@/services/recovery.api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mic, MicOff, Loader2, PhoneCall, Brain, CheckCircle2, AlertTriangle, Upload } from 'lucide-react'

const API_HEADERS = { 'X-API-Key': 'track03_dev_key' }

export default function VoiceRecoveryPage() {
  const [selectedCase, setSelectedCase] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const { data: cases = [] } = useQuery({
    queryKey: ['cases'],
    queryFn: () => getRecoveryCases(),
  })

  const startRecording = async () => {
    setError('')
    setResult(null)
    setAudioBlob(null)
    setAudioUrl('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      mediaRef.current = mr
      setIsRecording(true)
    } catch {
      setError('Microphone access denied. Please allow microphone access.')
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    setIsRecording(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioBlob(file)
    setAudioUrl(URL.createObjectURL(file))
    setResult(null)
    setError('')
  }

  const processAudio = async () => {
    if (!audioBlob) { setError('No audio recorded or uploaded.'); return }
    if (!selectedCase) { setError('Please select a recovery case.'); return }
    if (!selectedCustomer) { setError('Please select a customer.'); return }

    setIsProcessing(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'voice_input.wav')
      const res = await fetch(
        `/api/v2/voice-recovery?recovery_case_id=${encodeURIComponent(selectedCase)}&customer_id=${encodeURIComponent(selectedCustomer)}`,
        { method: 'POST', headers: API_HEADERS, body: formData }
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail?.error?.message ?? data.detail ?? 'Voice processing failed')
      }
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hinglish Voice Recovery</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Record or upload customer audio → Sarvam AI STT → Groq intent detection → Promise-to-Pay
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Session Setup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-blue-500" /> Session Setup
            </CardTitle>
            <CardDescription className="text-xs">Select the case and customer for this voice session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Recovery Case *</label>
              <select
                value={selectedCase}
                onChange={e => {
                  setSelectedCase(e.target.value)
                  const c = cases.find((c: any) => c.id === e.target.value)
                  if (c) setSelectedCustomer(c.customer_id)
                }}
                className="w-full rounded-md border bg-background h-9 text-sm px-3 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select a recovery case...</option>
                {cases.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — ₹{(c.amount_at_risk || 0).toLocaleString('en-IN')} ({c.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Customer ID</label>
              <input
                value={selectedCustomer}
                onChange={e => setSelectedCustomer(e.target.value)}
                placeholder="auto-filled from case"
                className="w-full rounded-md border bg-background h-9 text-sm px-3 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        {/* Audio Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Mic className="h-4 w-4 text-red-500" /> Audio Input
            </CardTitle>
            <CardDescription className="text-xs">Record live or upload a WAV/MP3 file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              {!isRecording ? (
                <Button onClick={startRecording} variant="outline" className="gap-2 flex-1">
                  <Mic className="h-4 w-4 text-red-500" /> Start Recording
                </Button>
              ) : (
                <Button onClick={stopRecording} variant="destructive" className="gap-2 flex-1 animate-pulse">
                  <MicOff className="h-4 w-4" /> Stop Recording
                </Button>
              )}
              <label className="flex-1">
                <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                <div className="flex items-center justify-center gap-2 border rounded-md h-10 text-sm cursor-pointer hover:bg-muted transition-colors">
                  <Upload className="h-4 w-4" /> Upload Audio
                </div>
              </label>
            </div>

            {isRecording && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Recording...
              </div>
            )}

            {audioUrl && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                <audio src={audioUrl} controls className="w-full h-8" />
              </div>
            )}

            <Button
              onClick={processAudio}
              disabled={isProcessing || !audioBlob || !selectedCase}
              className="w-full gap-2"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {isProcessing ? 'Processing with AI...' : 'Submit for Sarvam STT + Groq Analysis'}
            </Button>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <Card className="border-emerald-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="h-4 w-4" /> Voice Analysis Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Transcript (Hinglish)</p>
                    <p className="text-sm bg-muted/30 border rounded-md p-3 leading-relaxed">{result.transcript ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Detected Language</p>
                    <Badge variant="outline">{result.language ?? '—'}</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Customer Intent</p>
                    <Badge variant={result.intent === 'will_pay' ? 'success' : result.intent === 'refusing' ? 'destructive' : 'warning'}>
                      {result.intent ?? 'unknown'}
                    </Badge>
                  </div>
                  {result.payment_commitment && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Payment Commitment</p>
                        <p className="text-sm font-semibold text-emerald-400">₹{(result.promised_amount || 0).toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Promised By</p>
                        <p className="text-sm">{result.promised_date ?? '—'}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Action Taken</p>
                    <Badge variant="default">{result.action_taken ?? 'N/A'}</Badge>
                  </div>
                </div>
              </div>
              {result.ai_response && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-1">AI Response</p>
                  <p className="text-sm bg-muted/20 border rounded-md p-3 leading-relaxed">{result.ai_response}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {result.promise_id && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                <CheckCircle2 className="h-4 w-4" /> Promise-to-Pay Created
              </div>
              <p className="text-xs text-muted-foreground">ID: <span className="font-mono text-primary">{result.promise_id}</span></p>
            </div>
          )}
        </div>
      )}

      {/* Pipeline explanation */}
      {!result && (
        <Card className="bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">How Voice Recovery Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { step: '1', label: 'Record / Upload', sub: 'WAV, MP3, M4A' },
                { step: '2', label: 'Sarvam AI STT', sub: 'Hindi + English' },
                { step: '3', label: 'Groq LLM Intent', sub: 'Will pay / Refusing' },
                { step: '4', label: 'Promise Detected', sub: 'Amount + Date' },
                { step: '5', label: 'DB Updated', sub: 'Audit logged' },
              ].map(item => (
                <div key={item.step} className="text-center p-3 border rounded-lg bg-background">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center mx-auto mb-2">{item.step}</div>
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              ⚠️ Requires <code className="text-primary">STT_API_KEY</code> (Sarvam AI) in your <code>.env</code> file.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
