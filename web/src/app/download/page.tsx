import { Section, Eyebrow, H1, H2, Lede } from "@/components/Section";
import CodeBlock from "@/components/CodeBlock";

export const metadata = { title: "Download · Decision Engine" };

const REPO = "https://github.com/jaydeepc/decision-engine-playground";

export default function Download() {
  return (
    <>
      <Section className="!pb-8">
        <Eyebrow>Download</Eyebrow>
        <H1>Take it with you.</H1>
        <Lede>Weights, library, backend and this playground are all open. Everything below is Apache 2.0.</Lede>
      </Section>

      <Section tone="tint" className="!pt-10">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { h: "Model weights", p: "The English checkpoint (ModernBERT-large, 421M, 843 MB safetensors) is attached to this repository's GitHub release. The multilingual and typed-decisions checkpoints download from Hugging Face on first use.", links: [[`${REPO}/releases`, "GitHub release"], ["https://huggingface.co/convaiinnovations/laya", "Hugging Face hub"]] },
            { h: "Python library", p: "pip install laya. Router, three checkpoints, presets, batch mode, an HTTP server, an MCP server and LangChain nodes. Python 3.10+.", links: [["https://pypi.org/project/laya/", "PyPI"], ["https://github.com/NandhaKishorM/laya", "Source"]] },
            { h: "This playground", p: "Next.js UI, Vercel gateway, FastAPI backend, training script and the docs on this site. Fork it, change the passcode, deploy.", links: [[REPO, "GitHub"], [`${REPO}#readme`, "README"]] },
          ].map((c) => (
            <div key={c.h} className="card p-6">
              <div className="font-semibold text-lg">{c.h}</div>
              <p className="text-ink-2 mt-2 text-[15px] leading-relaxed">{c.p}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {c.links.map(([href, label]) => <a key={href} href={href} className="btn btn-secondary !py-1.5 !text-[13px]">{label} ↗</a>)}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="self-host">
        <Eyebrow>Self-host the backend</Eyebrow>
        <H2>Run the model in three ways.</H2>
        <div className="prose mt-6 max-w-3xl">
          <h3>1. Python, any machine</h3>
          <CodeBlock lang="bash" code={`git clone ${REPO}
cd decision-engine-playground/api
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
LAYA_API_KEY=change-me LAYA_MODELS=english .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000
# first start downloads the English checkpoint (~808 MB) from Hugging Face`} />
          <p>Then, on Vercel, set <code>LAYA_BACKEND_URL=https://your-host:8000</code> and <code>LAYA_BACKEND_KEY=change-me</code>. On Apple Silicon set <code>LAYA_DEVICE=mps</code> for about 3x faster inference than CPU.</p>
          <h3>2. Docker</h3>
          <CodeBlock lang="bash" code={`docker build -t decision-engine-api ./api
docker run -p 8000:8000 -e LAYA_API_KEY=change-me -e LAYA_MODELS=english \\
  -v laya-cache:/home/laya/.cache/huggingface decision-engine-api
# GPU: add --gpus all and -e LAYA_DEVICE=cuda (build with TORCH_INDEX=cu128)`} />
          <h3>3. Hugging Face Space (free CPU or a GPU)</h3>
          <CodeBlock lang="bash" code={`# Create a Docker Space, then push the api/ folder to it:
git clone https://huggingface.co/spaces/<you>/decision-engine-api && cd decision-engine-api
cp -r ../decision-engine-playground/api/* . && cp ../decision-engine-playground/api/huggingface-space/README.md .
git add . && git commit -m "laya backend" && git push
# Space secrets: LAYA_API_KEY. The Space URL becomes LAYA_BACKEND_URL on Vercel.`} />
          <h3>Use the weights from this repository's release instead of Hugging Face</h3>
          <CodeBlock lang="bash" code={`# Download the English checkpoint attached to the GitHub release into models/laya-english
./models/download.sh
LAYA_LOCAL_MODEL_DIR=$PWD/models/laya-english .venv/bin/uvicorn app:app --app-dir api --port 8000`} />
        </div>
      </Section>

      <Section tone="tint">
        <Eyebrow>Other ways to run Laya</Eyebrow>
        <div className="prose mt-4 max-w-3xl">
          <ul>
            <li><strong>Command line:</strong> <code>laya &quot;refund please&quot; --predict</code> after <code>pip install laya</code>.</li>
            <li><strong>MCP server:</strong> <code>pip install &quot;laya[mcp]&quot;</code> then <code>laya-mcp-server</code>; Claude Desktop, Cursor and others can call typed decisions as tools.</li>
            <li><strong>TypeScript and the browser:</strong> the upstream repository's <code>laya-ts</code> package runs an ONNX export on Node or WebGPU with identical answers.</li>
            <li><strong>ONNX Runtime and TileLang:</strong> <code>laya.onnx_agent.ONNXAgent</code>, and <code>laya.load(..., fast=True)</code> for fused GPU kernels.</li>
            <li><strong>Fine-tuning:</strong> the Kaggle 2xT4 notebook, or the single-device script in this repository's <code>training/</code> folder.</li>
          </ul>
        </div>
      </Section>
    </>
  );
}
