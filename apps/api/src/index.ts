import { app } from "./app";
import { env } from "./config/env";
import { scheduleRentRoll } from "./jobs/rentRoll";

app.listen(env.PORT, () => {
  console.log(`DirectLet API running on http://localhost:${env.PORT}`);
  scheduleRentRoll();
});
