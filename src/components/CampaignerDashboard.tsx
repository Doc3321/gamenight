'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Event, EventType, MostViewsEventConfig, Prize } from '@/types/campaigner';
import { validateEventConfig } from '@/lib/eventValidation';

interface CampaignerDashboardProps {
  campaignerId: string;
}

export default function CampaignerDashboard({ campaignerId }: CampaignerDashboardProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: '',
    description: '',
    type: 'most-views',
    config: {
      viewRequirement: {
        minViews: 0
      },
      sumViews: false,
      prizes: [
        { position: 1, name: "1st Place", description: "Winner" },
        { position: 2, name: "2nd Place", description: "Runner-up" },
        { position: 3, name: "3rd Place", description: "Third place" }
      ]
    },
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    isActive: true
  });

  const handleCreateEvent = () => {
    if (!newEvent.title || !newEvent.description) return;

    // Validate event configuration
    if (newEvent.type === 'most-views') {
      const config = newEvent.config as MostViewsEventConfig;
      const errors = validateEventConfig(config);
      if (errors.length > 0) {
        alert('Validation errors:\n' + errors.join('\n'));
        return;
      }
    }

    const event: Event = {
      id: `event_${Date.now()}`,
      campaignerId,
      title: newEvent.title!,
      description: newEvent.description!,
      type: newEvent.type as EventType,
      config: newEvent.config as MostViewsEventConfig,
      startDate: newEvent.startDate!,
      endDate: newEvent.endDate!,
      isActive: true,
      createdAt: new Date()
    };

    setEvents([...events, event]);
    setShowCreateForm(false);
    setNewEvent({
      title: '',
      description: '',
      type: 'most-views',
      config: {
        viewRequirement: {
          minViews: 0
        },
        sumViews: false,
        prizes: [
          { position: 1, name: "1st Place", description: "Winner" },
          { position: 2, name: "2nd Place", description: "Runner-up" },
          { position: 3, name: "3rd Place", description: "Third place" }
        ]
      },
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true
    });
  };

  const handleConfigChange = (field: string, value: string | number | boolean) => {
    setNewEvent(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value
      }
    }));
  };

  const handleViewRequirementChange = (field: string, value: number | undefined) => {
    setNewEvent(prev => ({
      ...prev,
      config: {
        ...prev.config,
        viewRequirement: {
          ...(prev.config as MostViewsEventConfig).viewRequirement,
          [field]: value
        }
      }
    }));
  };

  const addPrize = () => {
    const currentPrizes = (newEvent.config as MostViewsEventConfig)?.prizes || [];
    const nextPosition = currentPrizes.length + 1;
    const newPrize: Prize = {
      position: nextPosition,
      name: `${nextPosition}${getOrdinalSuffix(nextPosition)} Place`,
      description: ''
    };
    
    setNewEvent(prev => ({
      ...prev,
      config: {
        ...prev.config,
        prizes: [...currentPrizes, newPrize]
      }
    }));
  };

  const removePrize = (position: number) => {
    const currentPrizes = (newEvent.config as MostViewsEventConfig)?.prizes || [];
    const updatedPrizes = currentPrizes.filter(prize => prize.position !== position);
    
    setNewEvent(prev => ({
      ...prev,
      config: {
        ...prev.config,
        prizes: updatedPrizes
      }
    }));
  };

  const updatePrize = (position: number, field: string, value: string | number | undefined) => {
    const currentPrizes = (newEvent.config as MostViewsEventConfig)?.prizes || [];
    const updatedPrizes = currentPrizes.map(prize => 
      prize.position === position 
        ? { ...prize, [field]: value }
        : prize
    );
    
    setNewEvent(prev => ({
      ...prev,
      config: {
        ...prev.config,
        prizes: updatedPrizes
      }
    }));
  };

  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Campaigner Dashboard</h1>
        <Button onClick={() => setShowCreateForm(true)}>
          Create New Event
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter event description"
              />
            </div>

            <div>
              <Label htmlFor="type">Event Type</Label>
              <Select
                value={newEvent.type}
                onValueChange={(value) => setNewEvent(prev => ({ ...prev, type: value as EventType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="most-views">Most Views</SelectItem>
                  <SelectItem value="most-clips">Most Clips</SelectItem>
                  <SelectItem value="engagement">Engagement</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newEvent.type === 'most-views' && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold">Most Views Event Configuration</h3>
                
                <div>
                  <Label htmlFor="minViews">Minimum Views</Label>
                  <Input
                    id="minViews"
                    type="number"
                    value={(newEvent.config as MostViewsEventConfig)?.viewRequirement?.minViews || 0}
                    onChange={(e) => handleViewRequirementChange('minViews', parseInt(e.target.value) || 0)}
                    placeholder="Minimum views required"
                  />
                </div>

                <div>
                  <Label htmlFor="maxViews">Maximum Views (Optional)</Label>
                  <Input
                    id="maxViews"
                    type="number"
                    value={(newEvent.config as MostViewsEventConfig)?.viewRequirement?.maxViews || ''}
                    onChange={(e) => handleViewRequirementChange('maxViews', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Maximum views (optional)"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sumViews"
                    checked={(newEvent.config as MostViewsEventConfig)?.sumViews || false}
                    onChange={(e) => handleConfigChange('sumViews', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="sumViews">
                    Sum views of all clips (instead of most views per clip)
                  </Label>
                </div>

                <p className="text-sm text-gray-600">
                  {newEvent.config?.sumViews 
                    ? "Winners will be determined by the sum of views from all clips that meet the requirements from the same clipper."
                    : "Winners will be determined by the single clip with the most views that meets the requirements."
                  }
                </p>

                {/* Prize Configuration */}
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Prizes</h4>
                    <Button size="sm" onClick={addPrize}>
                      Add Prize
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {(newEvent.config as MostViewsEventConfig)?.prizes?.map((prize) => (
                      <div key={prize.position} className="flex gap-2 items-center p-2 border rounded">
                        <div className="flex-1">
                          <Label htmlFor={`prize-name-${prize.position}`}>Prize Name</Label>
                          <Input
                            id={`prize-name-${prize.position}`}
                            value={prize.name}
                            onChange={(e) => updatePrize(prize.position, 'name', e.target.value)}
                            placeholder="e.g., 1st Place"
                          />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor={`prize-desc-${prize.position}`}>Description</Label>
                          <Input
                            id={`prize-desc-${prize.position}`}
                            value={prize.description || ''}
                            onChange={(e) => updatePrize(prize.position, 'description', e.target.value)}
                            placeholder="e.g., $100 prize"
                          />
                        </div>
                        <div className="w-20">
                          <Label htmlFor={`prize-value-${prize.position}`}>Value</Label>
                          <Input
                            id={`prize-value-${prize.position}`}
                            type="number"
                            value={prize.value || ''}
                            onChange={(e) => updatePrize(prize.position, 'value', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="100"
                          />
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => removePrize(prize.position)}
                          className="mt-6"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-2">
              <Button onClick={handleCreateEvent}>
                Create Event
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Your Events</h2>
        {events.length === 0 ? (
          <p className="text-gray-500">No events created yet.</p>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <Card key={event.id}>
                <CardHeader>
                  <CardTitle>{event.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-2">{event.description}</p>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>Type: {event.type}</span>
                    <span>Status: {event.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  {event.type === 'most-views' && (
                    <div className="mt-2 text-sm">
                      <p>Min Views: {(event.config as MostViewsEventConfig).viewRequirement.minViews}</p>
                      <p>Sum Views: {(event.config as MostViewsEventConfig).sumViews ? 'Yes' : 'No'}</p>
                      <div className="mt-2">
                        <p className="font-medium">Prizes:</p>
                        <ul className="ml-2">
                          {(event.config as MostViewsEventConfig).prizes?.map(prize => (
                            <li key={prize.position} className="text-xs">
                              {prize.name}: {prize.description || 'No description'}
                              {prize.value && ` ($${prize.value})`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
