# MeTTa Game – Client

> **Note:** This repository contains the client for MeTTa Game. If you're looking for the server, visit [MeTTa Game – Server](https://github.com/fluidity-labs/metta-game-server).

**MeTTa Game** is a text-based adventure client for a MeTTa and OpenCog Hyperon-powered game server. The current game, **Emerald Grove Omen**, uses websocket events to stream narrative output, executed MeTTa, and backend-authored documentation metadata into the browser.

The client includes a narrative play view, a direct MeTTa console, a clickable definition inspector, and an in-app documentation dialog for players and developers. The server drives the actual world model, command resolution, puzzle logic, and MeTTa execution.

## Features

- 🎮 **Narrative Play Panel** – Send natural-language actions and read the story-focused response stream.
- 🖥️ **Direct MeTTa Console** – Inspect exact executed queries and run explicit MeTTa commands with runtime guardrails.
- 📚 **Interactive Definition Inspector** – Click executed MeTTa to inspect function and trigger source returned by the server.
- 🧠 **Reasoning-Aware UI** – Surfaced docs and raw responses make MeTTa execution visible instead of opaque.
- 🌍 **Procedural Puzzle Flow** – The current island scenario combines randomized rune placement and a randomized final escape item.
- 📖 **Built-In Documentation** – The Documentation action in the app explains the player flow, backend architecture, and reasoning model.

## Documentation

The client now ships with an in-app documentation dialog covering:

- **Player Guide** – How to navigate the interface, use commands, and progress through the current game loop.
- **Technical Guide** – Runtime flow, websocket events, command matching, MeTTa rules, state atoms, tick synchronization, and the clickable docs pipeline.

The fastest way to explore the technical side of the game is:

1. Open the app.
2. Use the **Documentation** button for the authored overview.
3. Switch to **Code** after a few actions and click the highlighted MeTTa to inspect live definitions.

## Getting Started

### Prerequisites
- **Node 18+**
- **NPM 9+** (Node package manager)
- [**MeTTa Game – Server**](https://github.com/fluidity-labs/metta-game-server) (Currently not available on Windows)

### Installation

```sh
# Clone the repository
git clone https://github.com/philipesantos/metta-game-client.git
cd metta-game-client

# Install dependencies
npm install

# Run
npm run dev
```

Configure the websocket endpoint with:

```sh
VITE_WEBSOCKET_BASE_URL=ws://127.0.0.1:8765
```

See [`.env.example`](.env.example) for the local defaults.

## How The Client Fits The Server

- The browser sends websocket messages with `command`, `command_type`, and a UUID.
- The server resolves natural-language commands into MeTTa, executes them, and returns structured `command_result` events.
- Startup also includes a `metta_docs` catalog so the client can inspect exact MeTTa definitions without parsing backend source itself.
- After natural-language actions, the server runs a tick synchronization step so procedural logic like cave danger resolution can advance cleanly.

## Tech Stack

[MeTTa](https://metta-lang.dev/) (Meta Type Talk) is a multi-paradigm language for declarative and functional computations over knowledge (meta)graphs.

[OpenCog Hyperon](https://hyperon.opencog.org/) is an ambitious open-source project aimed at creating an Artificial General Intelligence (AGI) framework, capable of human-level reasoning and beyond.

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.
