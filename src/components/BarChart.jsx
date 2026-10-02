import { useEffect, useRef, useState } from 'react'

// Gráfico de barras en SVG, sin librerías. Una sola serie (ingresos en S/):
// - vertical (columnas) para agrupaciones por tiempo
// - horizontal (barras) para categorías, ordenadas de mayor a menor
// Pasar el cursor (o tocar) una barra muestra el detalle.

const BAR_COLOR = '#0d9488' // validado: croma y contraste suficientes sobre fondo blanco
const BAR_HOVER = '#0f766e'
const GRID = '#e2e8f0'
const INK_MUTED = '#64748b'
const MAX_BAR = 24

function niceStep(max, ticks = 4) {
  const raw = max / ticks
  const pow = 10 ** Math.floor(Math.log10(raw || 1))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

function compact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}K`
  return n.toLocaleString('es-PE', { maximumFractionDigits: 0 })
}

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    if (!ref.current) return undefined
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Barra con 4px redondeados en el extremo del dato y recta en la base. */
function barPath(x, y, w, h, horizontal) {
  const r = Math.min(4, horizontal ? w / 2 : h / 2, horizontal ? h / 2 : w / 2)
  if (w <= 0 || h <= 0) return ''
  if (horizontal) {
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`
  }
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

export default function BarChart({ data, horizontal = false, formatValue, ariaLabel }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  if (!data.length) return <div ref={ref} className="chart-empty muted">Sin datos para el periodo seleccionado.</div>

  const max = Math.max(...data.map((d) => d.total), 0)
  const step = niceStep(max || 1)
  const top = Math.max(step * Math.ceil((max || 1) / step), step)
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)

  let svg
  if (horizontal) {
    const labelW = Math.min(180, Math.max(90, width * 0.3))
    const valueW = 90
    const row = 34
    const height = data.length * row + 8
    const plotW = Math.max(60, width - labelW - valueW)
    const x = (v) => labelW + (v / top) * plotW
    svg = (
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {data.map((d, i) => {
          const y = i * row + (row - Math.min(MAX_BAR, row - 10)) / 2
          const h = Math.min(MAX_BAR, row - 10)
          const w = x(d.total) - labelW
          const label = d.label.length > 24 ? `${d.label.slice(0, 23)}…` : d.label
          return (
            <g key={d.key} className="bar" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
              <rect x={0} y={i * row} width={width} height={row} fill={hover === i ? '#f0fdfa' : 'transparent'} />
              <text x={labelW - 10} y={i * row + row / 2} textAnchor="end" dominantBaseline="middle" fontSize="12" fill="#0f172a">{label}</text>
              <path d={barPath(labelW, y, Math.max(w, d.total > 0 ? 2 : 0), h, true)} fill={hover === i ? BAR_HOVER : BAR_COLOR} />
              <text x={labelW + Math.max(w, 0) + 6} y={i * row + row / 2} dominantBaseline="middle" fontSize="12" fill={INK_MUTED}>{formatValue(d.total)}</text>
            </g>
          )
        })}
      </svg>
    )
  } else {
    const height = 260
    const m = { top: 12, right: 8, bottom: 28, left: 44 }
    const plotW = width - m.left - m.right
    const plotH = height - m.top - m.bottom
    const slot = plotW / data.length
    const barW = Math.max(2, Math.min(MAX_BAR, slot - 2))
    const y = (v) => m.top + plotH - (v / top) * plotH
    // Etiquetas del eje X: solo las que caben sin superponerse
    const every = Math.max(1, Math.ceil(52 / slot))
    svg = (
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={m.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill={INK_MUTED}>{compact(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = m.left + slot * i + slot / 2
          return (
            <g key={d.key} className="bar" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
              <rect x={m.left + slot * i} y={m.top} width={slot} height={plotH} fill={hover === i ? '#f0fdfa' : 'transparent'} />
              <path d={barPath(cx - barW / 2, y(d.total), barW, m.top + plotH - y(d.total), false)} fill={hover === i ? BAR_HOVER : BAR_COLOR} />
              {i % every === 0 && (
                <text x={cx} y={height - 10} textAnchor="middle" fontSize="11" fill={INK_MUTED}>{d.label}</text>
              )}
            </g>
          )
        })}
      </svg>
    )
  }

  const h = hover !== null ? data[hover] : null
  return (
    <div
      ref={ref}
      className="chart"
      onMouseMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect()
        setPos({ x: e.clientX - box.left, y: e.clientY - box.top })
      }}
    >
      {svg}
      {h && (
        <div className="chart-tip" role="status" style={{ left: Math.max(0, Math.min(pos.x + 14, width - 220)), top: pos.y + 14 }}>
          <strong>{h.label}</strong>
          <span>{formatValue(h.total)} · {h.count} {h.count === 1 ? 'pago' : 'pagos'} · {h.porcentaje.toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}
