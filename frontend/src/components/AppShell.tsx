import {
  ArrowRight,
  Bell,
  ChartColumn,
  ClipboardList,
  HeartHandshake,
  Home,
  Leaf,
  MapPin,
  Utensils,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DonationStatus } from "@/lib/demo-data"

const donorNav = [
  { to: "/donor/dashboard", label: "Overview", icon: Home },
  { to: "/donor/donations", label: "Donations", icon: ClipboardList },
  { to: "/donor/impact", label: "Impact", icon: ChartColumn },
]

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link aria-label="SecondServe home" className="brand" to="/">
      <span className="brand-mark">
        <Leaf aria-hidden="true" size={19} strokeWidth={2.5} />
      </span>
      {!compact && <span className="brand-name">SecondServe</span>}
    </Link>
  )
}

function WorkspaceCard({ recipientName }: { recipientName?: string }) {
  const recipient = Boolean(recipientName)
  const initials = recipientName
    ? recipientName
        .split(" ")
        .map((part) => part[0])
        .join("")
    : "GL"
  return (
    <div className="workspace-card">
      <span className={`workspace-avatar${recipient ? " workspace-avatar--recipient" : ""}`}>
        {initials}
      </span>
      <span className="workspace-copy">
        <span className="workspace-eyebrow">DEMO WORKSPACE</span>
        <strong>{recipientName ?? "Green Leaf Kitchen"}</strong>
      </span>
    </div>
  )
}

function Navigation({
  items,
}: {
  items: Array<{ to: string; label: string; icon: typeof Home }>
}) {
  return (
    <nav aria-label="Primary navigation" className="side-nav">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          className={({ isActive }) =>
            `side-nav-link${isActive ? " side-nav-link--active" : ""}`
          }
          to={to}
        >
          <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function Shell({
  children,
  recipient,
  recipientId,
}: {
  children: React.ReactNode
  recipient?: boolean
  recipientId?: string
}) {
  const recipientItems = [
    { to: `/recipient/${recipientId}/offers`, label: "Offers", icon: HeartHandshake },
    { to: `/recipient/${recipientId}/capacity`, label: "Capacity & needs", icon: ClipboardList },
    { to: `/recipient/${recipientId}/received`, label: "Received", icon: Utensils },
    { to: `/recipient/${recipientId}/impact`, label: "Impact", icon: ChartColumn },
  ]
  const items = recipient ? recipientItems : donorNav
  const location = useLocation()
  const current = items.find((item) => location.pathname.startsWith(item.to))
  const recipientName =
    recipientId === "community-kitchen"
      ? "Community Kitchen"
      : recipientId === "neighborhood-kitchen"
        ? "Neighborhood Kitchen"
        : "Hope Shelter"
  const userName = recipient ? recipientName : "Jordan Davis"

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <WorkspaceCard recipientName={recipient ? recipientName : undefined} />
        <div className="nav-caption">WORKSPACE</div>
        <Navigation items={items} />
        {!recipient && (
          <div className="sidebar-note">
            <strong>Make every meal count</strong>
            <p>Turn today’s surplus into someone’s dinner.</p>
            <Link to="/donor/new">
              How it works <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        )}
        {recipient && (
          <div className="sidebar-note sidebar-note--recipient">
            <strong>Good food, where it’s needed</strong>
            <p>Your capacity helps donors plan feasible rescues.</p>
          </div>
        )}
        <div className="sidebar-demo-note">
          <span className="demo-dot" />
          Sample data · demo only
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{recipient ? "Recipient workspace" : "Donor workspace"}</span>
            <span aria-hidden="true" className="breadcrumb-slash">
              /
            </span>
            <span>{current?.label ?? "Overview"}</span>
          </div>
          <div className="topbar-right">
            <span className="sample-label">DEMO</span>
            <button
              aria-label="Notifications are disabled in the demo"
              className="icon-button"
              disabled
              title="Notifications are disabled in the demo"
              type="button"
            >
              <Bell aria-hidden="true" size={18} />
            </button>
            <div className="profile">
              <span className="profile-avatar">
                {recipient
                  ? recipientName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                  : "JD"}
              </span>
              <span className="profile-copy">
                <strong>{userName}</strong>
                <span>{recipient ? "Recipient account" : "Donor account"}</span>
              </span>
            </div>
          </div>
        </header>
        <main className="page-content">{children}</main>
        <nav aria-label="Mobile primary navigation" className="mobile-nav">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              className={({ isActive }) =>
                `mobile-nav-link${isActive ? " mobile-nav-link--active" : ""}`
              }
              to={to}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
          {!recipient && (
            <NavLink className="mobile-nav-link mobile-nav-add" to="/donor/new">
              <span className="mobile-add-icon">+</span>
              <span>New</span>
            </NavLink>
          )}
        </nav>
      </div>
    </div>
  )
}

export function DonorShell() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  )
}

export function RecipientShell() {
  const { recipientId = "hope-shelter" } = useParams()
  return (
    <Shell recipient recipientId={recipientId}>
      <Outlet />
    </Shell>
  )
}

export function PageHeading({
  title,
  description,
  action,
  eyebrow,
}: {
  title: React.ReactNode
  description?: string
  action?: React.ReactNode
  eyebrow?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  )
}

export function StatusBadge({ status }: { status: DonationStatus }) {
  const labels: Record<DonationStatus, string> = {
    OFFERING: "Offer in progress",
    RELAYED: "Relayed to next recipient",
    ACCEPTED: "Accepted · handoff pending",
    PARTIALLY_RECEIVED: "Partially received",
    RECEIVED: "Received",
    UNCLAIMED: "No recipient available",
  }
  const variants: Record<
    DonationStatus,
    "neutral" | "success" | "warning" | "danger"
  > = {
    OFFERING: "warning",
    RELAYED: "warning",
    ACCEPTED: "success",
    PARTIALLY_RECEIVED: "warning",
    RECEIVED: "success",
    UNCLAIMED: "danger",
  }
  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}

export function RescueTimeline({
  status,
}: {
  status: DonationStatus
}) {
  const reducedMotion = useReducedMotion() ?? false
  const stages = ["Listed", "Planned", "Offering", "Received"]
  const currentIndex =
    status === "RECEIVED" || status === "PARTIALLY_RECEIVED"
      ? 3
      : status === "OFFERING" || status === "RELAYED" || status === "UNCLAIMED"
        ? 2
        : status === "ACCEPTED"
          ? 2
          : 0
  const stageText =
    status === "ACCEPTED"
      ? "Accepted"
      : status === "PARTIALLY_RECEIVED"
        ? "Partially received"
        : status === "RELAYED"
          ? "Relayed"
          : status === "UNCLAIMED"
            ? "Awaiting another recipient"
            : stages[currentIndex]
  const transition = {
    duration: reducedMotion ? 0.12 : 0.24,
    ease: "easeOut" as const,
  }

  return (
    <>
      <span aria-live="polite" className="visually-hidden" role="status">
        Rescue status: {stageText}
      </span>
      <ol aria-label="Donation rescue progress" className="rescue-timeline">
        {stages.map((stage, index) => (
        <li
          aria-current={index === currentIndex ? "step" : undefined}
          className="timeline-stage-wrap"
          key={stage}
        >
          <div
            className={`timeline-stage${
              index < currentIndex
                ? " timeline-stage--done"
                : index === currentIndex
                  ? " timeline-stage--current"
                  : ""
            }`}
          >
            <motion.span
              animate={{
                scale:
                  !reducedMotion && index === currentIndex
                    ? 1.16
                    : 1,
              }}
              className="timeline-dot"
              transition={transition}
            >
              {index < currentIndex ? <span aria-hidden="true">✓</span> : null}
            </motion.span>
            <span>{index === currentIndex ? stageText : stage}</span>
          </div>
          {index < stages.length - 1 && (
            <span aria-hidden="true" className="timeline-line">
              <motion.span
                animate={{ scaleX: index < currentIndex ? 1 : 0 }}
                className="timeline-line-fill"
                initial={{ scaleX: 0 }}
                transition={transition}
              />
            </span>
          )}
        </li>
        ))}
      </ol>
    </>
  )
}

export function MetricCard({
  title,
  value,
  note,
  icon,
  accent,
}: {
  title: string
  value: string
  note: React.ReactNode
  icon: React.ReactNode
  accent?: string
}) {
  return (
    <section className={`metric-card${accent ? ` ${accent}` : ""}`}>
      <div className="metric-top">
        <span>{title}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </section>
  )
}

export function ReadinessNotice({
  children,
  variant = "info",
}: {
  children: React.ReactNode
  variant?: "info" | "warning" | "success" | "error"
}) {
  return <div className={`notice notice--${variant}`}>{children}</div>
}

export function DemoTag() {
  return <Badge className="demo-tag" variant="neutral">SAMPLE DATA</Badge>
}

export function PrimaryLink({
  to,
  children,
}: {
  to: string
  children: React.ReactNode
}) {
  return (
    <Button asChild>
      <Link to={to}>{children}</Link>
    </Button>
  )
}

export function AvatarStack({ names }: { names: string[] }) {
  return (
    <div className="avatar-stack" aria-label={`Recipients: ${names.join(", ")}`}>
      {names.map((name) => (
        <span className="mini-avatar" key={name}>
          {name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </span>
      ))}
    </div>
  )
}

export function RouteMeta({
  name,
  quantity,
  distance,
  eta,
}: {
  name: string
  quantity: number
  distance: string
  eta: string
}) {
  return (
    <div className="route-summary">
      <span className="route-icon">
        <MapPin aria-hidden="true" size={17} />
      </span>
      <span className="route-copy">
        <strong>{name}</strong>
        <span>
          {quantity} meals · {distance} away
        </span>
      </span>
      <span className="route-eta">
        <strong>{eta}</strong>
        <span>Estimated arrival</span>
      </span>
    </div>
  )
}
