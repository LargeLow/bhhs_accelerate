import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CampaignSummary } from '../../shared/content-types';

async function fetchAllCampaigns(): Promise<(CampaignSummary & { pdfFilename: string; processedAt: string | null })[]> {
  const res = await fetch('/api/admin/campaigns', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}

export default function AdminPage() {
  const qc = useQueryClient();
  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ['admin-campaigns'], queryFn: fetchAllCampaigns });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

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
                <div key={c.id} className="bg-white border border-amber-200 rounded-lg p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">{c.sourceMonth} · {c.pdfFilename}</p>
                    <p className="font-medium text-gray-900">{c.title}</p>
                    {c.strategyCore && <p className="text-sm text-gray-500 mt-0.5">{c.strategyCore}</p>}
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
                <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                  <div className="flex-1">
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
      </main>
    </div>
  );
}
