"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/learn", label: "Learn" },
  { href: "/playground", label: "Playground" },
  { href: "/build", label: "API" },
  { href: "/studio", label: "Studio" },
  { href: "/finetune", label: "Fine-tune" },
  { href: "/download", label: "Download" },
];

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="glass sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 h-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src="/brand/laya-mark.svg" alt="" width={22} height={22} />
          <span>Decision Engine</span>
          <span className="hidden sm:inline text-ink-3 font-normal">· Laya</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-[13px]">
          {LINKS.map((l) => {
            const on = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-full transition ${on ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link href="/playground" className="btn btn-primary ml-2 !py-1.5 !px-3.5 !text-[13px]">
            Try it
          </Link>
        </nav>
        <button className="md:hidden p-2 -mr-2" aria-label="Menu" onClick={() => setOpen(!open)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-line px-4 py-3 flex flex-col gap-1 text-[15px]">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2 text-ink-2 hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
