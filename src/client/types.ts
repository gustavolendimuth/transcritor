export interface TranscriptionRecord {
  id: number;
  filename: string;
  text: string;
  projectTag: string | null;
  durationSeconds: number;
  withTimestamps: boolean;
  createdAt: string;
}

export interface TranscriptionChanges {
  filename: string;
  text: string;
  projectTag: string | null;
}
