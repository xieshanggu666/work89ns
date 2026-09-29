import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const db = new DatabaseSync(path.join(__dirname, 'event.db'))

db.exec(`
CREATE TABLE IF NOT EXISTS sports (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,        -- 球类/田径/水上/棋牌
  format TEXT NOT NULL,          -- roundrobin / group_knockout / knockout / track
  venue TEXT,
  finished INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit_id INTEGER NOT NULL,
  sport_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS athletes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit_id INTEGER NOT NULL,
  sport_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS referees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sport TEXT,
  status TEXT DEFAULT '就绪'
);
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sport_id INTEGER NOT NULL,
  stage TEXT,            -- 小组/循环/半决赛/决赛/季军
  group_name TEXT,
  team_a INTEGER,        -- 队伍id，可为 0 占位
  team_b INTEGER,
  venue_id INTEGER,
  order_no INTEGER,
  time_label TEXT,
  score_a INTEGER,
  score_b INTEGER,
  winner INTEGER,             -- 淘汰赛平局决胜（加时/点球）胜方队伍id
  status TEXT DEFAULT 'scheduled'   -- scheduled / finished
);
CREATE TABLE IF NOT EXISTS entries (
  -- 田径成绩（单项）
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sport_id INTEGER NOT NULL,
  athlete_id INTEGER NOT NULL,
  mark REAL,
  rank INTEGER,
  unit_id INTEGER
);
CREATE TABLE IF NOT EXISTS standings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sport_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  play INTEGER DEFAULT 0,
  win INTEGER DEFAULT 0,
  draw INTEGER DEFAULT 0,
  lose INTEGER DEFAULT 0,
  gf INTEGER DEFAULT 0,
  ga INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS medals (
  unit_id INTEGER PRIMARY KEY,
  gold INTEGER DEFAULT 0,
  silver INTEGER DEFAULT 0,
  bronze INTEGER DEFAULT 0
);
`)

// 迁移：为淘汰赛平局决胜增加 winner 字段（旧库补列）
try { db.exec('ALTER TABLE matches ADD COLUMN winner INTEGER') } catch (e) { /* 列已存在 */ }

export function run(sql, ...p) { return db.prepare(sql).run(...p) }
export function all(sql, ...p) { return db.prepare(sql).all(...p) }
export function get(sql, ...p) { return db.prepare(sql).get(...p) }