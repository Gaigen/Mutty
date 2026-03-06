# Voice App
![GitHub release (latest SemVer)]

**Voice App** is an open-source, real-time voice communication platform
inspired by Discord and built on top of **LiveKit**. It enables
developers to create modern voice-first applications with low-latency
communication, scalable infrastructure, and customizable UI components.

The project aims to provide a lightweight and flexible foundation for
building community voice platforms, collaboration tools, and real-time
communication systems.

------------------------------------------------------------------------

## Features

-   Real-time voice communication
-   Low-latency audio streaming
-   Discord-like voice channels
-   LiveKit-powered WebRTC infrastructure
-   Open-source and self-hostable
-   Modular architecture for easy customization
-   Cross-platform compatible (web-first architecture)
-   Simple developer setup

------------------------------------------------------------------------

## Architecture
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![LiveKit](https://img.shields.io/github/v/release/livekit/livekit)

Client (Web App / UI) │ │ WebRTC ▼ LiveKit Server │ │ Media + Signaling
▼ Voice Channels & Sessions

Core components:

-   **Frontend** -- UI and user interaction, React based
-   **LiveKit Server** -- Real-time voice infrastructure
-   **Token server** -- LiveKit related module, responsible for retrieving tokens needed for rooms
-   **Agent server** -- LiveKit feature, essentially it is a bot that can play videos, music

------------------------------------------------------------------------

## Getting Started

### 1. Clone the repository

git clone https://github.com/Gaigen/Voice-app.git cd Voice-app

### 2. Install dependencies

npm install

or

yarn install

### 3. Configure environment

Create a `.env` file in the root directory.

Example:

LIVEKIT_URL=your_livekit_url LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

### 4. Run the development server

npm run dev

or

yarn dev

------------------------------------------------------------------------

## Use Cases

Voice App can be used as a foundation for:

-   Community voice platforms
-   Team collaboration tools
-   Voice-enabled social apps
-   Gaming voice chat systems
-   Developer experimentation with LiveKit

------------------------------------------------------------------------

## Customization

You can extend the application by:

-   Implementing authentication
-   Creating moderation tools
-   Integrating bots or AI agents

------------------------------------------------------------------------

## Deployment

Typical deployment:

1.  Deploy the frontend
2.  Run a LiveKit server
3.  Configure environment variables
4.  Connect the client to the LiveKit instance

------------------------------------------------------------------------

## Contributing

1.  Fork the repository
2.  Create a branch
3.  Commit changes
4.  Submit a pull request

------------------------------------------------------------------------

## Roadmap

-   User authentication
-   Mobile support
-   Desktop app
-   Role and permission system
-   Plugin system

------------------------------------------------------------------------

## License

MIT License

------------------------------------------------------------------------

## Acknowledgements

-   LiveKit
-   WebRTC community
-   Open-source contributors
