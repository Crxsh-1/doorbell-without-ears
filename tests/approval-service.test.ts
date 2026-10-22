
import { describe, expect, it } from "vitest";
import { ActionHistory } from "../src/services/action-history.js";
import { ApprovalService } from "../src/services/approval-service.js";
import { EventStore } from "../src/services/event-store.js";
import { PreferenceStore } from "../src/services/preference-store.js";

function setup() {
  const events = new EventStore();
  const preferences = new PreferenceStore();
  const history = new ActionHistory();
  const approval = new ApprovalService(events, preferences, history);
  const event = events.add({
    kind: "doorbell",
    visitorHint: "Simulated delivery visitor"
  });

  events.update(event.id, {
    inferred: {
      category: "delivery",
      confidence: 0.8,
      reason: "Scripted simulator scenario"
    }
  });

  return { events, history, approval, event };
}

describe("ApprovalService", () => {
  it("does not deliver a reply when confirmation is false", async () => {
    const { approval, history, event } = setup();
    const reply = await approval.propose(event.id);

    expect(reply.requiresConfirmation).toBe(true);

    const result = approval.confirm(reply.id, false);

    expect(result.delivered).toBe(false);
    expect(history.list()).toHaveLength(0);
  });

  it("delivers only after explicit confirmation and records the action", async () => {
    const { approval, history, event } = setup();
    const reply = await approval.propose(event.id);

    const result = approval.confirm(reply.id, true);

    expect(result.delivered).toBe(true);
    expect(history.list()).toHaveLength(1);
    expect(history.list()[0].userConfirmed).toBe(true);
  });

  it("does not allow the same reply to be confirmed twice", async () => {
    const { approval, event } = setup();
    const reply = await approval.propose(event.id);

    approval.confirm(reply.id, true);

    expect(() => approval.confirm(reply.id, true)).toThrow(
      /already been confirmed/
    );
  });

  it("does not propose a reply for a dismissed event", async () => {
    const { approval, event } = setup();

    approval.dismiss(event.id);

    await expect(approval.propose(event.id)).rejects.toThrow(
      /dismissed event/
    );
  });
});
