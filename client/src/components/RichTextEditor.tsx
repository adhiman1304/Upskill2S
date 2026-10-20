import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote } from 'lucide-react'

export function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false, protocols: ['https'] })], content: value,
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
    editorProps: { attributes: { class: 'rich-editor-content', 'aria-label': 'Study notes editor' } },
  })
  if (!editor) return null
  const actions = [
    { label: 'Bold', icon: <Bold size={16} />, run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { label: 'Italic', icon: <Italic size={16} />, run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { label: 'Heading', icon: <Heading2 size={16} />, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading') },
    { label: 'Bulleted list', icon: <List size={16} />, run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { label: 'Numbered list', icon: <ListOrdered size={16} />, run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { label: 'Quote', icon: <Quote size={16} />, run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
  ]
  function addLink() {
    const current = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Enter an HTTPS link', current ?? 'https://')
    if (url && /^https:\/\//i.test(url)) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    else if (url) window.alert('Only HTTPS links are allowed.')
    else if (url === '') editor.chain().focus().unsetLink().run()
  }
  return <div className="rich-editor"><div className="rich-toolbar" role="toolbar" aria-label="Text formatting">
    {actions.map((action) => <button type="button" key={action.label} title={action.label} aria-label={action.label} aria-pressed={action.active} className={action.active ? 'active' : ''} onClick={action.run}>{action.icon}</button>)}
    <span className="toolbar-divider" /><button type="button" title="Add link" aria-label="Add link" onClick={addLink}><Link2 size={16} /></button>
  </div><EditorContent editor={editor} /></div>
}