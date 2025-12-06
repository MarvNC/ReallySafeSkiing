# Controls

## Keyboard Controls

### Player Movement Controls

- **`A`** / **`←`** (Left Arrow) - Steer left
- **`D`** / **`→`** (Right Arrow) - Steer right
- **`S`** / **`↓`** (Down Arrow) - Brake (snowplow)
- **Auto-Push** - The player automatically uses ski poles to propel forward when speed is below 20 km/h and not braking

### Camera Controls

- **`C`** - Toggle between debug orbit camera and first-person camera
  - Debug orbit camera: Free-roaming camera with mouse controls
  - First-person camera: Camera attached to player

### Visual Debug Controls

- **`F2`** - Toggle debug information overlay
  - Shows/hides the debug UI panel (top-left corner)
  - Displays player position, velocity, direction vectors, rotation, camera info, and FPS
  - Also toggles visual debug helpers (direction arrows and world axes)

- **`V`** - Toggle wireframe mode
  - Switches terrain rendering between solid and wireframe view
  - Useful for inspecting terrain geometry

- **`G`** - Toggle grid visibility
  - Shows/hides the ground grid helper
  - Helps visualize the world coordinate system

## Mouse Controls (Debug Orbit Camera Mode)

When in debug orbit camera mode (press `C` to activate), you can control the camera with your mouse:

- **Left Mouse Button + Drag** - Rotate camera around the scene
- **Right Mouse Button + Drag** - Pan camera (move horizontally/vertically)
- **Scroll Wheel** - Zoom in/out

## Debug Information Display

When debug mode is enabled (press `F2`), the overlay displays:

- **FPS** - Current frames per second
- **Position** - Player's world coordinates (x, y, z)
- **Velocity** - Current velocity vector
- **Speed** - Magnitude of velocity in m/s
- **Forward** - Forward direction vector (green arrow)
- **Right** - Right direction vector (red arrow)
- **Up** - Up direction vector (blue arrow)
- **Rotation** - Player rotation as Euler angles
- **Camera Pos** - Current camera position
- **Camera Rot** - Current camera rotation

Visual indicators in the 3D scene:

- **Green Arrow** - Forward direction
- **Red Arrow** - Right direction
- **Blue Arrow** - Up direction
- **Yellow Arrow** - Velocity vector (scaled for visibility)
- **World Axes** - Large coordinate axes at world origin (red=X, green=Y, blue=Z)

## Tips

- Start with debug orbit camera (`C`) to get an overview of the scene
- Use wireframe mode (`V`) to inspect terrain generation
- Enable debug info (`F2`) to monitor player physics and movement
- The grid (`G`) helps visualize the world space and terrain alignment
