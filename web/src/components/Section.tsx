export function Section({ children, className = "", tone = "plain", id }: { children: React.ReactNode; className?: string; tone?: "plain" | "tint"; id?: string }) {
  return (
    <section id={id} className={`${tone === "tint" ? "bg-bg-2" : ""} py-16 sm:py-24 ${className}`}>
      <div className="mx-auto max-w-6xl px-4">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow mb-3">{children}</div>;
}

export function H1({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h1 className={`display text-4xl sm:text-6xl ${className}`}>{children}</h1>;
}
export function H2({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`title text-3xl sm:text-5xl ${className}`}>{children}</h2>;
}
export function Lede({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`lede mt-4 max-w-2xl ${className}`}>{children}</p>;
}
