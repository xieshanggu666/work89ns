<script setup>
import { ref, computed } from 'vue'
import { useEventStore } from '@/store/event'
const store = useEventStore()
const cur = ref('all')

const teams = computed(() => {
  const ts = store.teams
  return cur.value === 'all' ? ts : ts.filter(t => t.sport_id === Number(cur.value))
})
const athletes = computed(() => {
  const as = store.athletes
  return cur.value === 'all' ? as : as.filter(a => a.sport_id === Number(cur.value))
})
const groupBy = (arr, k) => {
  const m = {}
  arr.forEach(x => { m[x[k]] = m[x[k]] || []; m[x[k]].push(x) })
  return m
}
</script>

<template>
  <div v-if="store.loaded">
    <div class="page-h">
      <div><h2>👥 队伍与运动员</h2><div class="sub">参赛队伍与单项运动员注册信息</div></div>
      <div class="filters">
        <button class="chip" :class="{ on: cur === 'all' }" @click="cur = 'all'">全部</button>
        <button v-for="s in store.sports" :key="s.id" class="chip" :class="{ on: cur === String(s.id) }" @click="cur = String(s.id)">{{ s.name }}</button>
      </div>
    </div>

    <div class="grid g2">
      <div class="card">
        <div class="caption">🏀 参赛队伍</div>
        <div class="pad">
          <div style="display:flex;flex-direction:column;gap:10px">
            <div v-for="(list, uid) in groupBy(teams, 'unit_id')" :key="uid" class="mcard">
              <div class="mheader"><span><span class="dot" :style="{ background: store.unitOfUid(Number(uid))?.color }"></span> {{ store.unitOfUid(Number(uid))?.name }}</span><span class="tag o">{{ list.length }} 支</span></div>
              <div class="row wrap" style="margin-top:8px">
                <span v-for="t in list" :key="t.id" class="tag b">{{ t.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="caption">🏃 运动员（田径等单项）</div>
        <div class="pad">
          <table>
            <thead><tr><th>姓名</th><th>参赛项目</th><th>单位</th></tr></thead>
            <tbody>
              <tr v-for="a in athletes" :key="a.id">
                <td><b>{{ a.name }}</b></td>
                <td>{{ store.sports.find(s=>s.id===a.sport_id)?.name }}</td>
                <td><span class="badge"><span class="dot" :style="{ background: store.unitOfUid(a.unit_id)?.color }"></span>{{ a.unit }}</span></td>
              </tr>
              <tr v-if="!athletes.length"><td colspan="3" class="empty">暂无运动员</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>