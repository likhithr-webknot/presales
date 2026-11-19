import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planNextStep } from './routing'
import { diffTexts, stampHumanEdits } from './provenance'

const job = (step: number, status: string, error?: string) => ({ step, status, error })

test('waits while any job in the current step is unfinished', () => {
  assert.deepEqual(planNextStep(3, [job(0, 'COMPLETED'), job(0, 'RUNNING')]), { action: 'wait' })
})

test('advances only when every parallel job in the step completed', () => {
  assert.deepEqual(planNextStep(3, [job(0, 'COMPLETED'), job(0, 'COMPLETED')]), { action: 'next', step: 1 })
})

test('finishes after the last step', () => {
  assert.deepEqual(planNextStep(2, [job(0, 'COMPLETED'), job(1, 'COMPLETED')]), { action: 'done' })
})

test('a failed job stops the run with its error', () => {
  assert.deepEqual(planNextStep(3, [job(0, 'COMPLETED'), job(0, 'FAILED', 'boom')]), { action: 'failed', error: 'boom' })
})

test('does not advance a cancelled run', () => {
  assert.deepEqual(planNextStep(3, [job(0, 'CANCELLED')]), { action: 'wait' })
})

test('edited text is stamped human; untouched text keeps its provenance', () => {
  const bullet = (text: string) => ({ text, evidence_ids: ['e1'], quote: 'q', origin: 'ai_verified' })
  const prev = { slides: [{ title: 'S', bullets: [bullet('Uptime is 99.95%.')] }] }
  const next = { slides: [{ title: 'S', bullets: [bullet('Uptime is 99.95%.'), bullet('Uptime is 99.999%.')] }] }
  const out = stampHumanEdits(prev, next)
  assert.equal(out.slides[0].bullets[0].origin, 'ai_verified')
  assert.equal(out.slides[0].bullets[1].origin, 'human')
})

test('diffTexts reports only what a person removed and added', () => {
  const b = (text: string) => ({ text, evidence_ids: ['e1'] })
  const d = diffTexts({ s: [b('keep'), b('gone')] }, { s: [b('keep'), b('new')] })
  assert.deepEqual(d, { removed: ['gone'], added: ['new'] })
})
