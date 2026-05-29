import { getDatabase } from "@/lib/database";

export type PlantNote = {
  id: string;
  userId: number;
  plantId: string;
  plantName: string;
  body: string;
  createdAt: string;
};

type PlantNoteRow = {
  id: string;
  user_id: number;
  plant_id: string;
  plant_name: string;
  body: string;
  created_at: string;
};

export function addPlantNote(userId: number, plantId: string, plantName: string, body: string): PlantNote {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO plant_notes (id, user_id, plant_id, plant_name, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, plantId, plantName, body.trim(), createdAt);
  return { id, userId, plantId, plantName, body: body.trim(), createdAt };
}

export function getPlantNotes(userId: number, plantId: string, limit = 20): PlantNote[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM plant_notes WHERE user_id = ? AND plant_id = ?
       ORDER BY datetime(created_at) DESC LIMIT ?`,
    )
    .all(userId, plantId, limit) as PlantNoteRow[];
  return rows.map(rowToNote);
}

export function deletePlantNote(userId: number, noteId: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare(`DELETE FROM plant_notes WHERE id = ? AND user_id = ?`)
    .run(noteId, userId);
  return ((result as { changes: number }).changes) > 0;
}

function rowToNote(row: PlantNoteRow): PlantNote {
  return {
    id: row.id,
    userId: row.user_id,
    plantId: row.plant_id,
    plantName: row.plant_name,
    body: row.body,
    createdAt: row.created_at,
  };
}
