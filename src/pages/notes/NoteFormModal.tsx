import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { IoList, IoCode, IoLink, IoCheckboxOutline, IoImage, IoExpand, IoContract } from '../../utils/icons';
import { Note } from '../../types';
import { Modal, ModalFooter, FormGroup, useToast } from '../../components';
import { MAX_INLINE_IMAGE_BYTES } from '../../utils/constants';
import { NOTE_COLORS } from './notesHelpers';

interface NoteFormModalProps {
  isOpen: boolean;
  editingNote: Note | null;
  onClose: () => void;
  onSubmit: (values: { title: string; content: string; color: string }) => void;
}

export function NoteFormModal({ isOpen, editingNote, onClose, onSubmit }: NoteFormModalProps) {
  const { show } = useToast();
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState('#FFFFFF');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: { class: 'note-image' },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setNoteContent(editor.getHTML());
    },
  }, []);

  // Reset form when modal opens/closes or editing target changes.
  useEffect(() => {
    if (!isOpen) return;
    if (editingNote) {
      setNoteTitle(editingNote.title);
      setNoteContent(editingNote.content);
      setNoteColor(editingNote.color || '#FFFFFF');
    } else {
      setNoteTitle('');
      setNoteContent('');
      setNoteColor('#FFFFFF');
    }
    setIsFullscreen(false);
  }, [isOpen, editingNote]);

  // Sync external content into the editor instance.
  useEffect(() => {
    if (editor && editor.getHTML() !== noteContent) {
      editor.commands.setContent(noteContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteContent, editor]);

  const handleImageAdd = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > MAX_INLINE_IMAGE_BYTES) {
        show(`Image must be smaller than ${(MAX_INLINE_IMAGE_BYTES / (1024 * 1024)).toFixed(0)} MB. Use "URL" to link a hosted image instead.`, 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        editor?.chain().focus().setImage({ src: base64 }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleImageUrl = () => {
    const url = window.prompt('Enter image URL:');
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  };

  const handleSubmit = () => {
    onSubmit({
      title: noteTitle.trim() || 'Untitled Note',
      content: noteContent.trim(),
      color: noteColor,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingNote ? 'Edit Note' : 'New Note'}
      className={`note-modal ${isFullscreen ? 'note-modal-fullscreen' : ''}`}
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitText={editingNote ? 'Save' : 'Create'}
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
            <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={editor?.isActive('bold') ? 'is-active' : ''} title="Bold">
              <strong>B</strong>
            </button>
            <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={editor?.isActive('italic') ? 'is-active' : ''} title="Italic">
              <em>I</em>
            </button>
            <button type="button" onClick={() => editor?.chain().focus().toggleStrike().run()} className={editor?.isActive('strike') ? 'is-active' : ''} title="Strikethrough">
              <span style={{ textDecoration: 'line-through' }}>S</span>
            </button>
            <div className="toolbar-separator" />
            <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={editor?.isActive('bulletList') ? 'is-active' : ''} title="Bullet List">
              <IoList />
            </button>
            <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={editor?.isActive('orderedList') ? 'is-active' : ''} title="Numbered List">
              <span style={{ fontWeight: 'bold' }}>1.</span>
            </button>
            <button type="button" onClick={() => editor?.chain().focus().toggleTaskList().run()} className={editor?.isActive('taskList') ? 'is-active' : ''} title="Task List">
              <IoCheckboxOutline />
            </button>
            <div className="toolbar-separator" />
            <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()} className={editor?.isActive('blockquote') ? 'is-active' : ''} title="Quote">
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>"</span>
            </button>
            <button type="button" onClick={() => editor?.chain().focus().toggleCodeBlock().run()} className={editor?.isActive('codeBlock') ? 'is-active' : ''} title="Code Block">
              <IoCode />
            </button>
            <button
              type="button"
              onClick={() => {
                const url = window.prompt('Enter URL:');
                if (url) editor?.chain().focus().setLink({ href: url }).run();
              }}
              className={editor?.isActive('link') ? 'is-active' : ''}
              title="Link"
            >
              <IoLink />
            </button>
            <div className="toolbar-separator" />
            <button type="button" onClick={handleImageAdd} title="Upload Image">
              <IoImage />
            </button>
            <button type="button" onClick={handleImageUrl} title="Image from URL" style={{ fontSize: '12px', fontWeight: 'bold' }}>
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
          {NOTE_COLORS.map(color => (
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
  );
}
