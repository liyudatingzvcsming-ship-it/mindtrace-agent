/**
 * 本人新增模块的回归测试（教师基线中没有这些模块）。
 * 覆盖：表驱动规则引擎、多案例任务库、教师复核闭环与回流统计。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { evaluate, checkGap, DEFAULT_RULES, RULE_SET_VERSION, type Rule } from './ruleEngine'
import { CASES, DEFAULT_CASE_ID, getCase } from './cases'
import { submitReview, getReviews, clearReviews, reviewStats } from './review'
import { analyse } from './learning'

const FULL = '这是过拟合，训练 99% 与验证 78% 差距 21pt。我会加入正则化，并用独立验证集比较干预前后表现。'

function memStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    clear: () => map.clear(),
  }
}

beforeEach(() => vi.stubGlobal('localStorage', memStorage()))
afterEach(() => vi.unstubAllGlobals())

describe('本人模块①：表驱动错因规则引擎', () => {
  it('完整作答命中 4 条规则，三项信号齐备，置信度落在 [0,1]', () => {
    const e = evaluate(FULL)
    expect(e.rule_set).toBe(RULE_SET_VERSION)
    expect(e.hits.map((h) => h.rule_id)).toEqual(
      expect.arrayContaining(['RE-CONCEPT', 'RE-EVIDENCE', 'RE-ACTION', 'RE-NUMERIC']),
    )
    expect(e.signals).toEqual({ concept: true, evidence: true, action: true, numeric: true })
    expect(e.confidence).toBeGreaterThan(0)
    expect(e.confidence).toBeLessThanOrEqual(1)
    expect(e.error_type).toBe('无明显错因')
  })

  it('规则集可整体替换（基线硬编码正则做不到）', () => {
    const custom: Rule[] = [
      { id: 'X-CUSTOM', category: 'concept', label: '自定义规则', keywords: ['自定义词'], weight: 1 },
    ]
    const e = evaluate('这里出现了自定义词', custom)
    expect(e.hits).toHaveLength(1)
    expect(e.hits[0].rule_id).toBe('X-CUSTOM')
    expect(e.error_type).toBe('审题偏差')
    expect(DEFAULT_RULES.length).toBeGreaterThan(0)
  })

  it('反例词触发矛盾记录并下调置信度', () => {
    const plain = evaluate(FULL)
    const conflict = evaluate(FULL + '，不过也可能算欠拟合')
    expect(conflict.contradictions.length).toBeGreaterThan(0)
    expect(conflict.confidence).toBeLessThan(plain.confidence)
  })

  it('数值差距核对：21pt 正确、30pt 判为计算失误', () => {
    expect(checkGap('差距 21pt')).toEqual({ found: true, value: 21, correct: true })
    expect(evaluate('过拟合，训练验证差距 30pt，我会正则化').error_type).toBe('计算失误')
  })

  it('跑题输入标注「未覆盖」，不编造诊断结论', () => {
    const e = evaluate('今天天气不错')
    expect(e.error_type).toBe('未覆盖')
    expect(e.hits).toHaveLength(0)
    expect(e.confidence).toBe(0)
  })

  it('依赖规则未命中时，行动信号不计入有效信号', () => {
    const e = evaluate('我会加入正则化并做交叉验证')
    expect(e.signals.action).toBe(false)
    expect(e.hits.some((h) => h.rule_id === 'RE-ACTION')).toBe(true)
  })
})

describe('本人模块②：可切换的多案例任务库', () => {
  it('共 3 个案例，其中 2 个为本人新增', () => {
    expect(CASES).toHaveLength(3)
    expect(CASES.filter((c) => c.origin === 'student_added')).toHaveLength(2)
    expect(CASES.filter((c) => c.origin === 'teacher_baseline')).toHaveLength(1)
  })

  it('默认案例为教师基线案例，且可切换到本人新增案例', () => {
    expect(getCase(DEFAULT_CASE_ID).origin).toBe('teacher_baseline')
    expect(getCase('CASE-002').origin).toBe('student_added')
    expect(getCase('CASE-003').focus).toContain('类别不平衡')
  })

  it('每个案例都有指标、题干与预期错因类别', () => {
    for (const c of CASES) {
      expect(c.prompt.length).toBeGreaterThan(10)
      expect(c.metrics.length).toBeGreaterThan(0)
      expect(c.expected_error_types.length).toBeGreaterThan(0)
    }
  })

  it('未知 id 安全回退到默认案例', () => {
    expect(getCase('NOT-EXIST').id).toBe(DEFAULT_CASE_ID)
  })

  it('新增案例的题干与基线案例不重复', () => {
    const titles = CASES.map((c) => c.title)
    expect(new Set(titles).size).toBe(titles.length)
  })
})

describe('本人模块③：教师复核闭环与回流统计', () => {
  it('提交采纳/驳回后记录可读取，重复提交覆盖而不累加', () => {
    submitReview('task-1', 'accepted', '证据链完整')
    expect(getReviews()).toHaveLength(1)
    expect(getReviews()[0].decision).toBe('accepted')
    submitReview('task-1', 'rejected')
    expect(getReviews()).toHaveLength(1)
    expect(getReviews()[0].decision).toBe('rejected')
  })

  it('统计正确反映待复核/采纳/驳回与平均证据条数', () => {
    const a = analyse('A', FULL)
    const b = analyse('B', '训练和验证结果不同')
    const reviews = [submitReview(a.id, 'accepted')]
    const stats = reviewStats([a, b], reviews)
    expect(stats.total_records).toBe(2)
    expect(stats.accepted).toBe(1)
    expect(stats.rejected).toBe(0)
    expect(stats.pending).toBe(1)
    expect(stats.avg_evidence_items).toBeGreaterThan(0)
    expect(stats.by_error_type['无明显错因']).toBe(1)
  })

  it('清空复核记录后统计回到全待复核', () => {
    const a = analyse('A', FULL)
    submitReview(a.id, 'accepted')
    clearReviews()
    expect(getReviews()).toEqual([])
    expect(reviewStats([a]).pending).toBe(1)
  })

  it('复核数据损坏时安全降级为空列表', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{broken', setItem: () => {}, removeItem: () => {} })
    expect(getReviews()).toEqual([])
  })
})

