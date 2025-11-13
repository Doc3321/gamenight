import { Clip, ViewRequirement, MostViewsEventConfig } from '@/types/campaigner';

export interface ValidationResult {
  isValid: boolean;
  eligibleClips: Clip[];
  totalViews: number;
  reason?: string;
}

/**
 * Validates if clips meet the view requirements for an event
 */
export function validateViewRequirements(
  clips: Clip[],
  requirements: ViewRequirement
): ValidationResult {
  const eligibleClips = clips.filter(clip => {
    const meetsMin = clip.views >= requirements.minViews;
    const meetsMax = !requirements.maxViews || clip.views <= requirements.maxViews;
    
    // Check date range if specified
    let meetsDateRange = true;
    if (requirements.dateRange) {
      const clipDate = new Date(clip.createdAt);
      meetsDateRange = clipDate >= requirements.dateRange.start && 
                      clipDate <= requirements.dateRange.end;
    }
    
    return meetsMin && meetsMax && meetsDateRange;
  });

  const totalViews = eligibleClips.reduce((sum, clip) => sum + clip.views, 0);

  return {
    isValid: eligibleClips.length > 0,
    eligibleClips,
    totalViews,
    reason: eligibleClips.length === 0 ? 'No clips meet the requirements' : undefined
  };
}

/**
 * Calculates the score for a clipper based on event configuration
 */
export function calculateClipperScore(
  clips: Clip[],
  config: MostViewsEventConfig
): ValidationResult {
  const validation = validateViewRequirements(clips, config.viewRequirement);
  
  if (!validation.isValid) {
    return validation;
  }

  let totalViews = 0;
  
  if (config.sumViews) {
    // Sum views of all eligible clips
    totalViews = validation.eligibleClips.reduce((sum, clip) => sum + clip.views, 0);
  } else {
    // Most views from single clip
    totalViews = Math.max(...validation.eligibleClips.map(clip => clip.views));
  }

  return {
    ...validation,
    totalViews
  };
}

/**
 * Ranks clippers based on their scores for an event
 */
export function rankClippers(
  clipperScores: Array<{ clipperId: string; score: number; clipperName: string }>
): Array<{ clipperId: string; score: number; clipperName: string; rank: number }> {
  return clipperScores
    .sort((a, b) => b.score - a.score)
    .map((clipper, index) => ({
      ...clipper,
      rank: index + 1
    }));
}

/**
 * Validates event configuration
 */
export function validateEventConfig(config: MostViewsEventConfig): string[] {
  const errors: string[] = [];
  
  if (config.viewRequirement.minViews < 0) {
    errors.push('Minimum views cannot be negative');
  }
  
  if (config.viewRequirement.maxViews && 
      config.viewRequirement.maxViews < config.viewRequirement.minViews) {
    errors.push('Maximum views must be greater than minimum views');
  }
  
  if (config.viewRequirement.dateRange) {
    const { start, end } = config.viewRequirement.dateRange;
    if (start >= end) {
      errors.push('Start date must be before end date');
    }
    
    if (start > new Date()) {
      errors.push('Start date cannot be in the future');
    }
  }
  
  return errors;
}

