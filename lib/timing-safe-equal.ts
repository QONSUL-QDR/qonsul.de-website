const encoder = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

/**
 * Fixed-length digest comparison mitigation for Worker runtime secrets.
 * It is deliberately not presented as a mathematically guaranteed constant-time primitive.
 */
export async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([digest(left), digest(right)]);
  let difference = Number(!left || !right) | (leftDigest.length ^ rightDigest.length);

  for (let index = 0; index < leftDigest.length; index++) {
    difference |= leftDigest[index] ^ rightDigest[index];
  }

  return difference === 0;
}
