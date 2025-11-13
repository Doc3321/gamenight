export interface Campaigner {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface Clipper {
  id: string;
  name: string;
  email: string;
  totalViews: number;
  clips: Clip[];
  createdAt: Date;
}

export interface Clip {
  id: string;
  clipperId: string;
  title: string;
  views: number;
  url: string;
  createdAt: Date;
  meetsRequirements: boolean;
}

export type EventType = 'most-views' | 'most-clips' | 'engagement' | 'custom';

export interface ViewRequirement {
  minViews: number;
  maxViews?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
export interface MostViewsEventConfig {
  viewRequirement: ViewRequirement;
  sumViews: boolean; // New option: true for sum of all clips, false for most views per clip
  // Prizes are always 1st, 2nd, 3rd place - no need for separate database fields
}

export interface Event {
  id: string;
  campaignerId: string;
  title: string;
  description: string;
  type: EventType;
  config: MostViewsEventConfig | Record<string, unknown>;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface EventParticipation {
  id: string;
  eventId: string;
  clipperId: string;
  clips: Clip[];
  totalViews: number;
  rank?: number;
  joinedAt: Date;
}

