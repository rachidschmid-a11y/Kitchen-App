// Rezept ↔ Link. Das Rezept steckt komprimiert im Link-Anhang (#r=…): Es wird nirgends hochgeladen,
// der Empfänger sieht nur genau dieses Rezept. Dafür ohne Foto und nicht widerrufbar –
// mit Firebase kommt später eine geteilte Kopie in der Datenbank dazu, die man wieder löschen kann.

const toBase64Url = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (str) => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function transform(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

// Nur was der Empfänger braucht – keine IDs, keine Bewertungen, die Notiz nur auf Wunsch.
export function toShareable(recipe, { includeNotes = false, categories = [], tags = [], from = '' } = {}) {
  return {
    v: 1,
    t: recipe.title,
    d: recipe.description || '',
    s: recipe.servings || 1,
    p: recipe.prepMin || 0,
    c: recipe.cookMin || 0,
    i: (recipe.ingredients || []).map((x) => [x.amount ?? null, x.amountMax ?? null, x.unit || '', x.name, x.note || '', x.section || '']),
    st: recipe.steps || [],
    n: includeNotes ? (recipe.noteLog || []).map((x) => x.text).join('\n\n') || recipe.notes || '' : '',
    q: recipe.source || '',
    k: categories,
    g: tags,
    f: from,
  };
}

export function fromShareable(o) {
  return {
    title: o.t,
    description: o.d,
    servings: o.s,
    prepMin: o.p,
    cookMin: o.c,
    ingredients: o.i.map(([amount, amountMax, unit, name, note, section]) => ({ amount, amountMax, unit, name, note, ...(section ? { section } : {}) })),
    steps: o.st,
    notes: o.n,
    source: o.q,
    categories: o.k || [],
    tags: o.g || [],
    from: o.f || '',
  };
}

export async function encodeRecipe(recipe, options) {
  const json = new TextEncoder().encode(JSON.stringify(toShareable(recipe, options)));
  return toBase64Url(await transform(json, new CompressionStream('deflate-raw')));
}

export async function decodeRecipe(code) {
  const json = await transform(fromBase64Url(code), new DecompressionStream('deflate-raw'));
  return fromShareable(JSON.parse(new TextDecoder().decode(json)));
}

export function shareUrl(code, { print = false } = {}) {
  return new URL(`teilen.html#r=${code}${print ? '&druck=1' : ''}`, location.href).href;
}
