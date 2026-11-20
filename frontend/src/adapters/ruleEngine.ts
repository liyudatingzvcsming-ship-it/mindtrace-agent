/**
 * 本人设计模块 ①：表驱动的错因规则引擎（教师基线中不存在）
 *
 * 与教师基线的区别：
 *  - 基线 `analyse()` 内只有 3 个硬编码正则（/过拟合|overfit/ 等），直接拼接反馈文本；
 *  - 本模块把规则抽成可配置数据：规则 id、类别、关键词、权重、反例词、依赖规则；
 *  - 输出命中明细、加权置信度、矛盾（反例）检测、数值核对与分类依据，
 *    规则集可整体替换（evaluate(text, customRules)），便于回归测试与后续扩展。
 *
 * 本模块独立于基线适配器，不改动基线 feedback / diagnosis 的输出，保证旧功能无回归。
 * 全部为本地确定性计算，DEMO / SAMPLE，不调用任何外部模型或生产服务。
 */

export interface Rule {
  id: string
  category: 'concept' | 'evidence' | 'action' | 'numeric'
  label: string
  keywords: readonly string[]
  weight: number
  /** 反例词：命中说明作答自相矛盾，置信度下调并记入 contradictions */
  negative?: readonly string[]
  /** 依赖规则：该规则只有在依赖规则也命中时才计入有效信号 */
  requires?: readonly string[]
}

export interface RuleHit {
  rule_id: string
  label: string
  category: string
  matched: string[]
  weight: number
  negative_hits: string[]
}

export interface Evaluation {
  rule_set: string
  hits: RuleHit[]
  signals: { concept: boolean; evidence: boolean; action: boolean; numeric: boolean }
  confidence: number
  error_type: string
  reason: string
  contradictions: string[]
  numeric_check: string
}

export const RULE_SET_VERSION = 'student-rule-engine-v1'

export const DEFAULT_RULES: readonly Rule[] = [
  {
    id: 'RE-CONCEPT',
    category: 'concept',
    label: '识别过拟合概念',
    keywords: ['过拟合', 'overfit', '泛化能力差', '死记硬背', '记住了训练集'],
    weight: 3,
    negative: ['欠拟合', 'underfit'],
  },
  {
    id: 'RE-EVIDENCE',
    category: 'evidence',
    label: '引用训练/验证数据证据',
    keywords: ['训练', '验证', '99', '78', '21', '差距', '准确率', '数据', '泛化'],
    weight: 2,
  },
  {
    id: 'RE-ACTION',
    category: 'action',
    label: '提出可检验的改进或验证方案',
    keywords: ['正则', '早停', '交叉验证', '更多数据', '数据增强', '增强', '简化', 'dropout', '检查', '验证集', '比较', '独立', '干预', '对照'],
    weight: 2,
    requires: ['RE-CONCEPT'],
  },
  {
    id: 'RE-NUMERIC',
    category: 'numeric',
    label: '数值差距核算',
    keywords: ['差距', '21pt', '21 分', '21pt'],
    weight: 1,
  },
]

const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g

export function checkGap(text: string): { found: boolean; value: number | null; correct: boolean } {
  const m =
    text.match(/差距[^0-9]{0,8}(\d{1,3})\s*(?:pt|个百分点|分|%)/i) ||
    text.match(/99\s*[-–]\s*78\s*=\s*(\d{1,3})/i)
  if (!m) return { found: false, value: null, correct: false }
  const value = Number(m[1])
  return { found: true, value, correct: value === 21 }
}

/**
 * 规则求值：纯函数，可替换规则集。
 * 置信度 = 命中规则权重 / 全部规则权重，再按矛盾条目扣减（每条 -0.2），下限 0。
 * 置信度只表示规则匹配强度，不是学生能力评分，也不构成自动评级。
 */
export function evaluate(rawText: string, rules: readonly Rule[] = DEFAULT_RULES): Evaluation {
  const text = rawText.replace(CONTROL_CHARS, '').trim()
  const lower = text.toLowerCase()
  const hits: RuleHit[] = []
  const contradictions: string[] = []

  for (const rule of rules) {
    const matched = rule.keywords.filter((kw) => lower.includes(kw.toLowerCase()))
    if (!matched.length) continue
    const negative_hits = (rule.negative ?? []).filter((kw) => lower.includes(kw.toLowerCase()))
    if (negative_hits.length) {
      contradictions.push(`规则 ${rule.id} 同时命中反例词「${negative_hits.join('、')}」，结论需教师复核`)
    }
    hits.push({
      rule_id: rule.id,
      label: rule.label,
      category: rule.category,
      matched,
      weight: rule.weight,
      negative_hits,
    })
  }

  const hitIds = new Set(hits.map((h) => h.rule_id))
  const effective = hits.filter((h) => {
    const rule = rules.find((r) => r.id === h.rule_id)
    return !rule?.requires || rule.requires.every((dep) => hitIds.has(dep))
  })

  const signals = {
    concept: effective.some((h) => h.category === 'concept'),
    evidence: effective.some((h) => h.category === 'evidence'),
    action: effective.some((h) => h.category === 'action'),
    numeric: effective.some((h) => h.category === 'numeric'),
  }

  const totalWeight = rules.reduce((sum, r) => sum + r.weight, 0)
  const hitWeight = effective.reduce((sum, h) => sum + h.weight, 0)
  const confidence = Math.max(0, Math.min(1, hitWeight / totalWeight - contradictions.length * 0.2))

  const gap = checkGap(text)
  const numeric_check = gap.found
    ? `检测到差距数值 ${gap.value}pt，${gap.correct ? '与 21pt 一致' : '与 21pt 不一致'}`
    : '作答未给出可核对的差距数值'

  let error_type: string
  let reason: string
  if (gap.found && !gap.correct) {
    error_type = '计算失误'
    reason = `作答给出的差距为 ${gap.value}pt，与 99%-78%=21pt 不一致，请重新核算。`
  } else if (!signals.concept && !signals.evidence && !signals.action) {
    error_type = '未覆盖'
    reason = '规则集未覆盖该输入，不输出错因结论，转教师复核。'
  } else if (!signals.concept && signals.evidence) {
    error_type = '概念不清'
    reason = '注意到表现差距，但未使用「过拟合」概念解释，三项信号不齐。'
  } else if (signals.concept && !signals.evidence) {
    error_type = '审题偏差'
    reason = '给出概念判断，但未引用题目提供的指标数据作为依据。'
  } else if (signals.concept && !signals.action) {
    error_type = '表达不完整'
    reason = '已识别概念，但缺少可检验的改进或验证方案。'
  } else {
    error_type = '无明显错因'
    reason = '概念、数据证据与可检验方案三项信号均命中，规则基线未发现明显错因。'
  }

  return {
    rule_set: RULE_SET_VERSION,
    hits,
    signals,
    confidence: Number(confidence.toFixed(2)),
    error_type,
    reason,
    contradictions,
    numeric_check,
  }
}
