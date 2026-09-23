import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Decision Engine Playground" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="text-center">
        <img src="/brand/laya-mark.svg" alt="" width={44} height={44} className="mx-auto" />
        <h1 className="title text-3xl mt-5">Enter the access code</h1>
        <p className="text-ink-2 mt-2">The playground and studio run a real model on real hardware, so access is by invitation.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
