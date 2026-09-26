/**
 * Charts for the admin panel, drawn as plain server-rendered SVG.
 *
 * No charting library and no client component: the panel is a server page, so
 * these render to static markup and cost nothing on the client. Colours come
 * from the theme's CSS variables, so light and dark are handled for free.
 *
 * Every chart carries an accessible name and a visually hidden data table, so
 * the numbers are readable by a screen reader and by anyone who cannot see the
 * shape of the data.
 */

const VIEW = { width: 720, height: 200 };

/** "nice" upper bound for an axis, so the top gridline is a round number. */
function niceMax(value) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

function points(values, max, inset, height) {
  const width = VIEW.width;
  const plotWidth = width - inset * 2;
  const step = values.length > 1 ? plotWidth / (values.length - 1) : 0;
  return values.map((value, i) => {
    const x = inset + i * step;
    const ratio = max > 0 ? value / max : 0;
    return { x, y: inset + (1 - ratio) * (height - inset * 2), value };
  });
}

function polyline(pts) {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function shortDay(day) {
  const [, month, date] = day.split("-");
  return `${Number(date)} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(month) - 1]}`;
}

/**
 * Two overlaid series as an area plus a line — page views as the filled shape
 * with unique visitors drawn over the top, since unique is always the lower,
 * nested number.
 */
export function TrendChart({ series, label, primaryKey = "views", secondaryKey = "uniques" }) {
  if (!series?.length) return null;

  const primary = series.map((d) => d[primaryKey] ?? 0);
  const secondary = series.map((d) => d[secondaryKey] ?? 0);
  const max = niceMax(Math.max(...primary, ...secondary));
  const inset = 10;
  const primaryPts = points(primary, max, inset, VIEW.height);
  const secondaryPts = points(secondary, max, inset, VIEW.height);
  const baseline = VIEW.height - inset;
  const areaPath = `M ${polyline(primaryPts)} L ${primaryPts.at(-1).x.toFixed(1)},${baseline} L ${primaryPts[0].x.toFixed(1)},${baseline} Z`;
  const total = primary.reduce((sum, n) => sum + n, 0);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label}: ${total} in total over ${series.length} days`}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* gridlines at 0, half and full */}
        {[0, 0.5, 1].map((ratio) => {
          const y = inset + ratio * (VIEW.height - inset * 2);
          const value = Math.round(max * (1 - ratio));
          return (
            <g key={ratio}>
              <line
                x1={inset}
                x2={VIEW.width - inset}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray={ratio === 1 ? undefined : "3 4"}
              />
              <text x={inset} y={y - 4} fontSize="10" fill="var(--muted-foreground)">
                {value}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#trend-fill)" />
        <polyline
          points={polyline(primaryPts)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={polyline(secondaryPts)}
          fill="none"
          stroke="var(--info)"
          strokeWidth="1.75"
          strokeDasharray="4 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Native SVG tooltips: hover a point, no JavaScript required. */}
        {primaryPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="7" fill="transparent">
            <title>{`${shortDay(series[i].day)}: ${primary[i]} views, ${secondary[i]} unique`}</title>
          </circle>
        ))}

        {[0, Math.floor(series.length / 2), series.length - 1].map((i) => (
          <text
            key={i}
            x={primaryPts[i].x}
            y={VIEW.height - 1}
            fontSize="10"
            fill="var(--muted-foreground)"
            textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}
          >
            {shortDay(series[i].day)}
          </text>
        ))}
      </svg>

      <ChartLegend items={[["Page views", "var(--primary)"], ["Unique visitors", "var(--info)"]]} />
      <DataTable
        caption={`${label}, daily`}
        columns={["Day", "Page views", "Unique visitors"]}
        rows={series.map((d) => [shortDay(d.day), d[primaryKey] ?? 0, d[secondaryKey] ?? 0])}
      />
    </figure>
  );
}

/** Single-series columns, used for signups per day. */
export function BarChart({ series, label, tone = "var(--primary)" }) {
  if (!series?.length) return null;
  const values = series.map((d) => d.count ?? 0);
  const max = niceMax(Math.max(...values));
  const inset = 10;
  const plotWidth = VIEW.width - inset * 2;
  const slot = plotWidth / series.length;
  const barWidth = Math.max(2, slot * 0.62);
  const height = VIEW.height - inset * 2;
  const total = values.reduce((sum, n) => sum + n, 0);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label}: ${total} in total over ${series.length} days`}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = inset + ratio * height;
          return (
            <line
              key={ratio}
              x1={inset}
              x2={VIEW.width - inset}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={ratio === 1 ? undefined : "3 4"}
            />
          );
        })}

        {series.map((d, i) => {
          const value = values[i];
          const barHeight = max > 0 ? (value / max) * height : 0;
          return (
            <rect
              key={d.day}
              x={inset + i * slot + (slot - barWidth) / 2}
              y={inset + height - barHeight}
              width={barWidth}
              height={barHeight}
              rx="2"
              fill={tone}
              opacity={value === 0 ? 0.18 : 1}
            >
              <title>{`${shortDay(d.day)}: ${value}`}</title>
            </rect>
          );
        })}

        {[0, Math.floor(series.length / 2), series.length - 1].map((i) => (
          <text
            key={i}
            x={inset + i * slot + slot / 2}
            y={VIEW.height - 1}
            fontSize="10"
            fill="var(--muted-foreground)"
            textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}
          >
            {shortDay(series[i].day)}
          </text>
        ))}
      </svg>
      <DataTable
        caption={`${label}, daily`}
        columns={["Day", label]}
        rows={series.map((d) => [shortDay(d.day), d.count ?? 0])}
      />
    </figure>
  );
}

/**
 * A ranked list with proportional bars. Plain divs rather than SVG, because the
 * labels are real text and this reflows to any width for free.
 */
export function RankedBars({ items, label, unit = "views", emptyText = "Nothing recorded yet." }) {
  if (!items?.length) {
    return <p className="text-[13px] text-muted-foreground">{emptyText}</p>;
  }
  const max = Math.max(...items.map((item) => item.count));

  return (
    <ul aria-label={label} className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px]">{item.label}</span>
            <span className="nums shrink-0 text-[12.5px] text-muted-foreground">
              {item.count.toLocaleString("en")} {unit}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${max > 0 ? (item.count / max) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A single stacked bar for a small mix, e.g. device split. */
export function SplitBar({ items, label, colours }) {
  if (!items?.length) {
    return <p className="text-[13px] text-muted-foreground">No visits recorded yet.</p>;
  }
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) {
    return <p className="text-[13px] text-muted-foreground">No visits recorded yet.</p>;
  }

  return (
    <div>
      <div
        role="img"
        aria-label={items.map((item) => `${item.label} ${item.count}`).join(", ")}
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
      >
        {items.map((item, i) => (
          <div
            key={item.label}
            style={{ width: `${(item.count / total) * 100}%`, background: colours[i % colours.length] }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5 text-[12.5px]">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: colours[i % colours.length] }}
            />
            <span className="capitalize">{item.label}</span>
            <span className="nums text-muted-foreground">
              {Math.round((item.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function ChartLegend({ items }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {items.map(([text, colour]) => (
        <li key={text} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: colour }} />
          {text}
        </li>
      ))}
    </ul>
  );
}

/** The same numbers in a table, for screen readers and for copying out. */
function DataTable({ caption, columns, rows }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.join("-")}>
            {row.map((cell, i) => (
              <td key={i}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
