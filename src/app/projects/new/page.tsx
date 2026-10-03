import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { NewProjectForm } from "./new-project-form";

export const metadata: Metadata = { title: "New project · SignSeal" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">New project</h1>
      <p className="mt-1 text-sm text-muted">
        Define the milestones your client will review. Each approval or change request is sealed into the audit trail.
      </p>
      <Card className="mt-6">
        <NewProjectForm />
      </Card>
    </div>
  );
}
