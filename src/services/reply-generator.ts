
export type ReplyGenerationInput = {
  category: string;
  visitorHint?: string;
  transcript?: string;
  deliveryInstruction: string;
  unknownVisitorInstruction: string;
};

export type GeneratedReply = {
  text: string;
  generatedBy: "template";
  basis: string[];
};

export class ReplyGenerator {
  async generate(input: ReplyGenerationInput): Promise<GeneratedReply> {
    const isDelivery = input.category === "delivery";

    return {
      text: isDelivery
        ? input.deliveryInstruction
        : input.unknownVisitorInstruction,
      generatedBy: "template",
      basis: [
        `Category used: ${input.category}`,
        isDelivery
          ? "Saved delivery preference"
          : "Saved unknown-visitor preference"
      ]
    };
  }
}
