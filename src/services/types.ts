
export type VisitorKind = "doorbell" | "motion" | "knock";
export type VisitorCategory = "delivery" | "neighbor" | "unknown" | "service";
export type EventStatus = "new" | "proposed" | "confirmed" | "dismissed";

export type VisitorEvent = {
  id: string;
  timestamp: string;
  source: "simulator";
  kind: VisitorKind;
  visitorHint?: string;
  transcript?: {
    text: string;
    origin: "transcribe" | "browser-stt" | "demo-script";
  };
  inferred?: {
    category: VisitorCategory;
    confidence: number;
    reason: string;
  };
  status: EventStatus;
};

export type Preferences = {
  deliveryInstruction: string;
  unknownVisitorInstruction: string;
  textSize: "medium" | "large" | "xlarge";
  highContrast: boolean;
  flashAlerts: boolean;
  retainTranscripts: boolean;
};

export type ProposedReply = {
  id: string;
  eventId: string;
  text: string;
  basis: string[];
  requiresConfirmation: true;
  generatedBy: "template";
};

export type ActionRecord = {
  id: string;
  eventId: string;
  replyId: string;
  action: "reply_sent" | "dismissed" | "inference_corrected";
  timestamp: string;
  userConfirmed: boolean;
};
