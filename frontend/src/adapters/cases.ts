/**
 * 本人设计模块 ②：可切换的多案例任务库（教师基线中不存在）
 *
 * 教师基线把「猫狗分类过拟合」唯一案例硬编码在 App.vue 与 learning.ts 中，
 * 题目、指标、prompt 都写死在模板里。本模块把案例抽成数据，新增两个本人设计的
 * 诊断案例（数据泄漏、类别不平衡），并标注每个案例的来源，便于区分
 * 「教师基线内容」与「本人新增内容」。
 *
 * 所有案例均为 DEMO / SAMPLE 虚拟数据，不含真实学生或生产数据。
 */

export interface CaseMetric {
  label: string
  value: string
}

export interface CaseItem {
  id: string
  eyebrow: string
  title: string
  prompt: string
  metrics: CaseMetric[]
  focus: string
  /** 建议关注的错因类别，用于教师复核时对照 */
  expected_error_types: string[]
  origin: 'teacher_baseline' | 'student_added'
}

export const CASES: readonly CaseItem[] = [
  {
    id: 'CASE-001',
    eyebrow: 'CASE 001 · IMAGE CLASSIFICATION',
    title: '猫狗分类模型发生了什么？',
    prompt: '猫狗分类模型训练准确率 99%，验证准确率 78%。你认为发生了什么？如何确认并改进？',
    metrics: [
      { label: 'TRAIN ACCURACY', value: '99%' },
      { label: 'VALIDATION ACCURACY', value: '78%' },
      { label: 'GAP', value: '21 pt' },
    ],
    focus: '过拟合概念与验证方案',
    expected_error_types: ['无明显错因', '概念不清', '表达不完整', '计算失误'],
    origin: 'teacher_baseline',
  },
  {
    id: 'CASE-002',
    eyebrow: 'CASE 002 · DATA LEAKAGE（本人新增）',
    title: '验证分数异常偏高，问题出在哪？',
    prompt: '某分类模型验证准确率 98%，但上线后真实数据只有 61%。请分析可能原因，并说明如何确认与改进。',
    metrics: [
      { label: 'VALIDATION', value: '98%' },
      { label: 'ONLINE REAL', value: '61%' },
      { label: 'GAP', value: '37 pt' },
    ],
    focus: '数据泄漏与训练集/验证集隔离',
    expected_error_types: ['概念不清', '审题偏差', '表达不完整', '未覆盖'],
    origin: 'student_added',
  },
  {
    id: 'CASE-003',
    eyebrow: 'CASE 003 · CLASS IMBALANCE（本人新增）',
    title: '整体准确率很高，为什么 minority 类全错？',
    prompt: '数据集中正类占 95%、负类占 5%，模型整体准确率 95%，但负类召回率仅 8%。请解释原因并提出可检验的改进。',
    metrics: [
      { label: 'OVERALL ACC', value: '95%' },
      { label: 'MINORITY RECALL', value: '8%' },
      { label: 'POSITIVE RATIO', value: '95%' },
    ],
    focus: '类别不平衡与指标选择',
    expected_error_types: ['概念不清', '审题偏差', '表达不完整', '未覆盖'],
    origin: 'student_added',
  },
]

export const DEFAULT_CASE_ID = 'CASE-001'

export function getCase(id: string): CaseItem {
  return CASES.find((c) => c.id === id) ?? CASES[0]
}
