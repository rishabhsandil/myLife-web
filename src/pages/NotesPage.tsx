import { useState, useEffect } from 'react';
import { IoAdd, IoDocumentTextOutline, IoSearchOutline } from '../utils/icons';
import { Note } from '../types';
import { getNotes as apiGetNotes, saveNote, updateNote, deleteNote as apiDeleteNote } from '../utils/api';
import { Modal, ModalFooter, FAB, EmptyState, useToast } from '../components';
import { useModal } from '../hooks';
import { NoteCard } from './notes/NoteCard';
import { NoteFormModal } from './notes/NoteFormModal';
import './notes/NotesPage.css';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { showError } = useToast();

  const noteModal = useModal<Note>();
  const deleteModal = useModal<Note>();

  useEffect(() => {
    const ac = new AbortController();
    void loadData(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(signal?: AbortSignal) {
    setIsLoading(true);
    try {
      const noteData = await apiGetNotes(signal);
      // Sort by most recently updated first (copy first — don't mutate response)
      const sorted = [...noteData].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setNotes(sorted);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError(err, 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }

  const openAddModal = () => noteModal.open();
  const openEditModal = (note: Note) => noteModal.open(note);

  const handleSave = async (values: { title: string; content: string; color: string }) => {
    const previousNotes = notes;

    if (noteModal.data) {
      const updated: Note = {
        ...noteModal.data,
        ...values,
        updatedAt: new Date().toISOString(),
      };
      setNotes(notes.map(n => n.id === updated.id ? updated : n)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      noteModal.close();
      try {
        await updateNote(updated);
      } catch (err) {
        setNotes(previousNotes);
        showError(err, 'Failed to update note');
      }
    } else {
      const newNote: Note = {
        id: Date.now().toString(),
        ...values,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setNotes([newNote, ...notes]);
      noteModal.close();
      try {
        await saveNote(newNote);
      } catch (err) {
        setNotes(previousNotes);
        showError(err, 'Failed to add note');
      }
    }
  };

  const handleDeleteNote = async (id: string) => {
    const previousNotes = notes;
    setNotes(notes.filter(n => n.id !== id));
    try {
      await apiDeleteNote(id);
    } catch (err) {
      setNotes(previousNotes);
      showError(err, 'Failed to delete note');
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="notes-page">
      <header className="notes-header">
        <div>
          <h1 className="header-title">Notes</h1>
          <p className="header-subtitle">Your thoughts & ideas 📝</p>
        </div>
      </header>

      <div className="notes-search-container">
        <div className="notes-search-bar">
          <IoSearchOutline size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="notes-container">
        {isLoading ? (
          <div className="notes-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-note">
                <div className="skeleton skeleton-text large" style={{ width: '70%' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '90%', marginTop: '8px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
              </div>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          searchQuery ? (
            <EmptyState icon={IoSearchOutline} message="No notes found" />
          ) : (
            <EmptyState
              icon={IoDocumentTextOutline}
              message="No notes yet"
              action={{ label: 'Create Note', icon: IoAdd, onClick: openAddModal }}
            />
          )
        ) : (
          <div className="notes-grid">
            {filteredNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => openEditModal(note)}
                onDelete={() => deleteModal.open(note)}
              />
            ))}
          </div>
        )}
      </div>

      <FAB onClick={openAddModal} />

      <NoteFormModal
        isOpen={noteModal.isOpen}
        editingNote={noteModal.data ?? null}
        onClose={noteModal.close}
        onSubmit={handleSave}
      />

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete Note"
        footer={
          <ModalFooter
            onCancel={deleteModal.close}
            onSubmit={() => {
              if (deleteModal.data) {
                handleDeleteNote(deleteModal.data.id);
                deleteModal.close();
              }
            }}
            submitText="Delete"
            cancelText="Cancel"
            submitDestructive
          />
        }
      >
        <p>Are you sure you want to delete "{deleteModal.data?.title}"?</p>
      </Modal>
    </div>
  );
}
