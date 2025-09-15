import type {
  animeItem,
  anime as animeType,
  BtData as BtDataType,
  BtEntry,
} from "../types/anime.ts";

/**
 * 生成导航消息文本
 * @param newanime - 数据库中动漫详细信息
 * @returns - 格式化后的导航消息文本
 */
export function navmegtext(newanime: animeType) {
  const summarySection =
    newanime.summary && newanime.summary.trim()
      ? (() => {
          const cleanSummary = newanime.summary.replace(/\\n/g, "\n");
          const truncatedSummary =
            cleanSummary.length > 100
              ? cleanSummary.substring(0, 100) +
                `[...详细](https://bgm.tv/subject/${newanime.id})`
              : cleanSummary;
          return `\n\n介绍:\n>> ${truncatedSummary}`;
        })()
      : "";

  // 判断btdata是否存在且有效
  const resourceSection =
    newanime.btdata && typeof newanime.btdata === "object"
      ? `\n\n资源:> ${formatBtData(newanime.btdata)}`
      : "";

  const titleTag =
    (newanime.airingStart ? "#" : "") +
    (newanime.airingStart
      ? newanime.airingStart.replace(/(\d{4})年(\d{1,2})月.*/, "$1年$2月")
      : "");
  const text = `${titleTag} ${
    newanime.name || newanime.name_cn
  }\n> [中文名称]: ${newanime.name_cn}\n> [本季话数]:${
    newanime.episode || "未知"
  }\n[放送开始]: ${newanime.airingStart || "未知"}\n> [放送星期]: ${
    newanime.airingDay || "未知"
  }\n[动漫评分]: [${newanime.score || "未知"}](https://bgm.tv/subject/${
    newanime.id
  }/stats) (${(() => {
    // 获取当前北京时间
    const now = new Date();
    // 转为东八区
    const beijingOffset = 8 * 60;
    const localOffset = now.getTimezoneOffset();
    const beijingTime = new Date(
      now.getTime() + (beijingOffset + localOffset) * 60000
    );
    // 格式化为 yyyy-MM-dd
    const y = beijingTime.getFullYear();
    const m = String(beijingTime.getMonth() + 1).padStart(2, "0");
    const d = String(beijingTime.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })()})${summarySection}${resourceSection}\n\n标签:\n>> ${
    newanime.tags ? formatTags(newanime.tags) : ""
  }`;
  return text;
}

/**
 * 生成动漫信息文本
 * @param anime - 数据库中动漫详细信息
 * @param item - 动漫在BT站中的信息
 * @returns - 格式化后的动漫信息文本
 */
export function AnimeText(anime: animeType, item: animeItem) {
  const nsfwTag = anime.r18 === true ? "#NSFW " : "";
  const text = `#${
    anime.airingStart
      ? anime.airingStart.replace(/(\d{4})年(\d{1,2})月.*/, "$1年$2月")
      : ""
  } ${nsfwTag} ${item.title}
> [原名称]: ${anime.name}
> [中文名]: ${anime.name_cn}
> [发布组]：${formatTags(item.fansub?.map((f) => safeTag(f)) || [])}${
    item.pubDate ? `\n> [发布时间]: ${item.pubDate}` : ""
  }
\n\n追踪标签：
> 名称: #${safeTag(anime.name_cn || anime.name)}
> 番剧组: ${item.fansub
    ?.map(
      (f) =>
        `#${safeTag(f.replace(/\s+/g, "_"))}_${safeTag(
          anime.name_cn || anime.name
        )}`
    )
    .join(" ")}${
    anime.navMessageLink ? ` \n\n[番剧信息](${anime.navMessageLink})` : ""
  }`;

  return text;
}

function formatBtData(btdata: BtDataType) {
  if (!btdata || typeof btdata !== "object") return "";

  // 集数排序函数：提取数字部分并按数值排序，同时保持版本号顺序
  function sortEpisodes(episodes: BtEntry[]) {
    return episodes.sort((a, b) => {
      const episodeA = a.episode || "";
      const episodeB = b.episode || "";

      // 提取主要集数数字和版本信息
      const matchA = episodeA.match(/^(\d+)(.*)$/);
      const matchB = episodeB.match(/^(\d+)(.*)$/);

      if (matchA && matchB) {
        const numA = parseInt(matchA[1], 10);
        const numB = parseInt(matchB[1], 10);

        // 先按集数数字排序
        if (numA !== numB) {
          return numA - numB;
        }

        // 集数相同时，按版本信息排序（如 03 < 03v2）
        const suffixA = matchA[2] || "";
        const suffixB = matchB[2] || "";
        return suffixA.localeCompare(suffixB);
      }

      // 如果无法提取数字，则按字符串排序
      return episodeA.localeCompare(episodeB);
    });
  }

  return Object.entries(btdata)
    .map(([fansub, episodes]) => {
      const sortedEpisodes = sortEpisodes([...episodes]); // 创建副本避免修改原数组
      const links = sortedEpisodes
        .map((ep) =>
          ep.TGMegLink ? `[${ep.episode}](${ep.TGMegLink})` : ep.episode
        )
        .join(" | ");
      return `> [#${safeTag(fansub)}]\n> ${links}`;
    })
    .join("\n"); // 每个字幕组之间空一行更清晰
}

function formatTags(tags: string[]) {
  if (!Array.isArray(tags)) return "";

  return tags
    .map((t) => safeTag(t)) // 对每个标签进行格式化
    .filter((t) => t && !/^\d+$/.test(t)) // 过滤掉空值和纯数字标签
    .map((t) => `#${t}`)
    .join(" ");
}
function safeTag(text: string) {
  text = String(text ?? "");
  return text
    .trim()
    .replace(/\s+/g, "")
    .replace(
      /[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Latin}0-9_]/gu,
      ""
    )
    .replace(/[-❀]/g, "");
}
