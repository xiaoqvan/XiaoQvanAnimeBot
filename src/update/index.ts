import type { Update as Td$Update } from "tdlib-types";
import handleNewMessage from "./newMessage.ts";
import updateNewCallbackQuery from "./CallbackQuery/index.ts";

export async function handleUpdate(update: Td$Update) {
  switch (update._) {
    case "updateNewMessage":
      await handleNewMessage(update);
      break;
    case "updateNewCallbackQuery":
      await updateNewCallbackQuery(update);
      break;
    default:
      break;
  }
}
