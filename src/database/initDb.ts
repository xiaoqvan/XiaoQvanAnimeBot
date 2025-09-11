import { MongoClient } from "mongodb";
import logger from "../log/index.js";

if (!process.env.MONGODB_URI) {
  throw new Error("缺少MONGODB_URI环境变量");
}

const dbclient = new MongoClient(process.env.MONGODB_URI);

// 连接数据库的函数
async function connectDB() {
  try {
    await dbclient.connect();
    logger.info("数据库连接成功ฅ^•ﻌ•^ฅ");
    return dbclient;
  } catch (err) {
    logger.error("连接失败喵！", err);
    throw new Error("数据库连接失败");
  }
}
/**
 * 初始化数据库连接并设置全局引用
 * 到所需的数据库集合。
 */
async function initdb() {
  logger.info("正在连接数据库...");
  const dbclient = await connectDB();

  const db = dbclient.db("anime");

  // 为 torrents 集合创建 title 字段的唯一索引
  try {
    const torrents = db.collection("torrents");
    await torrents.createIndex(
      { title: 1 },
      { unique: true, name: "title_unique_idx" }
    );
  } catch (err) {
    logger.error("为 torrents 创建索引时出错", err);
    throw err;
  }

  return db;
}

// 模块加载时只创建一次
export const databasePromise = initdb();

/**
 * 获取数据库连接
 * @returns 数据库连接的Promise
 */
export async function getDatabase() {
  return await databasePromise;
}
