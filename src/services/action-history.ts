import { randomUUID } from "node:crypto";
import type { ActionRecord } from "./types.js";

export class ActionHistory {
  private records: ActionRecord[] = [];

  add(record: Omit<ActionRecord, "id" | "timestamp">): ActionRecord {
    const saved: ActionRecord = {
      ...record,
      id: randomUUID(),
      timestamp: new Date().toISOString()
    };
    this.records.unshift(saved);
    return { ...saved };
  }

  list(): ActionRecord[] {
    return this.records.map(record => ({ ...record }));
  }

  clear(): void {
    this.records = [];
  }
}
