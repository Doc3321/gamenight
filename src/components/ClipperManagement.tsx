'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clipper, Clip, Event, MostViewsEventConfig } from '@/types/campaigner';
import { calculateClipperScore, rankClippers } from '@/lib/eventValidation';

interface ClipperManagementProps {
  events: Event[];
}

export default function ClipperManagement({ events }: ClipperManagementProps) {
  const [clippers, setClippers] = useState<Clipper[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');

  const addClipper = () => {
    const newClipper: Clipper = {
      id: `clipper_${Date.now()}`,
      name: '',
      email: '',
      totalViews: 0,
      clips: [],
      createdAt: new Date()
    };
    setClippers([...clippers, newClipper]);
  };

  const addClip = (clipperId: string) => {
    const newClip: Clip = {
      id: `clip_${Date.now()}`,
      clipperId,
      title: '',
      views: 0,
      url: '',
      createdAt: new Date(),
      meetsRequirements: false
    };

    setClippers(prev => prev.map(clipper => 
      clipper.id === clipperId 
        ? { ...clipper, clips: [...clipper.clips, newClip] }
        : clipper
    ));
  };

  const updateClip = (clipperId: string, clipId: string, field: string, value: string | number) => {
    setClippers(prev => prev.map(clipper => 
      clipper.id === clipperId 
        ? {
            ...clipper,
            clips: clipper.clips.map(clip => 
              clip.id === clipId 
                ? { ...clip, [field]: value }
                : clip
            )
          }
        : clipper
    ));
  };

  const calculateTotalViews = (clipper: Clipper): number => {
    return clipper.clips.reduce((sum, clip) => sum + clip.views, 0);
  };

  const getEventResults = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event || event.type !== 'most-views') return [];

    const eventConfig = event.config as MostViewsEventConfig;
    
    // Calculate scores for each clipper
    const clipperScores = clippers.map(clipper => {
      const scoreResult = calculateClipperScore(clipper.clips, eventConfig);
      return {
        clipperId: clipper.id,
        clipperName: clipper.name,
        score: scoreResult.totalViews,
        eligibleClips: scoreResult.eligibleClips,
        isValid: scoreResult.isValid
      };
    });

    // Rank the clippers
    const rankedResults = rankClippers(clipperScores);

    return rankedResults.map(result => {
      const clipper = clippers.find(c => c.id === result.clipperId)!;
      return {
        clipper,
        totalViews: result.score,
        eligibleClips: clipperScores.find(cs => cs.clipperId === result.clipperId)?.eligibleClips || [],
        rank: result.rank,
        isValid: clipperScores.find(cs => cs.clipperId === result.clipperId)?.isValid || false
      };
    });
  };

  const selectedEventResults = selectedEvent ? getEventResults(selectedEvent) : [];
  const selectedEventData = selectedEvent ? events.find(e => e.id === selectedEvent) : null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Clipper Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clippers Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Clippers</h2>
            <Button onClick={addClipper}>Add Clipper</Button>
          </div>

          <div className="space-y-4">
            {clippers.map((clipper) => (
              <Card key={clipper.id}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>Clipper {clipper.id.slice(-6)}</span>
                    <Button 
                      size="sm" 
                      onClick={() => addClip(clipper.id)}
                    >
                      Add Clip
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor={`name-${clipper.id}`}>Name</Label>
                    <Input
                      id={`name-${clipper.id}`}
                      value={clipper.name}
                      onChange={(e) => setClippers(prev => prev.map(c => 
                        c.id === clipper.id ? { ...c, name: e.target.value } : c
                      ))}
                      placeholder="Clipper name"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`email-${clipper.id}`}>Email</Label>
                    <Input
                      id={`email-${clipper.id}`}
                      value={clipper.email}
                      onChange={(e) => setClippers(prev => prev.map(c => 
                        c.id === clipper.id ? { ...c, email: e.target.value } : c
                      ))}
                      placeholder="Clipper email"
                    />
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>Total Views: {calculateTotalViews(clipper)}</p>
                    <p>Clips: {clipper.clips.length}</p>
                  </div>

                  {/* Clips */}
                  <div className="space-y-2">
                    <h4 className="font-semibold">Clips:</h4>
                    {clipper.clips.map((clip) => (
                      <div key={clip.id} className="p-3 border rounded space-y-2">
                        <div>
                          <Label htmlFor={`title-${clip.id}`}>Title</Label>
                          <Input
                            id={`title-${clip.id}`}
                            value={clip.title}
                            onChange={(e) => updateClip(clipper.id, clip.id, 'title', e.target.value)}
                            placeholder="Clip title"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`views-${clip.id}`}>Views</Label>
                          <Input
                            id={`views-${clip.id}`}
                            type="number"
                            value={clip.views}
                            onChange={(e) => updateClip(clipper.id, clip.id, 'views', parseInt(e.target.value) || 0)}
                            placeholder="Number of views"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`url-${clip.id}`}>URL</Label>
                          <Input
                            id={`url-${clip.id}`}
                            value={clip.url}
                            onChange={(e) => updateClip(clipper.id, clip.id, 'url', e.target.value)}
                            placeholder="Clip URL"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Event Results Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Event Results</h2>
            <div>
              <Label htmlFor="eventSelect">Select Event</Label>
              <select
                id="eventSelect"
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Select an event</option>
                {events.filter(e => e.type === 'most-views').map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedEvent && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">🏆 Prizes</h3>
                <p className="text-sm text-gray-600">1st, 2nd, and 3rd place</p>
              </div>
              
              <h3 className="text-lg font-semibold">Leaderboard</h3>
              {selectedEventResults.length === 0 ? (
                <p className="text-gray-500">No clippers with eligible clips</p>
              ) : (
                <div className="space-y-2">
                  {selectedEventResults.map((result) => {
                    const isPrizeWinner = result.rank <= 3;
                    const prizeText = result.rank === 1 ? '1st Place' : result.rank === 2 ? '2nd Place' : result.rank === 3 ? '3rd Place' : '';
                    
                    return (
                      <Card 
                        key={result.clipper.id} 
                        className={`${result.isValid ? '' : 'opacity-50'} ${
                          isPrizeWinner ? 'ring-2 ring-yellow-400 bg-yellow-50' : ''
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-semibold flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  result.rank === 1 ? 'bg-yellow-500 text-white' :
                                  result.rank === 2 ? 'bg-gray-400 text-white' :
                                  result.rank === 3 ? 'bg-orange-600 text-white' :
                                  'bg-gray-200 text-gray-700'
                                }`}>
                                  #{result.rank}
                                </span>
                                {result.clipper.name}
                                {isPrizeWinner && (
                                  <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs font-medium">
                                    🏆 {prizeText}
                                  </span>
                                )}
                                {!result.isValid && <span className="text-red-500 ml-2">(No eligible clips)</span>}
                              </h4>
                              <p className="text-sm text-gray-600">
                                Total Views: {result.totalViews}
                              </p>
                              <p className="text-sm text-gray-600">
                                Eligible Clips: {result.eligibleClips.length}
                              </p>
                              {result.eligibleClips.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs text-gray-500">Eligible clips:</p>
                                  <ul className="text-xs text-gray-500 ml-2">
                                    {result.eligibleClips.map((clip, index) => (
                                      <li key={index}>
                                        {clip.title} ({clip.views} views)
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
