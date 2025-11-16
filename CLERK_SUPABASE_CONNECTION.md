# How Clerk Auth Works with Supabase

## Overview

Clerk handles **authentication** (login, signup, user management), while Supabase handles **data storage** (rooms, game state). They work together like this:

## The Connection Flow

1. **User logs in via Clerk** → Gets a Clerk `userId` (e.g., `user_2abc123...`)
2. **App makes API request** → Clerk middleware verifies the user is authenticated
3. **API route gets `userId`** → Uses `requireAuth()` helper to get Clerk `userId`
4. **Database operations** → Uses Clerk `userId` as `user_id` in Supabase tables

## Key Points

### 1. Clerk User ID = Supabase User ID
- When a user creates a room, their Clerk `userId` is stored as `host_id` in the `rooms` table
- When a user joins a room, their Clerk `userId` is stored as `user_id` in the `room_players` table
- **No separate user table needed** - Clerk manages users, we just use their IDs

### 2. Authentication Flow

```typescript
// In API routes:
import { requireAuth } from '@/lib/supabase/auth';

export async function POST(request: NextRequest) {
  const userId = await requireAuth(); // Gets Clerk userId
  // userId is now: "user_2abc123..." (Clerk format)
  
  // Use it in database:
  await createRoom(userId, hostName);
  // Stores userId in rooms.host_id column
}
```

### 3. Authorization Checks

We verify users can perform actions:

```typescript
// Check if user is host
const isHost = await isUserHost(userId, roomId);

// Check if user is in room
const inRoom = await isUserInRoom(userId, roomId);
```

### 4. Row Level Security (RLS)

RLS policies in Supabase are set to `true` (allow all) because:
- **Clerk middleware** already protects API routes (requires auth)
- **Application code** checks authorization (is user host? is user in room?)
- This is simpler than trying to pass Clerk tokens to Supabase

## Why This Works

1. **Clerk middleware** (`src/middleware.ts`) protects all routes except public ones
2. **API routes** use `requireAuth()` to get the authenticated user's ID
3. **Database functions** use the Clerk `userId` directly - no mapping needed
4. **Real-time subscriptions** work because Supabase doesn't need auth tokens (we use anon key for subscriptions, service role for writes)

## Security

- ✅ **Authentication**: Clerk handles it (login, sessions, tokens)
- ✅ **Authorization**: App code checks permissions (is host? in room?)
- ✅ **Data Access**: Service role key bypasses RLS (we control access in app code)
- ✅ **Real-time**: Anon key allows subscriptions (read-only, safe)

## Example Flow

```
User Action: Create Room
├─> Clerk Middleware: ✅ User authenticated
├─> API Route: requireAuth() → Gets userId
├─> Database: createRoom(userId, name) → Stores userId as host_id
└─> Response: Room created with host_id = Clerk userId

User Action: Join Room
├─> Clerk Middleware: ✅ User authenticated  
├─> API Route: requireAuth() → Gets userId
├─> Database: joinRoom(roomId, userId, name) → Stores userId in room_players
└─> Response: User added to room

Real-time Update: Room changes
├─> Supabase: Database change detected
├─> Supabase: Broadcasts to subscribed clients
└─> Client: useRoomSubscription hook receives update
```

## No User Sync Needed

We **don't need** to sync Clerk users to Supabase because:
- We only store Clerk `userId` strings (not full user objects)
- Clerk manages all user data (name, email, etc.)
- We only need the ID to link rooms/players to users

If you need user names/emails in the future, you can:
1. Fetch from Clerk API when needed
2. Or create a simple `users` table that syncs from Clerk webhooks

