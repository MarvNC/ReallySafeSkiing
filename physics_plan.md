Here’s a single plan you can keep coming back to. It bakes in all the decisions we’ve made so far.

---

## 0. High-level goals & constraints

**Physics design:**

- One global Rapier `World`.
- Fixed-timestep physics: **1/60 s**.
- Gravity lives in Rapier, not in ad-hoc code.
- Terrain = **heightfield colliders per chunk**.
- Obstacles = **primitive colliders** (sphere / capsule / box / cylinder).
- **Player is the only dynamic body**; everything else is static.
- Player body is kept upright via **locked rotations**.
- Collision layers: **Player** and **World** (plus optional Trigger later).
- Terrain height logic is **only** used to pick the player’s initial Y at spawn.
- Three.js is purely a view: it mirrors Rapier, never contradicts it.

**Ownership:**

- `GameApp` orchestrates initialization, update order, and teardown.
- `PhysicsWorld` owns Rapier world and timestep.
- `TerrainManager`+`TerrainChunk` own terrain & obstacle colliders.
- `PlayerPhysics` owns the dynamic body.
- `PlayerController` is visuals + input → calls into `PlayerPhysics`.
- Debug systems are read-only observers.

---

## 1. Files & modules to add/modify

### New modules

1. `src/physics/PhysicsWorld.ts`
2. `src/player/PlayerPhysics.ts`
3. `src/physics/PhysicsLayers.ts` (or inside `PhysicsWorld` if you want)
4. Optional: `src/physics/PhysicsUtils.ts` (for vec conversions, helper builders)

### Existing modules to touch

- `GameApp` (or equivalent main game class)
- `TerrainManager`
- `TerrainChunk`
- `PlayerController`
- `GameConfig` / `PHYSICS_CONFIG`
- `DebugUI` / `DebugHelpers` (just to read new physics state)

---

## 2. Phase 1 – PhysicsWorld (Rapier world + fixed step)

**Goal:** have a self-contained module that initializes Rapier, owns `Rapier.World`, and steps it with a fixed timestep.

### 2.1 Implement `PhysicsWorld`

Create class:

- Fields:
  - `world: RAPIER.World`
  - `gravity: RAPIER.Vector3`
  - `timestep = 1 / 60`
  - `accumulator = 0`

- Methods:
  - `async init()`
    - `await RAPIER.init()`
    - `this.gravity = new RAPIER.Vector3(0, -20, 0)` (or pulled from config)
    - `this.world = new RAPIER.World(this.gravity)`

  - `step(deltaSeconds: number)`
    - Clamp `deltaSeconds` to max (from config, e.g. 0.05).
    - `accumulator += deltaSeconds`
    - While `accumulator >= timestep`: `world.step()` and decrement.

  - `getWorld(): RAPIER.World`
  - `dispose()`
    - `world.free()` (and null out references)

Optional helpers:

- `createFixedBody(position: Vector3): RigidBody`
- `createDynamicBody(descModifiers): RigidBody`
- `threeToRapier` / `rapierToThree` vector mappings.

**Invariants:**

- There is exactly one `PhysicsWorld` instance for the runtime.
- No one else calls `RAPIER.init()` or creates their own `World`.

---

## 3. Phase 2 – PlayerPhysics (dynamic capsule, locked upright)

**Goal:** encapsulate the player’s Rapier body and how it responds to input.

### 3.1 Implement `PlayerPhysics` class

Fields:

- `body: RAPIER.RigidBody`
- `collider: RAPIER.Collider`
- `tmpPosition: THREE.Vector3`
- `tmpQuaternion: THREE.Quaternion`

Constructor:

1. Take `PhysicsWorld`, `spawnPosition: THREE.Vector3`, and config.
2. Get `world = physics.getWorld()`.
3. Build `RigidBodyDesc.dynamic()` with:
   - `setTranslation(spawn.x, spawn.y, spawn.z)`
   - `lockRotations()` (keep the player fully upright)
     - (Later you can allow Y rotation only if desired.)

4. Create the rigid body.
5. Create a capsule collider with radius/height from config.
6. Assign collision groups/layers (`PhysicsLayer.Player` vs `PhysicsLayer.World`).
7. Keep references to body + collider.

Public methods:

- `applyControls(input: InputManager, deltaSeconds: number)`
  - Read input actions (steer left/right, jump, maybe brake).
  - Compute impulses/forces and call `body.applyImpulse` / `applyTorqueImpulse`.
  - No direct transform edits, no terrain queries.

- `syncToThree(target: THREE.Object3D)`
  - Read translation & rotation from `body` and copy to `target`.

- `getPosition(out?: THREE.Vector3)`
- `getVelocity(out?: THREE.Vector3)`
- `dispose(physics: PhysicsWorld)`
  - Remove collider and body from `world`.

**Invariants:**

- Player position & orientation used by the game always come from this body.
- Player is always upright (no tipping) unless you explicitly change it later.
- No other code manipulates the player’s world-space position, except maybe for instantaneous dev teleports in debug mode.

---

## 4. Phase 3 – Integrate PlayerController with PlayerPhysics

**Goal:** keep `PlayerController` visual and input-centric, delegating physics to `PlayerPhysics`.

### 4.1 Refactor PlayerController’s constructor

Add a required `PlayerPhysics` parameter:

- `constructor(scene, input, cameras, config, playerPhysics: PlayerPhysics)`
  - Store `this.physics = playerPhysics`.
  - Build the usual visual hierarchy (root group, skis, hands, etc.).
  - Attach the player camera as a child of `this.root` (or a child of a camera rig under root).

### 4.2 `PlayerController.update(delta)`

New update flow:

1. `this.physics.applyControls(this.input, delta);`
2. `this.physics.syncToThree(this.root);`
3. Compute speed from `this.physics.getVelocity()` for:
   - Hand bobbing
   - Ski tilt
   - UI / HUD display if needed

4. Camera follows automatically because it’s a child of `root`.

**Invariants:**

- Player’s Three.js transform is always a mirror of the dynamic body.
- `PlayerController` **never** samples terrain height for movement and never teleports the root group.

---

## 5. Phase 4 – Hook into GameApp (init + main loop)

**Goal:** make physics part of the core lifecycle, with a well-defined order.

### 5.1 Initialization order in GameApp

In `GameApp.init()` (or equivalent async setup):

1. General Three.js setup: renderer, scene, cameras, input.
2. `this.physics = new PhysicsWorld();`
3. `await this.physics.init();`
4. `this.terrainManager = new TerrainManager(this.scene, this.physics, config);`
   - `TerrainManager` can now create initial chunks, including colliders.

5. Choose a spawn X/Z (and maybe direction) from config.
6. Call `const groundY = terrainManager.getTerrainHeight(x, z);`
7. Compute `spawnY = groundY + SPAWN_PLAYER_OFFSET` (e.g. 2 units above).
8. Create `this.playerPhysics = new PlayerPhysics(this.physics, new Vector3(x, spawnY, z));`
9. Create `this.playerController = new PlayerController(scene, input, cameras, config, this.playerPhysics);`
10. Create `DebugUI`, `DebugHelpers`, passing references to `playerPhysics` / `terrainManager`.

**Terrain height usage rule is enforced here:**

- The only place `getTerrainHeight` is used for player logic is this step.

### 5.2 Main loop

In `GameApp.animate(timestamp)`:

1. Compute `delta = (timestamp - lastTimestamp) / 1000`.
2. Clamp `delta` to `PHYSICS_CONFIG.maxDeltaTime` (e.g. 0.05).
3. `this.physics.step(delta);`
4. `this.playerController.update(delta);`
5. `this.terrainManager.update(this.playerPhysics.getPosition());`
   - For chunk streaming and possibly decoration updates.

6. `this.debugUI.update(this.playerPhysics, this.terrainManager);`
7. `this.debugHelpers.update(this.playerPhysics);`
8. `renderer.render(scene, activeCamera);`
9. `requestAnimationFrame(this.animate);`

**Invariants:**

- Physics always runs before any visual update each frame.
- Only one `step` per frame loop, with 0–N internal fixed substeps.

---

## 6. Phase 5 – TerrainManager & TerrainChunk: heightfield + obstacles

**Goal:** each chunk generates both visuals and colliders from the same data.

### 6.1 TerrainManager changes

- Constructor now takes `physics: PhysicsWorld`.
- When creating a chunk, pass `physics` through:
  - `new TerrainChunk(scene, physics, chunkCoords, config);`

- Provide:
  - `getTerrainHeight(x: number, z: number): number` → used for spawn.
  - `update(playerPosition: Vector3)` to load/unload chunks.

### 6.2 TerrainChunk responsibilities

On creation:

1. Generate or receive height data grid for this chunk:
   - `rows`, `cols`, `heights[]`
   - This is the same data you use for the terrain mesh vertices.

2. Build the terrain mesh:
   - Standard Three.js `BufferGeometry` from `heights`.

3. Build the heightfield collider:
   - Compute scale in X/Z direction from chunk size and grid resolution.
   - Create:
     - Fixed body for the chunk origin.
     - `ColliderDesc.heightfield(rows, cols, heights, scaleVec)`.

   - Set collision groups to `World` vs `Player`.

4. For each obstacle (tree, rock, log):
   - Decide a primitive shape:
     - Tree → cylinder or capsule.
     - Rock → sphere or capsule.
     - Log → box or capsule oriented along the log.

   - Create a fixed body at that world position.
   - Create collider with appropriate dimensions.
   - Set collision groups to `World` vs `Player`.

On `dispose(physics)`:

- Remove terrain mesh and obstacle meshes from the scene.
- Remove heightfield collider and its body from physics.
- Remove obstacle colliders and bodies from physics.

**Invariants:**

- No chunk exists without its colliders; no colliders linger after the chunk is gone.
- Heightfield collider is derived _directly_ from the same data as the visual mesh.

---

## 7. Phase 6 – Collision layers (Player vs World)

**Goal:** simple, explicit collision filtering aligned with “one dynamic body”.

### 7.1 Define layer flags

Create a small enum:

```ts
export enum PhysicsLayer {
  Player = 0b0000000000000001, // 1
  World = 0b0000000000000010, // 2
}
```

Add a helper function (e.g. in `PhysicsLayers.ts`):

```ts
export function makeCollisionGroups(membership: PhysicsLayer, mask: number): number {
  return membership | (mask << 16);
}
```

### 7.2 Apply to colliders

- **Player collider:**
  - Membership: `PhysicsLayer.Player`
  - Mask: `PhysicsLayer.World` (collide only with world)

- **Terrain + obstacle colliders:**
  - Membership: `PhysicsLayer.World`
  - Mask: `PhysicsLayer.Player` (collide only with player)

Later, triggers:

- Membership: `PhysicsLayer.Trigger`
- Mask: `PhysicsLayer.Player` (or similar)

**Invariants:**

- Rapier never simulates dynamic-dynamic interactions (because you don’t have any).
- Adding non-colliding debug colliders or triggers later is straightforward.

---

## 8. Phase 7 – Debug and visualization

**Goal:** tools to understand what the physics is doing without changing the simulation.

### 8.1 DebugUI

- Read from `PlayerPhysics`:
  - Speed = `|velocity|`.
  - Altitude = `position.y`.
  - Maybe surface height under player: `terrainManager.getTerrainHeight(x, z)` **for display only**, not for movement.

- Display:
  - Player position.
  - Player velocity.
  - Number of active chunks.
  - Maybe number of physics bodies/colliders (if you expose it).

### 8.2 DebugHelpers

- Optional shapes:
  - Arrow for velocity from player position.
  - Line to contact point or display of slope angle (by asking terrain for normal if you have it).

- All logic is read-only: no direct changes to physics or Three transforms other than debug objects.

---

## 9. Phase 8 – Cleanup and refactor pass

Once everything’s working (player falls onto terrain, slides, collides with obstacles):

### 9.1 Remove obsolete code

- Any manual Y-clamping of player based on terrain height.
- Any direct per-frame position edits like `player.position.x += ...` for movement.
- Any old physics hacks now superseded by Rapier.

### 9.2 Enforce invariants

Scan the codebase for:

- Direct uses of `Rapier.World` outside `PhysicsWorld` (except where absolutely necessary).
- Any call to `getTerrainHeight` that isn’t:
  - Player spawn; or
  - Visual/debug/placement logic.

### 9.3 Extract config

- Put physics-related constants (capsule radius/height, mass, friction, restitution, jump impulse, max speed, damping values) into a config section.
- Make sure `PhysicsWorld` reads gravity from config, not hardcoded.

---

## 10. Implementation order checklist

If you want a concrete “do this next” list:

1. Implement `PhysicsWorld` with fixed step (no other changes yet).
2. Implement `PlayerPhysics` (dynamic, upright capsule).
3. Refactor `PlayerController` to depend on `PlayerPhysics`.
4. Wire `GameApp`:
   - Init order with `PhysicsWorld`, `TerrainManager`, height-based spawn, `PlayerPhysics`, `PlayerController`.
   - Main loop: `physics.step`, `playerController.update`, `terrainManager.update`, debug, render.

5. Implement heightfield colliders in a single `TerrainChunk`; run a test with 1–2 chunks to verify:
   - Player falls.
   - Player collides with terrain.
   - Player stays upright.

6. Add primitive colliders for obstacles in that chunk and verify collisions.
7. Extend to full chunk streaming + proper dispose logic.
8. Hook up collision layers properly.
9. Wire debug UI/helpers to read physics state.
10. Cleanup pass: kill old movement/terrain hacks and consolidate config.

Use that as the reference design; if you keep future changes consistent with these ownership rules and invariants, you won’t have to rip apart the integration later.
