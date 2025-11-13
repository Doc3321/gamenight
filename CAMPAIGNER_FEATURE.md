# Campaigner Feature Documentation

## Overview
This feature adds campaigner functionality to the word game application, allowing campaigners to create events and manage clippers with view tracking.

## Key Features

### 1. Campaigner Dashboard
- **Location**: `/campaigner`
- **Features**:
  - Create new events with different types
  - Configure "Most Views" events with sum views option
  - View all created events
  - Event validation

### 2. Most Views Event Type
The "Most Views" event type includes a key feature: **Sum Views Option** and **Prize Tiers**

#### Traditional Mode (sumViews: false)
- Winners determined by the single clip with the most views
- Only considers the highest-performing clip per clipper

#### Sum Views Mode (sumViews: true) 
- Winners determined by the sum of views from all clips that meet requirements
- All eligible clips from the same clipper are combined
- Better for measuring overall clipper performance

#### Prize System
- **1st, 2nd, 3rd Place**: Default prize tiers with customizable names and descriptions
- **Custom Prizes**: Add unlimited prize positions (4th, 5th, etc.)
- **Prize Values**: Optional monetary values for each prize
- **Visual Indicators**: Prize winners highlighted with special styling and trophy icons

### 3. View Requirements
Events can specify:
- **Minimum views**: Required view count per clip
- **Maximum views**: Optional upper limit
- **Date range**: Optional time window for clip eligibility

### 4. Clipper Management
- Add and manage clippers
- Track individual clips with view counts
- Real-time leaderboard calculation
- Validation of clip eligibility

## Technical Implementation

### Types
- `Event`: Main event configuration
- `Clipper`: Clipper information and clips
- `Clip`: Individual video clips with view data
- `MostViewsEventConfig`: Configuration for most views events

### Key Components
- `CampaignerDashboard`: Event creation and management
- `ClipperManagement`: Clipper and clip management
- `eventValidation.ts`: Validation and scoring logic

### Validation Logic
- View requirements validation
- Date range validation
- Configuration validation
- Real-time eligibility checking

## Usage

1. Navigate to `/campaigner` from the main page
2. Create events with the "Most Views" type
3. Toggle the "Sum views of all clips" option as needed
4. Set minimum/maximum view requirements
5. Use the Clipper Management tab to add clippers and clips
6. View real-time leaderboards based on your configuration

## Example Scenarios

### Scenario 1: Single Best Clip with Prizes
- Event: "Best Gaming Clip"
- Sum Views: OFF
- Min Views: 1000
- Prizes: 1st Place ($100), 2nd Place ($50), 3rd Place ($25)
- Result: Top 3 clippers with single highest-viewed clips win prizes

### Scenario 2: Total Performance Competition
- Event: "Most Consistent Creator" 
- Sum Views: ON
- Min Views: 500
- Prizes: 1st Place ($200), 2nd Place ($100), 3rd Place ($50)
- Result: Top 3 clippers with highest total views across all eligible clips win prizes

### Scenario 3: Custom Prize Structure
- Event: "Monthly Creator Challenge"
- Sum Views: ON
- Min Views: 1000
- Prizes: 
  - 1st Place: "Champion" ($500)
  - 2nd Place: "Runner-up" ($250) 
  - 3rd Place: "Third Place" ($100)
  - 4th Place: "Honorable Mention" ($50)
  - 5th Place: "Participation Prize" ($25)
- Result: Top 5 clippers receive different prize levels

