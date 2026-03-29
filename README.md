# Native Banter YouTube Player

This script provides a native serverless YouTube player for Banter spaces. It uses `OneShots` for instantaneous playback control and `SpaceState` for persistence without the need for an external WebSocket server.

## Features
- **Serverless Sync**: Uses Banter SDK's built-in networking.
- **Admin Locking**: Prevents unauthorized users from changing the video.
- **Grabbable**: Optionally allow users to pick up and move the screen.
- **Billboard**: Optionally make the screen always face the local user.
- **Hand Controls**: Attached to the left hand.
- **In-Space Playlist**: Search YouTube directly from inside the VR space.

## Installation

Add the script tag inside your `<a-scene>` in your space's `index.html`.

```html
<!-- Native YouTube Player -->
<script src="https://banter-yt-player.firer.at/player.js" 
    instance="main-screen"
    position="0 1.5 4" 
    rotation="0 0 0" 
    scale="3.2 1.8 1" 
    volume="40"
    billboard="false"
    lock-position="true"
    hand-controls="true">
</script>
```

### Self-Hosting (Optional)
If you wish to host the player files yourself:
1. Download `player.js`, `playlist.html`, `youtube_player.html`, and the `assets/` folder.
2. Edit `player.js` and change `const HOST_URL = "banter-yt-player.firer.at";` to your domain.
3. Upload the files to your domain.

## Attributes Reference

You can customize the player by adding the following attributes to the `<script>` tag:

| Attribute | Default Value | Description |
| :--- | :--- | :--- |
| `instance` | `default-room` | A unique ID for the player. Required if you place multiple players in the same space to keep their states separate. |
| `mode` | `playlist` | Set to `karaoke` to auto-remove videos after playing. |
| `volume` | `40` | Default startup volume (0-100). |
| `position` | `0 1.5 4` | Initial position of the screen in the space. |
| `rotation` | `0 0 0` | Initial rotation of the screen. |
| `scale` | `3.2 1.8 1` | Scale of the screen. |
| `billboard` | `false` | If `"true"`, the screen will always face the user. |
| `lock-position` | `true` | If `"false"`, the player screen can be grabbed and moved by users. |
| `hand-controls` | `true` | If `"true"`, play/pause and volume controls attach to the user's left hand. |
| `in-space-playlist`| `true` | Spawns a dedicated browser in the world for searching/adding videos. |
| `playlist-position`| `2 1.5 4` | Position of the in-space playlist browser. |
| `playlist-rotation`| `0 -30 0` | Rotation of the in-space playlist browser. |
| `playlist-scale` | `2 2 1` | Scale of the in-space playlist browser. |
| `button-position` | `0 0 0` | Offset position for the buttons below the screen. |
| `button-rotation` | `0 0 0` | Offset rotation for the buttons below the screen. |
| `button-scale` | `1 1 1` | Scale multiplier for the buttons below the screen. |

**(Note: You can also override icon URLs by using `data-[icon-name]-icon-url` attributes, such as `data-playlist-icon-url`.)**
