import { loadConfig } from "./config/config.js";
import { createServer } from "./server/server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await createServer(config);

  const shutdown = async () => {
    app.log.info("shutting down");
    await app.close();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  await app.listen({ host: "0.0.0.0", port: config.port });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
