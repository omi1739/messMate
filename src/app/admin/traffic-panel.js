import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, RankedBars, SplitBar, TrendChart } from "./charts";
import { Delta, Metric } from "./bits";
import { VISITOR_RETENTION_DAYS } from "@/lib/analytics";

const DEVICE_COLOURS = ["var(--primary)", "var(--info)", "var(--warning)"];

const number = (value) => value.toLocaleString("en");

/**
 * Traffic panel.
 *
 * Every number here comes from counters written by src/proxy.js — see
 * src/lib/analytics.js for exactly what is and is not collected. The note at
 * the bottom is not decoration: an operator should be able to answer "what
 * does this know about my visitors?" without reading the source.
 */
export function TrafficPanel({ traffic }) {
  const hasTraffic = traffic.totals.views > 0;
  const viewsPerDay = traffic.days > 0 ? traffic.totals.views / traffic.days : 0;

  return (
    <div className="space-y-5">
      <section
        aria-label="Traffic totals"
        className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-soft sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          label="Page views today"
          value={number(traffic.today.views)}
          hint={
            <Delta current={traffic.last7.views} previous={traffic.previous7.views} unit="7-day views" />
          }
        />
        <Metric
          label="Unique visitors today"
          value={number(traffic.today.uniques)}
          hint={<span className="text-[12px] text-muted-foreground">counted once per person per day</span>}
        />
        <Metric
          label={`Views, last ${traffic.days} days`}
          value={number(traffic.totals.views)}
          hint={
            <span className="text-[12px] text-muted-foreground">
              about {viewsPerDay.toFixed(1)} a day
            </span>
          }
        />
        <Metric
          label="Unique, last 7 days"
          value={number(traffic.last7.uniques)}
          hint={<Delta current={traffic.last7.uniques} previous={traffic.previous7.uniques} unit="7-day" />}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Daily visitors</CardTitle>
          <CardDescription>
            Page views and distinct visitors for each of the last {traffic.days} days. Hover a point
            for the day&apos;s numbers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasTraffic ? (
            <TrendChart series={traffic.series} label="Daily visitors" />
          ) : (
            <NoTraffic />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Most visited pages</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars
              items={traffic.pages}
              label="Most visited pages"
              emptyText="No page views recorded yet."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where visits come from</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars
              items={traffic.referrers}
              label="Referrer sources"
              unit="visits"
              emptyText="No referrals recorded yet."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Devices</CardTitle>
            <CardDescription>A coarse category, not a device fingerprint.</CardDescription>
          </CardHeader>
          <CardContent>
            <SplitBar items={traffic.devices} label="Device split" colours={DEVICE_COLOURS} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What this panel records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
          <p>
            Counts are taken on the server as requests arrive. There is no tracking script, no
            cookie, and nothing is sent to a third party.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>No IP address or user agent is stored. Both are hashed with a salt that changes daily, and only to answer &quot;have I counted this person today?&quot;</li>
            <li>Hashes are deleted after {VISITOR_RETENTION_DAYS} days, so the same person cannot be recognised across days.</li>
            <li>Visitors who send Do Not Track are not counted at all, and crawlers are filtered out.</li>
            <li>Query strings and identifiers in URLs are stripped, so nothing about a person&apos;s link is kept.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/** Signups over the same window, so growth and traffic can be read together. */
export function SignupChart({ series, trend }) {
  const total = series.reduce((sum, day) => sum + day.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signups</CardTitle>
        <CardDescription>
          {total} new {total === 1 ? "account" : "accounts"} in the last {series.length} days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BarChart series={series} label="Signups" tone="var(--success)" />
        <p className="mt-3">
          <Delta current={trend.thisWeek} previous={trend.lastWeek} unit="this week" />
        </p>
      </CardContent>
    </Card>
  );
}

function NoTraffic() {
  return (
    <div className="py-6 text-center">
      <p className="text-[13.5px] font-medium">No visits counted yet</p>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
        Open the site in a normal browser tab and this fills in. Curl, scripts and crawlers are
        deliberately not counted, so nothing appears until a real page view happens.
      </p>
    </div>
  );
}
