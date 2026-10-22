import { randomUUID } from "node:crypto";
import type { ActionHistory } from "./action-history.js";
import type { EventStore } from "./event-store.js";
import type { PreferenceStore } from "./preference-store.js";
import type { ProposedReply, VisitorCategory } from "./types.js";

export class ApprovalService {
  private replies = new Map<string, ProposedReply>();

  constructor(
    private events: EventStore,
    private preferences: PreferenceStore,
    private history: ActionHistory
  ) {}

  propose(eventId: string): ProposedReply {
    const event = this.events.get(eventId);
    if (!event) throw new Error("Visitor event not found");

    const prefs = this.preferences.get();
    const category = event.inferred?.category ?? "unknown";
    const text = category === "delivery"
      ? prefs.deliveryInstruction
      : prefs.unknownVisitorInstruction;

    const reply: ProposedReply = {
      id: randomUUID(),
      eventId,
      text,
      basis: [
        `Category used: ${category}`,
        category === "delivery" ? "Saved delivery preference" : "Saved unknown-visitor preference"
      ],
      requiresConfirmation: true,
      generatedBy: "template"
    };

    this.replies.set(reply.id, reply);
    this.events.update(eventId, { status: "proposed" });
    return { ...reply, basis: [...reply.basis] };
  }

  confirm(replyId: string, confirmed: boolean): { delivered: boolean; message: string } {
    const reply = this.replies.get(replyId);
    if (!reply) throw new Error("Proposed reply not found");

    if (confirmed !== true) {
      return { delivered: false, message: "Reply not delivered: user confirmation required." };
    }

    const event = this.events.get(reply.eventId);
    if (!event) throw new Error("Visitor event no longer exists");
    if (event.status === "dismissed") throw new Error("Cannot reply to a dismissed event");
    if (event.status === "confirmed") throw new Error("Reply has already been confirmed");

    this.events.update(reply.eventId, { status: "confirmed" });
    this.history.add({
      eventId: reply.eventId,
      replyId,
      action: "reply_sent",
      userConfirmed: true
    });

    return { delivered: true, message: "Simulated reply delivered after confirmation." };
  }

  correctCategory(eventId: string, category: VisitorCategory): void {
    const event = this.events.get(eventId);
    if (!event) throw new Error("Visitor event not found");

    this.events.update(eventId, {
      inferred: {
        category,
        confidence: 1,
        reason: "Corrected by user"
      }
    });

    this.history.add({
      eventId,
      replyId: "",
      action: "inference_corrected",
      userConfirmed: true
    });
  }

  dismiss(eventId: string): void {
    const event = this.events.get(eventId);
    if (!event) throw new Error("Visitor event not found");

    this.events.update(eventId, { status: "dismissed" });
    this.history.add({
      eventId,
      replyId: "",
      action: "dismissed",
      userConfirmed: true
    });
  }
}
