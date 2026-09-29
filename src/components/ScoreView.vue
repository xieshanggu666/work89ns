<script setup>
import { ref, computed, reactive } from 'vue'
import { useEventStore, matchWinnerOf, isKOMatch } from '@/store/event'

const store = useEventStore()
const curSport = ref('all')
const active = ref(null)
const toast = ref('')

const ballSports = computed(() => store.sports.filter(s => s.format !== 'track'))
const matches = computed(() => store.matches.filter(m => {
  const s = store.sports.find(x => x.id === m.sport_id)
  if (curSport.value !== 'all' && m.sport_id !== Number(curSport.value)) return false
  return s && s.format !== 'track'
}))
const trackSports = computed(() => store.sports.filter(s => s.format === 'track'))

const sa = ref(0), sb = ref(0), winner = ref(null)
const isDrawEdit = () => Number(sa.value) === Number(sb.value)
function open(m) { active.value = m; sa.value = m.score_a ?? 0; sb.value = m.score_b ?? 0; winner.value = m.winner ?? null }
async function saveScore() {
  const draw = isDrawEdit()
  if (isKOMatch(active.value) && draw && !winner.value) {
    toast.value = '⚠ 淘汰赛出现平局，必须选择决胜方（加时/点球胜方）'
    setTimeout(() => toast.value = '', 2600)
    return
  }
  const r = await store.score(active.value.id, sa.value, sb.value, isKOMatch(active.value) && draw ? winner.value : null)
  if (r && r.error) {
    toast.value = '⚠ ' + r.error
    setTimeout(() => toast.value = '', 3200)
    return
  }
  toast.value = '✅ 比分已录入，积分榜已更新，淘汰赛晋级/奖牌已同步'
  setTimeout(() => toast.value = '', 2400)
  active.value = null
}
// 已完赛但平局未决胜的淘汰赛场次，允许补录决胜方
function canEdit(m) {
  if (m.status === 'scheduled') return true
  return isKOMatch(m) && m.score_a === m.score_b && !m.winner
}
const wn = m => matchWinnerOf(m)

const tr = reactive({})
const getMark = e => tr[e.athlete_id] ?? e.mark
const setMark = (e, ev) => { tr[e.athlete_id] = Number(ev.target.value) }
async function saveTrack(sid) {
  const list = store.entries.filter(e => e.sport_id === sid)
  const sorted = list.map(e => ({ athlete_id: e.athlete_id, mark: Number(tr[e.athlete_id] ?? e.mark) })).sort((a, b) => a.mark - b.mark)
  await store.saveTrack(sid, sorted)
  toast.value = '✅ 田径成绩已按时间排序并结算金/银/铜'
  setTimeout(() => toast.value = '', 2600)
}
const rankCls = r => r === 1 ? '#d99a00' : r === 2 ? '#90a4ae' : r === 3 ? '#c9743a' : 'var(--muted)'
</script>

<template>
  <div v-if="store.loaded">
    <div class="page-h">
      <div><h2>⚡ 成绩录入</h2><div class="sub">录入比分自动更新积分排名；田径按成绩计时结算奖项</div></div>
      <div v-if="toast" class="toast">{{ toast }}</div>
      <div class="filters">
        <button class="chip" :class="{ on: curSport === 'all' }" @click="curSport = 'all'">全部球类</button>
        <button v-for="s in ballSports" :key="s.id" class="chip" :class="{ on: curSport === String(s.id) }" @click="curSport = String(s.id)">{{ s.name }}</button>
      </div>
    </div>

    <div class="grid g2">
      <div v-for="m in matches" :key="m.id" class="mcard" :class="{ done: m.status==='finished' }">
        <div class="mheader">
          <span>{{ store.sports.find(x=>x.id===m.sport_id)?.name }} · {{ m.stage }}{{ m.group_name ? ' · ' + m.group_name : '' }}</span>
          <span class="tag" :class="m.status==='finished' ? 'g' : 'o'">{{ m.status==='finished' ? '已完赛' : '待赛' }}</span>
        </div>
        <div class="mrow">
          <span class="t"><span class="badge"><span class="dot" :style="{ background: store.unitOfUid(m.teamA?.unit_id)?.color }"></span>{{ m.teamA?.name }}<span v-if="wn(m)?.id===m.teamA?.id" class="tag g" style="margin-left:6px">胜</span></span></span>
          <template v-if="active?.id === m.id">
            <input v-model.number="sa" type="number" min="0" class="score-in" style="width:52px"> :
            <input v-model.number="sb" type="number" min="0" class="score-in" style="width:52px">
          </template>
          <template v-else>
            <span class="score-chip ph" v-if="m.status==='scheduled'">—</span>
            <span class="score-chip" v-else>{{ m.score_a }}:{{ m.score_b }}</span>
          </template>
          <span class="t" style="text-align:right"><span class="badge">{{ m.teamB?.name }}<span v-if="wn(m)?.id===m.teamB?.id" class="tag g" style="margin-left:6px">胜</span><span class="dot" :style="{ background: store.unitOfUid(m.teamB?.unit_id)?.color }"></span></span></span>
        </div>
        <!-- 淘汰赛平局决胜：加时/点球胜方 -->
        <div v-if="active?.id === m.id && isKOMatch(m) && isDrawEdit()" class="decide">
          <div class="decide-tip">⚖️ 淘汰赛平局须决胜（加时赛 / 点球大战胜方），晋级、季军与奖牌均以决胜方为准</div>
          <div class="row" style="gap:8px;margin-top:6px;justify-content:center">
            <button type="button" class="chip" :class="{ on: winner===m.teamA?.id }" @click="winner=m.teamA.id">{{ m.teamA?.name }} 胜</button>
            <button type="button" class="chip" :class="{ on: winner===m.teamB?.id }" @click="winner=m.teamB.id">{{ m.teamB?.name }} 胜</button>
          </div>
        </div>
        <div v-if="isKOMatch(m) && m.status==='finished'" class="decide-note">
          <template v-if="m.score_a===m.score_b">
            <span class="tag gray">⚖️ 平局</span>
            <span v-if="wn(m)" class="tag g">决胜 · {{ wn(m).name }} 胜</span>
            <span v-else class="tag o">⚠ 平局待决胜</span>
          </template>
          <span v-else class="hint">胜方晋级 {{ m.stage==='半决赛' ? '决赛' : '' }}</span>
        </div>
        <div class="row mt8" style="justify-content:flex-end">
          <button v-if="active?.id !== m.id && canEdit(m)" class="btn primary sm" @click="open(m)">{{ m.status==='finished' ? '✍️ 补录决胜' : '✍️ 录入比分' }}</button>
          <template v-if="active?.id === m.id">
            <button class="btn ghost sm" @click="active=null">取消</button>
            <button class="btn green sm" @click="saveScore">保存赛果</button>
          </template>
          <span v-else-if="m.status==='finished'" class="tag g">✔ 已结算</span>
        </div>
      </div>
    </div>

    <div class="card mt" v-for="s in trackSports" :key="'t' + s.id">
      <div class="caption"><span class="badge">🏃 {{ s.name }}</span><span class="hint">按成绩(秒)升序自动排名，前 3 结算金/银/铜</span></div>
      <div class="pad">
        <table>
          <thead><tr><th>#</th><th>运动员</th><th>单位</th><th>成绩(秒)</th></tr></thead>
          <tbody>
            <tr v-for="(e, i) in store.entries.filter(x=>x.sport_id===s.id).sort((a,b)=>a.mark-b.mark)" :key="e.id">
              <td><b :style="{ color: rankCls(e.rank), fontSize:'16px' }">{{ e.rank }}</b></td>
              <td>{{ e.aname }}</td>
              <td><span class="badge"><span class="dot" :style="{ background: store.unitOfUid(e.unit_id)?.color }"></span>{{ e.unit }}</span></td>
              <td><input :value="getMark(e)" @input="setMark(e, $event)" type="number" step="0.01" style="width:90px" /> <span class="tag gray mt8" style="margin-left:6px">s</span></td>
            </tr>
          </tbody>
        </table>
        <div class="row mt16" style="justify-content:flex-end">
          <button class="btn primary" @click="saveTrack(s.id)">💾 结算本项成绩</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.score-in { font-weight: 800; font-size: 15px; text-align: center; }
.decide { margin-top: 8px; padding: 8px 10px; border: 1px dashed var(--accent); border-radius: 10px; background: #fff7f0; }
.decide-tip { font-size: 12px; color: var(--accent); font-weight: 600; }
.decide-note { margin-top: 6px; font-size: 12px; color: var(--muted); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
</style>