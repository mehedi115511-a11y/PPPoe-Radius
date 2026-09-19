import { smokeCheck } from "./smoke.js";
try {
  console.log(JSON.stringify(await smokeCheck()));
} catch (error) {
  console.error(`Smoke check failed: ${error.message}`);
  process.exitCode = 1;
}
