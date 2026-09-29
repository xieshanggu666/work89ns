import { defineStore } from 'pinia'

const j = (p, o) => fetch(p, o).then(r => r.json())

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
    async score(mid, sa, sb, tbA = null, tbB = null) {
      const r = await j('/api/matches/' + mid + '/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score_a: sa, score_b: sb, tb_a: tbA, tb_b: tbB }) })
      if (r && r.error) throw new Error(r.error)
      await this.refresh()
    },
    async genKO(sid) { const r = await j('/api/ko/' + sid, { method: 'POST' }); await this.refresh(); return r.msg },
    async saveTrack(sid, list) { await j('/api/track/' + sid, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(list) }); await this.refresh() },
    async reset() { await j('/api/reset'); await this.init() }
  }
})