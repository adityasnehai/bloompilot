import { requireApiSession } from "@/lib/api-session";
import { readWorkspaceIdentityByEmail } from "@/lib/workspace-store";
import { runCarePlanAgents } from "@/lib/agent-graph";

export const dynamic = "force-dynamic";

const STEP_LABELS: Record<string, { title: string; detail: string }> = {
  context:     { title: "Your garden",       detail: "Reading your profile, location, and plants." },
  environment: { title: "Local conditions",  detail: "Checking today’s weather and garden conditions." },
  knowledge:   { title: "Plant care",        detail: "Matching each plant with its care needs." },
  planner:     { title: "Today’s care plan", detail: "Choosing the most useful actions for today." },
  evidence:    { title: "Final check",       detail: "Checking that recommendations are grounded and safe." },
};

const STEP_ORDER = ["context", "environment", "knowledge", "planner", "evidence"];

export async function GET() {
  const { session, response } = await requireApiSession();
  if (!session || response) return response ?? new Response("Unauthorized", { status: 401 });

  const identity = readWorkspaceIdentityByEmail(session.email);
  if (!identity) {
    return new Response("Workspace not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      }

      send("steps", {
        steps: STEP_ORDER.map((id) => ({ id, ...STEP_LABELS[id], status: "pending" })),
      });

      // Signal first step running immediately
      send("step_update", { id: "context", status: "running" });

      try {
        let lastCompleted = "";

        const result = await runCarePlanAgents(
          { userId: identity.id, userEmail: session.email },
          (completedStep: string) => {
            send("step_update", { id: completedStep, status: "done" });
            lastCompleted = completedStep;

            const nextIndex = STEP_ORDER.indexOf(completedStep) + 1;
            if (nextIndex < STEP_ORDER.length) {
              send("step_update", { id: STEP_ORDER[nextIndex], status: "running" });
            }
          },
        );

        // Mark any steps that may have been skipped (e.g. environment when no coords)
        for (const step of STEP_ORDER) {
          if (step !== lastCompleted) {
            send("step_update", { id: step, status: "done" });
          }
        }

        send("done", {
          actionCount: result?.today_actions?.length ?? 0,
          agentCount: result?.agent_traces?.length ?? 0,
        });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Agent run failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
