import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CampaignSummary } from '../../shared/content-types';

interface Props {
  user: { name: string; role: 'admin' | 'agent' };
}

async function fetchCampaigns(): Promise<CampaignSummary[]> {
  const res = await fetch('/api/campaigns', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load campaigns');
  return res.json();
}

export default function LibraryPage({ user }: Props) {
  const qc = useQueryClient();
  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns });

  const latest = campaigns[0];
  const past = campaigns.slice(1);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    await qc.invalidateQueries({ queryKey: ['me'] });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-bhhs-maroon text-white px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-light tracking-wide">Accelerate</h1>
          <p className="text-white/60 text-xs">BHHS Utah Properties</p>
        </div>
        <div className="flex items-center gap-4">
          {user.role === 'admin' && (
            <Link to="/admin" className="text-white/80 hover:text-white text-sm transition-colors">
              Admin
            </Link>
          )}
          <span className="text-white/60 text-sm">{user.name}</span>
          <button onClick={logout} className="text-white/60 hover:text-white text-sm transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {isLoading && <p className="text-gray-500 text-sm">Loading content…</p>}

        {!isLoading && campaigns.length === 0 && (
          <p className="text-gray-500 text-sm">No content published yet.</p>
        )}

        {/* Latest release — featured */}
        {latest && (
          <section className="mb-12">
            <p className="text-xs uppercase tracking-widest text-bhhs-maroon font-medium mb-3">Latest Release</p>
            <div className="bg-bhhs-maroon text-white rounded-xl p-5 sm:p-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
              <div className="flex-1">
                <p className="text-white/60 text-sm mb-1">{latest.sourceMonth}</p>
                <h2 className="font-serif text-2xl font-light mb-3">{latest.title}</h2>
                {latest.strategyCore && (
                  <p className="text-white/80 text-sm leading-relaxed max-w-xl">{latest.strategyCore}</p>
                )}
              </div>
              <Link
                to={`/campaign/${latest.id}`}
                className="sm:shrink-0 bg-white text-bhhs-maroon px-5 py-2.5 rounded text-sm font-medium hover:bg-bhhs-cream transition-colors text-center"
              >
                View Content →
              </Link>
            </div>
          </section>
        )}

        {/* Past campaigns grid */}
        {past.length > 0 && (
          <section>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-medium mb-4">Content Library</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {past.map((c) => (
                <Link
                  key={c.id}
                  to={`/campaign/${c.id}`}
                  className="bg-white border border-gray-200 rounded-lg p-5 hover:border-bhhs-maroon hover:shadow-sm transition-all group"
                >
                  <p className="text-xs text-gray-400 mb-1">{c.sourceMonth}</p>
                  <h3 className="font-serif text-gray-900 group-hover:text-bhhs-maroon transition-colors mb-2 leading-snug">
                    {c.title}
                  </h3>
                  {c.strategyCore && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{c.strategyCore}</p>
                  )}
                  <p className="text-bhhs-maroon text-xs font-medium mt-3 group-hover:underline">View →</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
