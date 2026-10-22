import { randomUUID } from "node:crypto";
import type { VisitorEvent, VisitorKind } from "./types.js";

export class EventStore {
  private events: VisitorEvent[] = [];

  add(input: { kind: VisitorKind; visitorHint?: string }): VisitorEvent {
    const event: VisitorEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      source: "simulator",
      kind: input.kind,
      visitorHint: input.visitorHint,
      status: "new"
    };

    this.events.unshift(event);
    return event;
  }

  list(limit = 20): VisitorEvent[] {
    return this.events.slice(0, Math.max(0, limit)).map(event => ({
      ...event,
      transcript: event.transcript ? { ...event.transcript } : undefined,
      inferred: event.inferred ? { ...event.inferred } : undefined
    }));
  }

  get(id: string): VisitorEvent | undefined {
    const event = this.events.find(item => item.id === id);
    return event ? { ...event } : undefined;
  }

  update(id: string, update: Partial<VisitorEvent>): VisitorEvent {
    const index = this.events.findIndex(item => item.id === id);
    if (index < 0) throw new Error("Visitor event not found");

    this.events[index] = { ...this.events[index], ...update, id };
    return { ...this.events[index] };
  }

  deleteAll(): void {
    this.events = [];
  }
}
