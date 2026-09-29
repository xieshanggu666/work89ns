<script setup>
import { computed } from 'vue'
import { useEventStore } from '@/store/event'
const store = useEventStore()

const venueBusy = computed(() => {
  const map = {}
  store.matches.forEach(m => {
    if (m.venue && m.status === 'scheduled') {
      map[m.venue_id] = (map[m.venue_id] || 0) + 1
    }
  })
  return map
})
</script>

<template>
  <div v-if="store.loaded">
    <div class="page-h">
      <div><h2>📍 场地与裁判</h2><div class="sub">场地占用概览与比赛执法排班</div></div>
    </div>

    <div class="grid g3">
      <div v-for="v in store.venues" :key="v.id" class="card stat">
        <span class="bar" :style="{ background: 'linear-gradient(90deg, var(--accent3), #7cc4ff)' }"></span>
        <span class="ic">🏟️</span>
        <b>{{ v.name }}</b>
        <em>待赛场次：{{ venueBusy[v.id] || 0 }} 场 · {{ v.type }}</em>
      </div>
    </div>

    <div class="card mt">
      <div class="caption">🧑‍⚖️ 裁判名单与排班</div>
      <div class="pad">
        <table>
          <thead><tr><th>姓名</th><th>负责项目</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="r in store.referees" :key="r.id">
              <td><b>{{ r.name }}</b></td>
              <td>{{ r.sport || '综合执法' }}</td>
              <td><span class="tag g">在岗</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>