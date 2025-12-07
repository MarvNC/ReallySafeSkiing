# Really Safe Skiing ⛷️

A fast-paced, 3D procedural skiing game.

## ✨ Features

- **Physics-Based Movement:** Realistic skiing mechanics including carving, braking, and ragdoll crashes using Rapier3D.
- **Customizable:** Adjust slope angles (0°–70°) and difficulty settings (Chill, Sport, Extreme).
- **Modern UI:** Clean, responsive HUD and menus built with React and Tailwind.
- **PWA Support:** Installable as a standalone app on supported devices.
- **Mobile Ready:** Touch controls for steering and braking.

## 🛠️ Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Framework:** [React](https://react.dev) + [Vite](https://vitejs.dev)
- **3D Engine:** [Three.js](https://threejs.org)
- **Physics:** [Rapier3D](https://rapier.rs)
- **Styling:** [Tailwind CSS](https://tailwindcss.com)
- **State:** [Zustand](https://github.com/pmndrs/zustand)

## 🚀 Getting Started

This project uses **Bun** for package management and script execution.

1.  **Install dependencies:**

    ```bash
    bun install
    ```

2.  **Start development server:**

    ```bash
    bun run dev
    ```

3.  **Lint & Format:**

    ```bash
    bun run lint:fix
    bun run format
    ```

## 🎮 Controls

| Action               | Keyboard               | Touch (Mobile)        |
| :------------------- | :--------------------- | :-------------------- |
| **Steer**            | `A` / `D` or `←` / `→` | Tap Left / Right side |
| **Brake (Snowplow)** | `A` + `D` or `←` + `→` | Hold both sides       |
| **Start / Select**   | `Space` / `Enter`      | Tap Button            |
| **Pause**            | `Esc`                  | Tap UI Button         |

### Debug Controls

- **`F2`**: Toggle Debug UI (FPS, speed, vectors)
- **`C`**: Toggle Camera (First-person / Orbit)
- **`V`**: Toggle Wireframe
- **`G`**: Toggle Grid

## 📦 Build

To create a production build:

```bash
bun run build
```
