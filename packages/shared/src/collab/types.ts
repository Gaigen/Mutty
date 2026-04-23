// Collab sync types.

export interface CollabMessage {
  module: string;
  type: string;
  payload: unknown;
  author: string;
  ts: number;
}

export interface CollabModuleState {
  id: string;
  participants: string[];
}
