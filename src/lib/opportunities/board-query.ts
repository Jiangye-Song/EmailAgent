import { pool } from "@/lib/db";
import type { OpportunityStage } from "./schemas";

export type OpportunityBoardItem = {
  id: string;
  company: string;
  role: string;
  stage: OpportunityStage;
  outcome: string;
  latestChange: string;
  nextAction: string | null;
  nextDeadline: string | null;
  confidence: number;
  evidence: string[];
};

export type OpportunityBoard = {
  byStage: Record<OpportunityStage, OpportunityBoardItem[]>;
  urgent: OpportunityBoardItem[];
};

const STAGES: OpportunityStage[] = [
  "applied",
  "assessment",
  "interview",
  "offer",
  "closed",
];

export async function getOpportunityBoard(
  userId: string,
): Promise<OpportunityBoard> {
  const { rows } = await pool.query<{
    id: string;
    company: string;
    role: string;
    stage: string;
    outcome: string;
    latest_change: string;
    next_action: string | null;
    next_deadline: string | null;
    confidence: number;
    evidence: string[];
  }>(
    `SELECT
       o.id,
       o.company,
       o.role,
       o.current_stage AS stage,
       o.outcome,
       COALESCE(
         (SELECT ev.event_type
          FROM opportunity_events ev
          WHERE ev.opportunity_id = o.id
            AND ev.confirmation_status = 'automatic'
          ORDER BY ev.created_at DESC
          LIMIT 1),
         'general_status_update'
       ) AS latest_change,
       o.next_action,
       o.next_deadline,
       o.latest_confidence AS confidence,
       COALESCE(
         (SELECT ev.evidence
          FROM opportunity_events ev
          WHERE ev.opportunity_id = o.id
            AND ev.confirmation_status = 'automatic'
          ORDER BY ev.created_at DESC
          LIMIT 1),
         '[]'::jsonb
       ) AS evidence
     FROM opportunities o
     WHERE o.user_id = $1
       AND o.outcome != 'withdrawn'
     ORDER BY o.updated_at DESC`,
    [userId],
  );

  const byStage: Record<OpportunityStage, OpportunityBoardItem[]> = {
    applied: [],
    assessment: [],
    interview: [],
    offer: [],
    closed: [],
  };

  const urgent: OpportunityBoardItem[] = [];
  const now = new Date();
  const urgentWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  for (const row of rows) {
    const stage = (STAGES.includes(row.stage as OpportunityStage)
      ? row.stage
      : "applied") as OpportunityStage;

    const item: OpportunityBoardItem = {
      id: row.id,
      company: row.company,
      role: row.role,
      stage,
      outcome: row.outcome,
      latestChange: row.latest_change,
      nextAction: row.next_action,
      nextDeadline: row.next_deadline,
      confidence: row.confidence,
      evidence: Array.isArray(row.evidence) ? row.evidence : [],
    };

    byStage[stage].push(item);

    // Urgent: overdue or within 24 hours
    if (row.next_deadline) {
      const deadline = new Date(row.next_deadline);
      if (deadline <= urgentWindow) {
        urgent.push(item);
      }
    }
  }

  // Sort urgent by deadline ascending
  urgent.sort((a, b) => {
    if (!a.nextDeadline) return 1;
    if (!b.nextDeadline) return -1;
    return (
      new Date(a.nextDeadline).getTime() - new Date(b.nextDeadline).getTime()
    );
  });

  return { byStage, urgent };
}
