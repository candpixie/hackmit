"use client";

import { useState } from "react";
import type { Report, TieView } from "@/lib/types";

type Because = { person: string; quote: string; msgId: string };
type Plan = {
  title: string;
  rationale: string;
  because: Because[];
  estimatedPerPerson: number;
  risk: string;
};

type Cart = {
  merchant: string;
  items: { label: string; amount: number; note?: string }[];
  subtotal: number;
  perPerson: number;
  headcount: number;
  currency: string;
  reasoning: string[];
  guardrail: { capPerPerson: number; withinCap: boolean; adjustment: string | null };
  credential: { reference: string; maxAmount: number; merchantLock: string; expiresAt: string };
};

export function Friendsgiving({ report, onBack }: { report: Report; onBack: () => void }) {
  const [picked, setPicked] = useState<string[]>(
    report.ties.filter((t) => t.decay >= 0.45).slice(0, 4).map((t) => t.thread)
  );
  const [cap, setCap] = useState(60);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [chosen, setChosen] = useState<Plan | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [booked, setBooked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  function toggle(thread: string) {
    setPicked((p) => (p.includes(thread) ? p.filter((x) => x !== thread) : [...p, thread]));
    setPlans(null);
    setChosen(null);
    setCart(null);
  }

  async function plan() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session: report.session,
          people: picked,
          ties: report.ties.filter((t) => picked.includes(t.thread)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Planning failed.");
      setPlans(data.plans ?? []);
      setModel(data.model ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planning failed.");
    } finally {
      setBusy(false);
    }
  }

  async function checkout(p: Plan) {
    setChosen(p);
    setBooked(false);
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: p.title,
          headcount: picked.length + 1,
          capPerPerson: cap,
        }),
      });
      setCart(await res.json());
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 lg:px-10">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">
          Friendsgiving
        </p>
        <button onClick={onBack} className="text-[12px] text-faint hover:text-bone">
          Back to the list
        </button>
      </div>

      <h1 className="mt-5 font-serif text-4xl leading-tight text-bone">
        Get all of them in one room.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        Nobody remembers what anyone wanted, because it is scattered across{" "}
        {report.threadCount} separate threads. This searches all of them at once and
        finds the one thing the evidence actually supports.
      </p>

      {/* ---- who ---- */}
      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">
          Who
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {report.ties.map((t) => (
            <button
              key={t.thread}
              onClick={() => toggle(t.thread)}
              className={`rounded-full border px-4 py-2 text-[13px] transition-colors ${
                picked.includes(t.thread)
                  ? "border-ember bg-ember/10 text-bone"
                  : "border-line text-muted hover:border-faint hover:text-bone"
              }`}
            >
              {t.friend}
              <span className="ml-2 font-mono text-[11px] text-faint">
                {t.silenceDays}d
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <label className="text-[13px] text-muted">
            Cap per person
            <input
              type="number"
              value={cap}
              min={10}
              onChange={(e) => setCap(Number(e.target.value))}
              className="ml-3 w-20 rounded-md border border-line bg-card px-3 py-1.5 text-[14px] tabular-nums text-bone"
            />
          </label>

          <button
            onClick={plan}
            disabled={busy || picked.length < 2}
            className="rounded-md bg-ember px-5 py-2.5 text-[14px] font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy && !chosen ? "Searching all threads…" : "Find something they'd all want"}
          </button>
        </div>

        {picked.length < 2 ? (
          <p className="mt-3 text-[13px] text-faint">Pick at least two people.</p>
        ) : null}
        {error ? <p className="mt-3 text-[13px] text-ember">{error}</p> : null}
      </section>

      {/* ---- plans ---- */}
      {plans ? (
        <section className="rise mt-12 border-t border-line pt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">
              What the evidence supports
            </h2>
            {model ? (
              <span className="font-mono text-[11px] text-faint">{model}</span>
            ) : null}
          </div>

          {plans.length === 0 ? (
            <p className="mt-5 text-[14px] text-muted">
              Nothing in these threads says what anyone wanted to do.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {plans.map((p) => (
                <li
                  key={p.title}
                  className={`rounded-lg border p-6 transition-colors ${
                    chosen?.title === p.title
                      ? "border-ember/50 bg-ember/[0.06]"
                      : "border-line bg-card"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-serif text-[24px] leading-tight text-bone">
                      {p.title}
                    </h3>
                    <span className="shrink-0 font-mono text-[13px] tabular-nums text-muted">
                      ~${p.estimatedPerPerson}/each
                    </span>
                  </div>

                  <p className="mt-3 text-[14px] leading-relaxed text-muted">
                    {p.rationale}
                  </p>

                  <ul className="mt-5 space-y-2.5">
                    {p.because.map((b) => (
                      <li key={b.msgId} className="text-[13px] leading-relaxed">
                        <span className="text-ember">{b.person}</span>
                        <span className="text-faint"> · </span>
                        <span className="font-serif text-[15px] text-bone">
                          “{b.quote}”
                        </span>
                      </li>
                    ))}
                  </ul>

                  {p.risk ? (
                    <p className="mt-5 border-l-2 border-line pl-4 text-[13px] leading-relaxed text-faint">
                      {p.risk}
                    </p>
                  ) : null}

                  <button
                    onClick={() => checkout(p)}
                    disabled={busy}
                    className="mt-6 rounded-md border border-line px-5 py-2.5 text-[14px] text-bone transition-colors hover:border-ember disabled:opacity-50"
                  >
                    Book this
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* ---- checkout ---- */}
      {cart ? (
        <section className="rise mt-12 border-t border-line pt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">
              Checkout
            </h2>
            <span className="rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              Sandbox
            </span>
          </div>

          <p className="mt-5 text-[15px] text-bone">{cart.merchant}</p>

          <ul className="mt-5 space-y-2">
            {cart.items.map((i) => (
              <li key={i.label} className="flex items-baseline justify-between gap-4 text-[14px]">
                <span className="text-muted">
                  {i.label}
                  {i.note ? (
                    <span className="ml-2 font-mono text-[11px] text-faint">{i.note}</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-bone">
                  {cart.currency}
                  {i.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4 text-[15px]">
            <span className="text-muted">
              {cart.headcount} people, split evenly
            </span>
            <span className="tabular-nums text-bone">
              {cart.currency}
              {cart.perPerson.toFixed(2)} each
            </span>
          </div>

          <div className="mt-7">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              What the agent did
            </h3>
            <ul className="mt-3 space-y-1.5">
              {cart.reasoning.map((r) => (
                <li key={r} className="text-[13px] leading-relaxed text-muted">
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-7 rounded-lg border border-line bg-card p-5">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              Payment credential
            </h3>
            <dl className="mt-3 space-y-1.5 font-mono text-[12px]">
              <Row k="reference" v={cart.credential.reference} />
              <Row k="max amount" v={`${cart.currency}${cart.credential.maxAmount.toFixed(2)}`} />
              <Row k="locked to" v={cart.credential.merchantLock} />
              <Row
                k="expires"
                v={new Date(cart.credential.expiresAt).toLocaleTimeString()}
              />
            </dl>
            <p className="mt-4 text-[12px] leading-relaxed text-faint">
              Single use, one merchant, one amount, thirty minutes. The agent never
              holds anything broader than the purchase you approved.
            </p>
          </div>

          {booked ? (
            <p className="rise mt-7 text-[15px] text-sage">
              Booked in sandbox. In production this is where the merchant confirmation
              and the split request to each person would go out.
            </p>
          ) : (
            <button
              onClick={() => setBooked(true)}
              disabled={!cart.guardrail.withinCap}
              className="mt-7 rounded-md bg-ember px-5 py-2.5 text-[14px] font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cart.guardrail.withinCap
                ? `Approve ${cart.currency}${cart.subtotal.toFixed(2)}`
                : "Over your cap"}
            </button>
          )}
        </section>
      ) : null}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-faint">{k}</dt>
      <dd className="truncate text-muted">{v}</dd>
    </div>
  );
}
