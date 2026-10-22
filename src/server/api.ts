import { Router } from "express";
import { ActionHistory } from "../services/action-history.js";
import { ApprovalService } from "../services/approval-service.js";
import { EventStore } from "../services/event-store.js";
import { PreferenceStore } from "../services/preference-store.js";
import type { Preferences, VisitorKind } from "../services/types.js";

export const eventStore = new EventStore();
export const preferenceStore = new PreferenceStore();
export const actionHistory = new ActionHistory();

const approvalService = new ApprovalService(
  eventStore,
  preferenceStore,
  actionHistory
);

export const apiRouter = Router();

const validKinds: VisitorKind[] = ["doorbell", "motion", "knock"];
const validTextSizes = ["medium", "large", "xlarge"] as const;

apiRouter.get("/events", (_req, res) => {
  res.json({
    source: "simulator",
    events: eventStore.list()
  });
});

apiRouter.post("/events/simulate", (req, res) => {
  const { kind, visitorHint } = req.body as {
    kind?: VisitorKind;
    visitorHint?: string;
  };

  if (!kind || !validKinds.includes(kind)) {
    res.status(400).json({
      error: "kind must be doorbell, motion, or knock"
    });
    return;
  }

  const event = eventStore.add({
    kind,
    visitorHint:
      typeof visitorHint === "string" && visitorHint.trim()
        ? visitorHint.trim().slice(0, 200)
        : "Simulated visitor event"
  });

  res.status(201).json({
    notice: "Simulated visitor events — this is not a live Ring integration.",
    event
  });
});

apiRouter.get("/preferences", (_req, res) => {
  res.json(preferenceStore.get());
});

apiRouter.patch("/preferences", (req, res) => {
  const body = req.body as Partial<Preferences>;

  const allowedKeys = [
    "deliveryInstruction",
    "unknownVisitorInstruction",
    "textSize",
    "highContrast",
    "flashAlerts",
    "retainTranscripts"
  ];

  const suppliedKeys = Object.keys(body);

  if (
    suppliedKeys.length === 0 ||
    suppliedKeys.some(key => !allowedKeys.includes(key))
  ) {
    res.status(400).json({
      error: "Provide at least one valid preference field."
    });
    return;
  }

  if (
    body.deliveryInstruction !== undefined &&
    (typeof body.deliveryInstruction !== "string" ||
      body.deliveryInstruction.trim().length === 0 ||
      body.deliveryInstruction.length > 500)
  ) {
    res.status(400).json({
      error: "deliveryInstruction must be a non-empty string up to 500 characters."
    });
    return;
  }

  if (
    body.unknownVisitorInstruction !== undefined &&
    (typeof body.unknownVisitorInstruction !== "string" ||
      body.unknownVisitorInstruction.trim().length === 0 ||
      body.unknownVisitorInstruction.length > 500)
  ) {
    res.status(400).json({
      error: "unknownVisitorInstruction must be a non-empty string up to 500 characters."
    });
    return;
  }

  if (
    body.textSize !== undefined &&
    !validTextSizes.includes(body.textSize as (typeof validTextSizes)[number])
  ) {
    res.status(400).json({
      error: "textSize must be medium, large, or xlarge."
    });
    return;
  }

  for (const key of [
    "highContrast",
    "flashAlerts",
    "retainTranscripts"
  ] as const) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") {
      res.status(400).json({
        error: `${key} must be a boolean.`
      });
      return;
    }
  }

  let updated = preferenceStore.get();

  if (body.deliveryInstruction !== undefined) {
    updated = preferenceStore.update(
      "deliveryInstruction",
      body.deliveryInstruction.trim()
    );
  }

  if (body.unknownVisitorInstruction !== undefined) {
    updated = preferenceStore.update(
      "unknownVisitorInstruction",
      body.unknownVisitorInstruction.trim()
    );
  }

  if (body.textSize !== undefined) {
    updated = preferenceStore.update("textSize", body.textSize);
  }

  if (body.highContrast !== undefined) {
    updated = preferenceStore.update("highContrast", body.highContrast);
  }

  if (body.flashAlerts !== undefined) {
    updated = preferenceStore.update("flashAlerts", body.flashAlerts);
  }

  if (body.retainTranscripts !== undefined) {
    updated = preferenceStore.update(
      "retainTranscripts",
      body.retainTranscripts
    );
  }

  res.json({
    message: "Preferences saved for this running server.",
    preferences: updated
  });
});

apiRouter.post("/events/:id/propose", async (req, res) => {
  try {
    const reply = await approvalService.propose(req.params.id);
    res.json(reply);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unable to propose reply";

    const status = message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

apiRouter.post("/events/:id/confirm", (req, res) => {
  const { replyId, confirmed } = req.body as {
    replyId?: string;
    confirmed?: boolean;
  };

  if (!replyId || typeof confirmed !== "boolean") {
    res.status(400).json({
      error: "replyId and a boolean confirmed value are required"
    });
    return;
  }

  try {
    const result = approvalService.confirm(replyId, confirmed);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unable to confirm reply"
    });
  }
});

apiRouter.post("/events/:id/dismiss", (req, res) => {
  const event = eventStore.get(req.params.id);

  if (!event) {
    res.status(404).json({ error: "Visitor event not found" });
    return;
  }

  if (event.status === "dismissed") {
    res.json({ ok: true, event });
    return;
  }

  try {
    const dismissed = eventStore.update(event.id, { status: "dismissed" });
    res.json({ ok: true, event: dismissed });
  } catch {
    res.status(500).json({ error: "Unable to dismiss visitor event" });
  }
});
