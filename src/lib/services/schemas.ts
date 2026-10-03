import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

export const createProjectSchema = z
  .object({
    title: text(120),
    clientName: text(120),
    milestones: z
      .array(
        z
          .object({
            title: text(120),
            description: z.string().max(1000).optional(),
            dueDate: z.iso.date().optional(),
          })
          .strict(),
      )
      .min(3)
      .max(20),
  })
  .strict();

export const decisionSchema = z
  .object({
    milestoneId: z.uuid(),
    decision: z.enum(["approved", "changes_requested"]),
    actor: text(80).refine((a) => !a.includes("|"), { message: 'Name must not contain "|"' }),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.decision === "changes_requested" && !v.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "A note is required when requesting changes" });
    }
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
