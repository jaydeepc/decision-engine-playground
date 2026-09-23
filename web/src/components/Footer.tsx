import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-line mt-24">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 md:grid-cols-4 text-[13px] text-ink-2">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 text-ink font-semibold mb-2">
            <img src="/brand/laya-mark.svg" alt="" width={18} height={18} /> Decision Engine Playground
          </div>
          <p className="max-w-md leading-relaxed">
            An information site and playground for <a className="link" href="https://github.com/NandhaKishorM/laya">Laya</a>, the open-source
            System 1 decision engine by Nandakishor Mukkunnoth, ConvAI Innovations. Model weights and library are Apache 2.0. This playground is an
            independent community project and is not affiliated with ConvAI Innovations.
          </p>
        </div>
        <div>
          <div className="text-ink font-medium mb-2">Explore</div>
          <ul className="space-y-1.5">
            <li><Link className="hover:text-ink" href="/learn">What is a decision engine</Link></li>
            <li><Link className="hover:text-ink" href="/playground">Playground</Link></li>
            <li><Link className="hover:text-ink" href="/build">Build with the API</Link></li>
            <li><Link className="hover:text-ink" href="/studio">Model Studio</Link></li>
            <li><Link className="hover:text-ink" href="/finetune">Fine-tuning</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-ink font-medium mb-2">Upstream</div>
          <ul className="space-y-1.5">
            <li><a className="hover:text-ink" href="https://laya.convaiinnovations.com/">Laya research post</a></li>
            <li><a className="hover:text-ink" href="https://huggingface.co/convaiinnovations/laya">Hugging Face weights</a></li>
            <li><a className="hover:text-ink" href="https://pypi.org/project/laya/">pip install laya</a></li>
            <li><a className="hover:text-ink" href="https://github.com/jaydeepc/decision-engine-playground">This playground on GitHub</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
