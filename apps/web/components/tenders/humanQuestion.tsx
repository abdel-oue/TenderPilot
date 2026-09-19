"use client";
// The agent stopped and asked. This is where a person answers it.
//
// It renders where the run stopped, inside the feed, because that is what makes
// the pause legible: the question is a step of the reasoning, not a modal that
// interrupted it. The options come from the model, which knows what answers it
// can act on — a free-text box alone would put the burden of guessing them on
// the reader.
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MessageCircleQuestion } from "lucide-react";
import type { Blocker } from "@tenderpilot/shared";
import type { HumanAnswer, PendingQuestion } from "@/lib/types";
import { INPUT, PRIMARY, SECONDARY } from "@/lib/utils/workspaceStyleUtils";
import { fadeUp } from "@/lib/utils/motionUtils";
import { cn } from "@/lib/utils/classNameUtils";

interface HumanQuestionProps {
  question: PendingQuestion;
  /** Offered only where they mean something: the verdict exists by then. */
  blockers: Blocker[];
  pending: boolean;
  error: string | null;
  onAnswer: (answer: HumanAnswer) => void;
}

export function HumanQuestion({ question, blockers, pending, error, onAnswer }: HumanQuestionProps) {
  const reduced = useReducedMotion();
  const [choice, setChoice] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [override, setOverride] = useState<"go" | "no-go" | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  function toggleBlocker(id: string) {
    setDismissed((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function submit() {
    if (!choice || pending) return;
    onAnswer({
      askId: question.askId,
      choice,
      instruction: instruction.trim() || undefined,
      verdictOverride: override,
      dismissedBlockers: dismissed,
    });
  }

  return (
    <motion.section
      variants={fadeUp(reduced)}
      initial="hidden"
      animate="visible"
      data-testid="human-question"
      className="rounded-2xl border border-accent/40 bg-accent-soft p-5 text-left"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-xl bg-surface p-2 text-accent">
          <MessageCircleQuestion size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-mini uppercase tracking-label text-accent">L&apos;agent vous demande</p>
          <h3 className="mt-1 font-heading text-lg leading-6">{question.question}</h3>
          {question.raison ? (
            <p className="mt-1.5 text-xs leading-5 text-muted">« {question.raison} »</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Votre réponse">
        {question.options.map((option) => (
          <button
            key={option.value}
            className={cn(
              "cursor-pointer rounded-lg border px-3.5 py-2 text-xs transition duration-200",
              choice === option.value
                ? "border-accent bg-accent font-medium text-surface dark:text-background"
                : "border-border bg-surface hover:bg-soft",
            )}
            aria-pressed={choice === option.value}
            data-testid={`answer-${option.value}`}
            onClick={() => setChoice(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="mt-4 block space-y-1.5">
        <span className="text-mini text-muted">Une précision à lui donner (facultatif)</span>
        <textarea
          className={cn(INPUT, "min-h-16 resize-y leading-5")}
          placeholder="Ex : insistez sur nos références ferroviaires."
          value={instruction}
          data-testid="answer-instruction"
          onChange={(event) => setInstruction(event.target.value)}
        />
      </label>

      {/* Only once there is a verdict to argue with. Before `decide` has run
          these two controls would be asking about something that does not
          exist yet. */}
      {blockers.length > 0 ? (
        <fieldset className="mt-4 space-y-2">
          <legend className="text-mini text-muted">
            Points bloquants à écarter — cochez ce que l&apos;agent a mal jugé
          </legend>
          {blockers.map((blocker, index) => {
            const id = blocker.requirementId ?? `blocker-${index}`;
            return (
              <label key={id} className="flex cursor-pointer items-start gap-2 text-xs leading-5">
                <input
                  type="checkbox"
                  className="mt-0.5 cursor-pointer accent-accent"
                  checked={dismissed.includes(id)}
                  data-testid={`dismiss-${id}`}
                  onChange={() => toggleBlocker(id)}
                />
                <span className={cn(dismissed.includes(id) && "text-muted line-through")}>
                  {blocker.text}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {blockers.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-mini text-muted">Forcer le verdict :</span>
          {(["go", "no-go"] as const).map((value) => (
            <button
              key={value}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-1.5 text-mini uppercase transition duration-200",
                override === value
                  ? "border-accent bg-accent text-surface dark:text-background"
                  : "border-border bg-surface hover:bg-soft",
              )}
              aria-pressed={override === value}
              data-testid={`override-${value}`}
              onClick={() => setOverride(override === value ? null : value)}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          className={PRIMARY}
          disabled={!choice || pending}
          data-testid="answer-submit"
          onClick={submit}
        >
          {pending ? "Reprise de l’analyse…" : "Répondre et reprendre"}
        </button>
        <button
          className={SECONDARY}
          disabled={pending}
          data-testid="answer-reset"
          onClick={() => {
            setChoice(null);
            setInstruction("");
            setOverride(null);
            setDismissed([]);
          }}
        >
          Effacer
        </button>
        {!choice && <span className="text-mini text-muted">Choisissez une réponse.</span>}
      </div>

      {error ? (
        <p role="alert" data-testid="answer-error" className="mt-3 text-xs text-warning">
          {error}
        </p>
      ) : null}
    </motion.section>
  );
}
