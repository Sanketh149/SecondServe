import { useState, type FormEvent } from "react"
import { Bot, LoaderCircle, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ReadinessNotice } from "@/components/AppShell"
import { askRescueAssistant, type ApiGuidance } from "@/lib/api-client"

export function RescueAssistantCard({
  donationId,
}: {
  donationId?: string
}) {
  const [question, setQuestion] = useState("")
  const [guidance, setGuidance] = useState<ApiGuidance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const prompt = question.trim()
    if (prompt.length < 3 || loading) return
    setLoading(true)
    setError("")
    try {
      setGuidance(await askRescueAssistant(prompt, donationId))
      setQuestion("")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The rescue assistant is unavailable right now.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="panel rescue-assistant-card">
      <div className="panel-heading">
        <div className="rescue-assistant-heading">
          <span className="network-insights-icon">
            <Bot aria-hidden="true" size={16} />
          </span>
          <span>
            <h2>AI Rescue Assistant</h2>
            <small>Guidance grounded in your workspace records</small>
          </span>
        </div>
        <Badge variant="neutral">Gemini</Badge>
      </div>
      {guidance ? (
        <div aria-live="polite" className="rescue-assistant-answer" role="status">
          <p>{guidance.answer}</p>
          {guidance.basedOn.length > 0 && (
            <small>Based on: {guidance.basedOn.join(" · ")}</small>
          )}
          <small>{guidance.limitations}</small>
        </div>
      ) : (
        <p className="rescue-assistant-prompt">
          Ask about a donation, recipient readiness, or what to do next.
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <form className="rescue-assistant-form" onSubmit={(event) => void submit(event)}>
        <Input
          aria-label="Ask the AI Rescue Assistant"
          maxLength={500}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="e.g. Why is this rescue still waiting?"
          value={question}
        />
        <Button disabled={loading || question.trim().length < 3} type="submit">
          {loading ? (
            <LoaderCircle aria-hidden="true" className="spin" size={15} />
          ) : (
            <Send aria-hidden="true" size={15} />
          )}
          <span className="visually-hidden">
            {loading ? "Getting guidance" : "Ask"}
          </span>
        </Button>
      </form>
      <ReadinessNotice variant="info">
        Guidance cannot verify food safety, ingredients, routes, or rescue
        completion.
      </ReadinessNotice>
    </Card>
  )
}
