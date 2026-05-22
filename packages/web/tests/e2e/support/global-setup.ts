import { bootstrap, testDbName } from "./db";

export default async function globalSetup() {
  const name = testDbName();
  console.log(`[e2e] Bootstrapping test database '${name}'…`);
  await bootstrap();
  console.log(`[e2e] Test database '${name}' ready.`);
}
