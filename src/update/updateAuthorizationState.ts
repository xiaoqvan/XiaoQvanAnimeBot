import type { updateAuthorizationState as Td$updateAuthorizationState } from "tdlib-types";
import { getMe } from "../TDLib/function/get.js";
import logger from "../log/index.js";

export default async function updateAuthorizationState(
  update: Td$updateAuthorizationState
) {
  // console.log("收到授权状态更新", JSON.stringify(update, null, 2));
  // 检查消息时间戳，只处理10分钟内的消息
  switch (update.authorization_state._) {
    case "authorizationStateReady":
      getMeInfo();
  }
}
async function getMeInfo() {
  const me = await getMe();

  if (me && me.usernames && me.type._ === "userTypeBot") {
    logger.info(
      `Bot 已登录: ${me.first_name}${me.last_name} (@${me.usernames.active_usernames[0]} - ID:${me.id})`
    );
  }
  if (me && me.usernames && me.type._ === "userTypeRegular") {
    logger.info(
      `用户 ${me.first_name}${me.last_name} 已登录: (@${
        me.usernames.active_usernames[0] || null
      } - ID:${me.id})`
    );
  }
}
