import fs from "fs/promises";

import logger from "../log/index.js";

import {
  updateAnimeNavMessageLink,
  updateAnimeScore,
  updateTorrentStatus,
} from "../database/update.js";

import { editMessageCaption, sendMessage } from "../TDLib/function/message.js";
import { parseMarkdownToFormattedText } from "../TDLib/function/index.js";
import { getAnimeById } from "../database/query.js";
import { AnimeText, navmegtext } from "./text.js";
import { getSubjectById } from "./info.js";
import { getMessageLink, getMessageLinkInfo } from "../TDLib/function/get.js";
import { downloadFile, extractVideoMetadata } from "../function/index.js";

import type { animeItem, anime as animeType } from "../types/anime.js";

/**
 * 发送/更新 导航频道的消息
 * @param id - 数据库中动漫的id字段值
 * @returns 导航消息链接
 */
export async function sendMegToNavAnime(id: number) {
  const Anime = await getAnimeById(id);

  if (!Anime) return;

  // 导航频道中有该番剧，编辑现有消息
  if (Anime.navMessageLink) {
    // 更新评分
    const Subject = await getSubjectById(Anime.id);
    const score = Subject?.rating?.score || "*";

    updateAnimeScore(Anime.id, score);

    Anime.score = score;

    const navmeg = await getMessageLinkInfo(Anime.navMessageLink);

    if (!navmeg.message) {
      logger.error(`导航消息链接无效: ${Anime.navMessageLink}`);
      return;
    }
    if (
      navmeg.message.content._ === "messagePhoto" &&
      navmeg.message.content.caption ===
        parseMarkdownToFormattedText(navmegtext(Anime))
    ) {
      // 内容未变无需更新
      return;
    }

    await editMessageCaption({
      chat_id: navmeg.chat_id,
      message_id: navmeg.message.id,
      invoke: {
        caption: parseMarkdownToFormattedText(navmegtext(Anime)),
      },
    });

    return Anime.navMessageLink;
  }

  // 导航频道中没有的番剧，新动漫发送逻辑
  let navmeg = null;
  let localImagePath = null;

  // 首先尝试使用远程图片
  navmeg = await sendMessage(Number(process.env.NAV_CHANNEL), {
    invoke: {
      input_message_content: {
        _: "inputMessagePhoto",
        photo: {
          _: "inputFileRemote",
          id: Anime.image,
        },
        caption: parseMarkdownToFormattedText(navmegtext(Anime)),
      },
    },
  });
  // 如果远程图片发送失败，尝试下载到本地
  if (!navmeg) {
    try {
      const localImagePath = await downloadFile(Anime.image);

      // 使用本地图片发送
      navmeg = await sendMessage(Number(process.env.NAV_CHANNEL), {
        invoke: {
          input_message_content: {
            _: "inputMessagePhoto",
            photo: {
              _: "inputFileLocal",
              path: localImagePath,
            },
            caption: parseMarkdownToFormattedText(navmegtext(Anime)),
          },
        },
      });
    } catch (localError) {
      logger.error(`本地图片上传也失败: ${Anime.image}`, localError);
      throw localError;
    } finally {
      // 清理本地图片文件
      if (localImagePath) {
        await fs.unlink(localImagePath).catch(() => {});
      }
    }
  }

  if (!navmeg) {
    throw new Error("发送导航消息失败");
  }

  // 获取导航频道消息链接并保存到数据库
  const navLink = await getMessageLink(navmeg.chat_id, navmeg.id);
  await updateAnimeNavMessageLink(Anime.id, navLink.link);
  return navLink.link;
}

/**
 * 发送动漫视频到动漫频道
 * @param anime - 数据库中动漫详细信息
 * @param item - 动漫在BT站中的信息
 * @param videoPath - 种子完整信息
 * @param newAnime - 是否为待发送的新动漫
 */
export async function sendMegToAnime(
  anime: animeType,
  item: animeItem,
  videoPath: string,
  newAnime = false
) {
  const text = parseMarkdownToFormattedText(AnimeText(anime, item));

  await updateTorrentStatus(item.title, "上传中");
  const videoInfo = await extractVideoMetadata(videoPath);

  if (newAnime) {
    const animeMessage = await sendMessage(Number(process.env.ADMIN_GROUP_ID), {
      invoke: {
        message_thread_id: Number(process.env.ANIME_GROUP_THREAD_ID),
        input_message_content: {
          _: "inputMessageVideo",
          video: {
            _: "inputFileLocal",
            path: videoPath,
          },
          cover: {
            _: "inputFileLocal",
            path: videoInfo.coverPath,
          },
          width: videoInfo.width,
          height: videoInfo.height,
          duration: Math.floor(videoInfo.duration),
          supports_streaming: true,
          caption: text,
          has_spoiler: anime?.r18 === true || false,
        },
      },
    });
    await updateTorrentStatus(item.title, "等待纠正");

    fs.unlink(videoPath).catch(() => {});
    fs.unlink(videoInfo.coverPath).catch(() => {});
    return animeMessage;
  }
  const animeMessage = await sendMessage(Number(process.env.ANIME_CHANNEL), {
    invoke: {
      input_message_content: {
        _: "inputMessageVideo",
        video: {
          _: "inputFileLocal",
          path: videoPath,
        },
        cover: {
          _: "inputFileLocal",
          path: videoInfo.coverPath,
        },
        width: videoInfo.width,
        height: videoInfo.height,
        duration: Math.floor(videoInfo.duration),
        supports_streaming: true,
        caption: text,
        has_spoiler: anime?.r18 === true || false,
      },
    },
  });
  await updateTorrentStatus(item.title, "完成");
  fs.unlink(videoPath).catch(() => {});
  fs.unlink(videoInfo.coverPath).catch(() => {});
  return animeMessage;
}
