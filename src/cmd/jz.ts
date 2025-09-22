import { getAnimeById, getCacheItemById } from "../database/query.ts";
import { sendMessage } from "../TDLib/function/message.ts";
import type { message as messageType } from "tdlib-types";
import { parseMarkdownToFormattedText } from "../TDLib/function/parseMarkdown.ts";

export default async function ConAnimeInformation(
  message: messageType,
  commandParts: string[]
) {
  if (
    message.content._ !== "messageText" ||
    message.sender_id._ !== "messageSenderUser"
  )
    return;

  const id = Number(commandParts[1]);
  const Cache_id = Number(commandParts[2]);

  const anime = await getAnimeById(id, true);
  const cache = await getCacheItemById(Cache_id);

  await sendMessage(message.chat_id, {
    invoke: {
      reply_markup: {
        _: "replyMarkupInlineKeyboard",
        rows: [
          [
            {
              _: "inlineKeyboardButton",
              text: "确定",
              type: {
                _: "inlineKeyboardButtonTypeCallback",
                data: Buffer.from(`Y_anime?id=${id}&c=${Cache_id}`).toString(
                  "base64"
                ),
              },
            },
          ],
        ],
      },
      input_message_content: {
        _: "inputMessageText",
        text: parseMarkdownToFormattedText(
          `番剧缓存信息为：${anime?.name_cn || anime?.name || "未知"}(id:${
            anime?.id
          })\n缓存: ${cache?.title}(id:${Cache_id}) `
        ),
      },
    },
  });
}
