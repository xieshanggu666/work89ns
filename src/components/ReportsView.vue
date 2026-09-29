<script setup>
import { computed } from 'vue'
import { useEventStore } from '@/store/event'
const store = useEventStore()

const bestAttack = computed(() => {
  const rows = []
  store.sports.forEach(s => {
    (store.standings[s.id] || []).forEach(r => { if (r.play > 0) rows.push({ t: r.tname, sport: s.name, gf: r.gf - r.ga, unit: r.unit, color: r.color }) })
  })
  return rows.sort((a, b) => b.gf - a.gf).slice(0, 6)
})
const maxGD = computed(() => Math.max(1, ...bestAttack.value.map(r => r.gf)))

const unitPoints = computed(() => {
  const m = {}
  const u = store.units
  u.forEach(x => m[x.id] = { name: x.name, color: x.color, pts: 0, gold: 0 })
  store.teams.forEach(t => {
    const st = (store.standings[t.sport_id] || []).find(r => r.team_id === t.id)
    if (st && m[t.unit_id]) m[t.unit_id].pts += st.points
  })
  store.medals.forEach(md => { if (m[md.unit_id]) m[md.unit_id].gold = md.gold })
  return Object.values(m).sort((a, b) => b.pts - a.pts)
})
const maxPts = computed(() => Math.max(1, ...unitPoints.value.map(x => x.pts)))
</script>

<template>
  <div v-if="store.loaded">
    <div class="page-h">
      <div><h2>📊 报表中心</h2><div class="sub">赛事数据洞察：净胜球排行 · 综合积分 · 项目概览</div></div>
    </div>

    <div class="grid g2">
      <!-- 净胜球排行 -->
      <div class="card">
        <div class="caption">🔥 最佳攻击线（净胜球）</div>
        <div class="pad" style="display:flex;flex-direction:column;gap:14px">
          <div v-for="(r, ri) in bestAttack" :key="ri + '-' + r.t">
            <div class="row spread" style="margin-bottom:6px">
              <span class="badge"><span class="dot" :style="{ background: r.color }"></span>{{ r.t }} <span class="tag gray" style="margin-left:4px">{{ r.sport }}</span></span>
              <b class="mono">{{ r.gf > 0 ? '+' : '' }}{{ r.gf }}</b>
            </div>
            <div class="hbar"><i :style="{ width: (r.gf / maxGD) * 100 + '%', background: r.gf > 0 ? 'var(--accent)' : '#e5484d' }"></i></div>
          </div>
        </div>
      </div>

      <!-- 单位综合积分 -->
      <div class="card">
        <div class="caption">🏅 单位综合积分（球类积分之和）</div>
        <div class="pad" style="display:flex;flex-direction:column;gap:14px">
          <div v-for="u in unitPoints" :key="u.name">
            <div class="row spread" style="margin-bottom:6px">
              <span class="badge"><span class="dot" :style="{ background: u.color }"></span>{{ u.name }}</span>
              <span><span class="tag y">🥇{{ u.gold }}</span> <b class="mono" style="font-size:16px;color:var(--accent)">{{ u.pts }}</b></span>
            </div>
            <div class="hbar"><i :style="{ width: (u.pts / maxPts) * 100 + '%' }"></i></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 项目明细 -->
    <div class="card mt">
      <div class="caption">🗂️ 赛事项目明细与规则</div>
      <div class="pad">
        <table>
          <thead><tr><th>项目</th><th>类别</th><th>赛制</th><th>场地</th><th>已完成/总场次</th><th>冠军归属</th></tr></thead>
          <tbody>
            <tr v-for="s in store.sports" :key="s.id">
              <td><b>{{ s.name }}</b></td>
              <td><span class="tag b">{{ s.category }}</span></td>
              <td>{{ s.format === 'roundrobin' ? '单循环积分制' : s.format === 'group_knockout' ? '小组赛 + 淘汰赛' : s.format === 'knockout' ? '单败淘汰' : '计时成绩' }}</td>
              <td>{{ s.venue }}</td>
              <td class="mono">{{ store.overview?.sportDone?.find(x=>x.id===s.id)?.done || 0 }}/{{ store.overview?.sportDone?.find(x=>x.id===s.id)?.total || 0 }}</td>
              <td class="ph">{{ s.finished ? '已产生' : '待结算' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>