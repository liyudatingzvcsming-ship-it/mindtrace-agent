/**
 * MindTrace-Agent · 规则基线适配器（DEMO / SAMPLE）
 *
 * 课程设计「最小改进」：为错因分类设计可测试规则与证据链字段。
 *  - 所有结论必须由一条明确的规则命中或作答原文支撑（evidence_chain）；
 *  - 规则置信度仅表示关键词匹配强度，不是学生能力评分；
 *  - 系统不自动评级，全部记录 need_review=true / pending_teacher_review；
 *  - 所有输出标注 DEMO / SAMPLE 与 not_verified，不连接任何生产服务。
 *
 * 基线行为（feedback / diagnosis / source / mode / localStorage KEY）保持不变，
 * 以保证旧功能无回归（见 learning.test.ts 的回归用例与 T04）。
 */

export type StudentId = 'A' | 'B'

export type ErrorType =
  | '无明显错因'
  | '概念不清'
  | '审题偏差'
  | '计算失误'
  | '表达不完整'
  | '未覆盖'

export type EvidenceSource = 'student_answer' | 'rule_baseline' | 'local_session'

export interface EvidenceItem {
  claim: string
  source: EvidenceSource
  ref: string
  value: string
  verified: false
}

export interface EvidenceSummary {
  rule_id: string
  rule_version: string
  concept_hits: string[]
  evidence_hits: string[]
  action_hits: string[]
  signals: { concept: boolean; evidence: boolean; action: boolean }
  numeric_check: string
}

export interface EvidenceRecord {
  id: string
  student: StudentId
  answer: string
  feedback: string
  diagnosis: string
  source: 'current_local_session'
  mode: 'rule_baseline'
  createdAt: string
  /* ↓ 本次课程设计新增：可测试错因规则 + 证据链 */
  error_type: ErrorType
  confidence: number
  need_review: true
  review_status: 'pending_teacher_review'
  evidence_chain: EvidenceItem[]
  evidence_summary: EvidenceSummary
  notice: string
}

/** 可测试规则表：每条规则有稳定 id，测试可直接引用。 */
export const RULES = {
  RULE_VERSION: 'rule-baseline-v2',
  MAX_ANSWER_LENGTH: 2000,
  CONCEPT: {
    id: 'R-CONCEPT',
    label: '识别过拟合概念',
    keywords: ['过拟合', 'overfit', '泛化能力差', '记住了训练集', '死记硬背'],
  },
  EVIDENCE: {
    id: 'R-EVIDENCE',
    label: '引用训练/验证数据证据',
    keywords: ['训练', '验证', '99', '78', '21', '差距', '准确率', '数据', '泛化'],
  },
  ACTION: {
    id: 'R-ACTION',
    label: '提出可检验的改进或验证方案',
    keywords: [
      '正则', '早停', '交叉验证', '更多数据', '数据增强', '增强', '简化',
      'dropout', '检查', '验证集', '比较', '独立', '干预', '对照',
    ],
  },
  MISCALC: { id: 'R-MISCALC', label: '数值差距计算', expected_gap: 21 },
} as const

const KEY = 'mindtrace-demo-evidence-v1'
const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g

export const prompt = '猫狗分类模型训练准确率 99%，验证准确率 78%。你认为发生了什么？如何确认并改进？'

function matchKeywords(text: string, keywords: readonly string[]): string[] {
  const lower = text.toLowerCase()
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()))
}

/** 检测作答中给出的差距数值是否与题目 99% - 78% = 21pt 一致。 */
export function checkNumericGap(text: string): { found: boolean; value: number | null; correct: boolean } {
  const m =
    text.match(/差距[^0-9]{0,8}(\d{1,3})\s*(?:pt|个百分点|分|%)/i) ||
    text.match(/99\s*[-–]\s*78\s*=\s*(\d{1,3})/i)
  if (!m) return { found: false, value: null, correct: false }
  const value = Number(m[1])
  return { found: true, value, correct: value === RULES.MISCALC.expected_gap }
}

export interface Classification {
  error_type: ErrorType
  confidence: number
  need_review: true
  reason: string
  summary: EvidenceSummary
}

/** 纯函数：规则错因分类，独立于存储与 UI，便于单元测试。 */
export function classify(rawText: string): Classification {
  const text = rawText.replace(CONTROL_CHARS, '').trim()
  const concept_hits = matchKeywords(text, RULES.CONCEPT.keywords)
  const evidence_hits = matchKeywords(text, RULES.EVIDENCE.keywords)
  const action_hits = matchKeywords(text, RULES.ACTION.keywords)
  const signals = {
    concept: concept_hits.length > 0,
    evidence: evidence_hits.length > 0,
    action: action_hits.length > 0,
  }
  const gap = checkNumericGap(text)
  const numeric_check = gap.found
    ? `检测到差距数值 ${gap.value}pt，${gap.correct ? '与 21pt 一致' : '与 21pt 不一致'}`
    : '作答未给出可核对的差距数值'

  let error_type: ErrorType
  let confidence: number
  let reason: string
  if (gap.found && !gap.correct) {
    error_type = '计算失误'
    confidence = 0.9
    reason = `作答给出的差距为 ${gap.value}pt，与题目 99%-78%=21pt 不一致，请重新核算。`
  } else if (!signals.concept && !signals.evidence && !signals.action) {
    error_type = '未覆盖'
    confidence = 0.2
    reason = '作答未命中任何规则关键词，规则库未覆盖该输入，不输出错因结论，转教师复核。'
  } else if (!signals.concept && signals.evidence) {
    error_type = '概念不清'
    confidence = 0.72
    reason = '注意到训练与验证的表现差距，但未使用「过拟合」概念解释两个数字。'
  } else if (signals.concept && !signals.evidence) {
    error_type = '审题偏差'
    confidence = 0.7
    reason = '给出了概念判断，但未引用题目提供的 99%/78% 数据作为依据。'
  } else if (signals.concept && !signals.action) {
    error_type = '表达不完整'
    confidence = 0.78
    reason = '已识别过拟合，但缺少可检验的改进或验证方案。'
  } else {
    error_type = '无明显错因'
    confidence = 0.88
    reason = '概念、数据证据与可检验方案三项信号均命中，规则基线未发现明显错因。'
  }

  return {
    error_type,
    confidence,
    need_review: true,
    reason,
    summary: {
      rule_id: 'overfit-diagnosis-baseline',
      rule_version: RULES.RULE_VERSION,
      concept_hits,
      evidence_hits,
      action_hits,
      signals,
      numeric_check,
    },
  }
}

/** 后处理校验：剔除无来源引用的结论，强制标注 not_verified。 */
export function validateEvidenceChain(chain: EvidenceItem[]): EvidenceItem[] {
  const allowed: EvidenceSource[] = ['student_answer', 'rule_baseline', 'local_session']
  return chain
    .filter((item) => item.ref !== '' && allowed.includes(item.source))
    .map((item) => ({ ...item, verified: false as const }))
}

function buildEvidenceChain(answer: string, cls: Classification): EvidenceItem[] {
  const chain: EvidenceItem[] = [
    { claim: '作答原文留存', source: 'student_answer', ref: 'answer.original', value: answer, verified: false },
  ]
  if (cls.summary.signals.concept) {
    chain.push({
      claim: `命中规则：${RULES.CONCEPT.label}`,
      source: 'rule_baseline',
      ref: RULES.CONCEPT.id,
      value: cls.summary.concept_hits.join('、'),
      verified: false,
    })
  }
  if (cls.summary.signals.evidence) {
    chain.push({
      claim: `命中规则：${RULES.EVIDENCE.label}`,
      source: 'rule_baseline',
      ref: RULES.EVIDENCE.id,
      value: cls.summary.evidence_hits.join('、'),
      verified: false,
    })
  }
  if (cls.summary.signals.action) {
    chain.push({
      claim: `命中规则：${RULES.ACTION.label}`,
      source: 'rule_baseline',
      ref: RULES.ACTION.id,
      value: cls.summary.action_hits.join('、'),
      verified: false,
    })
  }
  chain.push({
    claim: cls.error_type === '未覆盖' ? '规则未覆盖，不输出错因结论' : `错因分类结论：${cls.error_type}`,
    source: 'rule_baseline',
    ref: cls.error_type === '未覆盖' ? `${RULES.RULE_VERSION}:no_match` : `classification:${cls.error_type}`,
    value: cls.reason,
    verified: false,
  })
  return validateEvidenceChain(chain)
}

export function analyse(student: StudentId, answer: string): EvidenceRecord {
  const text = answer.replace(CONTROL_CHARS, '').trim()
  if (!text) throw new Error('请先填写回答')
  if ([...text].length > RULES.MAX_ANSWER_LENGTH) {
    throw new Error(`回答过长（上限 ${RULES.MAX_ANSWER_LENGTH} 字符），请精简后重试`)
  }
  const normalized = text

  /* ---- 基线逻辑保持不变，确保旧功能无回归 ---- */
  const overfit = /过拟合|overfit/i.test(normalized)
  const evidence = /训练|验证|数据|泛化|差距|99|78/.test(normalized)
  const action = /增强|正则|早停|交叉验证|更多数据|简化|dropout|检查/.test(normalized)
  const diagnosis = overfit
    ? '已识别过拟合概念'
    : evidence
      ? '已注意到训练与验证的差距'
      : '尚未指出训练与验证差距'
  const feedback =
    overfit && action
      ? '你指出了过拟合并提出改进方向。下一步请说明如何用独立验证集比较干预前后表现。'
      : overfit
        ? '你识别了过拟合。请再提出至少一项可检验的干预，并说明验证方式。'
        : evidence
          ? '你观察到了表现差异。试着用“过拟合”和“泛化”解释这两个数字，再提出验证办法。'
          : '先比较训练 99% 与验证 78%：模型在未见数据上表现如何？请说明可能原因。'
  /* ---- 基线逻辑结束 ---- */

  const cls = classify(normalized)
  return {
    id: crypto.randomUUID(),
    student,
    answer: text,
    feedback,
    diagnosis,
    source: 'current_local_session',
    mode: 'rule_baseline',
    createdAt: new Date().toISOString(),
    error_type: cls.error_type,
    confidence: cls.confidence,
    need_review: true,
    review_status: 'pending_teacher_review',
    evidence_chain: buildEvidenceChain(text, cls),
    evidence_summary: cls.summary,
    notice: 'DEMO / SAMPLE · 规则基线 · 结论 not_verified · 需教师复核 · 系统不自动评级',
  }
}

/** 证据链完备性检查：诊断单中的每条结论都应能回溯到规则或原文。 */
export function checkEvidenceCompleteness(record: EvidenceRecord): { complete: boolean; missing: string[] } {
  const missing: string[] = []
  if (!record.evidence_chain.length) missing.push('evidence_chain 为空')
  if (!record.evidence_chain.some((i) => i.source === 'student_answer')) missing.push('缺少作答原文记录')
  if (!record.evidence_chain.some((i) => i.ref.startsWith('classification:') || i.ref.endsWith(':no_match'))) {
    missing.push('缺少错因结论来源')
  }
  if (record.evidence_chain.some((i) => i.verified !== false)) missing.push('存在未标注 not_verified 的结论')
  if (record.review_status !== 'pending_teacher_review') missing.push('复核状态异常')
  return { complete: missing.length === 0, missing }
}

export function getEvidence(): EvidenceRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as EvidenceRecord[]
  } catch {
    return []
  }
}

export function saveEvidence(record: EvidenceRecord) {
  localStorage.setItem(KEY, JSON.stringify([record, ...getEvidence()].slice(0, 100)))
}

export function clearEvidence() {
  localStorage.removeItem(KEY)
}
