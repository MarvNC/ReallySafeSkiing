# Really Safe Skiing ⛷️

A low-poly, high-speed downhill skiing game where safety is strictly... optional.
Dodge trees, rocks, and gravity itself.

## ✨ Features

- **Physics-Driven Movement:** Momentum, friction, and non-linear air drag simulated via **Rapier3D**.
- **Infinite Terrain:** Procedurally generated chunks with adaptive obstacles, jumps, and cliffs.
- **Game Modes:** Race the clock in **Sprint Mode** or ski endlessly in **Zen Mode**.
- **Responsive Controls:** precise keyboard steering for desktop and intuitive touch zones for mobile.
- **Visual Polish:** Procedural snow sparkles, speed lines, and crash recovery animations.

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

## 📦 Build

To create a production build:

```bash
bun run build
```
