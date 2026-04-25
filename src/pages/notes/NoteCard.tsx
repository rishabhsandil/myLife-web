import { Note } from '../../types';
import { SortableSwipeItem } from '../../components';
import { formatRelativeDate, getPreviewText } from './notesHelpers';

interface NoteCardProps {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  return (
    <SortableSwipeItem
      onSwipeDelete={onDelete}
      wrapperClassName="note-card-wrapper"
      contentClassName="note-card"
      contentStyle={{ background: note.color || '#FFFFFF' }}
      onContentClick={onEdit}
    >
      <h3 className="note-title">{note.title}</h3>
      <p className="note-preview">{getPreviewText(note.content)}</p>
      <span className="note-date">{formatRelativeDate(note.updatedAt)}</span>
    </SortableSwipeItem>
  );
}
