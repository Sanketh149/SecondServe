import { ChartColumn, HeartHandshake, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useDemoStore } from "@/lib/demo-context"

function getHeatmapLayout(
  cells: NonNullable<
    ReturnType<typeof useDemoStore>["networkInsights"]
  >["heatmapCells"],
) {
  if (cells.length === 0) return []
  const latitudes = cells.map((cell) => cell.latitude)
  const longitudes = cells.map((cell) => cell.longitude)
  const minLatitude = Math.min(...latitudes)
  const maxLatitude = Math.max(...latitudes)
  const minLongitude = Math.min(...longitudes)
  const maxLongitude = Math.max(...longitudes)
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.05)
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.05)
  const maxVolume = Math.max(
    ...cells.map((cell) => cell.activeSurplusMeals + cell.unmetNeedMeals),
    1,
  )

  return cells.map((cell) => ({
    ...cell,
    x: 24 + ((cell.longitude - minLongitude) / longitudeSpan) * 312,
    y: 18 + ((maxLatitude - cell.latitude) / latitudeSpan) * 116,
    radius:
      7 +
      (Math.sqrt(cell.activeSurplusMeals + cell.unmetNeedMeals) /
        Math.sqrt(maxVolume)) *
        14,
    supplyShare:
      (cell.activeSurplusMeals + 1) /
      (cell.activeSurplusMeals + cell.unmetNeedMeals + 2),
  }))
}

export function NetworkInsightsPanel() {
  const { networkInsights } = useDemoStore()
  const cells = getHeatmapLayout(networkInsights?.heatmapCells ?? [])
  const partnerships = networkInsights?.partnerships ?? []

  return (
    <Card className="panel network-insights-card">
      <div className="panel-heading">
        <div>
          <span className="step-kicker">NETWORK INTELLIGENCE</span>
          <h2>Rescue network</h2>
        </div>
        <Badge variant="neutral">Live records</Badge>
      </div>
      <div className="network-insights-grid">
        <section aria-label="Approximate rescue heatmap" className="network-heatmap">
          <div className="network-insights-subheading">
            <span className="network-insights-icon">
              <MapPin aria-hidden="true" size={15} />
            </span>
            <span>
              <strong>Surplus & unmet need</strong>
              <small>
                Approximate {networkInsights?.heatmapCellSizeKm ?? 5} km cells;
                organization locations are not shown.
              </small>
            </span>
          </div>
          {cells.length > 0 ? (
            <>
              <svg
                aria-label="Aggregated food surplus and recipient unmet need by approximate area"
                className="network-heatmap-svg"
                role="img"
                viewBox="0 0 360 152"
              >
                <defs>
                  <pattern
                    height="20"
                    id="network-grid"
                    patternUnits="userSpaceOnUse"
                    width="20"
                  >
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8ece8" strokeWidth="0.7" />
                  </pattern>
                  <radialGradient id="network-supply">
                    <stop offset="0" stopColor="#4285f4" stopOpacity="0.68" />
                    <stop offset="1" stopColor="#4285f4" stopOpacity="0.08" />
                  </radialGradient>
                  <radialGradient id="network-demand">
                    <stop offset="0" stopColor="#34a853" stopOpacity="0.68" />
                    <stop offset="1" stopColor="#34a853" stopOpacity="0.08" />
                  </radialGradient>
                </defs>
                <rect height="152" rx="12" width="360" fill="#f8faf8" />
                <rect height="152" rx="12" width="360" fill="url(#network-grid)" />
                {cells.map((cell) => (
                  <g key={`${cell.latitude}-${cell.longitude}`}>
                    <circle
                      cx={cell.x}
                      cy={cell.y}
                      fill={
                        cell.activeSurplusMeals >= cell.unmetNeedMeals
                          ? "url(#network-supply)"
                          : "url(#network-demand)"
                      }
                      r={cell.radius}
                    />
                    <circle
                      cx={cell.x}
                      cy={cell.y}
                      fill={
                        cell.activeSurplusMeals >= cell.unmetNeedMeals
                          ? "#4285f4"
                          : "#34a853"
                      }
                      r="3.2"
                    />
                  </g>
                ))}
              </svg>
              <div className="network-heatmap-legend">
                <span><i className="network-legend-dot network-legend-dot--supply" /> Active surplus</span>
                <span><i className="network-legend-dot network-legend-dot--demand" /> Unmet need</span>
              </div>
            </>
          ) : (
            <div className="network-heatmap-empty">
              <ChartColumn aria-hidden="true" size={18} />
              <span>
                No active surplus or unmet need is currently recorded. Completed
                rescues appear in the partnership history.
              </span>
            </div>
          )}
        </section>
        <section aria-label="Recurring partnership recommendations" className="network-partnerships">
          <div className="network-insights-subheading">
            <span className="network-insights-icon">
              <HeartHandshake aria-hidden="true" size={15} />
            </span>
            <span>
              <strong>Partnerships from real rescues</strong>
              <small>Ranked by completed, recipient-confirmed handoffs.</small>
            </span>
          </div>
          {partnerships.length > 0 ? (
            <div className="network-partner-list">
              {partnerships.slice(0, 3).map((partnership) => (
                <div className="network-partner-row" key={partnership.organizationName}>
                  <span className="network-partner-avatar">
                    {partnership.organizationName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="network-partner-copy">
                    <strong>{partnership.organizationName}</strong>
                    <small>{partnership.reason}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="network-partnership-empty">
              Repeat-partner suggestions will appear after completed rescues.
            </div>
          )}
        </section>
      </div>
    </Card>
  )
}
