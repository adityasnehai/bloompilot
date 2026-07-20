import { getDatabase } from "@/lib/database";

export type FeedbackValue = "positive" | "negative";

export type ActionFeedback = {
  id: string;
  userId: number;
  plantId: string | null;
  plantName: string;
  actionType: string;
  actionTitle: string;
  feedback: FeedbackValue;
  createdAt: string;
};

type FeedbackRow = {
  id: string;
  user_id: number;
  plant_id: string | null;
  plant_name: string;
  action_type: string;
  action_title: string;
  feedback: string;
  created_at: string;
};

export type PlantFeedbackSummary = {
  plantId: string | null;
  positiveCount: number;
  negativeCount: number;
  negativeActionTypes: string[];
  positiveActionTypes: string[];
};

export async function logActionFeedback(
  userId: number,
  plantId: string | null,
  plantName: string,
  actionType: string,
  actionTitle: string,
  feedback: FeedbackValue,
) {
  const db = await getDatabase();
  await db.prepare(
    `INSERT INTO action_feedback (id, user_id, plant_id, plant_name, action_type, action_title, feedback, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    userId,
    plantId,
    plantName,
    actionType,
    actionTitle,
    feedback,
    new Date().toISOString(),
  );
}

export async function getPlantFeedbackSummary(
  userId: number,
  plantId: string,
): Promise<PlantFeedbackSummary> {
  const db = await getDatabase();
  const rows = await db
    .prepare(
      `SELECT * FROM action_feedback WHERE user_id = ? AND plant_id = ?
       ORDER BY datetime(created_at) DESC LIMIT 30`,
    )
    .all(userId, plantId) as FeedbackRow[];

  const positive = rows.filter((r) => r.feedback === "positive");
  const negative = rows.filter((r) => r.feedback === "negative");

  return {
    plantId,
    positiveCount: positive.length,
    negativeCount: negative.length,
    negativeActionTypes: [...new Set(negative.map((r) => r.action_type))],
    positiveActionTypes: [...new Set(positive.map((r) => r.action_type))],
  };
}

export async function getAllFeedbackSummaries(userId: number): Promise<PlantFeedbackSummary[]> {
  const db = await getDatabase();
  const plantIds = await db
    .prepare(`SELECT DISTINCT plant_id FROM action_feedback WHERE user_id = ? AND plant_id IS NOT NULL`)
    .all(userId) as { plant_id: string }[];

  return Promise.all(plantIds.map(({ plant_id }) => getPlantFeedbackSummary(userId, plant_id)));
}
