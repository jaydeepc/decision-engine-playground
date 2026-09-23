import Link from "next/link";
import { Section, Eyebrow, H1, H2, Lede } from "@/components/Section";
import CodeBlock from "@/components/CodeBlock";
import ApiTry from "./ApiTry";

export const metadata = { title: "Build with the API · Decision Engine" };

const BASE = "https://decision-engine-playground.vercel.app";

export default function Build() {
  const curl = `curl -s ${BASE}/api/v1/systemone \\
  -H "Authorization: Bearer $DECISION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "state": {"body": "Billed twice this month. Refund the duplicate today or we cancel."},
    "questions": {
      "queue":   {"type": "choice", "instructions": "Which team owns this?",
                  "criteria": {"billing": "refunds, invoices", "tech": "bugs, outages", "other": "anything else"}},
      "urgency": {"type": "score",  "instructions": "How urgent?",
                  "criteria": ["not urgent", "soon", "blocking"]},
      "churn":   {"type": "noul",   "instructions": "Does the customer threaten to cancel?"}
    }
  }'`;

  const py = `import os, requests

API = "${BASE}/api/v1/systemone"
KEY = os.environ["DECISION_API_KEY"]

def decide(state, questions, model=None):
    r = requests.post(API, json={"state": state, "questions": questions, "model": model},
                      headers={"Authorization": f"Bearer {KEY}"}, timeout=60)
    r.raise_for_status()
    return r.json()

res = decide(
    {"body": "Billed twice this month. Refund the duplicate today or we cancel."},
    {
        "queue":   {"type": "choice", "instructions": "Which team owns this?",
                    "criteria": {"billing": "refunds, invoices", "tech": "bugs, outages", "other": "anything else"}},
        "urgency": {"type": "score",  "instructions": "How urgent?", "criteria": ["not urgent", "soon", "blocking"]},
        "churn":   {"type": "noul",   "instructions": "Does the customer threaten to cancel?"},
    },
)
a = res["answers"]
print(a["queue"]["choice"], a["queue"]["confidence"])   # billing 0.97
print(a["urgency"]["score"])                            # 1.8
if a["churn"]["noul"] > 0.5:
    escalate()`;

  const js = `const res = await fetch("${BASE}/api/v1/systemone", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.DECISION_API_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({
    state: { body: "Billed twice this month. Refund the duplicate today or we cancel." },
    questions: {
      queue:   { type: "choice", instructions: "Which team owns this?",
                 criteria: { billing: "refunds, invoices", tech: "bugs, outages", other: "anything else" } },
      urgency: { type: "score", instructions: "How urgent?", criteria: ["not urgent", "soon", "blocking"] },
      churn:   { type: "noul",  instructions: "Does the customer threaten to cancel?" },
    },
  }),
});
const { answers, routing } = await res.json();
console.log(answers.queue.choice, answers.churn.noul, routing.model);`;

  const resp = `{
  "model": "laya-rl-agent",
  "answers": {
    "queue":   { "type": "choice", "choice": "billing",
                 "probabilities": { "billing": 0.968, "tech": 0.004, "other": 0.028 }, "confidence": 0.91 },
    "urgency": { "type": "score", "score": 1.79,
                 "legend": { "0": "not urgent", "1": "soon", "2": "blocking" },
                 "probabilities": { "0": 0.05, "1": 0.11, "2": 0.84 }, "confidence": 0.62 },
    "churn":   { "type": "noul", "noul": 0.87, "confidence": 0.87 }
  },
  "usage": { "input_tokens": 212, "output_tokens": 0 },
  "routing": { "model": "english", "repo": "convaiinnovations/laya", "reason": "Latin script and English function words" },
  "latency_ms": 241.3,
  "gateway": { "latency_ms": 402, "auth": "key" }
}`;

  const local = `# Same request, straight against your own backend (laya-serve or api/app.py), no gateway
pip install "laya[serve]"
LAYA_MODELS=english laya-serve            # http://localhost:8000/v1/systemone

# or the Python SDK, no HTTP at all
pip install laya
python -c 'import laya; a = laya.load("convaiinnovations/laya"); print(a.predict({"body": "billed twice"}, laya.triage_questions())["answers"])'`;

  return (
    <>
      <Section className="!pb-8">
        <Eyebrow>Build with the API</Eyebrow>
        <H1>One POST. Every decision.</H1>
        <Lede>
          The playground is a thin UI over a REST gateway that you can call from any language. It speaks the same wire format as TypeSafe's Jev
          <code className="mono"> /v1/systemone</code> endpoint, so existing Jev clients only need a new base URL and key.
        </Lede>
      </Section>

      <Section tone="tint" className="!pt-10">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-10 items-start">
          <div className="prose">
            <h2 className="!mt-0">Endpoints</h2>
            <table>
              <tbody>
                <tr><td><code>POST /api/v1/systemone</code></td><td>Evaluate questions over a state. Needs a key.</td></tr>
                <tr><td><code>POST /api/v1/route</code></td><td>Routing decision only: which checkpoint would run, and why. No key, no model, sub-millisecond.</td></tr>
                <tr><td><code>GET /api/v1/presets</code></td><td>The built-in question sets used by the playground.</td></tr>
                <tr><td><code>GET /api/health</code></td><td>Gateway and model backend status.</td></tr>
              </tbody>
            </table>
            <h3>Authentication</h3>
            <p>
              Send <code>Authorization: Bearer &lt;key&gt;</code>. Keys are issued by whoever runs this deployment (the <code>API_KEYS</code>
              environment variable). Signed-in playground users are also authorised through their session cookie, which is how the chat works.
            </p>
            <h3>Request</h3>
            <ul>
              <li><code>state</code>: a string, or any JSON object or array. Up to 20,000 characters. Objects are serialised as compact JSON, so key names are visible to the model: name them well.</li>
              <li><code>questions</code>: an object keyed by question id. Each has <code>type</code> (choice, score, noul), <code>instructions</code>, and <code>criteria</code> (a map for choice, a list for score, optional for noul).</li>
              <li><code>model</code> (optional): <code>english</code>, <code>multilingual</code> or <code>typed-decisions</code>. Omit to auto-route.</li>
            </ul>
            <h3>Response</h3>
            <p>Answers per question id, token usage, the routing decision with its reason, model latency, and the gateway's own timing.</p>
            <CodeBlock code={resp} title="200 OK" />
            <h3>Errors</h3>
            <ul>
              <li><code>400</code> invalid question schema, with a message naming the question.</li>
              <li><code>401</code> missing or wrong key. <code>413</code> state too large.</li>
              <li><code>503</code> the model backend is offline. The response still includes the routing decision.</li>
            </ul>
          </div>
          <div>
            <CodeBlock code={curl} lang="bash" title="curl" />
            <CodeBlock code={py} lang="python" title="Python" />
            <CodeBlock code={js} lang="ts" title="JavaScript / TypeScript" />
          </div>
        </div>
      </Section>

      <Section>
        <Eyebrow>Try it here</Eyebrow>
        <H2>Send a request from the browser.</H2>
        <Lede>Uses your playground session if you are signed in, or paste an API key.</Lede>
        <ApiTry />
      </Section>

      <Section tone="tint">
        <Eyebrow>Architecture</Eyebrow>
        <H2>Where things run.</H2>
        <div className="prose mt-6 max-w-3xl">
          <p>
            This site is a Next.js app on Vercel. Vercel functions cannot hold a 421M-parameter PyTorch model, so the gateway forwards
            <code>/api/v1/systemone</code> to a <strong>model backend</strong>: the FastAPI service in the repository's <code>api/</code> folder, which wraps
            the <code>laya</code> Python package. Run it on any machine with 4 GB of RAM (CPU, about 250 to 900 ms per request) or a small GPU
            (about 33 ms), and point the gateway at it with <code>LAYA_BACKEND_URL</code>.
          </p>
          <p>Routing, validation, authentication and the presets run on Vercel itself. That is why <code>/api/v1/route</code> works even when no backend is attached.</p>
          <CodeBlock code={local} lang="bash" title="Skip the gateway entirely" />
          <p>
            Full self-hosting instructions, a Dockerfile and a Hugging Face Spaces recipe are on the <Link className="link" href="/download#self-host">Download</Link> page.
          </p>
        </div>
      </Section>

      <Section>
        <Eyebrow>Patterns</Eyebrow>
        <H2>Things people build with it.</H2>
        <div className="mt-8 grid md:grid-cols-2 gap-5">
          {[
            ["Confidence-gated automation", "Act automatically when confidence is above 0.85, escalate to a human below. Because the probabilities are calibrated, the threshold means what you think it means."],
            ["LLM pre-router", "Score difficulty, domain and tool needs in 30 ms, then send easy requests to a small model and hard ones to a frontier model."],
            ["Guardrail in front of a chatbot", "Jailbreak, injection, sensitive data and harm severity before the prompt reaches the LLM. Five questions, one pass."],
            ["Inbox and ticket triage", "Route to a queue, flag phishing, judge urgency and churn risk. Preload the router so a Hindi ticket after an English one costs nothing extra."],
            ["RAG passage filter", "Ask 'does this passage answer the query?' for each candidate in a batch and keep the ones above threshold."],
            ["LangGraph conditional edges", "The laya package ships LayaRouter and LayaGuardrail nodes for LangChain and LangGraph, with an HTTP mode that can point at this API."],
          ].map(([h, p]) => (
            <div key={h} className="card p-5">
              <div className="font-semibold">{h}</div>
              <div className="text-ink-2 mt-1 text-[15px] leading-relaxed">{p}</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
