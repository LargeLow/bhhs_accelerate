import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CampaignSummary } from '../../shared/content-types';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

async function fetchAllCampaigns(): Promise<(CampaignSummary & { pdfFilename: string; processedAt: string | null })[]> {
  const res = await fetch('/api/admin/campaigns', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}

async function fetchUsers(): Promise<UserRecord[]> {
  const res = await fetch('/api/admin/users', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

export default function AdminPage() {
  const qc = useQueryClient();
  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ['admin-campaigns'], queryFn: fetchAllCampaigns });
  const { data: userList = [] } = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // User form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'agent' | 'admin'>('agent');
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // Reset-password state keyed by user id
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetError, setResetError] = useState('');

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setSavingUser(true);
    setUserError('');
    setUserSuccess('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) { setUserError(data.error || 'Failed to create user'); }
    else {
      setUserSuccess(`${data.name} added successfully.`);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('agent');
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
    }
    setSavingUser(false);
  }

  async function handleDeleteUser(id: string, name: string) {
    if (!confirm(`Remove ${name}? They will no longer be able to log in.`)) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
    await qc.invalidateQueries({ queryKey: ['admin-users'] });
  }

  async function handleResetPassword(id: string) {
    setResetError('');
    if (resetPw.length < 6) { setResetError('Password must be at least 6 characters'); return; }
    const res = await fetch(`/api/admin/users/${id}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPw }),
      credentials: 'include',
    });
    if (res.ok) { setResetTargetId(null); setResetPw(''); setResetError(''); }
    else { const d = await res.json(); setResetError(d.error || 'Failed'); }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file1 = (form.elements.namedItem('pdf1') as HTMLInputElement).files?.[0];
    const file2 = (form.elements.namedItem('pdf2') as HTMLInputElement).files?.[0];
    const file3 = (form.elements.namedItem('pdf3') as HTMLInputElement).files?.[0];
    if (!file1) return;

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    const formData = new FormData();
    formData.append('pdfs', file1);
    if (file2) formData.append('pdfs', file2);
    if (file3) formData.append('pdfs', file3);

    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        setUploadError(data.error || 'Upload failed');
        setUploading(false);
        return;
      }

      const campaign = await res.json();
      form.reset();

      // Poll every 4 seconds until Claude finishes — timeout after 3 minutes
      const timeout = setTimeout(() => {
        clearInterval(poll);
        setUploading(false);
        setUploadError('Processing is taking longer than expected. Check the Drafts list — it may still complete. Refresh the page to check.');
      }, 3 * 60 * 1000);

      const poll = setInterval(async () => {
        await qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
        const allRes = await fetch('/api/admin/campaigns', { credentials: 'include' });
        const all = await allRes.json();
        const updated = all.find((c: { id: string; title: string }) => c.id === campaign.id);
        if (updated && updated.title !== 'Processing...') {
          clearInterval(poll);
          clearTimeout(timeout);
          setUploading(false);
          if (updated.title.startsWith('Processing failed')) {
            setUploadError(`Processing failed — check Render logs for details.`);
          } else {
            setUploadSuccess(`Ready: "${updated.title}" — preview and publish when ready.`);
          }
          await qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
        }
      }, 4000);
    } catch {
      setUploadError('Network error — please try again');
      setUploading(false);
    }
  }

  async function updateStatus(id: string, status: 'published' | 'archived') {
    await fetch(`/api/admin/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
      credentials: 'include',
    });
    await qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
    await qc.invalidateQueries({ queryKey: ['campaigns'] });
  }

  const drafts = campaigns.filter((c) => c.status === 'draft');
  const published = campaigns.filter((c) => c.status === 'published');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-bhhs-maroon text-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link to="/" className="text-white/60 hover:text-white text-sm">← Library</Link>
          <h1 className="font-serif text-lg font-light flex-1">Admin</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12">

        {/* Upload */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Upload PDF</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Research PDF <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="file"
                    name="pdf1"
                    accept="application/pdf"
                    required
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-bhhs-maroon file:text-white hover:file:bg-bhhs-dark file:cursor-pointer"
                  />
                  <p className="text-xs text-gray-400 mt-1">Survey methodology + full data</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Topic Drop PDF <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="file"
                    name="pdf2"
                    accept="application/pdf"
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer"
                  />
                  <p className="text-xs text-gray-400 mt-1">Highlights + agent examples</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional PDF <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="file"
                    name="pdf3"
                    accept="application/pdf"
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer"
                  />
                  <p className="text-xs text-gray-400 mt-1">If a third file arrives</p>
                </div>
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="btn-primary disabled:opacity-60"
              >
                {uploading ? 'Processing… (30–60s)' : 'Upload & Process'}
              </button>
            </form>

            {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}
            {uploadSuccess && <p className="mt-3 text-sm text-green-700">{uploadSuccess}</p>}

            {uploading && (
              <p className="mt-3 text-xs text-gray-400">
                Claude is reading your PDFs and generating content for all 7 platforms. This takes 60–90 seconds — this page will update automatically when it's done.
              </p>
            )}
          </div>
        </section>

        {/* Drafts */}
        {drafts.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
              Drafts — awaiting approval ({drafts.length})
            </h2>
            <div className="space-y-3">
              {drafts.map((c) => (
                <div key={c.id} className="bg-white border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 truncate">{c.sourceMonth} · {c.pdfFilename}</p>
                    <p className="font-medium text-gray-900">{c.title}</p>
                    {c.strategyCore && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{c.strategyCore}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link to={`/campaign/${c.id}`} className="btn-secondary text-xs">
                      Preview
                    </Link>
                    <button onClick={() => updateStatus(c.id, 'published')} className="btn-primary text-xs">
                      Publish
                    </button>
                    <button onClick={() => updateStatus(c.id, 'archived')} className="text-xs text-gray-400 hover:text-gray-600">
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Published */}
        {published.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
              Published ({published.length})
            </h2>
            <div className="space-y-2">
              {published.map((c) => (
                <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">{c.sourceMonth}</p>
                    <p className="font-medium text-gray-900">{c.title}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link to={`/campaign/${c.id}`} className="btn-secondary text-xs">View</Link>
                    <button onClick={() => updateStatus(c.id, 'archived')} className="text-xs text-gray-400 hover:text-gray-600">
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {isLoading && <p className="text-gray-400 text-sm">Loading…</p>}

        {/* Team / User Management */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Team</h2>

          {/* Add user form */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Add Agent or Admin</h3>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                  <input
                    required value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-bhhs-maroon"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email (login username)</label>
                  <input
                    required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-bhhs-maroon"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Password</label>
                  <input
                    required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-bhhs-maroon"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Role</label>
                  <select
                    value={newRole} onChange={(e) => setNewRole(e.target.value as 'agent' | 'admin')}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-bhhs-maroon"
                  >
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={savingUser} className="btn-primary text-sm disabled:opacity-60">
                {savingUser ? 'Adding…' : 'Add User'}
              </button>
              {userError && <p className="text-sm text-red-600">{userError}</p>}
              {userSuccess && <p className="text-sm text-green-700">{userSuccess}</p>}
            </form>
          </div>

          {/* User list */}
          {userList.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Last Login</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Last Active</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {userList.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-bhhs-maroon/10 text-bhhs-maroon' : 'bg-gray-100 text-gray-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{timeAgo(u.lastLoginAt)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{timeAgo(u.lastActiveAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 justify-end">
                          {resetTargetId === u.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)}
                                placeholder="New password"
                                className="border border-gray-200 rounded px-2 py-1 text-xs w-36 focus:outline-none focus:border-bhhs-maroon"
                              />
                              <button onClick={() => handleResetPassword(u.id)} className="text-xs text-bhhs-maroon font-medium hover:text-bhhs-dark">Save</button>
                              <button onClick={() => { setResetTargetId(null); setResetPw(''); setResetError(''); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                              {resetError && <span className="text-xs text-red-600">{resetError}</span>}
                            </div>
                          ) : (
                            <button onClick={() => { setResetTargetId(u.id); setResetPw(''); }} className="text-xs text-gray-400 hover:text-bhhs-maroon">
                              Reset password
                            </button>
                          )}
                          <button onClick={() => handleDeleteUser(u.id, u.name)} className="text-xs text-gray-400 hover:text-red-500">
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
