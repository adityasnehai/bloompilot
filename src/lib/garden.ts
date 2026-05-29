import { getDatabase, withTransaction } from "@/lib/database";
import { readSession } from "@/lib/session";
import { upsertWorkspaceProfile } from "@/lib/workspace-store";

export type PlantPlacement =
  | "Indoor collection"
  | "Balcony garden"
  | "Backyard garden"
  | "Terrace or rooftop garden"
  | "Patio or container garden"
  | "Indoor"
  | "Balcony"
  | "Patio"
  | "Backyard"
  | "Terrace"
  | "Container Garden";
export type SunlightLevel = "Low light" | "Bright indirect" | "Partial sun" | "Full sun";
export type TaskKind = "water" | "inspect" | "feed";
export type TaskStatus = "open" | "done";
export type ActivityType =
  | "plant_added"
  | "plant_updated"
  | "plant_removed"
  | "task_completed"
  | "task_reopened"
  | "diagnosis_logged";

export type Plant = {
  id: string;
  nickname: string;
  species: string;
  placement: PlantPlacement;
  sunlight: SunlightLevel;
  wateringIntervalDays: number;
  notes: string;
  addedAt: string;
  lastWateredAt?: string;
};

export type CareTask = {
  id: string;
  plantId: string;
  title: string;
  kind: TaskKind;
  status: TaskStatus;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
};

export type ActivityEntry = {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  createdAt: string;
  plantId?: string;
};

export type GardenState = {
  plants: Plant[];
  tasks: CareTask[];
  activities: ActivityEntry[];
  lastUpdated: string;
};

export type PlantInput = {
  nickname: string;
  species: string;
  placement: PlantPlacement;
  sunlight: SunlightLevel;
  wateringIntervalDays: number;
  notes: string;
};

const MAX_ACTIVITY_ENTRIES = 20;
const MAX_COMPLETED_TASKS = 20;

export const placementOptions: PlantPlacement[] = [
  "Indoor",
  "Balcony",
  "Backyard",
  "Terrace",
  "Container Garden",
  // legacy values kept for backward compat with existing DB rows
  "Indoor collection",
  "Balcony garden",
  "Backyard garden",
  "Terrace or rooftop garden",
  "Patio or container garden",
];

export function normalizePlacement(value?: string | null): PlantPlacement {
  if (!value) return "Indoor";
  const v = value.toLowerCase().trim();
  if (v === "indoor" || v === "indoor collection") return "Indoor";
  if (v === "balcony" || v === "balcony garden") return "Balcony";
  if (v === "backyard" || v === "backyard garden") return "Backyard";
  if (v === "terrace" || v === "terrace or rooftop garden" || v === "rooftop") return "Terrace";
  if (v === "container garden" || v === "patio or container garden" || v === "patio") return "Container Garden";
  return "Indoor";
}

export function getPlacementDefaultFromGardenType(gardenType?: string | null): PlantPlacement {
  return normalizePlacement(gardenType ?? "Indoor");
}

export const sunlightOptions: SunlightLevel[] = [
  "Low light",
  "Bright indirect",
  "Partial sun",
  "Full sun",
];

export function createEmptyGardenState(): GardenState {
  return {
    plants: [],
    tasks: [],
    activities: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function parseGardenValue(value?: string | null) {
  if (!value) {
    return createEmptyGardenState();
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<GardenState>;

    return sanitizeGardenState(parsed);
  } catch {
    return createEmptyGardenState();
  }
}

type PlantRow = {
  id: string;
  nickname: string;
  species: string;
  placement: PlantPlacement;
  sunlight: SunlightLevel;
  watering_interval_days: number;
  notes: string;
  added_at: string;
  last_watered_at: string | null;
};

type TaskRow = {
  id: string;
  plant_id: string;
  title: string;
  kind: TaskKind;
  status: TaskStatus;
  due_date: string;
  created_at: string;
  completed_at: string | null;
};

type ActivityRow = {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  created_at: string;
  plant_id: string | null;
};

function sanitizeGardenState(state?: Partial<GardenState>): GardenState {
  return trimGardenState({
    plants: Array.isArray(state?.plants) ? state.plants.filter(Boolean) as Plant[] : [],
    tasks: Array.isArray(state?.tasks) ? state.tasks.filter(Boolean) as CareTask[] : [],
    activities: Array.isArray(state?.activities)
      ? state.activities.filter(Boolean) as ActivityEntry[]
      : [],
    lastUpdated: state?.lastUpdated ?? new Date().toISOString(),
  });
}

function trimGardenState(state: GardenState) {
  const completedTasks = state.tasks
    .filter((task) => task.status === "done")
    .sort((left, right) => {
      return (
        new Date(right.completedAt ?? right.createdAt).getTime() -
        new Date(left.completedAt ?? left.createdAt).getTime()
      );
    })
    .slice(0, MAX_COMPLETED_TASKS);

  const openTasks = state.tasks.filter((task) => task.status === "open");

  return {
    ...state,
    tasks: [...openTasks, ...completedTasks],
    activities: state.activities.slice(0, MAX_ACTIVITY_ENTRIES),
  };
}

export async function getCurrentWorkspaceUserId() {
  const session = await readSession();

  if (!session) {
    return null;
  }

  return upsertWorkspaceProfile(session);
}

export async function readGardenState() {
  const userId = await getCurrentWorkspaceUserId();

  if (!userId) {
    return createEmptyGardenState();
  }

  const database = getDatabase();
  const plants = database
    .prepare(
      `
        SELECT id, nickname, species, placement, sunlight,
               watering_interval_days, notes, added_at, last_watered_at
        FROM plants
        WHERE user_id = ?
        ORDER BY datetime(added_at) DESC
      `,
    )
    .all(userId) as PlantRow[];
  const tasks = database
    .prepare(
      `
        SELECT id, plant_id, title, kind, status, due_date, created_at, completed_at
        FROM care_tasks
        WHERE user_id = ?
        ORDER BY datetime(due_date) ASC, datetime(created_at) DESC
      `,
    )
    .all(userId) as TaskRow[];
  const activities = database
    .prepare(
      `
        SELECT id, type, title, detail, created_at, plant_id
        FROM activities
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
      `,
    )
    .all(userId) as ActivityRow[];

  return sanitizeGardenState({
    plants: plants.map((plant) => ({
      id: plant.id,
      nickname: plant.nickname,
      species: plant.species,
      placement: plant.placement,
      sunlight: plant.sunlight,
      wateringIntervalDays: plant.watering_interval_days,
      notes: plant.notes,
      addedAt: plant.added_at,
      lastWateredAt: plant.last_watered_at ?? undefined,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      plantId: task.plant_id,
      title: task.title,
      kind: task.kind,
      status: task.status,
      dueDate: task.due_date,
      createdAt: task.created_at,
      completedAt: task.completed_at ?? undefined,
    })),
    activities: activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      detail: activity.detail,
      createdAt: activity.created_at,
      plantId: activity.plant_id ?? undefined,
    })),
    lastUpdated:
      activities[0]?.created_at ??
      tasks[0]?.created_at ??
      plants[0]?.added_at ??
      new Date().toISOString(),
  });
}

export async function writeGardenState(state: GardenState) {
  const userId = await getCurrentWorkspaceUserId();

  if (!userId) {
    return;
  }

  const trimmedState = trimGardenState(state);

  withTransaction((database) => {
    // Preserve existing photos before delete-reinsert
    type PhotoRow = { id: string; photo_blob: Uint8Array | null; photo_type: string | null };
    const existingPhotos = database
      .prepare(`SELECT id, photo_blob, photo_type FROM plants WHERE user_id = ?`)
      .all(userId) as PhotoRow[];
    const photoMap = new Map<string, { blob: Uint8Array | null; type: string | null }>();
    for (const row of existingPhotos) {
      if (row.photo_blob) photoMap.set(row.id, { blob: row.photo_blob, type: row.photo_type });
    }

    database.prepare(`DELETE FROM plants WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM care_tasks WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM activities WHERE user_id = ?`).run(userId);

    const insertPlant = database.prepare(`
      INSERT INTO plants (
        id, user_id, nickname, species, placement, sunlight,
        watering_interval_days, notes, added_at, last_watered_at, photo_blob, photo_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTask = database.prepare(`
      INSERT INTO care_tasks (
        id, user_id, plant_id, title, kind, status,
        due_date, created_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertActivity = database.prepare(`
      INSERT INTO activities (
        id, user_id, type, title, detail, created_at, plant_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const plant of trimmedState.plants) {
      const photo = photoMap.get(plant.id);
      insertPlant.run(
        plant.id,
        userId,
        plant.nickname,
        plant.species,
        plant.placement,
        plant.sunlight,
        plant.wateringIntervalDays,
        plant.notes,
        plant.addedAt,
        plant.lastWateredAt ?? null,
        photo?.blob ?? null,
        photo?.type ?? null,
      );
    }

    for (const task of trimmedState.tasks) {
      insertTask.run(
        task.id,
        userId,
        task.plantId,
        task.title,
        task.kind,
        task.status,
        task.dueDate,
        task.createdAt,
        task.completedAt ?? null,
      );
    }

    for (const activity of trimmedState.activities) {
      insertActivity.run(
        activity.id,
        userId,
        activity.type,
        activity.title,
        activity.detail,
        activity.createdAt,
        activity.plantId ?? null,
      );
    }
  });
}

export async function clearGardenState() {
  const userId = await getCurrentWorkspaceUserId();

  if (!userId) {
    return;
  }

  withTransaction((database) => {
    database.prepare(`DELETE FROM plants WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM care_tasks WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM activities WHERE user_id = ?`).run(userId);
  });
}

export function createPlant(input: PlantInput): Plant {
  return {
    id: crypto.randomUUID(),
    nickname: input.nickname.trim(),
    species: input.species.trim(),
    placement: input.placement,
    sunlight: input.sunlight,
    wateringIntervalDays: input.wateringIntervalDays,
    notes: input.notes.trim(),
    addedAt: new Date().toISOString(),
  };
}

function createTask(
  plantId: string,
  kind: TaskKind,
  title: string,
  dueDate: Date,
): CareTask {
  return {
    id: crypto.randomUUID(),
    plantId,
    title,
    kind,
    status: "open",
    dueDate: dueDate.toISOString(),
    createdAt: new Date().toISOString(),
  };
}

export function createInitialTasksForPlant(plant: Plant): CareTask[] {
  const wateringDue = addDays(Math.max(1, Math.ceil(plant.wateringIntervalDays / 2)));
  const inspectDue = addDays(2);
  const feedDue = addDays(14);

  return [
    createTask(plant.id, "water", `Water ${plant.nickname}`, wateringDue),
    createTask(plant.id, "inspect", `Inspect ${plant.nickname}`, inspectDue),
    createTask(plant.id, "feed", `Feed ${plant.nickname}`, feedDue),
  ];
}

export function addPlantToGarden(state: GardenState, input: PlantInput) {
  const plant = createPlant(input);
  const tasks = createInitialTasksForPlant(plant);

  return trimGardenState({
    plants: [plant, ...state.plants],
    tasks: [...tasks, ...state.tasks],
    activities: [
      createActivity(
        "plant_added",
        `Added ${plant.nickname}`,
        `${plant.species} is now part of your garden.`,
        plant.id,
      ),
      ...state.activities,
    ],
    lastUpdated: new Date().toISOString(),
  });
}

export function updatePlantInGarden(
  state: GardenState,
  plantId: string,
  input: PlantInput,
) {
  const existing = state.plants.find((entry) => entry.id === plantId);

  if (!existing) {
    return {
      state,
      plant: null,
    };
  }

  const updatedPlant: Plant = {
    ...existing,
    nickname: input.nickname.trim(),
    species: input.species.trim(),
    placement: input.placement,
    sunlight: input.sunlight,
    wateringIntervalDays: input.wateringIntervalDays,
    notes: input.notes.trim(),
  };

  return {
    state: trimGardenState({
      ...state,
      plants: state.plants.map((entry) =>
        entry.id === plantId ? updatedPlant : entry,
      ),
      tasks: state.tasks.filter((task) => task.plantId !== plantId).concat(
        createInitialTasksForPlant(updatedPlant),
      ),
      activities: [
        createActivity(
          "plant_updated",
          `Updated ${updatedPlant.nickname}`,
          `${updatedPlant.species} setup was refreshed.`,
          updatedPlant.id,
        ),
        ...state.activities,
      ],
      lastUpdated: new Date().toISOString(),
    }),
    plant: updatedPlant,
  };
}

export function removePlantFromGarden(state: GardenState, plantId: string) {
  const plant = state.plants.find((entry) => entry.id === plantId);

  if (!plant) {
    return state;
  }

  return trimGardenState({
    plants: state.plants.filter((entry) => entry.id !== plantId),
    tasks: state.tasks.filter((task) => task.plantId !== plantId),
    activities: [
      createActivity(
        "plant_removed",
        `Removed ${plant.nickname}`,
        `${plant.species} was removed from the active garden.`,
        plant.id,
      ),
      ...state.activities,
    ],
    lastUpdated: new Date().toISOString(),
  });
}

export function toggleTaskStatus(state: GardenState, taskId: string) {
  const task = state.tasks.find((entry) => entry.id === taskId);

  if (!task) {
    return state;
  }

  const plant = state.plants.find((entry) => entry.id === task.plantId);
  const completing = task.status === "open";
  const now = new Date().toISOString();

  const tasksWithoutFollowUp =
    completing || !task.completedAt
      ? state.tasks
      : removeFollowUpTask(state.tasks, task);

  const tasks = tasksWithoutFollowUp.map((entry) => {
    if (entry.id !== taskId) {
      return entry;
    }

    if (completing) {
      return {
        ...entry,
        status: "done" as const,
        completedAt: now,
      };
    }

    return {
      ...entry,
      status: "open" as const,
      completedAt: undefined,
    };
  });

  const nextTasks =
    completing && plant
      ? buildFollowUpTasks(task, plant)
      : [];

  const plants = state.plants.map((entry) => {
    if (
      entry.id === task.plantId &&
      completing &&
      task.kind === "water"
    ) {
      return {
        ...entry,
        lastWateredAt: now,
      };
    }

    return entry;
  });

  return trimGardenState({
    plants,
    tasks: [...nextTasks, ...tasks],
    activities: [
      createActivity(
        completing ? "task_completed" : "task_reopened",
        `${completing ? "Completed" : "Reopened"} ${task.title}`,
        plant
          ? `${plant.nickname} is ${completing ? "moving forward" : "back in queue"} in today's care flow.`
          : "Garden workflow updated.",
        task.plantId,
      ),
      ...state.activities,
    ],
    lastUpdated: now,
  });
}

function removeFollowUpTask(tasks: CareTask[], sourceTask: CareTask) {
  const followUp = tasks
    .filter(
      (task) =>
        task.id !== sourceTask.id &&
        task.plantId === sourceTask.plantId &&
        task.kind === sourceTask.kind &&
        task.status === "open" &&
        new Date(task.dueDate).getTime() > new Date(sourceTask.dueDate).getTime(),
    )
    .sort((left, right) => {
      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    })[0];

  if (!followUp) {
    return tasks;
  }

  return tasks.filter((task) => task.id !== followUp.id);
}

function buildFollowUpTasks(task: CareTask, plant: Plant) {
  if (task.kind === "water") {
    return [
      createTask(
        plant.id,
        "water",
        `Water ${plant.nickname}`,
        addDays(plant.wateringIntervalDays),
      ),
    ];
  }

  if (task.kind === "inspect") {
    return [
      createTask(
        plant.id,
        "inspect",
        `Inspect ${plant.nickname}`,
        addDays(7),
      ),
    ];
  }

  if (task.kind === "feed") {
    return [
      createTask(
        plant.id,
        "feed",
        `Feed ${plant.nickname}`,
        addDays(21),
      ),
    ];
  }

  return [];
}

function createActivity(
  type: ActivityType,
  title: string,
  detail: string,
  plantId?: string,
): ActivityEntry {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    detail,
    createdAt: new Date().toISOString(),
    plantId,
  };
}

export function getGardenMetrics(state: GardenState) {
  const overdue = getOverdueTasks(state.tasks).length;
  const dueToday = getDueTodayTasks(state.tasks).length;
  const openTasks = state.tasks.filter((task) => task.status === "open").length;
  const completedThisWeek = state.tasks.filter((task) => {
    return (
      task.status === "done" &&
      Boolean(task.completedAt) &&
      new Date(task.completedAt!).getTime() >= addDays(-7).getTime()
    );
  }).length;

  return {
    plantCount: state.plants.length,
    openTasks,
    overdue,
    dueToday,
    completedThisWeek,
  };
}

export function getDueTodayTasks(tasks: CareTask[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return tasks
    .filter(
      (task) =>
        task.status === "open" &&
        new Date(task.dueDate).getTime() >= startOfToday.getTime() &&
        new Date(task.dueDate).getTime() <= endOfToday.getTime(),
    )
    .sort((left, right) => {
      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    });
}

export function getOverdueTasks(tasks: CareTask[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return tasks
    .filter(
      (task) =>
        task.status === "open" &&
        new Date(task.dueDate).getTime() < startOfToday.getTime(),
    )
    .sort((left, right) => {
      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    });
}

export function getUpcomingTasks(tasks: CareTask[]) {
  const startOfTomorrow = new Date();
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  startOfTomorrow.setHours(0, 0, 0, 0);

  return tasks
    .filter(
      (task) =>
        task.status === "open" &&
        new Date(task.dueDate).getTime() >= startOfTomorrow.getTime(),
    )
    .sort((left, right) => {
      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    });
}

export function getRecentCompletedTasks(tasks: CareTask[]) {
  return tasks
    .filter((task) => task.status === "done")
    .sort((left, right) => {
      return (
        new Date(right.completedAt ?? right.createdAt).getTime() -
        new Date(left.completedAt ?? left.createdAt).getTime()
      );
    })
    .slice(0, 6);
}

export function getPlantTaskStats(plant: Plant, tasks: CareTask[]) {
  const plantTasks = tasks.filter((task) => task.plantId === plant.id);
  const openTasks = plantTasks.filter((task) => task.status === "open");
  const overdue = getOverdueTasks(plantTasks).length;
  const score = Math.max(58, 96 - overdue * 10 - openTasks.length * 3);

  return {
    openCount: openTasks.length,
    overdueCount: overdue,
    score,
  };
}

export function getTaskPlantMap(plants: Plant[]) {
  return new Map(plants.map((plant) => [plant.id, plant]));
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function describeTaskTiming(value: string) {
  const due = new Date(value);
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const dueStart = new Date(due);
  dueStart.setHours(0, 0, 0, 0);
  const difference = Math.round(
    (dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (difference < 0) {
    return `${Math.abs(difference)} day${Math.abs(difference) === 1 ? "" : "s"} overdue`;
  }

  if (difference === 0) {
    return "Due today";
  }

  if (difference === 1) {
    return "Due tomorrow";
  }

  return `Due in ${difference} days`;
}

export function buildAgentBrief(state: GardenState) {
  const metrics = getGardenMetrics(state);
  const topTasks = [...getOverdueTasks(state.tasks), ...getDueTodayTasks(state.tasks)].slice(
    0,
    3,
  );
  const focusPlants = state.plants
    .map((plant) => ({
      plant,
      stats: getPlantTaskStats(plant, state.tasks),
    }))
    .sort((left, right) => right.stats.overdueCount - left.stats.overdueCount)
    .slice(0, 3);

  return {
    headline:
      metrics.plantCount === 0
        ? "No plants are loaded yet."
        : metrics.overdue > 0
          ? `${metrics.overdue} care tasks need immediate attention.`
          : `${metrics.dueToday} tasks are lined up for today.`,
    overview:
      metrics.plantCount === 0
        ? "Start with a few plants so BloomPilot can generate a usable care rhythm."
        : `BloomPilot is tracking ${metrics.plantCount} plants with ${metrics.openTasks} open tasks across watering, inspections, and feeding.`,
    priorities: topTasks,
    focusPlants,
  };
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date;
}
