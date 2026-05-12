/**
 * Helper compartilhado pra carregar @solana/kit sem reimplementar em cada rota.
 */
export async function loadKit() {
  const kit = await import('@solana/kit');
  return { kit };
}
