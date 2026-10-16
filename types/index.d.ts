export type NightMode = 'auto' | 'on' | 'off'

export type CutinKind = 'yoru' | 'tsukkomi' | 'homeru' | 'ranyu' | 'seikatsu'

export type Cutin = { id: number; kind: CutinKind; title: string; sub: string }

declare module 'claude-code' {
  interface PluginState {
    okan: {
      nightMode: NightMode
      recent: string[]
      tsukkomi: string | null
      yappariCount: number
      cutin: Cutin | null
      isMuted: boolean
      isZengamen: boolean
      firedSlots: string[]
    }
  }
}
