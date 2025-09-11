import "dotenv/config";
import { getClient } from "./TDLib/index.js";
import { handleUpdate } from "./update/index.js";
import { anime } from "./anime/index.js";

(async () => {
  const client = await getClient();

  client.on("update", async (update) => {
    handleUpdate(update);
  });
  await client.loginAsBot(String(process.env.TELEGRAM_BOT_TOKEN));
  await anime();
})();
