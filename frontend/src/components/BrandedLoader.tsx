import { HeartHandshake, Leaf, MapPin, TrendingUp } from "lucide-react"

interface BrandedLoaderProps {
  title: string
  description: string
}

export function BrandedLoader({ title, description }: BrandedLoaderProps) {
  return (
    <main aria-busy="true" aria-live="polite" className="app-loader-screen" role="status">
      <section className="app-loader-card">
        <div className="app-loader-brand">
          <span className="brand-mark"><Leaf aria-hidden="true" size={19} /></span>
          <strong>SecondServe</strong>
        </div>
        <div aria-hidden="true" className="app-loader-route">
          <span className="app-loader-stop app-loader-stop--active"><TrendingUp size={16} /></span>
          <span className="app-loader-track"><i /></span>
          <span className="app-loader-stop"><MapPin size={16} /></span>
          <span className="app-loader-track"><i /></span>
          <span className="app-loader-stop"><HeartHandshake size={16} /></span>
        </div>
        <span className="app-loader-eyebrow">YOUR SECOND SERVE WORKSPACE</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div aria-hidden="true" className="app-loader-progress"><span /></div>
      </section>
    </main>
  )
}

export function InlineLoader({ label }: { label: string }) {
  return (
    <span aria-busy="true" className="app-inline-loader" role="status">
      <span aria-hidden="true" className="app-inline-loader-spinner" />
      {label}
    </span>
  )
}
