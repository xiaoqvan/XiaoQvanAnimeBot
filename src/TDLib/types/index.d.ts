import type { TextEntityType$Input } from "tdlib-types";

export type markdownToken = {
  type: "text" | "entity";
  content: string;
  entity?: TextEntityType$Input;
};

export type markdownPattern = {
  name: string;
  regex: RegExp;
  getEntity: (content: string, extra?: string) => TextEntityType$Input;
  extract?: (match: RegExpExecArray) => { content: string; extra?: string };
};

export type markdownExtractResult = {
  content: string;
  extra?: string;
};
