import { defineStore } from 'pinia'

const j = (p, o) => fetch(p, o).then(r => r.json())

// 淘汰赛胜方：比分高者胜；平局时取记录的决胜方（加时/点球），未决胜返回 null
export function matchWinnerOf(m) {
  if (m?.status !== 'finished') return null
  if (m.score_a > m.score_b) return m.teamA
  if (m.score_b > m.score_a) return m.teamB
  return m.winner ? (m.winner === m.teamA?.id ? m.teamA : m.teamB) : null
}
export function isKOMatch(m) { return ['半决赛', '决赛', '季军'].includes(m?.stage) }

export const useEventStore = defineStore('event', {
  state: () => ({
    sports: [], teams: [], units: [], venues: [], referees: [],
    athletes: [], matches: [], entries: [], medals: [], overview: null,
    standings: {}, loaded: false
  }),
  getters: {
    teamOf: s => id => s.teams.find(t => t.id === id),
    unitOfUid: s => id => s.units.find(u => u.id === id)
  },
  actions: {
    async init() {
      const [sports, teams, units, venues, referees, athletes, matches, entries, medals, overview] = await Promise.all([
        j('/api/sports'), j('/api/teams'), j('/api/units'), j('/api/venues'), j('/api/referees'),
        j('/api/athletes'), j('/api/matches'), j('/api/entries'), j('/api/medals'), j('/api/overview')
      ])
      Object.assign(this, { sports, teams, units, venues, referees, athletes, matches, entries, medals, overview })
      const st = {}
      for (const s of sports) st[s.id] = await j('/api/standings/' + s.id)
      this.standings = st
      this.loaded = true
    },
    async refresh() {
      const [matches, entries, medals, overview] = await Promise.all([j('/api/matches'), j('/api/entries'), j('/api/medals'), j('/api/overview')])
      Object.assign(this, { matches, entries, medals, overview })
      const st = {}
      for (const s of this.sports) st[s.id] = await j('/api/standings/' + s.id)
      this.standings = st
    },
    async score(mid, sa, sb, winner) {
      const r = await j('/api/matches/' + mid + '/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score_a: sa, score_b: sb, winner: winner ?? null }) })
      await this.refresh()
      return r
    },
    async genKO(sid) { const r = await j('/api/ko/' + sid, { method: 'POST' }); await this.refresh(); return r.msg },
    async saveTrack(sid, list) { await j('/api/track/' + sid, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(list) }); await this.refresh() },
    async reset() { await j('/api/reset'); await this.init() }
  }
})