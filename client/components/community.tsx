'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Heart, Flag, Users } from 'lucide-react';
import { AppNav, Brand } from './app-nav';
import { readerRequest } from '../lib/browser-api';

interface Comment {
  id: string; body: string; createdAt: string;
  user: { id: string; displayName: string };
  _count?: { likes: number; replies?: number };
}
interface Page { items: Comment[]; meta: { page: number; pages: number; total: number }; }

export function Discussion({ signedIn }: { signedIn: boolean }) {
  const [result, setResult] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('recent');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const path = '/api/community/community/posts';
  const signIn = '/login?next=/community';
  useEffect(() => {
    let active = true; setError(''); setResult(null);
    readerRequest(`${path}?page=${page}&sort=${sort}`).then(data => { if (active) setResult(data); }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [path, page, sort, attempt]);
  const refresh = () => setAttempt(current => current + 1);
  return <div className="app-shell"><header className="topbar"><Brand /><Link href="/dashboard">My profile</Link></header>
    <main className="community-main discussion-main"><section className="community-welcome"><Users size={30} /><p className="eyebrow">The readers’ corner</p><h1>Good books. Great conversations.</h1><p>Talk about any book, share recommendations, and meet fellow readers. Every reader belongs here.</p></section>
      <p className="community-note">Share your thoughts, welcome new readers, and be kind. Please warn others before sharing spoilers.</p>
      {signedIn ? <Composer path={path} onPosted={() => { setPage(1); setSort('recent'); refresh(); }} /> : <p className="community-note"><Link href={signIn}>Sign in to join the conversation</Link>. Everyone is welcome to read along.</p>}
      <div className="section-heading"><h2>Conversation</h2><label>Sort <select aria-label="Sort discussion" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="recent">Newest</option><option value="popular">Most liked</option></select></label></div>
      {error ? <div role="alert"><p>{error}</p><button className="button button-light" onClick={refresh}>Retry discussion</button></div>
        : !result ? <p role="status">Loading conversation…</p> : !result.items.length ? <div className="empty-state"><MessageCircle size={28} /><h3>Start the conversation</h3><p>Tell us what you’re reading, recommend a favourite, or ask the community a question.</p></div>
        : result.items.map(comment => <CommentCard key={comment.id} comment={comment} path={path} feedUrl={`${path}?page=${page}&sort=${sort}`} signedIn={signedIn} />)}
      {result && result.meta.pages > 1 && <nav className="chapter-nav" aria-label="Discussion pages"><button className="button button-light" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous discussions</button><span>Page {page} of {result.meta.pages}</span><button className="button button-light" disabled={page >= result.meta.pages} onClick={() => setPage(page + 1)}>Next discussions</button></nav>}
    </main><AppNav active="community" /></div>;
}

function Composer({ path, parentId, onPosted }: { path: string; parentId?: string; onPosted: () => void }) {
  const [body, setBody] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <form className="comment-composer" onSubmit={async event => {
    event.preventDefault(); if (!body.trim() || busy) return; setBusy(true); setError('');
    try { await readerRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: body.trim(), ...(parentId ? { parentId } : {}) }) }); setBody(''); onPosted(); }
    catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  }}><label>{parentId ? 'Your reply' : 'Share your thoughts'}<textarea aria-label={parentId ? 'Your reply' : 'Share your thoughts'} value={body} onChange={event => setBody(event.target.value)} maxLength={2000} required rows={3} placeholder={parentId ? 'Keep the conversation going…' : 'What would you like to discuss?'} /></label>
    <div className="comment-actions"><small>{body.length}/2000</small><button className="button button-dark" disabled={busy || !body.trim()}>{busy ? 'Posting…' : parentId ? 'Post reply' : 'Post discussion'}</button></div>{error && <p role="alert">{error}</p>}</form>;
}

function CommentCard({ comment, path, feedUrl, signedIn, reply = false }: { comment: Comment; path: string; feedUrl: string; signedIn: boolean; reply?: boolean }) {
  const [liked, setLiked] = useState(false); const [likes, setLikes] = useState(comment._count?.likes ?? 0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [showReplies, setShowReplies] = useState(false); const [replies, setReplies] = useState<Page | null>(null);
  const [replyError, setReplyError] = useState(''); const [replyPage, setReplyPage] = useState(1);
  const [reporting, setReporting] = useState(false); const [reported, setReported] = useState(false); const [reason, setReason] = useState('SPAM');
  const endpoint = `/api/community/comments/${encodeURIComponent(comment.id)}`;
  const loadReplies = useCallback(async (page: number) => {
    setReplyError(''); setReplies(null);
    try { setReplies(await readerRequest(`${endpoint}/replies?page=${page}`)); setReplyPage(page); }
    catch (failure) { setReplyError((failure as Error).message); }
  }, [endpoint]);
  return <article className={`comment-card${reply ? ' comment-reply' : ''}`}>
    <header className="comment-header"><span className="comment-avatar" aria-hidden="true">{comment.user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{comment.user.displayName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</time></div></header>
    <p className="comment-body">{comment.body}</p>
    <div className="comment-actions"><button className="button button-light" disabled={!signedIn || busy} onClick={async () => {
      setBusy(true); setError('');
      try { await readerRequest(`${endpoint}/like`, { method: liked ? 'DELETE' : 'POST' }); setLiked(!liked);
        // Re-read the server count: an earlier visit may already have liked this comment.
        const data: Page = await readerRequest(feedUrl);
        const updated = data.items.find(item => item.id === comment.id);
        if (updated) setLikes(updated._count?.likes ?? likes);
      } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
    }}><Heart size={15} fill={liked ? 'currentColor' : 'none'} /> {liked ? 'Unlike' : 'Like'} · {likes}</button>
      {!reply && <button className="button button-light" onClick={() => { setShowReplies(!showReplies); if (!showReplies) void loadReplies(1); }}><MessageCircle size={15} /> {showReplies ? 'Hide replies' : `Replies${comment._count?.replies ? ` · ${comment._count.replies}` : ''}`}</button>}
      {signedIn && <button className="button button-light" disabled={reported} onClick={() => setReporting(!reporting)}><Flag size={15} /> {reported ? 'Reported' : 'Report'}</button>}
    </div>{error && <p role="alert">{error}</p>}
    {reporting && <form className="report-form" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { await readerRequest(`${endpoint}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }); setReported(true); setReporting(false); } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); } }}><label>Reason<select aria-label="Report reason" value={reason} onChange={event => setReason(event.target.value)}>{['SPAM', 'HARASSMENT', 'SPOILER', 'INAPPROPRIATE', 'OTHER'].map(value => <option key={value}>{value}</option>)}</select></label><button className="button button-dark" disabled={busy}>Submit report</button><button type="button" className="button button-light" onClick={() => setReporting(false)}>Cancel</button></form>}
    {reported && <p role="status">Thank you. Your report has been sent for review.</p>}
    {showReplies && <section aria-label={`Replies to ${comment.user.displayName}`} className="reply-list">{signedIn && <Composer path={path} parentId={comment.id} onPosted={() => void loadReplies(replies ? Math.max(1, Math.ceil((replies.meta.total + 1) / 20)) : 1)} />}
      {replyError ? <div role="alert"><p>{replyError}</p><button className="button button-light" onClick={() => void loadReplies(replyPage)}>Retry replies</button></div> : !replies ? <p role="status">Loading replies…</p> : replies.items.length ? replies.items.map(item => <CommentCard key={item.id} comment={item} path={path} feedUrl={`${endpoint}/replies?page=${replyPage}`} signedIn={signedIn} reply />) : <p className="muted">No replies yet.</p>}
      {replies && replies.meta.pages > 1 && <div className="comment-actions"><button className="button button-light" disabled={replyPage === 1} onClick={() => void loadReplies(replyPage - 1)}>Previous replies</button><span>Page {replyPage}</span><button className="button button-light" disabled={replyPage >= replies.meta.pages} onClick={() => void loadReplies(replyPage + 1)}>Next replies</button></div>}
    </section>}
  </article>;
}
