import "dotenv/config";
import { getClient } from "./TDLib/index.js";

(async () => {
  const client = await getClient();

  client.on("update", async (update) => {
    console.log("收到更新", JSON.stringify(update, null, 2));
  });
})();
