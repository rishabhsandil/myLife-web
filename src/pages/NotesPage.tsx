import { useState, useEffect } from 'react';
import { IoAdd, IoTrash, IoDocumentTextOutline, IoSearchOutline, IoList, IoCode, IoLink, IoCheckboxOutline, IoImage, IoExpand, IoContract } from 'react-icons/io5';
import { useSwipeable } from 'react-swipeable';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { Note } from '../types';
import { getNotes as apiGetNotes, saveNote, updateNote, deleteNote as apiDeleteNote } from '../utils/api';
import { Modal, ModalFooter, FormGroup, FAB, EmptyState } from '../components';
import { useModal } from '../hooks';
import './NotesPage.css';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const noteModal = useModal<Note>();
  const deleteModal = useModal<Note>();

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState('#FFFFFF');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const noteColors = [
    { name: 'White', value: '#FFFFFF' },
    { name: 'Yellow', value: '#FFF176' },
    { name: 'Pink', value: '#F48FB1' },
    { name: 'Purple', value: '#CE93D8' },
    { name: 'Blue', value: '#81D4FA' },
    { name: 'Green', value: '#AED581' },
    { name: 'Orange', value: '#FFB74D' },
  ];

  // Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'note-image',
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setNoteContent(editor.getHTML());
    },
  }, []);

  // Update editor content when noteContent changes externally
  useEffect(() => {
    if (editor && editor.getHTML() !== noteContent) {
      editor.commands.setContent(noteContent);
    }
  }, [noteContent, editor]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const noteData = await apiGetNotes();
    // Sort by most recently updated first
    const sorted = noteData.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    setNotes(sorted);
    setIsLoading(false);
  }

  const resetNoteForm = () => {
    setNoteTitle('');
    setNoteContent('');
    setNoteColor('#FFFFFF');
    setIsFullscreen(false);
  };

  const openAddModal = () => {
    resetNoteForm();
    noteModal.open();
  };

  const openEditModal = (note: Note) => {
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteColor(note.color || '#FFFFFF');
    noteModal.open(note);
  };

  const handleImageAdd = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          editor?.chain().focus().setImage({ src: base64 }).run();
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleImageUrl = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  };

  const handleSave = async () => {
    const title = noteTitle.trim() || 'Untitled Note';
    const content = noteContent.trim();

    if (noteModal.data) {
      // Update existing
      const updated: Note = {
        ...noteModal.data,
        title,
        content,
        color: noteColor,
        updatedAt: new Date().toISOString(),
      };
      await updateNote(updated);
      setNotes(notes.map(n => n.id === updated.id ? updated : n)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } else {
      // Add new
      const newNote: Note = {
        id: Date.now().toString(),
        title,
        content,
        color: noteColor,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveNote(newNote);
      setNotes([newNote, ...notes]);
    }

    noteModal.close();
  };

  const handleDeleteNote = async (id: string) => {
    await apiDeleteNote(id);
    setNotes(notes.filter(n => n.id !== id));
  };

  // Filter notes based on search query
  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get preview text from content (first 100 chars, strips HTML)
  const getPreviewText = (content: string): string => {
    if (!content) return 'No additional text';
    // Strip HTML tags
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
    if (!plainText) return 'No additional text';
    return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="notes-page">
      {/* Header */}
      <header className="notes-header">
        <div>
          <h1 className="header-title">Notes</h1>
          <p className="header-subtitle">Your thoughts & ideas 📝</p>
        </div>
      </header>

      {/* Search Bar */}
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

      {/* Notes Grid */}
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
            <EmptyState
              icon={IoSearchOutline}
              message="No notes found"
            />
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
                formatDate={formatDate}
                getPreviewText={getPreviewText}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <FAB onClick={openAddModal} />

      {/* Add/Edit Note Modal */}
      <Modal
        isOpen={noteModal.isOpen}
        onClose={noteModal.close}
        title={noteModal.data ? 'Edit Note' : 'New Note'}
        className={`note-modal ${isFullscreen ? 'note-modal-fullscreen' : ''}`}
        footer={
          <ModalFooter
            onCancel={noteModal.close}
            onSubmit={handleSave}
            submitText={noteModal.data ? 'Save' : 'Create'}
          />
        }
      >
        <FormGroup label="Title">
          <input
            type="text"
            value={noteTitle}
            onChange={e => setNoteTitle(e.target.value)}
            placeholder="Untitled Note"
            autoFocus
          />
        </FormGroup>

        <FormGroup label="Content">
          <div className="note-editor">
            <div className="editor-toolbar">
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={editor?.isActive('bold') ? 'is-active' : ''}
                title="Bold"
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={editor?.isActive('italic') ? 'is-active' : ''}
                title="Italic"
              >
                <em>I</em>
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleStrike().run()}
                className={editor?.isActive('strike') ? 'is-active' : ''}
                title="Strikethrough"
              >
                <span style={{ textDecoration: 'line-through' }}>S</span>
              </button>
              <div className="toolbar-separator" />
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={editor?.isActive('bulletList') ? 'is-active' : ''}
                title="Bullet List"
              >
                <IoList />
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                className={editor?.isActive('orderedList') ? 'is-active' : ''}
                title="Numbered List"
              >
                <span style={{ fontWeight: 'bold' }}>1.</span>
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleTaskList().run()}
                className={editor?.isActive('taskList') ? 'is-active' : ''}
                title="Task List"
              >
                <IoCheckboxOutline />
              </button>
              <div className="toolbar-separator" />
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                className={editor?.isActive('blockquote') ? 'is-active' : ''}
                title="Quote"
              >
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>"</span>
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                className={editor?.isActive('codeBlock') ? 'is-active' : ''}
                title="Code Block"
              >
                <IoCode />
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = window.prompt('Enter URL:');
                  if (url) {
                    editor?.chain().focus().setLink({ href: url }).run();
                  }
                }}
                className={editor?.isActive('link') ? 'is-active' : ''}
                title="Link"
              >
                <IoLink />
              </button>
              <div className="toolbar-separator" />
              <button
                type="button"
                onClick={handleImageAdd}
                title="Upload Image"
              >
                <IoImage />
              </button>
              <button
                type="button"
                onClick={handleImageUrl}
                title="Image from URL"
                style={{ fontSize: '12px', fontWeight: 'bold' }}
              >
                URL
              </button>
              <div className="toolbar-separator" />
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={isFullscreen ? 'is-active' : ''}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <IoContract /> : <IoExpand />}
              </button>
            </div>
            <EditorContent editor={editor} className="editor-content" />
          </div>
        </FormGroup>

        <FormGroup label="Color">
          <div className="color-picker-grid">
            {noteColors.map(color => (
              <button
                key={color.value}
                className={`color-option ${noteColor === color.value ? 'selected' : ''}`}
                style={{ background: color.value }}
                onClick={() => setNoteColor(color.value)}
                title={color.name}
              >
                {noteColor === color.value && <span className="color-check">✓</span>}
              </button>
            ))}
          </div>
        </FormGroup>
      </Modal>

      {/* Delete Confirmation Modal */}
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

// Note Card Component
interface NoteCardProps {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  formatDate: (date: string) => string;
  getPreviewText: (content: string) => string;
}

function NoteCard({ note, onEdit, onDelete, formatDate, getPreviewText }: NoteCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const resetSwipe = () => {
    setSwipeOffset(0);
    setIsSwiping(false);
  };

  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left') {
        const offset = Math.min(0, Math.max(-100, eventData.deltaX));
        setSwipeOffset(offset);
        setIsSwiping(true);
      }
    },
    onSwiped: (eventData) => {
      if (eventData.dir === 'Left' && swipeOffset < -70) {
        onDelete();
        setTimeout(resetSwipe, 300);
      } else {
        resetSwipe();
      }
      setIsSwiping(false);
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  const contentStyle = {
    transform: `translateX(${swipeOffset}px)`,
    transition: isSwiping ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  return (
    <div className="note-card-wrapper">
      <div className="swipe-delete-bg">
        <IoTrash size={20} />
      </div>
      <div 
        className="note-card" 
        style={{ ...contentStyle, background: note.color || '#FFFFFF' }}
        onClick={onEdit}
        {...swipeHandlers}
      >
        <h3 className="note-title">{note.title}</h3>
        <p className="note-preview">{getPreviewText(note.content)}</p>
        <span className="note-date">{formatDate(note.updatedAt)}</span>
      </div>
    </div>
  );
}
