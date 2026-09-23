"use client";
import { useState } from "react";

export default function CodeBlock({ code, lang, title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-4">
      {title && <div className="text-[12px] text-ink-3 mb-1.5 font-medium">{title}</div>}
      <pre className="code thin-scroll" data-lang={lang}>
        <code>{code}</code>
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        className="absolute top-2 right-2 text-[11px] px-2 py-1 rounded-md bg-white/10 text-white/80 hover:bg-white/20 opacity-0 group-hover:opacity-100 transition"
        style={title ? { top: 26 } : undefined}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
