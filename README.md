# Financial Management Program

A desktop financial management application built with **Tauri 2**, **React**, and **Vite**.

---

## 🛠️ Prerequisites

Before you begin, make sure you have the following installed:

| Tool | Version | Install Link |
|------|---------|--------------|
| **Node.js** | v18+ (LTS) | [nodejs.org](https://nodejs.org/) |
| **Rust** | Latest stable | [rustup.rs](https://rustup.rs/) |
| **Visual Studio Build Tools** | 2022+ | [Required for Windows](https://visualstudio.microsoft.com/visual-cpp-build-tools/) |

> **Windows Users:** When installing VS Build Tools, select "Desktop development with C++" workload.

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone <repo-url>
cd "Financial Management Program"

# 2. Install frontend dependencies
cd app/frontend
npm install

# 3. Install root dependencies (Tauri CLI)
cd ..
npm install

# 4. Run the app
npm run tauri:dev
```

The app window will open after the initial Rust compilation (~2-3 min first time).

---

## 📁 Project Structure

```
/app
  ├── frontend/      # React + Vite + TypeScript
  ├── src-tauri/     # Rust backend (Tauri 2)
  ├── shared/        # Shared types & constants
  └── scripts/       # Dev & build scripts
```

---

## 📜 Available Commands

Run from the `/app` directory:

| Command | Description |
|---------|-------------|
| `npm run tauri:dev` | Start dev server with hot-reload |
| `npm run tauri:build` | Build production executable |

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Test with `npm run tauri:dev`
4. Submit a pull request

---

## 📄 License

MIT License
