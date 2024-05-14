export function sigToRSV(sig: Buffer) {
  if (sig.length !== 65) {
    throw new Error(`Invalid signature length: expected 65, got ${sig.length}`);
  }

  return { r: sig.subarray(0, 32), s: sig.subarray(32, 64), v: sig[64] };
}
