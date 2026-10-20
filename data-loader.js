// Keep the compressed response streaming: do not retain a second full download buffer.
export async function fetchDatabase(onProgress = () => {}, url = "data/data.bin", { signal } = {}) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("This browser cannot decompress the recipe database. Please use a current browser.");
  }

  let response;
  try {
    response = await fetch(url, { signal, cache: "no-cache" });
  } catch (error) {
    throw new Error("Could not download the recipe database. Check your connection and retry.", { cause: error });
  }
  if (!response.ok) {
    throw new Error(`Recipe database download failed (HTTP ${response.status}). Please retry.`);
  }
  if (!response.body) throw new Error("The recipe database response was empty. Please retry.");

  const total = Number(response.headers.get("content-length")) || 0;
  let received = 0;
  let lastUpdate = 0;
  const progress = new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength;
      const now = performance.now();
      if (now - lastUpdate >= 100 || (total && received >= total)) {
        onProgress({ received, total });
        lastUpdate = now;
      }
      controller.enqueue(chunk);
    },
    flush() {
      onProgress({ received, total });
    }
  });

  const stream = response.body.pipeThrough(progress).pipeThrough(new DecompressionStream("gzip"));
  try {
    const buffer = await new Response(stream).arrayBuffer();
    if (buffer.byteLength < 32 || buffer.byteLength % 4 !== 0) {
      throw new Error("Invalid database length");
    }
    return buffer;
  } catch (error) {
    throw new Error("Could not read the recipe database. The download may be incomplete or damaged; please retry.", { cause: error });
  }
}
