import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = { plugin: 'okan', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10 } } as const

// 日本時間の昼12時と夜24時
const NOON = Date.UTC(2026, 9, 15, 3)
const MIDNIGHT = Date.UTC(2026, 9, 15, 15)

// おかんが何も出さないときの、空の帯
const emptyBand = (on: On) =>
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, null) as never
  })

const setup = (on: On, now: number) => {
  mock.clock(on, { now })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  emptyBand(on)
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`同じお願いを2回するとツッコむ (${surface})`, async ($, on) => {
    setup(on, NOON)
    await $.prompt.submit({ text: 'スライドを作ってください' })
    const first = await $.ui.mount({ ...BAND, surface })
    expect(await first.find({ text: /おかん/ })).toBeUndefined()
    await first.unmount()

    await $.prompt.submit({ text: 'スライドを作ってください！' })
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ text: /それさっきも言うてた/ })).toBeDefined()
    await ui.press({ key: 'hai' })
    expect(await ui.find({ text: /それさっきも言うてた/ })).toBeUndefined()
  })

  test(`「やっぱり」を数える (${surface})`, async ($, on) => {
    setup(on, NOON)
    await $.prompt.submit({ text: 'やっぱり青色にして' })
    await $.prompt.submit({ text: 'やっぱ赤で' })
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ text: /2回目/ })).toBeDefined()
  })

  test(`夜中は「はよ寝なさい」、昼は静か (${surface})`, async ($, on) => {
    const clock = mock.clock(on, { now: NOON })
    emptyBand(on)
    const day = await $.ui.mount({ ...BAND, surface })
    expect(await day.find({ text: /はよ寝なさい/ })).toBeUndefined()
    await day.unmount()

    await clock.set(MIDNIGHT)
    const night = await $.ui.mount({ ...BAND, surface })
    expect(await night.find({ text: /0時やで/ })).toBeDefined()
  })
}
