import type {
  animeItem,
  anime as animeType,
  BtData as BtDataType,
  BtEntry,
} from "../types/anime.ts";
import { parseMarkdownToFormattedText } from "../TDLib/function/parseMarkdown.ts";

/**
 * 生成导航消息文本（首条带图，1024 文本长度限制；资源分条纯文本，每条 4096 文本长度限制）
 * - 超限时优先压缩 summary（最低压到 100 字符）
 * - 仍超限则移除首条中的资源区，并把资源分页输出到后续消息
 * - 无资源时不显示资源
 */
export function navmegtext(anime: animeType): string[] {
  const messages: string[] = [];
  const sections = formatBtData(anime.btdata || {}); // 资源段

  // 构造首条消息（可选择是否包含资源区、summary 最大长度）
  const buildMain = (summaryMaxLen: number, includeResources: boolean) => {
    const title = `${animeDate(anime.airingStart)} ${NSFW(anime.r18)} ${
      anime.name || anime.name_cn
    }`;
    const baseInfo =
      `\n> 中文名称: ${anime.name_cn}\n` +
      `> 本季话数: ${anime.episode || "未知"}\n` +
      `> 放送开始: ${anime.airingStart || "未知"}\n` +
      `> 放送星期: ${anime.airingDay || "未知"}\n` +
      `> 动漫评分: [${anime.score || "未知"}](https://bgm.tv/subject/${
        anime.id
      }/stats)` +
      `${getBeijingDate()}`;

    const summaryPart = summaryTrim(anime.summary, anime.id, summaryMaxLen);

    // 资源区：只有在 includeResources 且确有资源时才显示
    const hasResources = includeResources && sections.length > 0;
    const resourcesPart = hasResources
      ? `\n\n资源:\n${sections.join("\n")}`
      : "";

    const tagsPart = `\n\n标签: ${formatTags(anime.tags || [])}`;

    return `${title}${baseInfo}${summaryPart}${resourcesPart}${tagsPart}`;
  };

  // 1) 先尝试包含资源区 + 默认 summary 长度
  let includeResources = sections.length > 0;
  let summaryMax = 300;
  let main = buildMain(summaryMax, includeResources);
  if (measureTextLen(main) > 1024) {
    // 2) 逐步压缩 summary 至少到 100
    const steps = [250, 200, 150, 120, 100];
    for (const len of steps) {
      summaryMax = len;
      const candidate = buildMain(summaryMax, includeResources);
      if (measureTextLen(candidate) <= 1024) {
        main = candidate;
        break;
      } else {
        main = candidate;
      }
    }
  }

  // 3) 若仍超 1024，则移除资源区放入分页
  if (measureTextLen(main) > 1024 && includeResources) {
    includeResources = false;
    main = buildMain(summaryMax, includeResources);
  }

  messages.push(main);

  // 4) 构造资源分页（仅当资源被移除或原本就不放在首条时）
  if (!includeResources && sections.length > 0) {
    const pages = buildResourcePages(anime, sections);
    messages.push(...pages);
  }

  return messages;
}

/** 获取纯文本长度（Markdown 转换后） */
function measureTextLen(md: string): number {
  const { text } = parseMarkdownToFormattedText(md);
  if (!text) {
    throw new Error("解析 Markdown 失败，无法获取纯文本长度");
  }
  return text.length;
}

/** 构造资源分页（每页 4096 文本长度限制） */
function buildResourcePages(anime: animeType, sections: string[]): string[] {
  const title = `${anime.name || anime.name_cn}\n\n资源:\n`;
  const pages: string[] = [];

  let currentBody = "";
  const pushPage = () => {
    if (currentBody.trim().length === 0) return;
    pages.push(`${title}${currentBody.trim()}`);
    currentBody = "";
  };

  // 逐段（再按行）装入，确保每页不超过 4096
  for (const sec of sections) {
    const lines = sec.split("\n");
    for (const line of lines) {
      const candidateBody = currentBody ? `${currentBody}\n${line}` : line;
      const candidatePage = `${title}${candidateBody}`;
      if (measureTextLen(candidatePage) > 4096) {
        // 当前页已满，先提交当前页，再将本行作为新页的起始
        pushPage();

        // 若单行本身已超限，仍需强制放入（极端情况），避免死循环
        const singleLinePage = `${title}${line}`;
        if (measureTextLen(singleLinePage) > 4096) {
          pages.push(singleLinePage);
          currentBody = "";
        } else {
          currentBody = line;
        }
      } else {
        currentBody = candidateBody;
      }
    }
  }
  pushPage();

  // 添加翻页提示（单页不显示）
  if (pages.length <= 1) return pages;

  return pages.map((p, i) => {
    const hasPrev = i > 0;
    const hasNext = i < pages.length - 1;

    // 仅在需要时添加提示
    const footer =
      (hasPrev ? "上一页" : "") +
      (hasPrev && hasNext ? "\n" : "") +
      (hasNext ? "下一页" : "");

    if (!footer) return p;

    const withFooter = `${p}\n\n${footer}`;
    if (measureTextLen(withFooter) <= 4096) return withFooter;

    // 若加提示超限，则不加提示，保正文完整
    return p;
  });
}

/** 格式化 时间 #<时间> */
function animeDate(time: string | undefined) {
  const titleTag =
    (time ? "#" : "") +
    (time ? time.replace(/(\d{4})年(\d{1,2})月.*/, "$1年$2月") : "");
  return titleTag;
}

/** 格式化 NSFW #NSFW */
function NSFW(nsfw: boolean | null | undefined) {
  return nsfw ? "#NSFW" : "";
}

/** 格式化 动漫介绍 */
function summaryTrim(summary: string | undefined, id: number, maxLen = 300) {
  if (!summary || !summary.trim()) return "";
  const cleanSummary = summary.replace(/\\n/g, "\n").replace(/\n{2,}/g, "\n");
  const truncatedSummary =
    cleanSummary.length > maxLen
      ? cleanSummary.substring(0, maxLen) +
        `[...详细](https://bgm.tv/subject/${id})`
      : cleanSummary;
  return `\n\n介绍:\n>> ${truncatedSummary.replace(/\n/g, "\n>> ")}`;
}

/** 获取当前北京时间，格式为 yyyy-MM-dd */
export function getBeijingDate() {
  const now = new Date();
  // 东八区偏移（分钟）
  const beijingOffset = 8 * 60;
  const localOffset = now.getTimezoneOffset();
  const beijingTime = new Date(
    now.getTime() + (beijingOffset + localOffset) * 60000
  );

  const y = beijingTime.getFullYear();
  const m = String(beijingTime.getMonth() + 1).padStart(2, "0");
  const d = String(beijingTime.getDate()).padStart(2, "0");

  return `(${y}-${m}-${d})`;
}

/**
 * 将 BtDataType 格式化为字符串数组
 */
export function formatBtData(btdata: BtDataType): string[] {
  if (!btdata || typeof btdata !== "object") return [];

  return Object.entries(btdata).map(([key, entries]) => {
    const line = entries
      // 过滤掉没有链接的
      .filter((entry) => entry.Message?.link || entry.TGMegLink)
      // 排序
      .sort(compareEpisode)
      // 格式化输出
      .map((entry) => {
        const link = entry.Message?.link ?? entry.TGMegLink!;
        return `[${entry.episode}](${link})`;
      })
      .join(" | ");

    return `#${key}\n${line}`;
  });
}

/**
 * 解析集数字符串，提取数字、版本、特殊剧集类型
 */
function parseEpisode(
  ep: string
):
  | { type: "num"; num: number; version: string }
  | { type: "sp"; num: number }
  | { type: "other"; raw: string } {
  const match = ep.match(/^(\d+)(v\d+)?$/i);
  if (match)
    return {
      type: "num",
      num: parseInt(match[1], 10),
      version: match[2] ?? "",
    };

  const spMatch = ep.match(/^SP(\d+)$/i);
  if (spMatch) return { type: "sp", num: parseInt(spMatch[1], 10) };

  const specialMatch = ep.match(/^特别篇(\d+)$/);
  if (specialMatch) return { type: "sp", num: parseInt(specialMatch[1], 10) };

  return { type: "other", raw: ep };
}

/**
 * 集数比较函数
 * 支持数字集数、版本号、SP、特别篇及非数字集
 * 排序规则：
 * 1. 数字集数优先，按数字升序
 * 2. 数字相同，按版本号排序 (如 03 < 03v2)
 * 3. 特殊集 (SP, 特别篇) 紧跟在数字集数后面
 * 4. 其他（电影、剧场版等）排在最后
 */
function compareEpisode(a: BtEntry, b: BtEntry): number {
  const ea = parseEpisode(a.episode);
  const eb = parseEpisode(b.episode);

  if (ea.type === "num" && eb.type === "num") {
    if (ea.num !== eb.num) return ea.num - eb.num;
    return ea.version.localeCompare(eb.version); // version 已经保证是 string
  }

  if (ea.type === "num" && eb.type === "sp") {
    if (ea.num !== eb.num) return ea.num - eb.num;
    return -1;
  }
  if (ea.type === "sp" && eb.type === "num") {
    if (ea.num !== eb.num) return ea.num - eb.num;
    return 1;
  }

  if (ea.type === "sp" && eb.type === "sp") {
    return ea.num - eb.num;
  }

  if (ea.type !== "other" && eb.type === "other") return -1;
  if (ea.type === "other" && eb.type !== "other") return 1;

  return 0;
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

// ----------------------------------------------------------------

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
> 原名称: ${anime.name}
> 中文名: ${anime.name_cn}
> 发布组: ${formatTags(item.fansub?.map((f) => safeTag(f)) || [])}${
    item.pubDate ? `\n> 发布时间: ${item.pubDate}` : ""
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
    anime.navMessage?.link || anime.navMessageLink
      ? ` \n\n[番剧信息](${anime.navMessage?.link || anime.navMessageLink})`
      : ""
  }`;

  return text;
}
