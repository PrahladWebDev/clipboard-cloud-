/** Generates a random, human-friendly 6-digit pairing code. */
export function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
