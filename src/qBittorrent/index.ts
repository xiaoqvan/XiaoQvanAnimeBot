import { QBittorrent } from "@ctrl/qbittorrent";
import logger from "../log/index.ts";

let QBclient: QBittorrent | null = null;

/** 创建并登录 qBittorrent 客户端实例
 * @returns 已登录的 QBittorrent 实例
 */
async function createQBClient() {
  const client = new QBittorrent({
    baseUrl: process.env.QBITTORRENT_HOST,
    username: process.env.QBITTORRENT_USERNAME,
    password: process.env.QBITTORRENT_PASSWORD,
  });

  try {
    await client.login();
    return client;
  } catch {
    logger.error("qBittorrent链接失败: 请检查Web UI是否开启或密码是否正确。");
    process.exit(1);
  }
}

/** 获取已登录的 qBittorrent 客户端实例
 * 如果未登录或连接失效，则重新登录
 * @returns 已登录的 QBittorrent 实例
 */
export async function getQBClient() {
  if (!QBclient) {
    QBclient = await createQBClient();
  } else {
    try {
      await QBclient.getAppVersion();
    } catch {
      await QBclient.login();
    }
  }
  return QBclient;
}
