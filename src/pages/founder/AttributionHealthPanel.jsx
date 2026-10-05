// src/pages/founder/AttributionHealthPanel.jsx
//
// CLOSEOUT W37 - read-only render of a salesperson's attribution health: labeled metrics, a totals
// table, and a by-day table with a proportional bar per day. Replaces the old one-line
// `key: String(value)` dump that printed "[object Object]" for `totals` and `byDay`.
// No requests, no mutation, no state beyond the props.
import { buildAttributionHealthView } from "./attributionHealthView.js";

const cell = { padding: ".25rem .6rem .25rem 0", fontSize: ".82rem", textAlign: "left" };
const head = { ...cell, fontSize: ".72rem", color: "var(--text-tertiary)", fontWeight: 700 };

export default function AttributionHealthPanel({ health }) {
  const view = buildAttributionHealthView(health);

  if (view.state === "malformed") {
    return (
      <p data-testid="fcc-health" data-state="malformed"
        style={{ fontSize: ".84rem", margin: "0 0 .9rem", color: "var(--text-secondary)" }}>
        Attribution figures are unavailable right now.
      </p>
    );
  }
  if (view.state === "empty") {
    return (
      <div data-testid="fcc-health" data-state="empty" style={{ margin: "0 0 .9rem" }}>
        <p style={{ fontSize: ".84rem", margin: 0, color: "var(--text-secondary)" }}>
          No attribution activity recorded yet for this salesperson.
        </p>
        {view.metrics.length > 0 ? (
          <p data-testid="fcc-health-loss" style={{ fontSize: ".8rem", margin: ".2rem 0 0", color: "var(--text-tertiary)" }}>
            {view.metrics.filter((m) => m.key === "lossRateBps").map((m) => `${m.label}: ${m.value}`)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div data-testid="fcc-health" data-state="ok" style={{ margin: "0 0 .9rem" }}>
      <h4 style={{ fontSize: ".74rem", margin: "0 0 .4rem", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
        Attribution health
      </h4>

      {view.metrics.length > 0 || view.extras.length > 0 ? (
        <dl data-testid="fcc-health-metrics"
          style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: ".25rem 1rem", margin: "0 0 .8rem" }}>
          {[...view.metrics, ...view.extras].map((m) => (
            <div key={m.key} style={{ display: "contents" }}>
              <dt style={{ fontSize: ".78rem", color: "var(--text-secondary)" }}>{m.label}</dt>
              <dd style={{ margin: 0, fontSize: ".85rem" }} data-testid={`fcc-health-metric-${m.key}`}>{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {view.totals.length > 0 ? (
        <table data-testid="fcc-health-totals" style={{ borderCollapse: "collapse", margin: "0 0 .8rem" }}>
          <caption style={{ ...head, captionSide: "top", paddingBottom: ".25rem" }}>Totals by outcome</caption>
          <thead><tr><th scope="col" style={head}>Outcome</th><th scope="col" style={head}>Count</th></tr></thead>
          <tbody>
            {view.totals.map((t) => (
              <tr key={t.key}><th scope="row" style={{ ...cell, fontWeight: 400 }}>{t.label}</th><td style={cell}>{t.count}</td></tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {view.days.length > 0 ? (
        <div data-testid="fcc-health-days">
          <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 640 }}>
            <caption style={{ ...head, captionSide: "top", paddingBottom: ".25rem" }}>By day (UTC)</caption>
            <thead>
              <tr>
                <th scope="col" style={head}>Day</th>
                {view.outcomeKeys.map((k) => <th key={k} scope="col" style={head}>{view.days.flatMap((d) => d.cells).find((c) => c.key === k).label}</th>)}
                <th scope="col" style={head}>Total</th>
                <th scope="col" style={head}><span className="gcd-sr-only" style={{ position: "absolute", left: -9999 }}>Chart</span></th>
              </tr>
            </thead>
            <tbody>
              {view.days.map((d) => (
                <tr key={d.day} data-testid={`fcc-health-day-${d.day}`}>
                  <th scope="row" style={{ ...cell, fontWeight: 400, whiteSpace: "nowrap" }}>{d.day}</th>
                  {view.outcomeKeys.map((k) => {
                    const c = d.cells.find((x) => x.key === k);
                    return <td key={k} style={cell}>{c ? c.count : 0}</td>;
                  })}
                  <td style={cell}>{d.total}</td>
                  <td style={{ ...cell, width: "35%" }}>
                    <span aria-hidden="true" data-testid={`fcc-health-bar-${d.day}`}
                      style={{
                        display: "block", height: 8, borderRadius: 4, background: "var(--accent, #4F2D7F)",
                        width: `${view.maxDayTotal > 0 ? Math.max(4, Math.round((d.total / view.maxDayTotal) * 100)) : 0}%`,
                      }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
