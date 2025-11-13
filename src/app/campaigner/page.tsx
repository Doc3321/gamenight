'use client';

import { useState } from 'react';
import CampaignerDashboard from '@/components/CampaignerDashboard';
import ClipperManagement from '@/components/ClipperManagement';
import { Event } from '@/types/campaigner';

export default function CampaignerPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clippers'>('dashboard');
  const [events, setEvents] = useState<Event[]>([]);

  // Mock campaigner ID - in a real app, this would come from authentication
  const campaignerId = 'campaigner_123';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('clippers')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'clippers'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Clipper Management
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="py-6">
        {activeTab === 'dashboard' && (
          <CampaignerDashboard campaignerId={campaignerId} />
        )}
        {activeTab === 'clippers' && (
          <ClipperManagement events={events} />
        )}
      </main>
    </div>
  );
}

