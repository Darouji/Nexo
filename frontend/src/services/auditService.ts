import { api } from "./api";

export type AuditActivityParams = {
  limit?: number;
  module?: string;
  action?: string;
};

export type RecordChangeParams = {
  app_label: string;
  model: string;
  object_id: string;
  limit?: number;
};

export interface AuditLog {
  id: number;
  actor: number | null;
  actor_name: string;
  action: string;
  action_display: string;
  origin: string;
  origin_display: string;
  module: string;
  model_name: string;
  object_id: string;
  object_repr: string;
  ip_address: string | null;
  user_agent: string;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RecordChangeLog {
  id: number;
  content_type: number;
  content_type_label: string;
  object_id: string;
  action: string;
  action_display: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: number | null;
  changed_by_name: string;
  origin: string;
  origin_display: string;
  reason: string;
  created_at: string;
}

export type AuditActivityResponse = {
  count: number;
  limit: number;
  results: AuditLog[];
};

export type RecordChangeResponse = {
  count: number;
  limit: number;
  app_label: string;
  model: string;
  object_id: string;
  results: RecordChangeLog[];
};

function normalizeAuditParams(params: AuditActivityParams = {}) {
  return {
    limit: params.limit || undefined,
    module: params.module?.trim() || undefined,
    action: params.action?.trim() || undefined,
  };
}

export async function fetchAuditActivity(params: AuditActivityParams = {}) {
  const response = await api.get<AuditActivityResponse>("/audit/activity/", {
    params: normalizeAuditParams(params),
  });

  return response.data;
}

export async function fetchRecordChangeHistory(params: RecordChangeParams) {
  const response = await api.get<RecordChangeResponse>(
    "/audit/record-changes/",
    {
      params: {
        app_label: params.app_label.trim(),
        model: params.model.trim().toLowerCase(),
        object_id: params.object_id.trim(),
        limit: params.limit || undefined,
      },
    },
  );

  return response.data;
}
