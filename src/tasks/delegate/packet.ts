import { truncateMiddle } from "../../utils/truncate.js";
import { redactSecrets } from "../review/packet.js";
import type { CcDelegateInput } from "./schema.js";

export function buildDelegatePacket(input: CcDelegateInput): string {
  const prompt = redactSecrets(input.prompt.trim());
  return finalizePacket(prompt, input.maxContextChars);
}

function finalizePacket(packet: string, maxChars: number): string {
  const withTrailingNewline = `${packet}\n`;
  if (withTrailingNewline.length <= maxChars) return withTrailingNewline;
  return `${truncateMiddle(packet, maxChars - 1)}\n`;
}
