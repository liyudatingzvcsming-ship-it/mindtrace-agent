/**
 * 本人设计模块 ③：教师复核闭环与回流统计（教师基线中不存在）
 *
 * 教师基线的「教师证据视图」只能查看与清空记录，没有任何复核动作、结论状态或统计。
 * 本模块实现：采纳 / 驳回 + 复核意见 -> 复核记录本地留存 -> 按错因类别回流统计，
 * 形成「学生作答 → 证据链诊断 → 教师采纳/驳回 → 统计回流」的闭环。
 *
 * 系统仍不自动给学生评级：复核决定只能由教师在界面上做出，规则引擎不写入决定。
 * 全部数据存于本机 localStorage，均为 DEMO / SAMPLE。
 */

import type { EvidenceRecord } from './learning'

export type ReviewDecision = 'accepted' | 'rejected'

export interface ReviewRecord {
  task_id: string
  decision: ReviewDecision
  note: string
  reviewer: string
  reviewed_at: string
}

export interface ReviewStats {
  total_records: number
  pending: number
  accepted: number
  rejected: number
  avg_evidence_items: number
  by_error_type: Record<string, number>
}

const REVIEW_KEY = 'mindtrace-student-review-v1'

export function getReviews(): ReviewRecord[] {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_KEY) ?? '[]') as ReviewRecord[]
  } catch {
    return []
  }
}

export function submitReview(task_id: string, decision: ReviewDecision, note = ''): ReviewRecord {
  const record: ReviewRecord = {
    task_id,
    decision,
    note,
    reviewer: 'teacher_demo',
    reviewed_at: new Date().toISOString(),
  }
  const others = getReviews().filter((r) => r.task_id !== task_id)
  localStorage.setItem(REVIEW_KEY, JSON.stringify([record, ...others].slice(0, 100)))
  return record
}

export function clearReviews(): void {
  localStorage.removeItem(REVIEW_KEY)
}

export function reviewStats(records: EvidenceRecord[], reviews: ReviewRecord[] = getReviews()): ReviewStats {
  const byDecision = new Map(reviews.map((r) => [r.task_id, r.decision]))
  const by_error_type: Record<string, number> = {}
  let evidenceTotal = 0
  for (const record of records) {
    const type = record.error_type ?? '基线记录'
    by_error_type[type] = (by_error_type[type] ?? 0) + 1
    evidenceTotal += record.evidence_chain?.length ?? 0
  }
  const accepted = reviews.filter((r) => r.decision === 'accepted' && byDecision.has(r.task_id)).length
  const rejected = reviews.filter((r) => r.decision === 'rejected' && byDecision.has(r.task_id)).length
  const reviewedOnRecords = records.filter((r) => byDecision.has(r.id)).length
  return {
    total_records: records.length,
    pending: records.length - reviewedOnRecords,
    accepted,
    rejected,
    avg_evidence_items: records.length ? Number((evidenceTotal / records.length).toFixed(2)) : 0,
    by_error_type,
  }
}
