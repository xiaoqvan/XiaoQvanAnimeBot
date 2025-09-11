import { QBittorrent } from "@ctrl/qbittorrent";
import logger from "../log/index.js";

async function Torrent() {
  const QBclient = new QBittorrent({
    baseUrl: "http://localhost:8080", // 默认Web UI地址
    username: "admin",
    password: "123456",
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
