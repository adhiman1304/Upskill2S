import { useEffect, useState, type FormEvent } from 'react'
import { CircleHelp, Clock3, Lightbulb, LoaderCircle, MessageCircle, MessagesSquare, Send } from 'lucide-react'
import { createCommunityComment, createCommunityPost, getCommunityPosts } from '../../lib/api'
import type { CommunityPost, CommunityPostKind } from '../../lib/api'
import { useApi } from '../../session'
import { formatDate, message } from './utils'

export function CommunityPage() {
  const request = useApi()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [filter, setFilter] = useState<'ALL' | CommunityPostKind>('ALL')
  const [kind, setKind] = useState<CommunityPostKind>('IDEA')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [commentingId, setCommentingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getCommunityPosts(request).then((data) => { if (active) { setPosts(data); setError('') } }).catch((reason: unknown) => { if (active) setError(message(reason, 'Could not load ideas and questions.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPosting(true)
    setError('')
    try {
      const created = await createCommunityPost(request, { kind, title: title.trim(), body: body.trim() })
      setPosts((current) => [created, ...current])
      setTitle('')
      setBody('')
    }
    catch (reason) { setError(message(reason, 'Could not post. Check the title and details.')) }
    finally { setPosting(false) }
  }

  async function submitComment(postId: string) {
    const text = (drafts[postId] ?? '').trim()
    if (!text) return
    setCommentingId(postId)
    setError('')
    try {
      const comment = await createCommunityComment(request, postId, text)
      setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: [...post.comments, comment], commentCount: post.commentCount + 1 } : post))
      setDrafts((current) => ({ ...current, [postId]: '' }))
    }
    catch (reason) { setError(message(reason, 'Could not add your comment.')) }
    finally { setCommentingId(null) }
  }

  const ideaCount = posts.filter((post) => post.kind === 'IDEA').length
  const questionCount = posts.length - ideaCount
  const visible = filter === 'ALL' ? posts : posts.filter((post) => post.kind === filter)
  const canPost = !posting && title.trim().length >= 5 && body.trim().length > 0
  const filters: { value: 'ALL' | CommunityPostKind; label: string; count: number }[] = [
    { value: 'ALL', label: 'All', count: posts.length },
    { value: 'IDEA', label: 'Ideas', count: ideaCount },
    { value: 'QUESTION', label: 'Questions', count: questionCount },
  ]

  return <div className="page-content community-page">
    <header className="topbar"><div><p className="breadcrumb">COMMUNITY <span>/</span> IDEAS &amp; QUESTIONS</p><h1>Ideas &amp; questions</h1></div></header>
    <p className="muted community-intro">Suggest an improvement or ask the community for help. Anyone signed in can reply.</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    <form className="community-composer" onSubmit={(event) => void submitPost(event)}>
      <div className="segmented" role="group" aria-label="Post type">
        <button type="button" className={kind === 'IDEA' ? 'active' : ''} onClick={() => setKind('IDEA')}><Lightbulb size={15} /> Idea</button>
        <button type="button" className={kind === 'QUESTION' ? 'active' : ''} onClick={() => setKind('QUESTION')}><CircleHelp size={15} /> Question</button>
      </div>
      <input className="community-input" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={kind === 'IDEA' ? 'Summarize your idea' : 'What would you like to ask?'} aria-label="Title" />
      <textarea className="community-input" value={body} maxLength={4000} rows={3} onChange={(event) => setBody(event.target.value)} placeholder="Add details" aria-label="Details" />
      <div className="community-composer-footer"><button className="button button-primary" type="submit" disabled={!canPost}><Send size={15} /> {posting ? 'Posting' : 'Post'}</button></div>
    </form>
    <div className="community-filters" role="tablist">
      {filters.map((item) => <button key={item.value} role="tab" aria-selected={filter === item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label} <span>{item.count}</span></button>)}
    </div>
    {loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading ideas and questions</div> : visible.length ? <div className="post-list">
      {visible.map((post) => {
        const open = openId === post.id
        const draft = drafts[post.id] ?? ''
        return <article key={post.id} className="post-card">
          <div className="post-meta"><span className={`post-kind ${post.kind.toLowerCase()}`}>{post.kind === 'IDEA' ? <Lightbulb size={13} /> : <CircleHelp size={13} />} {post.kind === 'IDEA' ? 'Idea' : 'Question'}</span><span><Clock3 size={13} /> {formatDate(post.createdAt)} · {post.authorName}</span></div>
          <h3>{post.title}</h3>
          <p className="post-body">{post.body}</p>
          <button className="post-comments-toggle" onClick={() => setOpenId(open ? null : post.id)} aria-expanded={open}><MessageCircle size={15} /> {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</button>
          {open && <div className="post-comments">
            {post.comments.map((comment) => <div key={comment.id} className="comment"><strong>{comment.authorName}</strong><span>{formatDate(comment.createdAt)}</span><p>{comment.body}</p></div>)}
            <div className="comment-form">
              <textarea value={draft} maxLength={2000} rows={2} placeholder="Write a reply" aria-label="Reply" onChange={(event) => setDrafts((current) => ({ ...current, [post.id]: event.target.value }))} />
              <button className="button button-secondary" type="button" disabled={!draft.trim() || commentingId === post.id} onClick={() => void submitComment(post.id)}><Send size={14} /> Reply</button>
            </div>
          </div>}
        </article>
      })}
    </div> : <div className="empty-state"><div className="empty-icon"><MessagesSquare size={21} /></div><h3>No {filter === 'ALL' ? 'ideas or questions' : filter === 'IDEA' ? 'ideas' : 'questions'} yet</h3><p>Start the conversation. Ideas shape the library; questions get answered by the community.</p></div>}
  </div>
}
