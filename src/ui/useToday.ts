import { useEffect, useState } from "preact/hooks";
import { type CalendarDay, dayFromDate } from "../domain/date";

const CHECK_EVERY_MS = 60_000;

/**
 * Today's calendar day. It moves on by itself when a page stays open overnight (checked every
 * minute and when the tab is shown again), so "heute" never lags behind.
 */
export function useToday(): CalendarDay {
  const [today, setToday] = useState(() => dayFromDate(new Date()));
  useEffect(() => {
    const update = () => setToday(dayFromDate(new Date()));
    const timer = setInterval(update, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return today;
}
