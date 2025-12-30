'use client';

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { clsx } from 'clsx';
import { Bold, Italic, Trash2 } from 'lucide-react';
import { RichTextContext } from './RichTextProvider';

interface RichEditableCellProps {
    value: string;
    onSave: (val: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    onBlur?: (val: string) => void;
    onCancel?: () => void;
    id?: string;
}

// --- Local Components for Standalone Mode ---

const CustomBubbleMenu = ({ editor }: { editor: any }) => {
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        const updatePosition = () => {
            const { from, to, empty } = editor.state.selection;
            
            if (empty) {
                setPosition(null);
                return;
            }

            const { view } = editor;
            const start = view.coordsAtPos(from);
            const end = view.coordsAtPos(to);
            
            const left = (start.left + end.right) / 2;
            const top = start.top - 40; 

            setPosition({ top, left });
        };

        editor.on('selectionUpdate', updatePosition);
        editor.on('blur', () => setPosition(null));

        return () => {
            editor.off('selectionUpdate', updatePosition);
            editor.off('blur', () => setPosition(null));
        };
    }, [editor]);

    if (!position) return null;

    return (
        <div 
            className="fixed z-50 flex items-center gap-1 p-1 rounded-lg bg-content1 shadow-medium border border-default-200 animate-in fade-in zoom-in-95 duration-100"
            style={{ 
                top: position.top, 
                left: position.left, 
                transform: 'translateX(-50%)' 
            }}
            onMouseDown={(e) => e.preventDefault()} 
        >
             <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={clsx(
                    "p-1 rounded hover:bg-default-100 transition-colors",
                    editor.isActive('bold') ? 'text-primary bg-primary/10' : 'text-default-500'
                )}
                type="button"
            >
                <Bold size={14} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={clsx(
                    "p-1 rounded hover:bg-default-100 transition-colors",
                    editor.isActive('italic') ? 'text-primary bg-primary/10' : 'text-default-500'
                )}
                type="button"
            >
                <Italic size={14} />
            </button>
            
            <div className="w-px h-4 bg-default-200 mx-1" />
            
            <button
                onClick={() => editor.chain().focus().toggleHighlight({ color: '#facc15' }).run()}
                className={clsx(
                    "w-5 h-5 rounded-full border border-default-200 hover:scale-110 transition-transform",
                    editor.isActive('highlight', { color: '#facc15' }) && 'ring-2 ring-offset-1 ring-primary'
                )}
                style={{ backgroundColor: '#facc15' }}
                type="button"
            />
            
             <button
                onClick={() => editor.chain().focus().toggleHighlight({ color: '#f87171' }).run()}
                className={clsx(
                    "w-5 h-5 rounded-full border border-default-200 hover:scale-110 transition-transform",
                    editor.isActive('highlight', { color: '#f87171' }) && 'ring-2 ring-offset-1 ring-primary'
                )}
                style={{ backgroundColor: '#f87171' }}
                type="button"
            />

             <button
                onClick={() => editor.chain().focus().unsetAllMarks().run()}
                className="p-1 rounded hover:bg-default-100 transition-colors text-default-400 ml-1"
                title="Clear formatting"
                type="button"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
};

const StandaloneTiptapEditor = ({ 
    initialContent, 
    onSave, 
    onCancel, 
    onBlurProp, 
    placeholder,
    className 
}: any) => {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: false,
                codeBlock: false,
                bulletList: false,
                orderedList: false,
            }),
            Placeholder.configure({
                placeholder: placeholder,
                emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-default-300 before:float-left before:h-0 before:pointer-events-none',
            }),
            TextStyle,
            Color,
            Highlight.configure({
                multicolor: true,
            }),
        ],
        content: initialContent,
        autofocus: 'end',
        editorProps: {
            attributes: {
                class: clsx(
                    'outline-none min-h-[24px] w-full break-words whitespace-pre-wrap leading-normal flex items-center focus:bg-primary-50/50 dark:focus:bg-primary-900/20 rounded px-1 py-[1px] transition-colors',
                    className
                ),
            },
            handleKeyDown: (view, event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    return true; 
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancel();
                    return true;
                }
                return false;
            }
        },
    });

    useEffect(() => {
        if (!editor) return;
        const handleKeyDown = (view: any, event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                const html = editor.getHTML();
                const isEmpty = editor.isEmpty;
                onSave(isEmpty ? '' : html);
                return true; 
            }
            return false;
        };
    }, [editor, onSave]);

    useEffect(() => {
        if (editor && onSave && onCancel) {
            editor.setOptions({
                editorProps: {
                    handleKeyDown: (view, event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            const html = editor.getHTML();
                            const isEmpty = editor.isEmpty;
                            onSave(isEmpty ? '' : html);
                            return true;
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            onCancel();
                            return true;
                        }
                        return false;
                    }
                }
            })
        }
    }, [editor, onSave, onCancel]);

    const handleBlur = useCallback(() => {
        if (editor) {
            const html = editor.getHTML();
            const isEmpty = editor.isEmpty;
            const finalVal = isEmpty ? '' : html;
            
            if (finalVal !== initialContent) {
                if (onBlurProp) onBlurProp(finalVal);
                onSave(finalVal);
            }
        }
    }, [editor, onSave, onBlurProp, initialContent]);

    if (!editor) return null;

    return (
        <>
            <CustomBubbleMenu editor={editor} />
            <EditorContent 
                editor={editor} 
                onBlur={handleBlur}
            />
        </>
    )
}

// --- Main Component ---

export const RichEditableCell = ({
    value,
    onSave,
    placeholder = "Empty",
    className,
    onBlur,
    onCancel,
    id
}: RichEditableCellProps) => {
    const context = useContext(RichTextContext);

    // --- SHARED MODE (if Provider exists) ---
    if (context) {
        const { activeId, activate, editor } = context;
        // Generate fallback ID only if context exists (to avoid overhead in standalone?)
        // Actually hooks must be unconditional.
        const fallbackId = React.useId();
        const finalId = id || fallbackId;
        const isActive = activeId === finalId;

        if (!isActive) {
            return (
                <div 
                    onClick={(e) => {
                        e.stopPropagation(); 
                        e.preventDefault();
                        activate(finalId, value || '', { onSave, onBlur, onCancel });
                    }}
                    className={clsx(
                        "outline-none min-h-[24px] break-words whitespace-pre-wrap leading-normal flex items-center rounded px-1 py-[1px] transition-colors cursor-text",
                        !value && "text-default-300",
                        className
                    )}
                    dangerouslySetInnerHTML={{ __html: value || placeholder }}
                />
            );
        }

        return (
            <EditorContent 
                editor={editor} 
                className={className} 
            />
        );
    }

    // --- STANDALONE MODE (Fallback for Inbox/Logs etc) ---
    // Note: We always render StandaloneTiptapEditor immediately for now, as View Mode removal was requested.
    // If we want View Mode here too, we can implement it locally. 
    // But since user complained about alignment, let's keep it simple: Just render Editor.
    // Wait, user said "сука с rich драг рабттат пизед лагает" - this applies to Project.
    // Inbox doesn't have drag-and-drop reordering (only move to project).
    // So Standalone Editor in Inbox is acceptable performance-wise.
    
    // We use a simplified version without View/Edit switching to avoid alignment issues.
    
    return (
        <StandaloneTiptapEditor 
            initialContent={value}
            onSave={onSave}
            onCancel={() => { if (onCancel) onCancel(); }}
            onBlurProp={onBlur}
            placeholder={placeholder}
            className={className}
        />
    );
};
