import express from 'express'
import { db, run, all, get } from './db.js'

const app = express()
app.use(express.json())
const PORT = 4170

/* ================= 种子数据 ================= */
function seed() {
  if (get('SELECT COUNT(*) c FROM sports').c > 0) return

  // 单位
  const units = [['雷霆学院', '#ff7a2f'], ['飞鹰学院', '#2f9bff'], ['雄狮学院', '#2ecc71'], ['星河学院', '#9b59b6']]
  const unitId = {}
  units.forEach((u, i) => { run('INSERT INTO units (name,color) VALUES (?,?)', u[0], u[1]); unitId[u[0]] = i + 1 })

  // 场地
  const venues = ['中心篮球馆', '五人足球场', '羽毛球馆', '田径场', '备用2号场']
  venues.forEach(v => run('INSERT INTO venues (name,type) VALUES (?,?)', v, 'arena'))

  // 裁判
  const refs = ['王裁判', '李裁判', '张裁判', '赵裁判', '陈裁判', '孙裁判']
  refs.forEach(r => run('INSERT INTO referees (name) VALUES (?)', r))

  // 项目
  const sp = (name, cat, fmt, venue) => { const r = run('INSERT INTO sports (name,category,format,venue) VALUES (?,?,?,?)', name, cat, fmt, venue); return Number(r.lastInsertRowid) }
  const spBasket = sp('篮球', '球类', 'roundrobin', '中心篮球馆')
  const spFoot = sp('五人制足球', '球类', 'group_knockout', '五人足球场')
  const spBad = sp('羽毛球', '球类', 'knockout', '羽毛球馆')
  const sp100 = sp('田径 · 100米', '田径', 'track', '田径场')

  // 队伍
  const mk = (name, unit) => { const r = run('INSERT INTO teams (name,unit_id,sport_id) VALUES (?,?,?)', name, unitId[unit], 0); return Number(r.lastInsertRowid) }
  // 篮球 4 队
  const B = ['雷霆学院', '飞鹰学院', '雄狮学院', '星河学院'].map(u => mk(u === '雷霆学院' ? '雷霆队' : u === '飞鹰学院' ? '飞鹰队' : u === '雄狮学院' ? '雄狮队' : '星河队', u))
  B.forEach(id => run('UPDATE teams SET sport_id=? WHERE id=?', spBasket, id))
  // 足球 6 队
  const F = [
    ['雷霆队', '雷霆学院'], ['飞鹰队', '飞鹰学院'], ['雄狮队', '雄狮学院'],
    ['星河队', '星河学院'], ['闪电队', '雷霆学院'], ['烈焰队', '雄狮学院']
  ].map(([n, u]) => mk(n, u))
  F.forEach(id => run('UPDATE teams SET sport_id=? WHERE id=?', spFoot, id))
  // 羽毛球 4 队（同名队伍）
  const G = ['雷霆队', '飞鹰队', '雄狮队', '星河队'].map((n, i) => mk(n, units[i][0]))
  G.forEach(id => run('UPDATE teams SET sport_id=? WHERE id=?', spBad, id))
  // 田径 8 名运动员
  const runners = [['林一', '雷霆学院'], ['周楠', '飞鹰学院'], ['陈晨', '雄狮学院'], ['顾言', '星河学院'], ['徐凯', '雷霆学院'], ['韩雪', '飞鹰学院'], ['陆鸣', '雄狮学院'], ['宋词', '星河学院']]
  const timeSlots = ['09:00', '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:20']
  runners.forEach(([n, u], i) => { run('INSERT INTO athletes (name,unit_id,sport_id) VALUES (?,?,?)', n, unitId[u], sp100) })

  // 循环赛助手
  const pairs = arr => { const p = []; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) p.push([arr[i], arr[j]]); return p }

  const venueById = get('SELECT id FROM venues LIMIT 1').id

  // —— 篮球：4队 单循环 6 场
  let ono = 0
  pairs(B).forEach(([a, b]) => {
    ono++
    run('INSERT INTO matches (sport_id,stage,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?)', spBasket, '循环', a, b, venueById, ono, timeSlots[(ono - 1) % 8], 'scheduled')
  })

  // —— 足球：分 AB 两组（A: 雷霆/雄狮/闪电  B: 飞鹰/星河/烈焰），组内循环 6 场
  const grpA = [F[0], F[2], F[4]]
  const grpB = [F[1], F[3], F[5]]
  ono = 0
  pairs(grpA).forEach(([a, b]) => { ono++; run('INSERT INTO matches (sport_id,stage,group_name,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?,?)', spFoot, '小组', 'A组', a, b, 2, ono, timeSlots[(ono - 1) % 8], 'scheduled') })
  pairs(grpB).forEach(([a, b]) => { ono++; run('INSERT INTO matches (sport_id,stage,group_name,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?,?)', spFoot, '小组', 'B组', a, b, 2, ono, timeSlots[(ono - 1) % 8], 'scheduled') })

  // —— 羽毛球：半决赛 2 场（固定对位），决赛/季军由编排按钮产生
  run('INSERT INTO matches (sport_id,stage,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?)', spBad, '半决赛', G[0], G[1], 3, 1, '09:30', 'scheduled')
  run('INSERT INTO matches (sport_id,stage,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?)', spBad, '半决赛', G[2], G[3], 3, 2, '10:00', 'scheduled')

  rebuildStandings()

  // —— 预录部分成绩（演示看板有内容）
  const sc = (sport, a, b, sa, sb) => { const m = get('SELECT id FROM matches WHERE sport_id=? AND team_a=? AND team_b=? AND status=\'scheduled\'', sport, a, b); if (m) finishMatch(m.id, sa, sb) }
  // 篮球全录 → 决出冠军
  sc(spBasket, B[0], B[1], 78, 70); sc(spBasket, B[2], B[3], 65, 71)
  sc(spBasket, B[0], B[2], 82, 60); sc(spBasket, B[1], B[3], 69, 74)
  sc(spBasket, B[0], B[3], 58, 66); sc(spBasket, B[1], B[2], 88, 77)
  // 足球小组录 4 场，留 2 场未赛
  sc(spFoot, grpA[0], grpA[1], 3, 1); sc(spFoot, grpA[1], grpA[2], 2, 2); sc(spFoot, grpA[0], grpA[2], 4, 2)
  sc(spFoot, grpB[0], grpB[1], 1, 3); sc(spFoot, grpB[1], grpB[2], 2, 1); sc(spFoot, grpB[0], grpB[2], 0, 2)
  // 羽毛球两场半决赛都录 → 可编排决赛
  sc(spBad, G[0], G[1], 21, 16); sc(spBad, G[2], G[3], 18, 21)
  // 田径成绩
  const marks = [10.62, 10.88, 11.05, 11.21, 11.35, 11.42, 11.58, 11.79]
  all('SELECT id,name FROM athletes').forEach((ath, i) => run('INSERT INTO entries (sport_id,athlete_id,mark,rank,unit_id) VALUES (?,?,?,?,?)', sp100, ath.id, marks[i], i + 1, get('SELECT unit_id FROM athletes WHERE id=?', ath.id).unit_id))

  recomputeMedals()
}
/* ================= 积分与奖牌 ================= */
function rebuildStandings(sportId) {
  const sports = sportId ? [sportId] : all('SELECT * FROM sports').map(s => s.id)
  sports.forEach(sid => {
    all('SELECT id FROM standings WHERE sport_id=?', sid).forEach(r => run('DELETE FROM standings WHERE id=?', r.id))
    const teams = all('SELECT id FROM teams WHERE sport_id=?', sid).map(t => t.id)
    teams.forEach(t => run('INSERT INTO standings (sport_id,team_id) VALUES (?,?)', sid, t))
    const done = all(`SELECT * FROM matches WHERE sport_id=? AND status='finished'`, sid)
    done.forEach(m => {
      const rowA = get('SELECT * FROM standings WHERE sport_id=? AND team_id=?', sid, m.team_a)
      const rowB = get('SELECT * FROM standings WHERE sport_id=? AND team_id=?', sid, m.team_b)
      if (!rowA || !rowB) return
      const sa = m.score_a, sb = m.score_b
      // 已存在记录则不重复累加
      if (m._acc) return
      rowA.play += 1; rowB.play += 1
      rowA.gf += sa; rowA.ga += sb; rowB.gf += sb; rowB.ga += sa
      if (sa > sb) { rowA.win++; rowB.lose++; rowA.points += 3 }
      else if (sa < sb) { rowB.win++; rowA.lose++; rowB.points += 3 }
      else { rowA.draw++; rowB.draw++; rowA.points += 1; rowB.points += 1 }
      run('UPDATE standings SET play=?,win=?,draw=?,lose=?,gf=?,ga=?,points=? WHERE id=?',
        rowA.play, rowA.win, rowA.draw, rowA.lose, rowA.gf, rowA.ga, rowA.points, rowA.id)
      run('UPDATE standings SET play=?,win=?,draw=?,lose=?,gf=?,ga=?,points=? WHERE id=?',
        rowB.play, rowB.win, rowB.draw, rowB.lose, rowB.gf, rowB.ga, rowB.points, rowB.id)
      m._acc = 1
    })
    // 排名
    const rows = all('SELECT * FROM standings WHERE sport_id=?', sid).sort((x, y) => y.points - x.points || (y.gf - y.ga) - (x.gf - x.ga) || x.id - y.id)
    rows.forEach((r, i) => run('UPDATE standings SET rank=? WHERE id=?', i + 1, r.id))
  })
}
function unitOfTeam(teamId) {
  const t = teamId == null ? null : get('SELECT unit_id FROM teams WHERE id=?', teamId)
  return t ? t.unit_id : null
}
function recomputeMedals() {
  all('SELECT unit_id FROM medals').forEach(r => run('DELETE FROM medals WHERE unit_id=?', r.unit_id))
  const add = (uid, medal) => { if (!uid) return; const row = get('SELECT * FROM medals WHERE unit_id=?', uid); const k = medal === 'gold' ? 'gold' : medal === 'silver' ? 'silver' : 'bronze'; if (row) run(`UPDATE medals SET ${k}=${k}+1 WHERE unit_id=?`, uid); else run(`INSERT INTO medals (unit_id,${k}) VALUES (?,1)`, uid) }
  const sports = all('SELECT * FROM sports')
  sports.forEach(spo => {
    if (spo.format === 'track') {
      const tops = all('SELECT * FROM entries WHERE sport_id=? ORDER BY mark ASC LIMIT 3', spo.id)
      add(tops[0]?.unit_id, 'gold'); add(tops[1]?.unit_id, 'silver'); add(tops[2]?.unit_id, 'bronze')
    } else if (spo.format === 'roundrobin') {
      const champ = get('SELECT s.*, t.unit_id FROM standings s JOIN teams t ON t.id=s.team_id WHERE s.sport_id=? AND s.rank=1', spo.id)
      const second = get('SELECT s.*, t.unit_id FROM standings s JOIN teams t ON t.id=s.team_id WHERE s.sport_id=? AND s.rank=2', spo.id)
      const third = get('SELECT s.*, t.unit_id FROM standings s JOIN teams t ON t.id=s.team_id WHERE s.sport_id=? AND s.rank=3', spo.id)
      if (all('SELECT * FROM standings WHERE sport_id=?', spo.id).some(r => r.play > 0)) { add(champ?.unit_id, 'gold'); add(second?.unit_id, 'silver'); add(third?.unit_id, 'bronze') }
    } else {
      const fin = get(`SELECT * FROM matches WHERE sport_id=? AND status='finished' AND stage='决赛'`, spo.id)
      if (fin) { add(unitOfTeam(fin.score_a > fin.score_b ? fin.team_a : fin.team_b), 'gold'); add(unitOfTeam(fin.score_a > fin.score_b ? fin.team_b : fin.team_a), 'silver') }
      const thirdM = get(`SELECT * FROM matches WHERE sport_id=? AND status='finished' AND stage='季军'`, spo.id)
      if (thirdM) add(unitOfTeam(thirdM.score_a > thirdM.score_b ? thirdM.team_a : thirdM.team_b), 'bronze')
    }
  })
}
/* ================= 编排下一轮（KO） ================= */
const STAGE_ORDER = { '小组': 1, '循环': 1, '半决赛': 2, '决赛': 3, '季军': 3 }
function finishMatch(id, sa, sb) {
  const m = get('SELECT * FROM matches WHERE id=?', id)
  run('UPDATE matches SET score_a=?, score_b=?, status=\'finished\' WHERE id=?', sa, sb, id)
  rebuildStandings(m.sport_id)
  recomputeMedals()
}
function generateKO(sportId) {
  const spo = get('SELECT * FROM sports WHERE id=?', sportId)
  if (spo.format === 'knockout') {
    // 羽毛球：半决赛是否已全部完成
    const semis = all(`SELECT * FROM matches WHERE sport_id=? AND stage='半决赛'`, sportId)
    const hasFinal = get(`SELECT id FROM matches WHERE sport_id=? AND stage='决赛'`, sportId)
    if (semis.length && semis.every(s => s.status === 'finished') && !hasFinal) {
      const w1 = semis[0].score_a > semis[0].score_b ? semis[0].team_a : semis[0].team_b
      const w2 = semis[1].score_a > semis[1].score_b ? semis[1].team_a : semis[1].team_b
      const l1 = w1 === semis[0].team_a ? semis[0].team_b : semis[0].team_a
      const l2 = w2 === semis[1].team_a ? semis[1].team_b : semis[1].team_a
      run('INSERT INTO matches (sport_id,stage,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?)', sportId, '决赛', w1, w2, 3, 9, '13:00', 'scheduled')
      run('INSERT INTO matches (sport_id,stage,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?)', sportId, '季军', l1, l2, 5, 10, '12:30', 'scheduled')
      return '已生成羽毛球 决赛 与 季军战'
    }
    return null
  }
  // group_knockout：小组完成后生成半决赛，半决赛完成后生成决赛
  const groups = ['A组', 'B组']
  const done = {}
  groups.forEach(g => {
    const gms = all(`SELECT * FROM matches WHERE sport_id=? AND group_name=?`, sportId, g)
    done[g] = gms.length === 0 || gms.every(m => m.status === 'finished')
  })
  const hasSemi = get(`SELECT id FROM matches WHERE sport_id=? AND stage='半决赛'`, sportId)
  if (groups.every(g => done[g]) && !hasSemi) {
    const rankOf = g => {
      const ids = all(`SELECT DISTINCT team_a id FROM matches WHERE sport_id=? AND group_name=? AND team_a IS NOT NULL UNION SELECT DISTINCT team_b FROM matches WHERE sport_id=? AND group_name=? AND team_b IS NOT NULL`, sportId, g, sportId, g).map(r => r.id)
      return ids.map(id => ({ id, pts: get('SELECT points p FROM standings WHERE sport_id=? AND team_id=?', sportId, id)?.p ?? -1 })).sort((a, b) => b.pts - a.pts).map(r => r.id)
    }
    const A = rankOf('A组'), B = rankOf('B组')
    if (A.length >= 2 && B.length >= 2) {
      run('INSERT INTO matches (sport_id,stage,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?)', sportId, '半决赛', A[0], B[1], 2, 99, '14:00', 'scheduled')
      run('INSERT INTO matches (sport_id,stage,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?)', sportId, '半决赛', B[0], A[1], 2, 100, '14:30', 'scheduled')
      return '已按小组排名生成足球半决赛'
    }
    return null
  }
  const semis = all(`SELECT * FROM matches WHERE sport_id=? AND stage='半决赛'`, sportId)
  const hasFinal = get(`SELECT id FROM matches WHERE sport_id=? AND stage='决赛'`, sportId)
  if (semis.length && semis.every(s => s.status === 'finished') && !hasFinal) {
    const w1 = semis[0].score_a > semis[0].score_b ? semis[0].team_a : semis[0].team_b
    const w2 = semis[1].score_a > semis[1].score_b ? semis[1].team_a : semis[1].team_b
    const l1 = w1 === semis[0].team_a ? semis[0].team_b : semis[0].team_a
    const l2 = w2 === semis[1].team_a ? semis[1].team_b : semis[1].team_a
    run('INSERT INTO matches (sport_id,stage,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?)', sportId, '决赛', w1, w2, 2, 101, '16:00', 'scheduled')
    run('INSERT INTO matches (sport_id,stage,team_a,team_b,venue_id,order_no,time_label,status) VALUES (?,?,?,?,?,?,?,?)', sportId, '季军', l1, l2, 5, 102, '15:30', 'scheduled')
    return '已生成决赛 与 季军战'
  }
  return null
}
function finishTrack(sportId, body) {
  // body: [{athlete_id, mark}] 按顺序
  body.forEach((b, i) => run('UPDATE entries SET mark=?, rank=? WHERE athlete_id=? AND sport_id=?', b.mark, i + 1, b.athlete_id, sportId))
  run('UPDATE sports SET finished=1 WHERE id=?', sportId)

  recomputeMedals()
}
seed()

/* ================= API ================= */
const joinMatch = m => {
  if (!m) return null
  return {
    ...m,
    teamA: m.team_a ? get('SELECT id,name,unit_id FROM teams WHERE id=?', m.team_a) : null,
    teamB: m.team_b ? get('SELECT id,name,unit_id FROM teams WHERE id=?', m.team_b) : null,
    venue: get('SELECT * FROM venues WHERE id=?', m.venue_id) || null
  }
}
app.get('/api/sports', (_, res) => res.json(all('SELECT * FROM sports')))
app.get('/api/teams', (_, res) => res.json(all('SELECT t.*, u.name unit, u.color FROM teams t JOIN units u ON u.id=t.unit_id')))
app.get('/api/units', (_, res) => res.json(all('SELECT * FROM units')))
app.get('/api/venues', (_, res) => res.json(all('SELECT * FROM venues')))
app.get('/api/referees', (_, res) => res.json(all('SELECT * FROM referees')))
app.get('/api/athletes', (_, res) => res.json(all('SELECT a.*, u.name unit FROM athletes a JOIN units u ON u.id=a.unit_id')))
app.get('/api/matches', (_, res) => res.json(all('SELECT * FROM matches').map(joinMatch)))
app.get('/api/entries', (_, res) => res.json(all('SELECT e.*, a.name aname, u.name unit FROM entries e JOIN athletes a ON a.id=e.athlete_id JOIN units u ON u.id=a.unit_id')))
app.get('/api/standings/:sid', (req, res) => res.json(all('SELECT s.*, t.name tname, u.name unit, u.color FROM standings s JOIN teams t ON t.id=s.team_id JOIN units u ON u.id=t.unit_id WHERE s.sport_id=? ORDER BY s.rank', Number(req.params.sid))))
app.get('/api/medals', (_, res) => res.json(all('SELECT m.*, u.name FROM medals m JOIN units u ON u.id=m.unit_id ORDER BY m.gold DESC, m.silver DESC')))

app.get('/api/overview', (_, res) => {
  const sp = all('SELECT * FROM sports')
  const mats = all('SELECT * FROM matches')
  const done = mats.filter(m => m.status === 'finished')
  const pend = mats.filter(m => m.status === 'scheduled')
  res.json({
    sports: sp.length,
    finishedMatches: done.length,
    pendingMatches: pend.length,
    teams: all('SELECT id FROM teams').length || 0,
    athletes: all('SELECT id FROM athletes').length,
    sportDone: sp.map(s => ({ ...s, total: mats.filter(m => m.sport_id === s.id).length, done: done.filter(m => m.sport_id === s.id).length })),
    recent: all('SELECT * FROM matches ORDER BY id DESC LIMIT 5').map(joinMatch)
  })
})
app.post('/api/matches/:id/score', (req, res) => {
  const { score_a, score_b } = req.body
  const m = get('SELECT * FROM matches WHERE id=?', Number(req.params.id))
  if (!m) return res.status(404).json({ error: '场次不存在' })
  if (m.team_a == null || m.team_b == null) return res.status(400).json({ error: '对阵尚未编排，先编排淘汰赛' })
  finishMatch(m.id, Number(score_a), Number(score_b))
  res.json({ ok: true })
})
app.post('/api/ko/:sportId', (req, res) => {
  const msg = generateKO(Number(req.params.sportId))
  res.json({ ok: !!msg, msg })
})
app.post('/api/track/:sportId', (req, res) => {
  finishTrack(Number(req.params.sportId), req.body)
  res.json({ ok: true })
})
app.get('/api/reset', (_, res) => {
  ['entries', 'standings', 'medals', 'matches', 'referees', 'venues', 'athletes', 'teams', 'units', 'sports'].forEach(t => { try { run(`DELETE FROM ${t}`) } catch (e) {} })
  seed()
  res.json({ ok: true })
})

app.listen(PORT, () => console.log(`[SPORT] API running at http://localhost:${PORT}`))