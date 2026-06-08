import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAssignmentQueryKey,
  useCreateProblem,
  useGetAssignment,
  type ProblemStep,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TeacherLayout } from "@/components/teacher/TeacherLayout";
import { getErrorMessage } from "@/lib/errors";

// A step row in the editor carries a stable client-only `key` so React keeps
// inputs/focus tied to the right row as rows are added and removed.
interface StepRow extends ProblemStep {
  key: number;
}

export default function AssignmentDetail({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const queryClient = useQueryClient();
  const { data: assignment, isLoading } = useGetAssignment(assignmentId);
  const createProblem = useCreateProblem();

  const stepKey = useRef(0);
  const newStep = (): StepRow => ({ key: stepKey.current++, prompt: "", answer: "" });

  const [prompt, setPrompt] = useState("");
  const [steps, setSteps] = useState<StepRow[]>(() => [newStep()]);

  function updateStep(index: number, patch: Partial<ProblemStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((prev) => [...prev, newStep()]);
  }
  function removeStep(index: number) {
    setSteps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const canSubmit =
    prompt.trim().length > 0 &&
    steps.every((s) => s.prompt.trim() && s.answer.trim());

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      await createProblem.mutateAsync({
        assignmentId,
        data: {
          prompt: prompt.trim(),
          steps: steps.map((s) => ({
            prompt: s.prompt.trim(),
            answer: s.answer.trim(),
          })),
        },
      });
      setPrompt("");
      setSteps([newStep()]);
      queryClient.invalidateQueries({
        queryKey: getGetAssignmentQueryKey(assignmentId),
      });
    } catch {
      // Surfaced below.
    }
  }

  const problems = assignment?.problems ?? [];

  return (
    <TeacherLayout
      title={assignment?.title ?? "Assignment"}
      description={assignment?.instructions || undefined}
      backHref={assignment ? `/teacher/classes/${assignment.classId}` : "/teacher/classes"}
      backLabel="Class"
    >
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Add a problem</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-5" data-testid="form-create-problem">
            <div className="space-y-1.5">
              <Label htmlFor="prompt">Problem</Label>
              <Textarea
                id="prompt"
                placeholder="e.g. Balance: H₂ + O₂ → H₂O"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                data-testid="input-problem-prompt"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Steps &amp; answer key</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStep}>
                  + Add step
                </Button>
              </div>
              {steps.map((step, i) => (
                <div
                  key={step.key}
                  className="rounded-lg border border-border p-3"
                  data-testid={`step-row-${i}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Step {i + 1}
                    </span>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="What the student does"
                      value={step.prompt}
                      onChange={(e) => updateStep(i, { prompt: e.target.value })}
                    />
                    <Input
                      placeholder="Expected answer"
                      value={step.answer}
                      onChange={(e) => updateStep(i, { answer: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="submit"
              disabled={createProblem.isPending || !canSubmit}
              data-testid="button-create-problem"
            >
              {createProblem.isPending ? "Adding…" : "Add problem"}
            </Button>
            {createProblem.isError && (
              <p className="text-sm text-destructive">
                {getErrorMessage(createProblem.error)}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Problems ({problems.length})
      </h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : problems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No problems yet. Add the first one above.
        </p>
      ) : (
        <div className="space-y-3">
          {problems.map((p, idx) => (
            <Card key={p.id}>
              <CardContent className="pt-6">
                <div className="font-medium text-foreground">
                  {idx + 1}. {p.prompt}
                </div>
                <ol className="mt-3 space-y-1.5">
                  {p.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      <span className="text-foreground">{s.prompt}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-foreground">{s.answer}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TeacherLayout>
  );
}
