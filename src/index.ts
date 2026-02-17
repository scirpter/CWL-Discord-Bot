import { createApplication } from "@/app.js";

async function main() {
  const app = await createApplication();
  await app.start();

  const shutdown = async () => {
    await app.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main().catch((error: unknown) => {
  // Fallback for startup failures before logger is initialized.
  process.stderr.write(`Startup failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
