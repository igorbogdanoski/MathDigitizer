async function test() {
  console.log("Importing vite...");
  const { createServer } = await import("vite");
  console.log("Vite imported successfully:", typeof createServer);
}
test().catch(console.error);
