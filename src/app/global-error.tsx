"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center", background: "#0a0e13", color: "#e6edf3" }}>
        <h1 style={{ fontSize: "1.25rem" }}>Something went wrong</h1>
        <p style={{ color: "#8b98a5" }}>Please reload the page. Your data is safe.</p>
        <button onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem", borderRadius: 6 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
