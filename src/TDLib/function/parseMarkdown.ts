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

    // 如果包含列表(list)节点，则保持原样返回（不做格式实体处理）
    if (containsListNode(tree)) {
      return {
        _: "formattedText" as const,
        text: markdown,
        entities: [],
      };
    }

    // 遍历 AST 并构建格式化文本
    const result = processNode(tree);
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

function containsListNode(node: any): boolean {
  if (!node) return false;
  if (node.type === "list") return true;
  if (Array.isArray(node.children)) {
    return node.children.some((c: any) => containsListNode(c));
  }
  return false;
}

function getBlockquoteDepth(node: any): number {
  if (!node || node.type !== "blockquote") return 0;
  if (!Array.isArray(node.children) || node.children.length === 0) return 1;
  let maxChildDepth = 0;
  for (const child of node.children) {
    if (child.type === "blockquote") {
      const d = getBlockquoteDepth(child);
      if (d > maxChildDepth) maxChildDepth = d;
    }
  }
  return 1 + maxChildDepth;
}

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
  options?: { suppressBlockquoteWrap?: boolean }
): {
  text: string;
  entities: textEntity$Input[];
} {
  const suppressBlockquoteWrap = options?.suppressBlockquoteWrap || false;
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
    const childResult = node.children
      ? processNode(
          { type: "root", children: node.children },
          { suppressBlockquoteWrap: true }
        )
      : { text: getTextFromNode(node), entities: [] };
    const depth = getBlockquoteDepth(node);
    const blockType =
      depth >= 2
        ? "textEntityTypeExpandableBlockQuote"
        : "textEntityTypeBlockQuote";
    if (!suppressBlockquoteWrap) {
      entities.push({
        _: "textEntity",
        offset: 0,
        length: childResult.text.length,
        type: { _: blockType },
      });
    }
    for (const e of childResult.entities) entities.push({ ...e });
    return { text: childResult.text, entities };
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
      const childResult = processNode(child, options);
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
