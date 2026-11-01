"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("MDIS route error", error);
  }, [error]);

  return (
    <main className="route-error" role="alert">
      <h1>This MDIS view could not load</h1>
      <p>{error.message || "An unexpected route error occurred."}</p>
      <button type="button" onClick={reset}>Retry this view</button>
    </main>
  );
}
