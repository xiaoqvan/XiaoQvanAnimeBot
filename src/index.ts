import "dotenv/config";
import { getClient } from "./TDLib/index.ts";
import { handleUpdate } from "./update/index.ts";
import { handleUpdate as TdUpdate } from "./TDLib/update/index.ts";
import { anime } from "./anime/index.ts";

(async () => {
  const client = await getClient();

  client.on("update", async (update) => {
    TdUpdate(update);
    handleUpdate(update);
  });
  await client.loginAsBot(String(process.env.TELEGRAM_BOT_TOKEN));
  await anime();
})();
