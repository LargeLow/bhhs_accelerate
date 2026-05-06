import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import type { CampaignDetail } from '../../shared/content-types';
import { PLATFORMS, PLATFORM_LABELS } from '../../shared/content-types';
import PlatformTabs from '../components/PlatformTabs';

interface Props {
  user: { name: string; role: 'admin' | 'agent' };
}

async function fetchCampaign(id: string): Promise<CampaignDetail & { canvaTemplates: { platform: string; name: string; url: string }[] }> {
  const res = await fetch(`/api/campaigns/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Campaign not found');
  return res.json();
}

export default function CampaignPage({ user }: Props) {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => fetchCampaign(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-4">Campaign not found.</p>
          <Link to="/" className="text-bhhs-maroon text-sm hover:underline">← Back to library</Link>
        </div>
      </div>
    );
  }

  const canvaMap = Object.fromEntries(campaign.canvaTemplates.map((t) => [t.platform, t]));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-bhhs-maroon text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link to="/" className="text-white/60 hover:text-white text-sm transition-colors">← Library</Link>
          <div className="flex-1">
            <p className="text-white/60 text-xs">{campaign.sourceMonth}</p>
            <h1 className="font-serif text-lg font-light">{campaign.title}</h1>
          </div>
          {user.role === 'admin' && (
            <Link to="/admin" className="text-white/60 hover:text-white text-sm">Admin</Link>
          )}
        </div>
      </header>

      {campaign.strategyCore && (
        <div className="bg-bhhs-cream border-b border-gray-200 px-6 py-3">
          <p className="max-w-6xl mx-auto text-sm text-gray-600 italic">{campaign.strategyCore}</p>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8">
        <PlatformTabs
          contentItems={campaign.contentItems}
          canvaMap={canvaMap}
          campaignId={campaign.id}
          isAdmin={user.role === 'admin'}
          initialImages={campaign.campaignImages ?? []}
        />
      </main>
    </div>
  );
}
