import type { message as messageType } from "tdlib-types";
import { isUserAdmin } from "../TDLib/function/index.ts";
import { send } from "process";
import { sendMessage } from "../TDLib/function/message";
import { sendMegToNavAnime } from "../anime/sendAnime.ts";
import { getAnimeById } from "../database/query";

export default async function updateAnime(
  message: messageType,
  commandParts: string[]
) {
  // 检查是否为管理员
  const isAdmin = await isUserAdmin(
    Number(process.env.ADMIN_GROUP_ID),
    message.sender_id
  );
  const isBotAdmin =
    message.sender_id._ === "messageSenderUser" &&
    message.sender_id.user_id === Number(process.env.BOT_ADMIN_ID);

  if (!isAdmin && !isBotAdmin) {
    return;
  }
  if (message.content._ !== "messageText") {
    return;
  }

  const animeId = Number(commandParts[1]);
  if (!animeId) {
    sendMessage(message.chat_id, {
      reply_to_message_id: message.id,
      text: "❌ 用法错误！\n\n**正确用法**:\n`/updateanime <ID>` - 更新指定ID动漫的信息\n\n**示例**:\n`/updateanime 12345`",
      link_preview: true,
    });
    return;
  }
  const anime = await getAnimeById(animeId);
  await sendMessage(message.chat_id, {
    reply_to_message_id: message.id,
    text: `✅ 已触发更新动漫${anime?.name_cn || anime?.name}(${
      anime?.id
    })信息的操作\nlink:${
      anime?.navMessage?.link
    }\n\n更新后的信息会更新到频道。\n\n如果长时间未更新信息，请检查日志或联系管理员。`,
    link_preview: true,
  });
  await sendMegToNavAnime(animeId);
  return;
}
