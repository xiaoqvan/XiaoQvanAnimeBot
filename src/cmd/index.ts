import { getMe } from "../TDLib/function/get.ts";

import logger from "../log/index.ts";

import { ErrorHandler } from "../function/index.ts";

import start from "./start.ts";
import handleSearchAnime from "./searchanime.ts";
import handleHelp from "./help.ts";
import handleSetAnimeR18 from "./setanimer18.ts";
import ConAnimeInformation from "./jz.ts";
import addAnime from "./addanime.ts";
import updateAnime from "./updateAnime.ts";

import type { message as messageType } from "tdlib-types";

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
        // 启动
        start: start,
        // 帮助
        help: handleHelp,

        // 搜索动漫
        searchanime: handleSearchAnime,
        s: handleSearchAnime,

        // 测试用
        test: test,

        // 设置 R18
        setanimer18: handleSetAnimeR18,

        // 纠正动漫信息
        ca: ConAnimeInformation,

        // 添加动漫
        addanime: addAnime,

        // 更新动漫文本信息
        updateanime: updateAnime,
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
    } catch (error) {
      logger.error(error);
    }
  }
}
async function test(message: messageType, commandParts: string[]) {
  console.log("test commandParts", commandParts);
}
