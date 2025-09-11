import { sendMessage } from "../TDLib/function/message.js";
import type { message as messageType } from "tdlib-types";

export default async function start(message: messageType) {
  sendMessage(message.chat_id, {
    reply_to_message_id: message.id,
    text: "欢迎使用xiaoqvan的Bot！\n\n使用 /help 可以获取帮助",
    link_preview: true,
  });
  return;
}
