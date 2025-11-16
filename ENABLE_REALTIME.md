# How to Enable Real-time in Supabase

## Step-by-Step Instructions

### 1. Go to Supabase Dashboard
1. Open your Supabase project dashboard
2. Navigate to **Database** → **Replication** (in the left sidebar)

### 2. Enable Replication for Tables

You need to enable replication for these 3 tables:

#### Enable for `rooms` table:
1. Find `rooms` in the table list
2. Toggle the switch to **ON** (it will turn green/blue)
3. This enables real-time updates when rooms are created, updated, or deleted

#### Enable for `room_players` table:
1. Find `room_players` in the table list
2. Toggle the switch to **ON**
3. This enables real-time updates when players join/leave rooms or change ready status

#### Enable for `game_states` table:
1. Find `game_states` in the table list
2. Toggle the switch to **ON**
3. This enables real-time updates for game state changes (voting, turns, etc.)

### 3. Verify It's Working

After enabling, you should see:
- ✅ Green/blue toggle switches next to each table
- The tables listed under "Replicated Tables"

### 4. Test Real-time (Optional)

You can test if real-time is working by:

1. Open your app in two browser windows
2. Create a room in one window
3. The room should appear in the other window automatically (without refresh)

## What This Does

When replication is enabled:
- **Database changes** → Supabase detects them
- **Supabase broadcasts** → All subscribed clients receive updates
- **Your app** → `useRoomSubscription` hook receives updates instantly

## Troubleshooting

### Real-time not working?
1. **Check replication is enabled** - Go back to Database → Replication and verify toggles are ON
2. **Check browser console** - Look for subscription errors
3. **Check Supabase logs** - Go to Logs → Realtime to see if there are errors
4. **Verify anon key** - Make sure `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly

### Still not working?
- Make sure you're using the Supabase client (not admin client) for subscriptions
- Check that your Supabase project is active (not paused)
- Verify your subscription code is correct (see `src/lib/hooks/useRoomSubscription.ts`)

## Important Notes

- **Replication uses resources** - Only enable for tables that need real-time
- **Free tier limits** - Supabase free tier has real-time limits, but should be fine for this game
- **Performance** - Real-time is very efficient, but too many subscriptions can slow things down

