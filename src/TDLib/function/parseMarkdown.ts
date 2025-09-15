import type {
  formattedText$Input,
  textEntity$Input,
  TextEntityType$Input,
} from "tdlib-types";
import { unified } from "unified";
import remarkParse from "remark-parse";
import logger from "../../log/index.ts";

/**
 * 将 Markdown 格式的文本解析为格式化文本
 * @param markdown - Markdown 格式的文本
 * @returns 包含格式化文本和实体信息的对象
 */
export function parseMarkdownToFormattedText(
  markdown: string
): formattedText$Input {
  const entities: textEntity$Input[] = [];
  let plainText = "";

  try {
    // 使用 remark-parse 解析 Markdown
    const processor = unified().use(remarkParse);
    const tree = processor.parse(markdown);

    // 遍历 AST 并构建格式化文本
    const result = processNode(tree, { depth: 0 });
    plainText = result.text;
    entities.push(...result.entities);
  } catch (error) {
    logger.error("parseMarkdownToFormattedText 解析失败:", error);
    // 如果解析失败，返回纯文本
    plainText = markdown;
  }

  return {
    _: "formattedText" as const,
    text: plainText,
    entities,
  };
}

// 列表不参与实体格式化，仅按纯文本重建

/**
 * 递归处理 MDAST 节点，将节点及其子节点转换为纯文本和 TDLib 文本实体列表。
 *
 * - 支持链接、行内代码、代码块、引用块、加粗、斜体、删除线等常见 Markdown 节点。
 * - 返回的实体的偏移量为相对于返回文本的起始位置（上层调用会在合并时调整偏移）。
 *
 * @param node - MDAST 节点或根节点
 * @param options.suppressBlockquoteWrap - 当为 true 时，禁止为引用块自动添加包裹实体（用于嵌套引用合并）
 * @returns 对象，包含解析后的 `text` 和 `entities`（用于 TDLib 的 `formattedText`）
 */

function processNode(
  node: any,
  options?: { depth?: number }
): {
  text: string;
  entities: textEntity$Input[];
} {
  const depth = options?.depth ?? 0;
  const entities: textEntity$Input[] = [];
  let text = "";
  if (node.type === "text") {
    return { text: node.value, entities: [] };
  }

  if (node.type === "link") {
    const childResult = node.children
      ? processNode({ type: "root", children: node.children }, options)
      : { text: getTextFromNode(node), entities: [] };
    const linkText = childResult.text;
    const url = node.url;

    let entityType: TextEntityType$Input;
    if (url && url.startsWith("tg://user?id=")) {
      entityType = {
        _: "textEntityTypeMentionName",
        user_id: parseInt(url.split("=")[1], 10),
      };
    } else if (url && url.startsWith("tg://openmessage?chat_id=")) {
      let chatId = url.split("=")[1];
      if (chatId.startsWith("-100")) chatId = chatId.substring(4);
      entityType = {
        _: "textEntityTypeTextUrl",
        url: `tg://openmessage?chat_id=${chatId}`,
      };
    } else {
      entityType = { _: "textEntityTypeTextUrl", url: url || "" };
    }

    entities.push({
      _: "textEntity",
      offset: 0,
      length: linkText.length,
      type: entityType,
    });
    for (const e of childResult.entities) entities.push({ ...e });

    return { text: linkText, entities };
  }

  if (node.type === "inlineCode") {
    entities.push({
      _: "textEntity",
      offset: 0,
      length: node.value.length,
      type: { _: "textEntityTypeCode" },
    });
    return { text: node.value, entities };
  }

  if (node.type === "code") {
    entities.push({
      _: "textEntity",
      offset: 0,
      length: node.value.length,
      type: { _: "textEntityTypePreCode", language: node.lang || "" },
    });
    return { text: node.value, entities };
  }

  if (node.type === "blockquote") {
    // 需求：外层实体只包第一行（或直到嵌套 blockquote），嵌套引用 + 紧随其后的非空行并入 expandable。
    if (!Array.isArray(node.children) || node.children.length === 0) {
      return { text: "", entities: [] };
    }
    // 将子节点解析为纯文本片段（逐节点）
    const parts: {
      text: string;
      entities: textEntity$Input[];
      type: string;
    }[] = [];
    for (const ch of node.children) {
      const r = processNode(ch, { depth: depth + 1 });
      parts.push({ text: r.text, entities: r.entities, type: ch.type });
    }
    // 合成时用换行连接
    const joined = parts.map((p) => p.text).join("\n");
    // 查找第一段文本（外层）与后续第一段嵌套 blockquote 起点
    let firstNestedIndex = parts.findIndex((p) => p.type === "blockquote");
    if (firstNestedIndex === -1) firstNestedIndex = parts.length; // 无嵌套
    // 外层包裹文本长度：合并 firstNestedIndex 之前的片段 + 中间换行
    let outerLength = 0;
    for (let i = 0; i < firstNestedIndex; i++) {
      outerLength += parts[i].text.length;
      if (i < firstNestedIndex - 1) outerLength += 1; // 换行
    }
    if (outerLength > 0) {
      entities.push({
        _: "textEntity",
        offset: 0,
        length: outerLength,
        type: {
          _:
            depth + 1 >= 2
              ? "textEntityTypeExpandableBlockQuote"
              : "textEntityTypeBlockQuote",
        },
      });
    }
    // 处理嵌套部分：将每个嵌套 blockquote 片段转换为 expandable，并把其后连续的非空普通行（不是 blockquote）并入同一个实体
    let cursorOffset = 0;
    // 预计算每个 part 在 joined 中的起始 offset
    const offsets: number[] = [];
    for (let i = 0; i < parts.length; i++) {
      offsets.push(cursorOffset);
      cursorOffset += parts[i].text.length;
      if (i < parts.length - 1) cursorOffset += 1; // 换行
    }
    for (let i = firstNestedIndex; i < parts.length; i++) {
      if (parts[i].type === "blockquote") {
        let startOffset = offsets[i];
        let length = parts[i].text.length;
        let j = i + 1;
        while (
          j < parts.length &&
          parts[j].type !== "blockquote" &&
          parts[j].text.trim() !== ""
        ) {
          // 加上换行 + 后续文本
          length += 1 + parts[j].text.length;
          j++;
        }
        entities.push({
          _: "textEntity",
          offset: startOffset,
          length,
          type: { _: "textEntityTypeExpandableBlockQuote" },
        });
        i = j - 1;
      }
    }
    // 子实体合并（偏移修正）
    for (let i = 0; i < parts.length; i++) {
      const base = offsets[i];
      for (const e of parts[i].entities) {
        const t = (e as any).type;
        // 过滤掉子 blockquote 自带的包裹实体，防止重复
        if (
          t &&
          (t._ === "textEntityTypeBlockQuote" ||
            t._ === "textEntityTypeExpandableBlockQuote")
        )
          continue;
        entities.push({ ...e, offset: (e.offset || 0) + base });
      }
    }
    // 去重（相同 offset/length/type）
    const uniq: textEntity$Input[] = [];
    const seen = new Set<string>();
    for (const e of entities) {
      const key = `${e.offset}|${e.length}|${(e as any).type._}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(e);
      }
    }
    return { text: joined, entities: uniq };
  }

  if (node.type === "list") {
    if (!Array.isArray(node.children)) return { text: "", entities: [] };
    const ordered = !!node.ordered;
    const start = typeof node.start === "number" ? node.start : 1;
    let index = 0;
    const lines: string[] = [];
    for (const li of node.children) {
      if (li.type !== "listItem") continue;
      const raw = getTextFromNode(li).trim();
      const prefix = ordered ? `${start + index}. ` : "- ";
      lines.push(prefix + raw);
      index++;
    }
    return { text: lines.join("\n"), entities: [] };
  }

  if (node.type === "strong") {
    const childResult = node.children
      ? processNode({ type: "root", children: node.children }, options)
      : { text: getTextFromNode(node), entities: [] };
    entities.push({
      _: "textEntity",
      offset: 0,
      length: childResult.text.length,
      type: { _: "textEntityTypeBold" },
    });
    for (const e of childResult.entities) entities.push({ ...e });
    return { text: childResult.text, entities };
  }

  if (node.type === "emphasis") {
    const childResult = node.children
      ? processNode({ type: "root", children: node.children }, options)
      : { text: getTextFromNode(node), entities: [] };
    entities.push({
      _: "textEntity",
      offset: 0,
      length: childResult.text.length,
      type: { _: "textEntityTypeItalic" },
    });
    for (const e of childResult.entities) entities.push({ ...e });
    return { text: childResult.text, entities };
  }

  if (node.type === "delete") {
    const childResult = node.children
      ? processNode({ type: "root", children: node.children }, options)
      : { text: getTextFromNode(node), entities: [] };
    entities.push({
      _: "textEntity",
      offset: 0,
      length: childResult.text.length,
      type: { _: "textEntityTypeStrikethrough" },
    });
    for (const e of childResult.entities) entities.push({ ...e });
    return { text: childResult.text, entities };
  }

  if (node.children && Array.isArray(node.children)) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childResult = processNode(child, { depth });
      const baseOffset = text.length;
      text += childResult.text;
      for (const e of childResult.entities) {
        entities.push({ ...e, offset: (e.offset || 0) + baseOffset });
      }
      if (node.type === "root" && i < node.children.length - 1) {
        const next = node.children[i + 1];
        // 使用 position 信息计算应保留的空行数
        const lineBreaks = computeLineBreaksBetween(child, next);
        if (lineBreaks > 0) {
          text += "\n".repeat(lineBreaks);
        }
      }
    }
  }

  return { text, entities };
}

/**
 * 从 MDAST 节点中提取纯文本内容（深度递归）。
 *
 * 该函数用于在不需要生成实体的上下文中快速获取节点文本表示。
 *
 * @param node - 要提取文本的节点
 * @returns 节点及其子节点拼接后的纯文本
 */
function getTextFromNode(node: any): string {
  if (node.type === "text") {
    return node.value;
  }

  if (node.children) {
    return node.children.map((child: any) => getTextFromNode(child)).join("");
  }

  if (node.value) {
    return node.value;
  }

  return "";
}

function isBlockLevel(node: any): boolean {
  return [
    "paragraph",
    "code",
    "blockquote",
    "heading",
    "thematicBreak",
    "list",
  ].includes(node?.type);
}

function computeLineBreaksBetween(a: any, b: any): number {
  if (!a || !b) return 1;
  if (!isBlockLevel(a) || !isBlockLevel(b)) return 1; // 默认至少 1 个换行
  const aEnd = a.position?.end?.line;
  const bStart = b.position?.start?.line;
  if (!aEnd || !bStart) return 1;
  const gap = bStart - aEnd; // 行号差
  if (gap <= 1) return 1; // 相邻行 => 单换行
  // gap=2 => 一行空行 => 2 个 \n (上一段结束换行 + 空行)，这里我们输出 gap-0 (经验值调整)
  return gap - 0; // 直接返回差值，保证多空行保留
}
