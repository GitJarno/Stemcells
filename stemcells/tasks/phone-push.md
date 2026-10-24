# Phone push from our own sender

`aski-forward.md`, Move 2, slice F. The person chose our own sender
(2026-10-24): the Mac sends straight to Apple's push service with the
person's own APNs key. Nothing goes through T3's relay, Expo's push service
or anyone else's cloud.

## What upstream does, and why we can't reuse it

- The phone reads its raw APNs device token
  (`apps/mobile/src/features/agent-awareness/remoteRegistration.ts`) and
  registers it with T3's relay behind a Clerk sign-in. Without a relay URL
  that whole path stays idle, so it is idle in Stemcells.
- The relay, not the server, decides when to push and talks to Apple
  (`infra/relay/src/agentActivity/`). Its APNs client is a good template:
  an HTTP/2 POST to `/3/device/<token>` with an ES256 JWT, and a payload
  of `aps.alert`, `thread-id` and `body: {environmentId, threadId,
  deepLink}`.
- The phone opens `/threads/<env>/<thread>` from that body
  (`notificationPayload.ts`), so a push we send in the same shape opens
  the Cell with no change on the phone.

## Constraints

- The server's `fetch` is held to HTTP/1.1 (`apps/server/src/outboundHttp.ts`)
  and APNs needs HTTP/2, so the sender uses `node:http2`.
- `api.push.apple.com` and its sandbox go into `stemcells/outbound.txt` as
  `host` lines: the app contacts them only once the person sets a key, so
  they aren't `live`.
- The phone build is pinned to T3's team, and the Personal Team build drops
  `aps-environment`. A push needs the person's paid team and an App ID of
  their own with push turned on.
- The phone has no Aski room yet, so a tap opens the Cell's thread, not its
  card.
- A paired Watch mirrors the iPhone's alerts by itself.

## Slices

- [x] 1. Server sender in `apps/server/src/stemcells/push/`. Endpoints:
      `POST /api/stemcells/push/devices` stores the token, environment and
      bundle id (read access: a phone that reads the Cells may hear of
      them), and `PUT /api/stemcells/push/key` stores the `.p8`, Key ID and
      Team ID in the secret store (the access pairing asks). Also an HTTP/2
      client with a JWT reused for 45 minutes, a test push, and the
      allow-list lines. Settings › Aski › Your phone sets the key, lists
      and removes phones, and sends a test.
- [x] 2. Trigger: a card still waiting 2 minutes after its `since`, while
      nobody is at the Mac (`presence.ts`), pushes once, with the Cell's
      title, the card's cue and the thread's deep link. A card that waits
      while the person is here pushes once they go. Elsewhere than macOS
      nobody is ever away, so nothing pushes.
- [ ] 3. Phone registration in `apps/mobile/src/stemcells/push/`. Ask for
      notification permission, read the device token, and post it to each
      saved connection. It shows as a Notifications row of our own.
- [ ] 4. Phone build under the person's own team and bundle id, keeping
      push. This is a seam in `app.config.ts` and `capabilities.ts`.
- [ ] 5. Later: an Aski room on the phone, so a tap lands on the card.

## Steps only the person can take

1. Join the paid Apple Developer Program (a Personal Team can't push).
2. Register an App ID of their own with Push Notifications on.
3. Create an APNs Auth Key (.p8) under Certificates, Identifiers & Profiles
   › Keys, and note its Key ID and the Team ID. The `.p8` downloads once.
4. Hand the key to Stemcells through its key setting, never the repo.
5. Install the phone build on the iPhone and allow notifications.
