"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ask, FROM_NAME, forgiven, intro, nextLabel, steps, waiting } from "@/config";
import { HeartScene } from "./HeartScene";

type Phase =
  | { kind: "intro" }
  | { kind: "step"; i: number }
  | { kind: "ask" }
  | { kind: "yes" }
  | { kind: "notyet" };

const WORD_STEP = 0.12;

// Animate word by word — splitting on spaces keeps Gujarati conjuncts intact.
function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i}>
          <span className="word" style={{ animationDelay: `${delay + i * WORD_STEP}s` }}>
            {w}
          </span>{" "}
        </span>
      ))}
    </>
  );
}

const wordsEnd = (text: string | undefined, delay: number) =>
  text ? delay + text.split(" ").length * WORD_STEP + 0.25 : delay;

function Card({
  line,
  sub,
  children,
}: {
  line: string;
  sub?: string;
  children?: (after: number) => React.ReactNode;
}) {
  const subDelay = wordsEnd(line, 0.15);
  const after = wordsEnd(sub, subDelay) + 0.2;
  return (
    <div className="card">
      <h1 className="line">
        <Words text={line} delay={0.15} />
      </h1>
      {sub && (
        <p className="sub">
          <Words text={sub} delay={subDelay} />
        </p>
      )}
      {children?.(after)}
    </div>
  );
}

export default function Apology() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HeartScene | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });

  useEffect(() => {
    if (!canvasRef.current) return;
    let scene: HeartScene | null = null;
    try {
      scene = new HeartScene(canvasRef.current);
    } catch (err) {
      // No WebGL — the words still work on the dark background.
      console.warn("WebGL unavailable", err);
    }
    sceneRef.current = scene;
    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    if (phase.kind === "intro") s.setTarget(1, 0);
    else if (phase.kind === "step") s.setTarget(steps[phase.i].split, steps[phase.i].warmth);
    else if (phase.kind === "ask") s.setTarget(0.4, 0.55);
    else if (phase.kind === "notyet") s.setTarget(0.35, 0.4);
    else {
      s.celebrate();
      navigator.vibrate?.([30, 80, 30]);
    }
  }, [phase]);

  const next = (i: number) => setPhase(i < steps.length ? { kind: "step", i } : { kind: "ask" });
  const progress = phase.kind === "step" ? phase.i : phase.kind === "ask" ? steps.length : -1;
  const key = phase.kind === "step" ? `step-${phase.i}` : phase.kind;

  let content: React.ReactNode;
  if (phase.kind === "intro") {
    content = (
      <Card line={intro.line} sub={intro.sub}>
        {(after) => (
          <div className="actions fade" style={{ animationDelay: `${after}s` }}>
            <button className="btn primary" onClick={() => next(0)}>
              {intro.cta}
            </button>
          </div>
        )}
      </Card>
    );
  } else if (phase.kind === "step") {
    const step = steps[phase.i];
    content = (
      <Card line={step.line} sub={step.sub}>
        {(after) => (
          <div className="actions fade" style={{ animationDelay: `${after}s` }}>
            <button className="btn" onClick={() => next(phase.i + 1)}>
              {nextLabel}
            </button>
          </div>
        )}
      </Card>
    );
  } else if (phase.kind === "ask") {
    content = (
      <Card line={ask.line}>
        {(after) => (
          <div className="actions fade" style={{ animationDelay: `${after}s` }}>
            <button className="btn primary" onClick={() => setPhase({ kind: "yes" })}>
              {ask.yes}
            </button>
            <button className="btn" onClick={() => setPhase({ kind: "notyet" })}>
              {ask.notYet}
            </button>
          </div>
        )}
      </Card>
    );
  } else if (phase.kind === "yes") {
    content = (
      <Card line={forgiven.line} sub={forgiven.sub}>
        {(after) => (
          <>
            <p className="ps fade" style={{ animationDelay: `${after}s` }}>
              {forgiven.ps}
            </p>
            {FROM_NAME && (
              <p className="sign fade" style={{ animationDelay: `${after + 0.6}s` }}>
                — {FROM_NAME}
              </p>
            )}
          </>
        )}
      </Card>
    );
  } else {
    content = (
      <Card line={waiting.line} sub={waiting.sub}>
        {(after) => (
          <div className="actions fade" style={{ animationDelay: `${after + 1.2}s` }}>
            <button className="btn" onClick={() => setPhase({ kind: "yes" })}>
              {waiting.changeMind}
            </button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <main>
      <canvas ref={canvasRef} className="scene" aria-hidden="true" />
      <section className="overlay" aria-live="polite">
        <Fragment key={key}>{content}</Fragment>
        {progress >= 0 && (
          <div className="dots" aria-hidden="true">
            {Array.from({ length: steps.length + 1 }, (_, i) => (
              <span key={i} className={`dot${i === progress ? " on" : ""}`} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
