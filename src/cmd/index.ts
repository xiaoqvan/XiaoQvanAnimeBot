import { getMe } from "../TDLib/function/get.js";
import type { message as messageType } from "tdlib-types";
import start from "./start.js";
import handleSearchAnime from "./searchanime.js";
import handleHelp from "./help.js";
import logger from "../log/index.js";
import { ErrorHandler } from "../function/index.js";
import { sendMessage } from "../TDLib/function/message.js";

/**
 * 处理命令
 * @param {object} message
 */
export async function BotCommand(message: messageType) {
  if (
    message.content._ !== "messageText" ||
    !message.content?.text?.entities?.some(
      (entity) => entity.type._ === "textEntityTypeBotCommand"
    )
  ) {
    return;
  }
  if (
    !message ||
    !message.content ||
    !message.content.text ||
    !message.content.text.text
  ) {
    return;
  }
  const commandParts = message.content.text.text.split(" ");
  const command = commandParts[0];

  // 获取机器人的用户名
  const botme = await getMe();

  const botUsername = botme?.usernames?.active_usernames?.[0] || null;

  // 检查命令是否应该被处理
  const shouldProcessCommand = () => {
    // 如果命令中包含@
    if (command.includes("@")) {
      const parts = command.split("@");
      const username = parts[1];
      // 只有当@后面是机器人自己的用户名时才处理
      return username === botUsername;
    }
    // 如果命令中不包含@，则处理
    return true;
  };

  if (message.content.text.text.startsWith("/") && shouldProcessCommand()) {
    try {
      // 提取基本命令（移除可能的@username部分）
      const baseCommand = command.split("@")[0];

      const handlers: Record<
        string,
        (
          message: messageType,
          commandParts: string[]
        ) => Promise<unknown> | unknown
      > = {
        start: start,
        help: handleHelp,
        searchanime: handleSearchAnime,
        s: handleSearchAnime,
        test: test,
      };

      // 基于命令名分发到对应的处理器
      const commandName = baseCommand.startsWith("/")
        ? baseCommand.slice(1).toLowerCase()
        : baseCommand.toLowerCase();

      const handler = handlers[commandName];

      if (handler) {
        try {
          await handler(message, commandParts);
        } catch (err) {
          logger.error("执行命令处理器时出错:", err);
          ErrorHandler(err);
        }
      }

      // switch (baseCommand) {
      //   case "/start":
      //     // await start(message);

      //     sendMessage(message.chat_id, {
      //       reply_to: {
      //         _: "inputMessageReplyToMessage",
      //         message_id: message.id,
      //       },
      //       input_message_content: {
      //         _: "inputMessageText",
      //         text:  (
      //           "欢迎使用xiaoqvan的Bot！\n\n使用 /help 可以获取帮助"
      //         ),
      //         link_preview_options: {
      //           _: "linkPreviewOptions",
      //           is_disabled: true,
      //         },
      //       },
      //     });
      //     break;
      //   case "/excludeTag":
      //     await handleExcludeTag(message, commandParts);
      //     break;
      //   case "/extractnames":
      //     await handleExtractNames(message, commandParts);
      //     break;
      //   case "/addanime":
      //     // 处理添加动漫的逻辑
      //     // await handleAddAnime(message, commandParts);
      //     break;
      //   case "/correctanime":
      //     // 处理动漫信息纠正的逻辑
      //     await handleCorrectAnime(message, commandParts);
      //     break;
      //   case "/addname":
      //     // 处理添加动漫别名的逻辑
      //     await handleAddName(message, commandParts);
      //     break;
      //   case "/removename":
      //     // 处理删除动漫别名的逻辑
      //     await handleRemoveName(message, commandParts);
      //     break;
      //   case "/deleteanime":
      //     // 处理删除动漫信息的逻辑
      //     await handleDeleteAnime(message, commandParts);
      //     break;
      //   case "/searchanime":
      //   case "/s":
      //     // 处理搜索动漫的逻辑
      //     await handleSearchAnime(message, commandParts);
      //     break;
      //   case "/getanime":
      //     // 处理获取动漫详细信息的逻辑
      //     await handleGetAnime(message, commandParts);
      //     break;
      //   case "/help":
      //     // 处理帮助命令的逻辑
      //     await handleHelp(message, commandParts);
      //     break;
      //   case "/log":
      //     // 处理获取日志文件的逻辑
      //     await handleGetLog(message, commandParts);
      //     break;
      //   case "/blacklistanime":
      //     await handleBlacklistAnime(message, commandParts);
      //     break;
      //   case "/addanimeinfo":
      //     await handleAddAnimeInfo(message, commandParts);
      //     break;
      //   case "/setanimer18":
      //     await handleSetAnimeR18(message, commandParts);
      //     break;
      // }
    } catch (error) {
      logger.error(error);
    }
  }
}
async function test(message: messageType, commandParts: string[]) {
  console.log("测试命令处理器被调用", message, commandParts);
  sendMessage(message.chat_id, {
    invoke: {
      _: "sendMessage",
      chat_id: -1003040986800,
      message_thread_id: 4194304,
      input_message_content: {
        _: "inputMessageText",
        text: {
          _: "formattedText",
          text:
            "错误信息:\n" +
            "name: Error\n" +
            "message: 发送消息失败\n" +
            "stack: Error: 发送消息失败\n" +
            "at f (file:///root/XiaoQvanAnimeBot/src/TDLib/function/message.ts:92:11)\n" +
            "at ae (file:///root/XiaoQvanAnimeBot/src/anime/sendAnime.ts:170:24)\n" +
            "at On (file:///root/XiaoQvanAnimeBot/src/anime/index.ts:432:20)\n" +
            "at Pn (file:///root/XiaoQvanAnimeBot/src/anime/index.ts:229:5)\n" +
            "at Nn (file:///root/XiaoQvanAnimeBot/src/anime/index.ts:213:3)",
          entities: [],
        },
        link_preview_options: undefined,
      },
    },
  });
}
