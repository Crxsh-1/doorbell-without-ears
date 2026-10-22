
import { randomUUID } from "node:crypto";
import type { ActionHistory } from "./action-history.js";
import type { EventStore } from "./event-store.js";
import type { PreferenceStore } from "./preference-store.js";
import type { ProposedReply, VisitorCategory } from "./types.js";
import { ReplyGenerator } from "./reply-generator.js";

export class ApprovalService {
  private replies = new Map<string, ProposedReply>();
  private generator = new ReplyGenerator();

  constructor(
    private events: EventStore,
    private preferences: PreferenceStore,
    private history: ActionHistory
  ) {}

  async propose(eventId: string): Promise<ProposedReply> {
    const event = this.events.get(eventId);
    if (!event) throw new Error("Visitor event not found");

    const prefs = this.preferences.get();
    const category = event.inferred?.category ?? "unknown";

    const generated = await this.generator.generate({
      category,
      visitorHint: event.visitorHint,
      transcript: prefs.retainTranscripts
        ? event.transcript?.text
        : undefined,
      deliveryInstruction: prefs.deliveryInstruction,
      unknownVisitorInstruction: prefs.unknownVisitorInstruction
    });

    const latestEvent = this.events.get(eventId);
    if (!latestEvent) throw new Error("Visitor event no longer exists");
    if (latestEvent.status === "dismissed") {
      throw new Error("Cannot propose a reply for a dismissed event");
    }

    const reply: ProposedReply = {
      id: randomUUID(),
      eventId,
      text: generated.text,
      basis: generated.basis,
      requiresConfirmation: true,
      generatedBy: generated.generatedBy
    };

    this.replies.set(reply.id, reply);
    this.events.update(eventId, { status: "proposed" });

    return { ...reply, basis: [...reply.basis] };
  }

  confirm(
    replyId: string,
    confirmed: boolean
  ): { delivered: boolean; message: string } {
    const reply = this.replies.get(replyId);
    if (!reply) throw new Error("Proposed reply not found");

    if (confirmed !== true) {
      return {
        delivered: false,
        message: "Reply not delivered: user confirmation required."
      };
    }

    const event = this.events.get(reply.eventId);
    if (!event) throw new Error("Visitor event no longer exists");
    if (event.status === "dismissed") {
      throw new Error("Cannot reply to a dismissed event");
    }
    if (event.status === "confirmed") {
      throw new Error("Reply has already been confirmed");
    }

    this.events.update(reply.eventId, { status: "confirmed" });
    this.history.add({
      eventId: reply.eventId,
      replyId,
      action: "reply_sent",
      userConfirmed: true
    });

    return {
      delivered: true,
      message: "Simulated reply delivered after confirmation."
    };
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
