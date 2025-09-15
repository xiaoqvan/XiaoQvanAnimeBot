import { QBittorrent } from "@ctrl/qbittorrent";
import logger from "../log/index.ts";

async function Torrent() {
  const QBclient = new QBittorrent({
    baseUrl: process.env.QBITTORRENT_HOST,
    username: process.env.QBITTORRENT_USERNAME,
    password: process.env.QBITTORRENT_PASSWORD,
  });

  try {
    await QBclient.login();

    return QBclient;
  } catch {
    logger.error(
      "qBittorrent链接失败:" +
        "请检查qBittorrent Web UI是否开启或密码是否正确。"
    );
    process.exit(1);
  }
}

export const QBclient = Torrent();

export async function getQBClient() {
  return await QBclient;
}
