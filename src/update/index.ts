import type { Update as Td$Update } from "tdlib-types";
import handleNewMessage from "./newMessage.js";
import updateAuthorizationState from "./updateAuthorizationState.js";
import updateNewCallbackQuery from "./CallbackQuery/index.js";

export async function handleUpdate(update: Td$Update) {
  switch (update._) {
    case "updateNewMessage":
      await handleNewMessage(update);
      break;
    case "updateAuthorizationState":
      await updateAuthorizationState(update);
      break;
    case "updateNewCallbackQuery":
      await updateNewCallbackQuery(update);
      break;
    default:
      break;
  }
}
