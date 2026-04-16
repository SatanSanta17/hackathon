'use client';

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
} from 'lucide-react';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TiptapEditorProps {
  content: string | null;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TiptapEditor({
  content,
  onChange,
  placeholder,
  className,
}: TiptapEditorProps) {
  // Force re-render on every transaction so toolbar active states stay in sync
  // Force re-render counter — unnamed first element is intentionally unused
  const [, setTick] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    onTransaction: () => {
      setTick((t) => t + 1);
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
    ],
    content: content ?? '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // If only an empty paragraph, treat as null
      onChange(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none min-h-[200px] px-4 py-3 outline-none',
          'prose-headings:font-semibold prose-p:my-1 prose-ul:my-1 prose-ol:my-1',
        ),
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
  });

  if (!editor) return null;

  return (
    <div
      className={cn(
        'rounded-md border focus-within:ring-2 focus-within:ring-ring',
        className,
      )}
    >
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-background px-2 py-1">
        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="size-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="size-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Ordered List"
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Link */}
        <ToolbarButton
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
            } else {
              const url = window.prompt('Enter URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }
          }}
          isActive={editor.isActive('link')}
          title="Link"
        >
          <LinkIcon className="size-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* History */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          isActive={false}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          isActive={false}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo className="size-4" />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar sub-components
// ---------------------------------------------------------------------------

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'rounded p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        isActive && 'bg-muted text-foreground',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}
