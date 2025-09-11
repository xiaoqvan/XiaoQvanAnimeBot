import type {
  updateNewMessage as Td$updateNewMessage,
  message as Td$message,
} from "tdlib-types";
import logger from "../log/index.js";
import { formattedDate } from "../function/index.js";
import { messageLog } from "../function/message.js";
import { BotCommand } from "../cmd/index.js";

/**处理新消息 */
export default async function handleNewMessage(update: Td$updateNewMessage) {
  const message = update.message;
  // console.log("收到新消息", JSON.stringify(message, null, 2));

  if (ignoreExpiredMessages(message)) return;

  const handlers = [
    { handler: messageLog, errMsg: "消息日志记录失败" },
    { handler: BotCommand, errMsg: "处理Bot命令失败" },
  ];

  await Promise.all(
    handlers.map(async ({ handler, errMsg }) => {
      handler(update.message).catch((error) => {
        logger.error(`${errMsg}: ${error.message}`);
      });
    })
  );
}

/**忽略过期消息 */
function ignoreExpiredMessages(message: Td$message) {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const messageTimestamp = message.date;
  const tenMinutesInSeconds = 20 * 60;

  if (currentTimestamp - messageTimestamp > tenMinutesInSeconds) {
    logger.debug(`忽略过期消息，消息时间: ${formattedDate(messageTimestamp)}`);
    return true;
  }

  return false;
}
