import type { Update as Td$Update } from "tdlib-types";
import updateOption from "./updateOption.js";
import updateAuthorizationState from "./updateAuthorizationState.js";

export async function handleUpdate(update: Td$Update) {
  switch (update._) {
    case "updateOption":
      await updateOption(update);
      break;
    case "updateAuthorizationState":
      await updateAuthorizationState(update);
      break;
    case "updateNewMessage":
      break;
    default:
      break;
  }
}
