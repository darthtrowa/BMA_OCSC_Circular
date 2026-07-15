export type WorkflowStatus =
  | 'DRAFT'
  | 'PENDING_GRP_REVIEW'
  | 'PENDING_HR_GRP_REVIEW'
  | 'PENDING_SEC_APPROVAL'
  | 'PENDING_HR_SEC_APPROVAL'
  | 'PENDING_DIRECTOR_APPROVAL'
  | 'PENDING_HR_APPROVAL'
  | 'PENDING_DELEGATION'
  | 'PENDING_EXECUTION'
  | 'PENDING_CLOSE'
  | 'COMPLETED'
  | 'REJECTED'
  | 'PENDING_PARALLEL';

export type WorkflowAction =
  | 'SUBMITTED'
  | 'DELEGATED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'REJECTED'
  | 'FINALIZED'
  | 'PARALLEL_ASSIGNED'
  | 'PARALLEL_DELEGATED'
  | 'PARALLEL_SUBMITTED'
  | 'PARALLEL_REJECTED'
  | 'STARTED';

export interface WorkflowHistory {
  wh_id: number;
  in_id: number;
  pa_id?: number;
  from_user_id: number;
  to_user_id: number;
  action: WorkflowAction;
  comments: string;
  created_at: Date;
}
