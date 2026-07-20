import { removePlantAction } from "@/app/garden-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type Plant } from "@/lib/garden";

type PlantCardProps = {
  plant: Plant;
  stats: {
    openCount: number;
    overdueCount: number;
    score: number;
  };
  returnTo?: string;
};

export function PlantCard({ plant, stats, returnTo = "/garden" }: PlantCardProps) {
  return (
    <Card as="article" className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-[var(--color-ink)]">
            {plant.nickname}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {plant.species} · {plant.placement}
          </p>
        </div>
        <span className="text-sm text-[var(--color-muted)]">
          Score {stats.score}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-[var(--color-muted)] sm:grid-cols-3">
        <div>
          <p className="font-medium text-[var(--color-ink)]">{plant.sunlight}</p>
          <p>Sunlight</p>
        </div>
        <div>
          <p className="font-medium text-[var(--color-ink)]">
            Every {plant.wateringIntervalDays} days
          </p>
          <p>Watering</p>
        </div>
        <div>
          <p className="font-medium text-[var(--color-ink)]">
            {stats.openCount} open · {stats.overdueCount} overdue
          </p>
          <p>Care queue</p>
        </div>
      </div>

      {plant.notes ? (
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
          {plant.notes}
        </p>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted)]">
          Last watered {plant.lastWateredAt ? "logged" : "not yet tracked"}
        </p>
        <form action={removePlantAction}>
          <input type="hidden" name="plantId" value={plant.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            className="h-10 rounded-full"
          >
            Remove
          </Button>
        </form>
      </div>
    </Card>
  );
}
