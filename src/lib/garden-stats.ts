import { getDatabase } from "@/lib/database";

export type PlantHealthRow = {
  plantId: string;
  plantName: string;
  species: string;
  waterCount: number;
  skipCount: number;
  diagnosisCount: number;
  lastEventAt: string | null;
};

export type DiagnosisTrendPoint = {
  month: string;
  count: number;
};

export type TaskCompletionByKind = {
  kind: string;
  total: number;
  done: number;
  rate: number;
};

export type GardenStats = {
  totalPlants: number;
  totalWaterings: number;
  totalDiagnoses: number;
  totalSkips: number;
  careStreak: number;
  greenThumbScore: number;
  mostCaredPlant: { name: string; count: number } | null;
  recentActivityDays: { date: string; count: number }[];
  taskCompletionRate: number;
  joinedDaysAgo: number;
  perPlantHealth: PlantHealthRow[];
  diagnosisTrend: DiagnosisTrendPoint[];
  taskCompletionByKind: TaskCompletionByKind[];
};

type CountRow = { count: number };
type NameCountRow = { name: string; count: number };
type DateCountRow = { date: string; count: number };
type TaskRow = { total: number; done: number };
type JoinRow = { joined_at: string };

export async function getGardenStats(userId: number): Promise<GardenStats> {
  const db = await getDatabase();

  const plantCount = (await db.prepare(`SELECT COUNT(*) as count FROM plants WHERE user_id = ?`).get(userId) as CountRow).count;

  const waterCount = (await db.prepare(
    `SELECT COUNT(*) as count FROM plant_health_events WHERE user_id = ? AND event_type = 'watered'`,
  ).get(userId) as CountRow).count;

  const diagnosisCount = (await db.prepare(
    `SELECT COUNT(*) as count FROM diagnosis_runs WHERE user_id = ?`,
  ).get(userId) as CountRow).count;

  const skipCount = (await db.prepare(
    `SELECT COUNT(*) as count FROM plant_health_events WHERE user_id = ? AND event_type = 'water_skipped'`,
  ).get(userId) as CountRow).count;

  // Care streak: consecutive days with at least one health event ending today or yesterday
  const eventDays = await db.prepare(
    `SELECT DISTINCT date(created_at) as day FROM plant_health_events WHERE user_id = ? ORDER BY day DESC`,
  ).all(userId) as { day: string }[];

  let streak = 0;
  if (eventDays.length > 0) {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Allow the streak to begin from today OR yesterday (user might not have done anything yet today)
    let startIndex = -1;
    if (eventDays[0].day === todayStr) startIndex = 0;
    else if (eventDays[0].day === yesterdayStr) startIndex = 1;

    if (startIndex !== -1) {
      let dayIdx = 0;
      let dateOffset = startIndex;
      while (dayIdx < eventDays.length) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - dateOffset);
        const expectedStr = expected.toISOString().slice(0, 10);
        if (eventDays[dayIdx].day === expectedStr) {
          streak++;
          dayIdx++;
          dateOffset++;
        } else {
          break;
        }
      }
    }
  }

  // Most cared plant
  const mostCared = await db.prepare(
    `SELECT plant_name as name, COUNT(*) as count FROM plant_health_events WHERE user_id = ?
     GROUP BY plant_id ORDER BY count DESC LIMIT 1`,
  ).get(userId) as NameCountRow | undefined;

  // Last 14 days activity
  const activityDaysRaw = await db.prepare(
    `SELECT date(created_at) as date, COUNT(*) as count
     FROM plant_health_events WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-14 days')
     GROUP BY date ORDER BY date ASC`,
  ).all(userId) as DateCountRow[];
  const activityByDate = new Map(activityDaysRaw.map((row) => [row.date, row.count]));
  const activityDays: DateCountRow[] = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (13 - index));
    const dateKey = date.toISOString().slice(0, 10);
    return { date: dateKey, count: activityByDate.get(dateKey) ?? 0 };
  });

  // Task completion rate (last 30 days)
  const taskStats = await db.prepare(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
     FROM care_tasks WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-30 days')`,
  ).get(userId) as TaskRow | undefined;

  const completionRate = taskStats && taskStats.total > 0
    ? Math.round((taskStats.done / taskStats.total) * 100)
    : 0;

  // Days since joined
  const joinRow = await db.prepare(`SELECT joined_at FROM users WHERE id = ?`).get(userId) as JoinRow | undefined;
  const joinedDaysAgo = joinRow
    ? Math.max(0, Math.round((Date.now() - new Date(joinRow.joined_at).getTime()) / 86400000))
    : 0;

  // Green thumb score: weighted formula
  const score = Math.min(100, Math.round(
    (completionRate * 0.4) +
    (Math.min(streak * 5, 30)) +
    (Math.min(waterCount * 2, 20)) +
    (Math.min(diagnosisCount * 3, 10)),
  ));

  // Per-plant health breakdown
  type PlantHealthSummaryRow = {
    plant_id: string;
    plant_name: string;
    species: string;
    water_count: number;
    skip_count: number;
    last_event_at: string | null;
  };
  const plantRows = await db.prepare(
    `SELECT p.id as plant_id, p.nickname as plant_name, COALESCE(p.species, '') as species,
            COALESCE(SUM(CASE WHEN e.event_type = 'watered' THEN 1 ELSE 0 END), 0) as water_count,
            COALESCE(SUM(CASE WHEN e.event_type = 'water_skipped' THEN 1 ELSE 0 END), 0) as skip_count,
            MAX(e.created_at) as last_event_at
     FROM plants p
     LEFT JOIN plant_health_events e ON e.plant_id = p.id AND e.user_id = p.user_id
     WHERE p.user_id = ?
     GROUP BY p.id ORDER BY water_count DESC`,
  ).all(userId) as PlantHealthSummaryRow[];

  type DiagnosisByPlantRow = { plant_id: string; count: number };
  const diagByPlant = await db.prepare(
    `SELECT plant_id, COUNT(*) as count FROM diagnosis_runs WHERE user_id = ? GROUP BY plant_id`,
  ).all(userId) as DiagnosisByPlantRow[];
  const diagByPlantMap = new Map(diagByPlant.map((r) => [r.plant_id, r.count]));

  const perPlantHealth: PlantHealthRow[] = plantRows.map((r) => ({
    plantId: r.plant_id,
    plantName: r.plant_name,
    species: r.species,
    waterCount: r.water_count,
    skipCount: r.skip_count,
    diagnosisCount: diagByPlantMap.get(r.plant_id) ?? 0,
    lastEventAt: r.last_event_at,
  }));

  // Diagnosis trend (last 6 months)
  type MonthCountRow = { month: string; count: number };
  const diagnosisTrendRaw = await db.prepare(
    `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
     FROM diagnosis_runs WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-6 months')
     GROUP BY month ORDER BY month ASC`,
  ).all(userId) as MonthCountRow[];
  const diagnosesByMonth = new Map(diagnosisTrendRaw.map((row) => [row.month, row.count]));
  const diagnosisTrend: DiagnosisTrendPoint[] = Array.from({ length: 6 }, (_, index) => {
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCMonth(month.getUTCMonth() - (5 - index));
    const monthKey = month.toISOString().slice(0, 7);
    return { month: monthKey, count: diagnosesByMonth.get(monthKey) ?? 0 };
  });

  // Task completion by kind (last 30 days)
  type TaskKindRow = { kind: string; total: number; done: number };
  const taskKindRows = await db.prepare(
    `SELECT kind, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
     FROM care_tasks WHERE user_id = ? AND datetime(created_at) >= datetime('now', '-30 days')
     GROUP BY kind`,
  ).all(userId) as TaskKindRow[];
  const taskCompletionByKind: TaskCompletionByKind[] = taskKindRows.map((r) => ({
    kind: r.kind,
    total: r.total,
    done: r.done,
    rate: r.total > 0 ? Math.round((r.done / r.total) * 100) : 0,
  }));

  return {
    totalPlants: plantCount,
    totalWaterings: waterCount,
    totalDiagnoses: diagnosisCount,
    totalSkips: skipCount,
    careStreak: streak,
    greenThumbScore: score,
    mostCaredPlant: mostCared ? { name: mostCared.name, count: mostCared.count } : null,
    recentActivityDays: activityDays,
    taskCompletionRate: completionRate,
    joinedDaysAgo,
    perPlantHealth,
    diagnosisTrend,
    taskCompletionByKind,
  };
}
