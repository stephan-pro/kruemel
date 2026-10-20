import { Flame } from "lucide-preact";
import { useState } from "preact/hooks";
import type { CalendarDay } from "../../domain/date";
import {
  STATISTICS_PERIODS,
  type StatisticsBar,
  type StatisticsPeriod,
  statistics,
} from "../../domain/statistics";
import type { Completion, Task } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
import { PageTitle } from "../components/PageTitle";
import { TaskSymbol } from "../components/TaskSymbol";
import {
  barLabel,
  describeBars,
  describeComparison,
  describePeriod,
  describeStreak,
  describeTakenOver,
  describeTeamwork,
  PERIOD_LABELS,
} from "../format";
import { routeInfo } from "../route";

interface StatisticsPageProps {
  readonly tasks: readonly Task[];
  readonly completions: readonly Completion[];
  readonly names: PersonNames;
  readonly today: CalendarDay;
}

/**
 * "Statistik" (DESIGN.md section 6): what the two did together in a week, a month or a year, how
 * the work is shared, and which tasks come up most. No ranking, no winner; counted by task.
 */
export function StatisticsPage({ tasks, completions, names, today }: StatisticsPageProps) {
  const [period, setPeriod] = useState<StatisticsPeriod>("week");
  const stats = statistics({ tasks, completions, today, period });
  const streak = describeStreak(stats.streakWeeks);
  const { personA, personB } = stats.byPerson;

  return (
    <div class="stats">
      <PageTitle title={routeInfo("statistics").title} heading="Eure Bilanz" />
      <fieldset class="segmented stats__periods">
        <legend class="visually-hidden">Zeitraum</legend>
        {STATISTICS_PERIODS.map((value) => (
          <button
            key={value}
            class="segmented__option"
            type="button"
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
          >
            {PERIOD_LABELS[value]}
          </button>
        ))}
      </fieldset>

      <section class="stats-total" aria-labelledby="s-gesamt">
        <div class="stats-total__head">
          <div class="stats-total__numbers">
            <h2 class="stats-total__label" id="s-gesamt">
              Gemeinsam erledigt · {describePeriod(period, stats.range)}
            </h2>
            <p class="stats-total__value">{stats.total}</p>
            <p class="stats-total__text">
              {describeComparison(period, stats.total, stats.previousTotal)}
            </p>
          </div>
          {streak !== undefined && (
            <p class="stats-total__streak">
              <Flame size={14} strokeWidth={2.4} aria-hidden="true" />
              {streak}
            </p>
          )}
        </div>
        <BarChart key={period} bars={stats.bars} period={period} />
      </section>

      <section class="stats-card" aria-labelledby="s-team">
        <h2 class="stats-card__title" id="s-team">
          Euer Teamwork
        </h2>
        <div class="split" role="img" aria-label={describeTeamwork(stats.byPerson, names)}>
          {personA + personB === 0 ? (
            <span class="split__empty" />
          ) : (
            <>
              <span class="split__part split__part--a" style={{ flexGrow: personA }} />
              <span class="split__part split__part--b" style={{ flexGrow: personB }} />
            </>
          )}
        </div>
        <ul class="split-legend">
          <li>
            <span class="split-legend__key split-legend__key--a" aria-hidden="true" />
            <strong>{names.personA}</strong> {personA}
          </li>
          <li>
            <span class="split-legend__key split-legend__key--b" aria-hidden="true" />
            <strong>{names.personB}</strong> {personB}
          </li>
        </ul>
        <p class="muted stats-card__note">{describeTakenOver(stats.takenOver)}</p>
      </section>

      <section class="stats-card" aria-labelledby="s-top">
        <h2 class="stats-card__title" id="s-top">
          Am häufigsten erledigt
        </h2>
        {stats.top.length === 0 ? (
          <p class="muted">In diesem Zeitraum wurde noch nichts erledigt.</p>
        ) : (
          <ol class="top-list">
            {stats.top.map(({ task, count }) => (
              <li class="top-list__item" key={task.id}>
                <TaskSymbol symbol={task.symbol} />
                <span class="top-list__title">{task.title}</span>
                <span class="top-list__count" aria-hidden="true">
                  {count}×
                </span>
                <span class="visually-hidden">{count}-mal erledigt</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** Width and height of the chart's drawing; the picture scales to the width of the tile. */
const CHART = { width: 300, height: 112, baseline: 92, plot: 68 } as const;

/** Whether the bar of a month's chart gets a label under it (every fifth day, to leave room). */
function labelled(bar: StatisticsBar, period: StatisticsPeriod): boolean {
  if (period !== "month") {
    return true;
  }
  const day = Number(bar.start.slice(8, 10));
  return day === 1 || day % 5 === 0;
}

/**
 * Done per day (week, month) or per month (year) as bars. The drawing is one picture with the
 * whole text as its description; the numbers on the bars are decoration of the same facts.
 */
function BarChart({
  bars,
  period,
}: {
  readonly bars: readonly StatisticsBar[];
  readonly period: StatisticsPeriod;
}) {
  const highest = Math.max(1, ...bars.map((bar) => bar.count));
  const slot = CHART.width / bars.length;
  const barWidth = slot * (period === "month" ? 0.7 : 0.62);
  return (
    <svg
      class="chart"
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      role="img"
      aria-label={describeBars(bars, period)}
    >
      {bars.map((bar, index) => {
        const height = bar.count === 0 ? 2 : Math.max(5, (bar.count / highest) * CHART.plot);
        const x = index * slot + (slot - barWidth) / 2;
        return (
          <g key={bar.start}>
            <rect
              class="chart__bar"
              x={x}
              y={CHART.baseline - height}
              width={barWidth}
              height={height}
              rx={Math.min(5, barWidth / 2)}
            />
            {period !== "month" && bar.count > 0 && (
              <text
                class="chart__value"
                x={index * slot + slot / 2}
                y={CHART.baseline - height - 4}
                text-anchor="middle"
              >
                {bar.count}
              </text>
            )}
            {labelled(bar, period) && (
              <text
                class="chart__label"
                x={index * slot + slot / 2}
                y={CHART.baseline + 16}
                text-anchor="middle"
              >
                {barLabel(bar.start, period)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
