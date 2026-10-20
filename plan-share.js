import { importPlan, serializePlan } from "./planner-state.js";
const MAX_BYTES = 2000000,
  MAX_LINK_DATA = 24000,
  PREFIX = "#plan=v1.";
const encode64 = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};
export async function createPlanLink(state, dataset, href = location.href) {
  if (!/^[a-f0-9]{64}$/.test(dataset.sha256 || ""))
    throw new Error(
      "Wait for a verified recipe dataset before creating a link.",
    );
  if (typeof CompressionStream !== "function")
    throw new Error("Plan links require gzip support. Download JSON instead.");
  const bytes = new TextEncoder().encode(serializePlan(state, dataset));
  if (bytes.length > MAX_BYTES)
    throw new Error(
      "This plan exceeds the 2 MB sharing limit. Download JSON instead.",
    );
  const compressed = new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  const encoded = encode64(compressed);
  if (encoded.length > MAX_LINK_DATA)
    throw new Error(
      "This plan is too large for a link. Download JSON instead.",
    );
  const url = new URL(href);
  url.search = "";
  url.searchParams.set("dataset", dataset.id);
  url.hash = PREFIX.slice(1) + encoded;
  return url.href;
}
export async function readPlanLink(hash, dataset) {
  if (!hash.startsWith("#plan=")) return null;
  if (!hash.startsWith(PREFIX))
    throw new Error("Unsupported shared plan link version.");
  const encoded = hash.slice(PREFIX.length);
  if (
    !encoded ||
    encoded.length > MAX_LINK_DATA ||
    !/^[a-z0-9_-]+$/i.test(encoded)
  )
    throw new Error(
      "The shared plan link is invalid or too large. Request a JSON export instead.",
    );
  let text, data;
  try {
    const bytes = Uint8Array.from(
      atob(encoded.replaceAll("-", "+").replaceAll("_", "/")),
      (char) => char.charCodeAt(0),
    );
    const reader = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"))
        .getReader(),
      chunks = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BYTES) throw new Error("Shared plan exceeds 2 MB.");
        chunks.push(value);
      }
    } catch (error) {
      try {
        await reader.cancel();
      } catch {
        /* Preserve the decoding failure. */
      }
      throw error;
    }
    const decoded = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      decoded.set(chunk, offset);
      offset += chunk.length;
    }
    text = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
    data = JSON.parse(text);
    if (data.format !== "gtnh-atlas-plan")
      throw new Error("Shared plans require a versioned dataset identity.");
  } catch {
    throw new Error(
      "The shared plan could not be decoded within the 2 MB limit. Request a fresh link or JSON export.",
    );
  }
  if (!/^[a-f0-9]{64}$/.test(data.dataset?.sha256 || ""))
    throw new Error(
      "Shared plan is missing its dataset checksum. Request a fresh link or JSON export.",
    );
  return importPlan(text, dataset);
}
