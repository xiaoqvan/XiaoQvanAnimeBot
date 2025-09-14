import type { message as messageType } from "tdlib-types";
import {
  deleteMessage,
  editMessageMedia,
  editMessageText,
  sendMessage,
} from "../TDLib/function/message.js";
import logger from "../log/index.js";
import { isUserAdmin } from "../TDLib/function/index.js";
import { getAnimeById } from "../database/query.js";
import { fetchBangumiTorrent, getSubjectById } from "../anime/info.js";
import {
  extractFilteredTagNames,
  extractInfoFromInfobox,
} from "../anime/index.js";

import { anime, BtData } from "../types/anime.js";
import { getMessageLinkInfo } from "../TDLib/function/get.js";
import { navmegtext } from "../anime/text.js";
/**
 * 处理动漫信息纠正命令
 * @param {object} message - 消息对象
 * @param {string[]} commandParts - 命令参数数组
 */
export async function handleCorrectAnime(
  message: messageType,
  commandParts: string[]
) {
  // 检查 chat_id 是否为指定值（管理员权限）
  // 检查是否为管理员
  const isAdmin = await isUserAdmin(
    Number(process.env.ADMIN_GROUP_ID),
    message.sender_id
  );
  const isBotAdmin =
    message.sender_id._ === "messageSenderUser" &&
    message.sender_id.user_id === Number(process.env.BOT_ADMIN_ID);
  const chatId = message.chat_id;

  if (!isAdmin || !isBotAdmin) {
    return;
  }

  try {
    // 检查参数数量 - 只支持纠正模式
    if (commandParts.length !== 3) {
      await sendMessage(chatId, {
        text: "❌ 用法错误！\n\n**纠正模式**:\n`/correctanime <旧ID> <新ID>` - 纠正动漫信息\n\n**示例**:\n`/correctanime 12345 67890`\n\n💡 **提示**: 使用 `/searchanime` 搜索动漫，使用 `/getanime <ID>` 查看详细信息",
      });
      return;
    }

    const oldId = commandParts[1];
    const newId = commandParts[2];
    await correctAnimeInfo(chatId, Number(oldId), Number(newId), message);
  } catch (error) {
    logger.error("处理动漫纠正命令时出错:", error);
    await sendMessage(chatId, { text: "❌ 处理命令时出错，请稍后再试。" });
  }
}

/**
 * 纠正动漫信息
 * @param chatId - 聊天ID
 * @param oldId - 旧的动漫ID
 * @param newId - 新的动漫ID
 */
async function correctAnimeInfo(
  chatId: number,
  oldId: number,
  newId: number,
  message: messageType
) {
  try {
    // 检查旧ID对应的动漫是否存在
    const oldAnime = await getAnimeById(Number(oldId));
    if (!oldAnime) {
      await sendMessage(chatId, {
        text: `❌ 未找到ID为 \`${oldId}\` 的动漫。`,
      });
      return;
    }

    // 获取新ID对应的动漫信息
    let newAnimeData;
    try {
      newAnimeData = await getSubjectById(newId);
    } catch {
      await sendMessage(chatId, {
        text: `❌ 无法从BGM.TV获取ID为 \`${newId}\` 的动漫信息。请检查ID是否正确。`,
      });
      return;
    }

    // 提取infobox信息
    const infobox = extractInfoFromInfobox(newAnimeData.infobox || []);

    // 检查目标ID是否已在数据库中存在
    const existingTargetAnime = await getAnimeById(Number(newId));

    // 构建更新数据 - 完全覆盖别名和标签，不保留旧数据
    const updateData: anime = {
      id: newAnimeData.id,
      name_cn: newAnimeData.name_cn || infobox.name,
      name: newAnimeData.name,
      names: [
        ...new Set(
          [newAnimeData.name_cn, newAnimeData.name, ...infobox.names].filter(
            (x): x is string => Boolean(x)
          )
        ),
      ],
      image:
        newAnimeData.images?.large ||
        newAnimeData.images?.medium ||
        newAnimeData.images?.common ||
        "https://dummyimage.com/350x600/cccccc/ffffff&text=%E6%97%A0%E5%B0%81%E9%9D%A2",
      summary: newAnimeData.summary
        ? newAnimeData.summary
            .replace(/\r\n/g, "\\n")
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\n")
        : undefined,
      tags: (await extractFilteredTagNames(newAnimeData.tags || [])) || [],
      episode: infobox.episodeCount || undefined,
      score: newAnimeData.rating?.score,
      airingDay: infobox.broadcastDay || undefined,
      airingStart: infobox.broadcastStart || undefined,
      updatedAt: new Date(),
    };

    let result; // 修复：提前声明
    let updateTargetData = updateData; // 默认赋值
    if (existingTargetAnime) {
      // 合并btdata
      const mergedBtdata = mergeBtdata(
        oldAnime.btdata,
        existingTargetAnime.btdata
      );
      // 构建新数据
      updateTargetData = {
        ...updateData,
        btdata: mergedBtdata,
        navMessageLink:
          existingTargetAnime.navMessageLink || oldAnime.navMessageLink,
      };
      // 更新目标ID的数据
      result = await updateAnimeInfo(newId, updateTargetData);
      // 删除旧ID的数据
      await updateAnimeInfo(oldId, { deleted: true }); // 或者用你的删除方法
    } else {
      // 目标ID不存在，正常更新旧ID为新数据
      result = await updateAnimeInfo(oldId, updateData);
    }

    if (result.success) {
      // 发送成功消息
      const successMessage =
        `✅ **动漫信息纠正成功！**\n\n` +
        `**旧ID**: \`${oldId}\`\n` +
        `**新ID**: \`${newId}\`\n` +
        (existingTargetAnime
          ? `\n🔀 **检测到目标ID已存在，已自动合并数据**\n`
          : `\n`) +
        `**更新的信息**:\n` +
        `• **中文名**: ${updateTargetData.name_cn || "未知"}\n` +
        `• **原名**: ${updateTargetData.name || "未知"}\n` +
        `• **别名**: ${
          updateTargetData.names.length > 0
            ? updateTargetData.names.join(", ")
            : "无"
        }\n` +
        `• **集数**: ${updateTargetData.episode || "未知"}\n` +
        `• **评分**: ${updateTargetData.score || "未知"}\n` +
        `• **放送星期**: ${updateTargetData.airingDay || "未知"}\n` +
        `• **放送开始**: ${updateTargetData.airingStart || "未知"}\n` +
        `• **标签数量**: ${updateTargetData.tags.length}\n` +
        (updateTargetData.btdata
          ? `• **字幕组数量**: ${Object.keys(updateTargetData.btdata).length}`
          : "");

      await sendMessage(chatId, {
        reply_to_message_id: message.id,
        text: successMessage,
        link_preview: true,
      });
      if (existingTargetAnime && oldId !== newId) {
        const messageLinkInfo = await getMessageLinkInfo(
          oldAnime.navMessageLink
        );
        try {
          deleteMessage(
            messageLinkInfo.message.chat_id,
            messageLinkInfo.message.id
          );
        } catch {
          editMessageText({
            chat_id: messageLinkInfo.message.chat_id,
            message_id: messageLinkInfo.message.id,
            text: parseMarkdownToFormattedText(
              `#需要删除的消息 ?\n\nID: \`${oldId}\`\nNEW ID: \`${newId}\``
            ),
          });
          sendMessage(chatId, {
            reply_to_message_id: message.id,
            text: `删除消息失败，请手动删除旧ID的导航消息 ${oldAnime.navMessageLink}`,
          });
        }
      }

      // 更新导航消息
      if (result.updatedAnime && result.updatedAnime.navMessageLink) {
        const text = navmegtext(result.updatedAnime);

        try {
          const navmeg = await getMessageLinkInfo(
            result.updatedAnime.navMessageLink
          );
          await global.client.invoke({
            _: "editMessageMedia",
            chat_id: navmeg.message.chat_id,
            message_id: navmeg.message.id,
            text: parseMarkdownToFormattedText(text),
            input_message_content: {
              _: "inputMessagePhoto",
              photo: {
                _: "inputFileRemote",
                id: result.updatedAnime.image,
              },
            },
          });
          await editMessageMedia({
            chat_id: navmeg.message.chat_id,
            message_id: navmeg.message.id,
            media: {
              photo: {
                id: result.updatedAnime.image,
              },
            },
          });
        } catch (navError) {
          logger.error("更新导航消息失败:", navError);
        }
      }

      await updateAssociatedVideoMessages(result.updatedAnime, message);
    } else {
      await sendMessage(chatId, {
        reply_to_message_id: message.id,
        text: "❌ 更新失败，可能是数据没有变化。",
      });
    }
  } catch (error) {
    logger.error("纠正动漫信息时出错:", error);
    await sendMessage(chatId, { text: "❌ 处理时出错，请稍后再试。" });
  }
}

/**
 * 合并两个动漫的btdata
 * @param sourceBtdata - 源动漫的btdata
 * @param targetBtdata - 目标动漫的btdata
 * @returns 合并后的btdata
 */
function mergeBtdata(sourceBtdata: BtData, targetBtdata: BtData) {
  const merged = {};

  // 首先复制目标动漫的btdata
  if (targetBtdata && typeof targetBtdata === "object") {
    for (const [fansub, episodes] of Object.entries(targetBtdata)) {
      if (Array.isArray(episodes)) {
        merged[fansub] = [...episodes];
      }
    }
  }

  // 然后合并源动漫的btdata
  if (sourceBtdata && typeof sourceBtdata === "object") {
    for (const [fansub, episodes] of Object.entries(sourceBtdata)) {
      if (!Array.isArray(episodes)) continue;

      if (merged[fansub]) {
        // 如果字幕组已存在，合并集数数据，避免重复
        const existingEpisodes = merged[fansub];
        const existingBTids = new Set(existingEpisodes.map((ep) => ep.BTid));

        // 添加不重复的集数
        for (const episode of episodes) {
          if (episode.BTid && !existingBTids.has(episode.BTid)) {
            existingEpisodes.push(episode);
          }
        }

        // 按集数排序
        merged[fansub].sort((a, b) => {
          const episodeA = a.episode || "";
          const episodeB = b.episode || "";

          // 提取数字部分进行数值比较
          const numA = parseInt(episodeA.match(/\d+/)?.[0] || "0", 10);
          const numB = parseInt(episodeB.match(/\d+/)?.[0] || "0", 10);

          return numA - numB;
        });
      } else {
        // 如果字幕组不存在，直接添加
        merged[fansub] = [...episodes];
      }
    }
  }

  return merged;
}

/**
 * 更新所有关联的视频消息
 * @param {object} anime - 更新后的动漫数据
 * @param {object} message - 消息对象
 */
async function updateAssociatedVideoMessages(
  anime: anime,
  message: messageType
) {
  if (!anime.btdata || typeof anime.btdata !== "object") {
    // 更新消息显示没有需要更新的视频
    try {
      await sendMessage(message.chat_id, {
        reply_to_message_id: message.id,
        text: "✅ 没有需要更新的视频消息。",
      });
    } catch (error) {
      logger.error("更新消息失败:", error);
    }
    return;
  }

  // 统计总的视频消息数量
  const text = {
    totalMessages: 0, // 总消息数
    processedMessages: 0, // 已处理消息数
    successCount: 0, // 成功数
    failCount: 0, // 失败数
    failDetails: [], // 失败详情
  };
  // 先统计总数
  for (const [_, episodes] of Object.entries(anime.btdata)) {
    if (!Array.isArray(episodes)) continue;
    for (const episodeData of episodes) {
      if (episodeData.TGMegLink) {
        text.totalMessages++;
      }
    }
  }

  const editTips = await sendMessage(message.chat_id, {
    reply_to_message_id: message.id,
    text: updateEditTip(text),
  });

  // 遍历所有字幕组的数据
  // 遍历所有字幕组的数据
  for (const [_, episodes] of Object.entries(anime.btdata)) {
    if (!Array.isArray(episodes)) continue;

    // 遍历该字幕组的所有集数
    for (const episodeData of episodes) {
      if (!episodeData.TGMegLink) continue;

      text.processedMessages++;

      // 更新当前处理的消息
      try {
        await editMessageText({
          chat_id: editTips.chat_id,
          message_id: editTips.id,
          text: updateEditTip(text),
        });
      } catch (error) {
        logger.error("更新进度消息失败:", error);
      }

      // 从标题中提取字幕组名称
      let fansub = null;
      const match = episodeData.title.match(/^(?:\[([^\]]+)\]|【([^】]+)】)/);
      if (!match) {
        continue; // 跳过无法解析的条目
      }
      if (match) {
        const raw = match[1] || match[2];
        fansub = raw
          .split(/\s*[&/|｜、]\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      // 构建 item 对象，模拟 RSS 项格式
      const item = {
        title: episodeData.title,
        episode: episodeData.episode,
        fansub: fansub,
        pubDate: null,
      };

      if (episodeData.BTid) {
        const torrent = await fetchBangumiTorrent(episodeData.BTid);
        if (!torrent) {
          item.pubDate = formatPublishTime(torrent.publish_time); // 使用BTid作为pubDate
        }
      }

      // 生成新的动漫文本
      const animeText = parseMarkdownToFormattedText(AnimeText(anime, item));

      // 获取消息信息并更新
      const messageLinkInfo = await getMessageLinkInfo(episodeData.TGMegLink);
      if (!messageLinkInfo.message) {
        text.failDetails.push(
          `[${fansub}] [第${episodeData.episode}集](<${episodeData.TGMegLink}>): 消息不存在或者没有找到`
        );
        text.failCount++;
        continue;
      }

      if (messageLinkInfo.message.content.caption.text === animeText.text) {
        // 如果文本没有变化，跳过编辑
        text.successCount++;
        continue;
      }
      try {
        await global.client.invoke({
          _: "editMessageCaption",
          chat_id: messageLinkInfo.message.chat_id,
          message_id: messageLinkInfo.message.id,
          caption: animeText,
        });
      } catch (error) {
        text.failDetails.push(
          `[${fansub}] [第${episodeData.episode}集](<${
            episodeData.TGMegLink
          }>): ${error?.message || error}`
        );
        text.failCount++;
        continue;
      }

      text.successCount++;

      // 添加小延迟避免请求过于频繁
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    // 更新当前处理的消息
    try {
      await client.invoke({
        _: "editMessageText",
        chat_id: editTips.chat_id,
        message_id: editTips.id,
        input_message_content: {
          _: "inputMessageText",
          text: parseMarkdownToFormattedText(updateEditTip(text)),
        },
      });
    } catch (error) {
      logger.error("更新进度消息失败:", error);
    }
  }
  return;
}

function updateEditTip(text) {
  let errortext = "";
  if (text.failCount > 0) {
    errortext = `❌ **失败**: ${
      text.failCount
    } 个\n**失败原因**: ${text.failDetails.join(", ")}\n\n`;
  }

  const messageText = `🔄 **正在更新关联的视频消息**\n\n📊 **进度**: ${text.processedMessages}/${text.totalMessages}\n✅ **成功**: ${text.successCount}\n ${errortext}`;
  return messageText;
}
