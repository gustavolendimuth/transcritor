import { useState } from 'react';
import { Card } from '../ui/Card';
import { UploadCard } from './upload/UploadCard';
import { ResultEditor } from './editor/ResultEditor';
import { HistoryList } from './history/HistoryList';
import { HistoryTagFilter } from './history/HistoryTagFilter';
import { useProjectTags } from './history/useProjectTags';
import type { TranscriptionRecord } from '../types';

export function MainApp() {
  const [activeRecord, setActiveRecord] = useState<TranscriptionRecord | null>(null);
  const [activeTag, setActiveTag] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { tags } = useProjectTags(refreshKey);

  function bumpRefresh() {
    setRefreshKey((key) => key + 1);
  }

  function handleRecordCreated(record: TranscriptionRecord) {
    setActiveRecord(record);
    bumpRefresh();
  }

  function handleRecordSaved() {
    bumpRefresh();
  }

  function handleRecordDeleted(id: number) {
    setActiveRecord((current) => (current?.id === id ? null : current));
    bumpRefresh();
  }

  function handleTagChange(tag: string) {
    if (tags.length > 0 && tag && !tags.includes(tag)) return;
    setActiveTag(tag);
  }

  return (
    <div>
      <UploadCard tags={tags} onRecordCreated={handleRecordCreated} onOpenRecord={setActiveRecord} />
      {activeRecord && <ResultEditor key={activeRecord.id} record={activeRecord} tags={tags} onSaved={handleRecordSaved} />}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="font-display text-lg">Histórico</h2>
          <HistoryTagFilter tags={tags} activeTag={activeTag} onChange={handleTagChange} />
        </div>
        <HistoryList
          activeTag={activeTag}
          activeRecordId={activeRecord?.id ?? null}
          refreshKey={refreshKey}
          onSelectRecord={setActiveRecord}
          onRecordDeleted={handleRecordDeleted}
        />
      </Card>
    </div>
  );
}
