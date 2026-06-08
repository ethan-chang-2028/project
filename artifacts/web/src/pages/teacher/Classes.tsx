import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListClassesQueryKey,
  useCreateClass,
  useListClasses,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeacherLayout } from "@/components/teacher/TeacherLayout";
import { getErrorMessage } from "@/lib/errors";

export default function TeacherClasses() {
  const queryClient = useQueryClient();
  const { data: classes, isLoading } = useListClasses();
  const createClass = useCreateClass();
  const [name, setName] = useState("");

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    try {
      await createClass.mutateAsync({ data: { name: value } });
      setName("");
      queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
    } catch {
      // Surfaced below.
    }
  }

  return (
    <TeacherLayout
      title="My classes"
      description="Create a class, then share its join code with students."
    >
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">New class</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onCreate}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            data-testid="form-create-class"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="class-name">Class name</Label>
              <Input
                id="class-name"
                placeholder="e.g. Period 1 — Algebra"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-class-name"
              />
            </div>
            <Button
              type="submit"
              disabled={createClass.isPending || !name.trim()}
              data-testid="button-create-class"
            >
              {createClass.isPending ? "Creating…" : "Create class"}
            </Button>
          </form>
          {createClass.isError && (
            <p className="mt-2 text-sm text-destructive">
              {getErrorMessage(createClass.error)}
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !classes || classes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No classes yet. Create your first one above.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {classes.map((c) => (
            <Link key={c.id} href={`/teacher/classes/${c.id}`}>
              <Card className="cursor-pointer transition-colors hover:border-primary" data-testid={`card-class-${c.id}`}>
                <CardContent className="pt-6">
                  <div className="font-medium text-foreground">{c.name}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Join code:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {c.joinCode}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </TeacherLayout>
  );
}
