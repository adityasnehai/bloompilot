import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/garden/empty-state";
import { TasksView } from "@/components/tasks/tasks-view";
import { Button } from "@/components/ui/button";
import {
  getDueTodayTasks,
  getOverdueTasks,
  getRecentCompletedTasks,
  getTaskPlantMap,
  getUpcomingTasks,
  readGardenState,
} from "@/lib/garden";
import { requireSession } from "@/lib/session";

export default async function TasksPage() {
  const session = await requireSession();

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const gardenState = await readGardenState();
  const plantMap = getTaskPlantMap(gardenState.plants);
  const overdueTasks = getOverdueTasks(gardenState.tasks);
  const dueTodayTasks = getDueTodayTasks(gardenState.tasks);
  const upcomingTasks = getUpcomingTasks(gardenState.tasks);
  const completedTasks = getRecentCompletedTasks(gardenState.tasks);

  if (gardenState.plants.length === 0) {
    return (
      <div className="surface-panel px-5 py-8 sm:px-6">
        <EmptyState
          title="No care queue yet because no plants are loaded."
          body="Add your plants first. BloomPilot creates recurring watering, inspection, and feed tasks automatically."
          action={
            <Button asChild>
              <Link href="/garden">Add plants</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <TasksView
      overdueTasks={overdueTasks}
      dueTodayTasks={dueTodayTasks}
      upcomingTasks={upcomingTasks}
      completedTasks={completedTasks}
      plantMap={[...plantMap.entries()]}
    />
  );
}
