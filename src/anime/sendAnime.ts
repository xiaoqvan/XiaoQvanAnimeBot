import fs from "fs/promises";

import logger from "../log/index.ts";

import {
  updateAnimeNavMessage,
  // updateAnimeNavMessageLink, // 不再使用链接单独更新
  updateAnimeNavVideoMessage, // 新增
  updateAnimeScore,
  updateTorrentStatus,
} from "../database/update.ts";

import { editMessageCaption, sendMessage } from "../TDLib/function/message.ts";
import { getAnimeById } from "../database/query.ts";
import { AnimeText, navmegtext } from "./text.ts";
import { getSubjectById } from "./info.ts";
import { getMessageLink, getMessageLinkInfo } from "../TDLib/function/get.ts";
import { downloadFile, extractVideoMetadata } from "../function/index.ts";
import { parseMarkdownToFormattedText } from "../TDLib/function/parseMarkdown.ts";

import type { animeItem, anime as animeType } from "../types/anime.ts";

/**
 * 发送/更新 导航频道的消息
 * @param id - 数据库中动漫的id字段值
 * @returns 导航消息链接
 */
export async function sendMegToNavAnime(id: number) {
  const Anime = await getAnimeById(id);

  if (!Anime) return;

  if (Anime.navMessageLink) {
    const navmeg = await getMessageLinkInfo(Anime.navMessageLink);

    if (!navmeg || !navmeg.message) {
      throw new Error("导航频道消息链接无效");
    }

    // 导航频道有旧消息，进行新消息适配
    const newMeg = {
      chat_id: navmeg.chat_id,
      message_id: navmeg.message.id,
      thread_id: navmeg.message_thread_id,
      link: Anime.navMessageLink,
    };
    await updateAnimeNavMessage(Anime.id, newMeg);
  }

  // 导航频道中有该番剧，编辑现有消息
  if (Anime.navMessage?.link) {
    // 更新评分
    const Subject = await getSubjectById(Anime.id);
    const score = Subject?.rating?.score || "*";

    updateAnimeScore(Anime.id, score);

    Anime.score = score;
    const megtexts = navmegtext(Anime); // megtexts[0] 为主导航，1.. 为资源
    await editMessageCaption({
      chat_id: Anime.navMessage.chat_id,
      message_id: Anime.navMessage.message_id,
      text: megtexts[0],
    });

    // 没有就发送新的，有就修改（并补足多出来的）
    const existingVideoMsgs = Anime.navVideoMessage ?? [];
    let idx = 1;

    if (existingVideoMsgs.length > 0) {
      // 先修改已有的
      for (const videoMeg of existingVideoMsgs) {
        if (idx >= megtexts.length) break;
        await editMessageCaption({
          chat_id: videoMeg.chat_id,
          message_id: videoMeg.message_id,
          text: megtexts[idx],
        });
        idx++;
      }
      // 如果 megtexts 有新增条目，则补发并写入数据库
      for (; idx < megtexts.length; idx++) {
        const videoMeg = await sendMessage(Anime.navMessage.chat_id, {
          invoke: {
            message_thread_id: Anime.navMessage.thread_id,
            input_message_content: {
              _: "inputMessageText",
              text: parseMarkdownToFormattedText(megtexts[idx]),
            },
          },
        });

        if (!videoMeg) {
          logger.error(
            "sendMegToNavAnime",
            `补发导航频道消息失败: ${Anime.navMessage.chat_id}, ${Anime.id}`
          );
          continue;
        }

        const navLink = await getMessageLink(videoMeg.chat_id, videoMeg.id);
        await updateAnimeNavVideoMessage(Anime.id, {
          page: idx, // 与 megtexts 的索引对应：1.. 为资源页
          chat_id: videoMeg.chat_id,
          message_id: videoMeg.id,
          thread_id: Anime.navMessage.thread_id,
          link: navLink.link,
        });
      }
    } else {
      // 没有历史视频消息，全部按顺序发送，并写入数据库
      for (idx = 1; idx < megtexts.length; idx++) {
        const videoMeg = await sendMessage(Anime.navMessage.chat_id, {
          invoke: {
            message_thread_id: Anime.navMessage.thread_id,
            input_message_content: {
              _: "inputMessageText",
              text: parseMarkdownToFormattedText(megtexts[idx]),
            },
          },
        });
        if (!videoMeg) {
          logger.error(
            "sendMegToNavAnime",
            `补发导航频道消息失败: ${Anime.navMessage.chat_id}, ${Anime.id}`
          );
          continue;
        }

        const navLink = await getMessageLink(videoMeg.chat_id, videoMeg.id);
        await updateAnimeNavVideoMessage(Anime.id, {
          page: idx,
          chat_id: videoMeg.chat_id,
          message_id: videoMeg.id,
          thread_id: Anime.navMessage.thread_id,
          link: navLink.link,
        });
      }
    }

    return Anime.navMessage?.link;
  }

  // 导航频道中没有的番剧，新动漫发送逻辑
  let navmeg = null;
  let localImagePath: string | null = null;
  const megtexts = navmegtext(Anime);

  // 首先尝试使用远程图片（caption 只使用首条 megtexts[0]）
  navmeg = await sendMessage(Number(process.env.NAV_CHANNEL), {
    invoke: {
      input_message_content: {
        _: "inputMessagePhoto",
        photo: {
          _: "inputFileRemote",
          id: Anime.image,
        },
        caption: parseMarkdownToFormattedText(megtexts[0]),
      },
    },
  });

  // 如果远程图片发送失败，尝试下载到本地
  if (!navmeg) {
    try {
      localImagePath = await downloadFile(Anime.image);

      // 使用本地图片发送
      navmeg = await sendMessage(Number(process.env.NAV_CHANNEL), {
        invoke: {
          input_message_content: {
            _: "inputMessagePhoto",
            photo: {
              _: "inputFileLocal",
              path: localImagePath,
            },
            caption: parseMarkdownToFormattedText(megtexts[0]),
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

  // 获取首条（图片）消息链接并写入 navMessage
  const navLink = await getMessageLink(navmeg.chat_id, navmeg.id);
  const navMessage = {
    chat_id: navmeg.chat_id,
    message_id: navmeg.id,
    thread_id: navmeg.message_thread_id,
    link: navLink.link,
  };
  await updateAnimeNavMessage(Anime.id, navMessage);

  // 继续发送后续文本消息，并写入 navVideoMessage
  for (let i = 1; i < megtexts.length; i++) {
    const videoMeg = await sendMessage(navmeg.chat_id, {
      invoke: {
        reply_to: {
          _: "inputMessageReplyToMessage",
          message_id: navmeg.id,
        },
        message_thread_id: navmeg.message_thread_id,
        input_message_content: {
          _: "inputMessageText",
          text: parseMarkdownToFormattedText(megtexts[i]),
        },
      },
    });

    if (!videoMeg) {
      logger.error(
        "sendMegToNavAnime",
        `补发导航频道消息失败: ${navmeg.chat_id}, ${Anime.id}, index=${i}`
      );
      continue;
    }

    const link = await getMessageLink(videoMeg.chat_id, videoMeg.id);
    await updateAnimeNavVideoMessage(Anime.id, {
      page: i,
      chat_id: videoMeg.chat_id,
      message_id: videoMeg.id,
      thread_id: navmeg.message_thread_id,
      link: link.link,
    });
  }

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
