import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAssignmentsQueryKey,
  useCreateAssignment,
  useGetClass,
  useListAssignments,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TeacherLayout } from "@/components/teacher/TeacherLayout";
import { getErrorMessage } from "@/lib/errors";

export default function ClassDetail({ classId }: { classId: string }) {
  const queryClient = useQueryClient();
  const { data: cls } = useGetClass(classId);
  const { data: assignments, isLoading } = useListAssignments(classId);
  const createAssignment = useCreateAssignment();

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueAt, setDueAt] = useState("");

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await createAssignment.mutateAsync({
        classId,
        data: {
          title: title.trim(),
          instructions: instructions.trim() || undefined,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        },
      });
      setTitle("");
      setInstructions("");
      setDueAt("");
      queryClient.invalidateQueries({
        queryKey: getListAssignmentsQueryKey(classId),
      });
    } catch {
      // Surfaced below.
    }
  }

  return (
    <TeacherLayout
      title={cls?.name ?? "Class"}
      description={cls ? `Share join code ${cls.joinCode} with students.` : undefined}
      backHref="/teacher/classes"
      backLabel="My classes"
    >
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">New assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-4" data-testid="form-create-assignment">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Balancing equations"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-assignment-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="What should students do? Show your work, etc."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">Due (optional)</Label>
              <Input
                id="due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="sm:w-64"
              />
            </div>
            <Button
              type="submit"
              disabled={createAssignment.isPending || !title.trim()}
              data-testid="button-create-assignment"
            >
              {createAssignment.isPending ? "Creating…" : "Create assignment"}
            </Button>
            {createAssignment.isError && (
              <p className="text-sm text-destructive">
                {getErrorMessage(createAssignment.error)}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Assignments</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !assignments || assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assignments yet.</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Link key={a.id} href={`/teacher/assignments/${a.id}`}>
              <Card className="cursor-pointer transition-colors hover:border-primary">
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <div className="font-medium text-foreground">{a.title}</div>
                    {a.dueAt && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Due {new Date(a.dueAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">Open →</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </TeacherLayout>
  );
}
