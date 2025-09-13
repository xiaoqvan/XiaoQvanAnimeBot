import type { message as messageType } from "tdlib-types";
import logger from "../log/index.js";
import { sendMessage } from "../TDLib/function/message.js";
import { isUserAdmin } from "../TDLib/function/index.js";
/**
 * 处理帮助命令
 * @param message - 消息对象
 * @param commandParts - 命令参数数组
 */
export default async function handleHelp(message: messageType, commandParts: string[]) {
  const chatId = message.chat_id;

  try {
    // 如果有特定命令参数，显示该命令的详细帮助
    if (commandParts.length > 1) {
      const specificCommand = commandParts[1].toLowerCase();
      await showSpecificHelp(message, specificCommand);
      return;
    }

    // 显示所有命令的概览
    await showGeneralHelp(message);
  } catch (error) {
    logger.error("处理帮助命令时出错:", error);
    await sendMessage(chatId, {
      reply_to_message_id: message.id,
      text: "处理帮助命令时出错，请稍后再试。",
      link_preview: true,
    });
  }
}

/**
 * 显示所有命令的概览帮助
 * @param message - 消息对象
 */
async function showGeneralHelp(message: messageType) {
  // 检查是否为管理员
  const isAdmin = await isUserAdmin(
    Number(process.env.ADMIN_GROUP_ID),
    message.sender_id
  );
  const isBotAdmin =
    message.sender_id._ === "messageSenderUser" &&
    message.sender_id.user_id === Number(process.env.BOT_ADMIN_ID);

  let helpText = `🤖 **xiaoqvan的动漫BOT**\n\n📋 **可用命令列表**:\n\n`;

  helpText += `🔍 **查询功能**:\n`;
  helpText += `/searchanime <关键词/ID> - 搜索动漫信息 (短命令 /s )\n`;
  helpText += `/getanime <ID> - 获取动漫详细信息\n\n`;

  helpText += `❓ **帮助系统**:\n`;
  helpText += `/help - 显示此帮助信息\n`;
  helpText += `/help <命令> - 显示特定命令的详细帮助\n\n`;

  // 管理员专用命令
  if (isAdmin || isBotAdmin) {
    helpText += `🔧 **管理功能** (管理员专用):\n`;
    helpText += `/correctanime <旧ID> <新ID> - 纠正动漫信息\n`;
    helpText += `/addanime <参数> - 添加新动漫\n`;
    helpText += `/addanimeinfo <ID> - 添加动漫详细信息\n`;
    helpText += `/deleteanime <ID> - 删除动漫信息\n`;
    helpText += `/excludeTag <关键词> - 排除指定标签\n`;
    helpText += `/blacklistanime <指令组> - 管理拉黑动漫列表\n\n`;

    helpText += `📝 **别名管理** (管理员专用):\n`;
    helpText += `/addname <ID> "<名称>" - 为动漫添加别名\n`;
    helpText += `/removename <ID> "<名称>" - 删除动漫别名\n`;
    helpText += `/extractnames <ID> "<字幕组名>" <标题> - 从标题中提取名称并添加别名\n\n`;
  }
  if (isBotAdmin) {
    helpText += `🔧 **系统管理** (管理员专用):\n`;
    helpText += `/log <类型> - 获取日志文件 (info/error/messages)\n\n`;
  }

  helpText += `💡 **使用提示**:\n`;
  helpText += `使用双引号包裹包含空格的名称\n`;

  helpText += `📖 使用 /help <命令名> 获取详细说明，例如:\n`;
  helpText += `/help searchanime、/help getanime`;

  await sendMessage(message.chat_id, {
    reply_to_message_id: message.id,
    text: helpText,
    link_preview: true,
  });
}

/**
 * 显示特定命令的详细帮助
 * @param {number} chatId - 聊天ID
 * @param {string} command - 命令名称
 */
async function showSpecificHelp(message: messageType, command: string) {
  // 检查是否为管理员
  const isAdmin = await isUserAdmin(
    Number(process.env.ADMIN_GROUP_ID),
    message.sender_id
  );
  const isBotAdmin =
    message.sender_id._ === "messageSenderUser" &&
    message.sender_id.user_id === Number(process.env.BOT_ADMIN_ID);

  // 管理员专用命令列表
  const adminCommands = [
    "correctanime",
    "addname",
    "removename",
    "addanime",
    "deleteanime",
    "excludetag",
    "extractnames",
    "blacklistanime",
    "log",
  ];

  // 如果普通用户请求管理员命令的帮助，直接返回
  if ((!isAdmin || !isBotAdmin) && adminCommands.includes(command)) {
    await sendMessage(message.chat_id, {
      reply_to_message_id: message.id,
      text:
        `❌ 未找到命令 ${command} 的帮助信息。\n\n` +
        `使用 /help 查看所有可用命令。`,
      link_preview: true,
    });
    return;
  }

  const helpTexts = {
    searchanime: {
      title: "🔍 搜索动漫命令",
      description: "通过关键词或ID搜索动漫信息",
      usage: [
        "**关键词搜索**:",
        '`/searchanime "<关键词>" - 按关键词搜索（至少2个字符）',
        "/searchanime <关键词> - 单个关键词搜索",
        "",
        "**ID搜索**:",
        "/searchanime <ID> - 按动漫ID精确搜索",
      ],
      examples: [
        '/searchanime "进击的巨人"',
        "/searchanime 忍者",
        "/searchanime 101437",
        '/searchanime "ninja slayer"',
      ],
      notes: [
        "• 关键词搜索不区分大小写",
        "• 支持搜索中文名、日文名和别名",
        "• 关键词搜索至少需要2个字符",
        "• 最多显示20个搜索结果",
        "• 使用 `/correctanime <ID>` 查看动漫详细信息",
      ],
    },

    getanime: {
      title: "📺 获取动漫详情命令",
      description: "通过动漫ID获取详细信息",
      usage: ["`/getanime <ID>` - 获取指定ID的动漫详细信息"],
      examples: ["`/getanime 101437`", "`/getanime 12345`"],
      notes: [
        "• 必须提供有效的数字ID",
        "• 显示动漫的完整详细信息",
        "• 包括基本信息、标签、简介和资源统计",
        "• 提供相关操作命令的快捷提示",
      ],
    },

    correctanime: {
      title: "🔧 纠正动漫信息命令",
      description: "纠正数据库中的动漫信息",
      usage: ["`/correctanime <旧ID> <新ID>` - 用新ID的信息覆盖旧ID"],
      examples: ["`/correctanime 12345 67890`"],
      notes: [
        "• 新ID必须是有效的BGM.TV动漫ID",
        "• 会完全覆盖旧信息，包括别名和标签",
        "• 操作不可逆，请谨慎使用",
        "• 会自动更新相关的导航消息",
      ],
    },

    addname: {
      title: "➕ 添加动漫别名命令",
      description: "为指定动漫添加新的别名",
      usage: ['`/addname <动漫ID> "<别名>"`'],
      examples: [
        '`/addname 12345 "鬼灭之刃"`',
        '`/addname 67890 "Demon Slayer"`',
      ],
      notes: [
        "• 动漫ID必须存在于数据库中",
        "• 不能添加重复的别名",
        "• 建议使用双引号包裹别名",
      ],
    },

    removename: {
      title: "➖ 删除动漫别名命令",
      description: "删除指定动漫的别名",
      usage: ['`/removename <动漫ID> "<别名>"`'],
      examples: [
        '/removename 12345 "鬼灭之刃"',
        '/removename 67890 "Demon Slayer"',
      ],
      notes: [
        "• 动漫ID必须存在于数据库中",
        "• 别名必须存在才能删除",
        "• 删除后会显示剩余别名列表",
      ],
    },

    extractnames: {
      title: "🔗 提取标题名称命令",
      description: "从番剧标题中自动提取名称并添加到动漫别名中",
      usage: ['`/extractnames <动漫ID> "<字幕组名>" <番剧标题>`'],
      examples: [
        '`/extractnames 12345 "喵萌奶茶屋" 鬼灭之刃 / Kimetsu no Yaiba - 01 [WebRip 1080p]"`',
        '`/extractnames 67890 "Leopard-Raws" 进击的巨人 / Shingeki no Kyojin (Attack on Titan) - 第1话"`',
      ],
      notes: [
        "• 动漫ID必须存在于数据库中",
        "• 字幕组名需用双引号包裹",
        "• 自动从标题中提取多种格式的名称",
        "• 支持中文名、日文名、英文名等多语言",
        "• 自动过滤重复和无效的名称",
        "• 只添加新的别名，已存在的不会重复添加",
        "• 提取逻辑支持常见的字幕组发布格式",
      ],
    },

    addanime: {
      title: "🆕 添加动漫命令",
      description: "添加新的动漫到数据库",
      usage: ["`/addanime <参数>` - 添加新动漫"],
      examples: ["`/addanime <相关参数>`"],
      notes: ["• 具体参数格式请参考文档", "• 需要有效的动漫信息"],
    },

    deleteanime: {
      title: "🗑️ 删除动漫命令",
      description: "从数据库中删除指定的动漫信息 (仅管理员)",
      usage: ["`/deleteanime <动漫名称>` - 删除指定动漫"],
      examples: [
        "/deleteanime 进击的巨人",
        "/deleteanime 鬼灭之刃",
        '/deleteanime "Re:从零开始的异世界生活"',
      ],
      notes: [
        "• ⚠️ 此命令仅限管理员使用",
        "• 支持动漫主名称和别名搜索",
        "• 删除操作不可逆，请谨慎使用",
        "• 删除前会显示动漫详细信息确认",
      ],
    },

    excludetag: {
      title: "🚫 排除标签命令",
      description: "添加需要排除的标签关键词",
      usage: ["`/excludeTag <关键词>` - 排除指定标签"],
      examples: ["`/excludeTag 血腥`", "`/excludeTag 暴力`"],
      notes: ["• 排除的标签不会在动漫推荐中显示", "• 关键词支持模糊匹配"],
    },

    blacklistanime: {
      title: "🚫 拉黑动漫管理命令",
      description: "管理动漫拉黑列表，过滤不需要的番剧",
      usage: [
        '/blacklistanime `add` "动漫名称" - 添加拉黑动漫',
        '/blacklistanime `remove` "动漫名称" - 移除拉黑动漫',
        "/blacklistanime `list` - 查看拉黑列表",
      ],
      examples: [
        '/blacklistanime `add` "某不喜欢的动漫"',
        '/blacklistanime `remove` "某动漫"',
        "/blacklistanime `list`",
      ],
      notes: [
        "• 拉黑的动漫不会出现在RSS推送中",
        "• 使用双引号包裹动漫名称",
        "• 支持部分匹配，包含关键词的标题都会被过滤",
        "• 拉黑列表对所有RSS源都生效",
      ],
    },

    help: {
      title: "❓ 帮助命令",
      description: "显示命令帮助信息",
      usage: ["/help - 显示所有命令概览", "/help <命令> - 显示特定命令帮助"],
      examples: ["/help", "/help correctanime", "/help addname"],
      notes: ["• 命令名不区分大小写", "• 支持所有可用命令的详细说明"],
    },

    addanimeinfo: {
      title: "📥 添加动漫详细信息命令",
      description:
        "通过动漫ID自动获取并写入详细信息到数据库，并发送导航消息（仅管理员）",
      usage: ["`/addanimeinfo <ID>` - 通过ID添加动漫详细信息"],
      examples: ["`/addanimeinfo 101437`"],
      notes: [
        "• ⚠️ 此命令仅限管理员使用",
        "• 自动从 BGM.TV 获取动漫信息并保存",
        "• 会自动发送导航消息到频道",
        "• 数据库中不存在该ID时才会新增",
        "• 导航消息会包含动漫简介和相关信息",
      ],
    },

    log: {
      title: "📄 获取日志文件命令",
      description: "获取系统运行日志文件（仅管理员）",
      usage: ["`/log <类型>` - 获取指定类型的日志文件"],
      examples: [
        "`/log info` - 获取应用日志文件",
        "`/log error` - 获取错误日志文件",
        "`/log messages` - 获取消息日志文件",
      ],
      notes: [
        "• ⚠️ 此命令仅限管理员使用",
        "• 支持三种日志类型：info、error、messages",
        "• 文件将直接发送到聊天中",
        "• 显示文件大小和最后修改时间",
        "• 日志文件包含系统运行的详细信息",
      ],
    },
  };

  type HelpInfo = {
    title: string;
    description: string;
    usage: string[];
    examples: string[];
    notes: string[];
  };

  const helpInfo = (helpTexts as Record<string, HelpInfo>)[command];

  if (!helpInfo) {
    await sendMessage(message.chat_id, {
      reply_to_message_id: message.id,
      text:
        `❌ 未找到命令 ${command} 的帮助信息。\n\n` +
        `使用 /help 查看所有可用命令。`,
      link_preview: true,
    });
    return;
  }

  const detailedHelpText =
    `${helpInfo.title}\n\n` +
    `📖 **说明**: ${helpInfo.description}\n\n` +
    `📝 **用法**:\n${helpInfo.usage.join("\n")}\n\n` +
    `💡 **示例**:\n${helpInfo.examples.join("\n")}\n\n` +
    `⚠️ **注意事项**:\n${helpInfo.notes.join("\n")}\n\n` +
    `📋 使用 /help 返回命令列表`;

  await sendMessage(message.chat_id, {
    reply_to_message_id: message.id,
    text: detailedHelpText,
    link_preview: true,
  });
}
