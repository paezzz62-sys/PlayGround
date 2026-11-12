# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/paezzz62-sys/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/paezzz62-sys/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/paezzz62-sys/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/paezzz62-sys/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/paezzz62-sys/PlayGround).
- 🛠️ [Check build runs](https://github.com/paezzz62-sys/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/paezzz62-sys/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/paezzz62-sys).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->

## Run locally

Requires Node.js 18 or newer.

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Players begin with 10 gold; signature skills cost 100 gold and are purchased in the Skill Lab. Without a Socket.IO connection, the game opens in offline practice mode; matchmaking and server-validated purchases require the server.

### Admin access

Set `ADMIN_KEY` before starting the server to enable admin privileges. Enter the same key in the optional Admin Access Key field when joining. Admin access is disabled when `ADMIN_KEY` is unset or empty.

```sh
ADMIN_KEY=your-secret-key npm start
```

For a public deployment, set `ALLOWED_ORIGIN` to the intended web origin instead of allowing cross-origin connections from `*`.
