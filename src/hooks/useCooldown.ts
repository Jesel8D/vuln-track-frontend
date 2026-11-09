import { useEffect, useState } from "react";
import { ApiError } from "../services/api";
export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (!seconds) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [seconds]);
  function receive(error: unknown) {
    if (error instanceof ApiError && error.retryAfter) {
      const time = Date.now();
      setNow(time);
      setUntil(time + error.retryAfter * 1000);
    }
  }
  return { seconds, receive };
}
