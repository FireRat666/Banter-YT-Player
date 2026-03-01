(function () {
    if (typeof window.nativePlayerInitialized !== 'undefined') return;
    window.nativePlayerInitialized = true;

    // --- Configuration Parser (No BS dependency) ---
    const currentScript = document.currentScript || (function () {
        const scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
    })();

    function getAttr(name, def) {
        return currentScript ? (currentScript.getAttribute(name) || def) : def;
    }

    // Constants that don't depend on BS
    const HOST_URL = "tube.webslop.ai";
    const ICONS = {
        playlist: getAttr("data-playlist-icon-url", `https://${HOST_URL}/assets/Playlist.png`),
        volUp: getAttr("data-vol-up-icon-url", `https://${HOST_URL}/assets/VolUp.png`),
        volDown: getAttr("data-vol-down-icon-url", `https://${HOST_URL}/assets/VolDown.png`),
        mute: getAttr("data-mute-icon-url", `https://${HOST_URL}/assets/Mute.png`),
        skipFwd: getAttr("data-skip-forward-icon-url", `https://${HOST_URL}/assets/Forward.png`),
        skipBack: getAttr("data-skip-backward-icon-url", `https://${HOST_URL}/assets/Backwards.png`)
    };

    // --- Init Game ---
    function initGame() {
        if (window.nativePlayerGameInitialized) return;
        window.nativePlayerGameInitialized = true;

        console.log("[NativeYT] Initializing Serverless Player from Attributes...");
        const BS = window.BS;
        const scene = BS.BanterScene.GetInstance();

        function parseVector3(str, def) {
            if (!str) return def;
            const parts = str.split(' ').map(Number);
            if (parts.length === 3 && !parts.some(isNaN)) {
                return new BS.Vector3(parts[0], parts[1], parts[2]);
            }
            return def;
        }

        const DEFAULT_PLAYLIST = [
            { title: "Creative Commons Demo", id: "8MLbOulrLA0", user: "System" },
            { title: "Blender Open Movie", id: "YE7VzlLtp-4", user: "System" }
        ];

        const CONFIG = {
            instanceId: getAttr("instance", "default-room"),
            mode: getAttr("mode", "playlist"),
            volume: parseFloat(getAttr("volume", "40")),
            screenPos: parseVector3(getAttr("position", "0 1.5 4"), new BS.Vector3(0, 1.5, 4)),
            screenRot: parseVector3(getAttr("rotation", "0 0 0"), new BS.Vector3(0, 0, 0)),
            screenScale: parseVector3(getAttr("scale", "3.2 1.8 1"), new BS.Vector3(3.2, 1.8, 1)),
            buttonPos: parseVector3(getAttr("button-position", "0 0 0"), new BS.Vector3(0, 0, 0)),
            buttonRot: parseVector3(getAttr("button-rotation", "0 0 0"), new BS.Vector3(0, 0, 0)),
            buttonScale: parseVector3(getAttr("button-scale", "1 1 1"), new BS.Vector3(1, 1, 1)),
            handControls: getAttr("hand-controls", "true") === "true",
            inSpacePlaylist: getAttr("in-space-playlist", "true") === "true",
            playlistPos: parseVector3(getAttr("playlist-position", "2 1.5 4"), new BS.Vector3(2, 1.5, 4)),
            playlistRot: parseVector3(getAttr("playlist-rotation", "0 -30 0"), new BS.Vector3(0, -30, 0)),
            playlistScale: parseVector3(getAttr("playlist-scale", "2 2 1"), new BS.Vector3(2, 2, 1)),
            syncInterval: 2000
        };

        // --- State ---
        const STATE_KEY = `yt_${CONFIG.instanceId}_state`;
        let screenObj, videoPlayer, buttonsContainer;
        let inSpacePlaylistBrowserGo, inSpacePlaylistBrowserComponent;

        let localState = {
            playlist: [...DEFAULT_PLAYLIST],
            index: 0,
            playing: false,
            startTime: 0,
            pausedAt: 0,
            locked: false,
            hostId: "",
            mode: CONFIG.mode,
            volume: CONFIG.volume,
            muted: false
        };

        // --- Init ---
        async function init() {
            console.log(`[NativeYT] Starting Instance: ${CONFIG.instanceId} (${CONFIG.mode})`);

            screenObj = await new BS.GameObject(`NativeScreen_${CONFIG.instanceId}`).Async();
            const sTrans = await screenObj.AddComponent(new BS.Transform());
            sTrans.position = CONFIG.screenPos;
            sTrans.localEulerAngles = CONFIG.screenRot;
            sTrans.localScale = CONFIG.screenScale;

            // YouTube player via BanterBrowser with custom wrapper HTML
            const playerUrl = `https://${HOST_URL}/youtube_player.html`;
            videoPlayer = await screenObj.AddComponent(new BS.BanterBrowser(playerUrl, 1, 1280, 720));
            videoPlayer.ToggleInteraction(true);

            // Buttons
            await createButtons();

            // Hand Controls
            if (CONFIG.handControls) {
                await createHandControls();
            }

            // Optional In-Space Playlist Browser
            if (CONFIG.inSpacePlaylist) {
                await createInSpacePlaylistBrowser();
            }

            // Listen for messages from the YouTube player wrapper
            screenObj.On("browser-message", handlePlayerMessage);
            console.log("[NativeYT] Listening for 'browser-message' on screenObj");

            // Listen for messages from the Menu Browser
            scene.On("menu-browser-message", (e) => {
                console.log("[NativeYT] Raw menu-browser-message received:", e.detail);
                handleUiMessage(e);
            });
            console.log("[NativeYT] Listening for 'menu-browser-message' on scene");

            scene.On("space-state-changed", onStateChange);

            // Give player time to load, then send initial state
            setTimeout(() => checkState(), 2000);

            // Start Time Sync Loop
            setInterval(checkTimeSync, 1000);
        }

        async function createInSpacePlaylistBrowser() {
            console.log("[NativeYT] Creating in-space playlist browser.");
            inSpacePlaylistBrowserGo = await new BS.GameObject(`InSpacePlaylist_${CONFIG.instanceId}`).Async();
            const pTrans = await inSpacePlaylistBrowserGo.AddComponent(new BS.Transform());
            pTrans.position = CONFIG.playlistPos;
            pTrans.localEulerAngles = CONFIG.playlistRot;
            pTrans.localScale = CONFIG.playlistScale;

            const playlistUrl = `https://${HOST_URL}/playlist.html?instance=${CONFIG.instanceId}&mode=${CONFIG.mode}&user=${scene.localUser.uid}-_-${encodeURIComponent(scene.localUser.name)}`;
            inSpacePlaylistBrowserComponent = await inSpacePlaylistBrowserGo.AddComponent(new BS.BanterBrowser(playlistUrl, 1, 1024, 1024));
            inSpacePlaylistBrowserComponent.ToggleInteraction(true);

            // Listen for messages specifically from this browser
            inSpacePlaylistBrowserGo.On("browser-message", (e) => {
                console.log("[NativeYT] Received message from in-space playlist:", e.detail);
                handleUiMessage(e);
            });
        }

        async function createButtons() {
            buttonsContainer = await new BS.GameObject(`Buttons_${CONFIG.instanceId}`).Async();
            const t = await buttonsContainer.AddComponent(new BS.Transform());

            const yOffset = CONFIG.screenScale.y * 0.335;
            const basePos = new BS.Vector3(
                CONFIG.screenPos.x,
                CONFIG.screenPos.y - yOffset,
                CONFIG.screenPos.z
            );

            t.position = new BS.Vector3(basePos.x + CONFIG.buttonPos.x, basePos.y + CONFIG.buttonPos.y, basePos.z + CONFIG.buttonPos.z);
            t.localEulerAngles = CONFIG.buttonRot;
            t.localScale = CONFIG.buttonScale;

            await spawnButton(buttonsContainer, "Playlist", -0.633, 0, 0, ICONS.playlist, () => toggleUi());
            await spawnButton(buttonsContainer, "Prev", -0.332, 0, 0, ICONS.skipBack, () => handleAction("PREV"));
            await spawnButton(buttonsContainer, "Next", -0.081, 0, 0, ICONS.skipFwd, () => handleAction("NEXT"));
            await spawnButton(buttonsContainer, "Mute", 0.23, 0, 0, ICONS.mute, () => handleAction("MUTE"));
            await spawnButton(buttonsContainer, "VolDown", 0.471, 0, 0, ICONS.volDown, () => handleAction("VOL_DOWN"));
            await spawnButton(buttonsContainer, "VolUp", 0.693, 0, 0, ICONS.volUp, () => handleAction("VOL_UP"));
        }

        async function createHandControls() {
            const handObj = await new BS.GameObject("HandControls").Async();

            setTimeout(async () => {
                const attachPos = (BS.LegacyAttachmentPosition && BS.LegacyAttachmentPosition.LEFT_HAND) ? BS.LegacyAttachmentPosition.LEFT_HAND : 1;
                if (scene.LegacyAttachObject) {
                    await scene.LegacyAttachObject(handObj, scene.localUser.uid, attachPos);
                }
            }, 1000);

            const wrapper = await new BS.GameObject("HandWrapper").Async();
            await wrapper.SetParent(handObj, false);
            const t = await wrapper.AddComponent(new BS.Transform());
            t.localPosition = new BS.Vector3(0, 0.046, 0.030);
            t.localScale = new BS.Vector3(0.1, 0.1, 0.1);
            t.rotation = new BS.Vector4(0.25, 0, 0.8, 1);

            const r = new BS.Vector3(180, 0, 0);

            await spawnButton(wrapper, "HMute", -0.4, 0.4, 0.3, ICONS.mute, () => handleAction("MUTE"), r, 1);
            await spawnButton(wrapper, "HVolD", 0.0, 0.4, 0.3, ICONS.volDown, () => handleAction("VOL_DOWN"), r, 1);
            await spawnButton(wrapper, "HVolU", 0.4, 0.4, 0.3, ICONS.volUp, () => handleAction("VOL_UP"), r, 1);

            await spawnButton(wrapper, "HPlay", 0.4, -0.1, 0.3, ICONS.playlist, () => toggleUi(), r, 1);
            await spawnButton(wrapper, "HPrev", -0.5, -0.1, 0.3, ICONS.skipBack, () => handleAction("PREV"), r, 1);
            await spawnButton(wrapper, "HNxt", 0.0, -0.1, 0.3, ICONS.skipFwd, () => handleAction("NEXT"), r, 1);
        }

        async function spawnButton(parent, name, x, y, z, iconUrl, callback, rot = null, scale = 0.2) {
            const btn = await new BS.GameObject(`Btn_${name}`).Async();
            await btn.SetParent(parent, false);
            const trans = await btn.AddComponent(new BS.Transform());
            trans.localPosition = new BS.Vector3(x, y, z);
            if (rot) trans.localEulerAngles = rot;
            if (scale !== 0.2) trans.localScale = new BS.Vector3(1, 1, 1);

            await btn.SetLayer(5); // UI Layer

            const planeSize = (scale === 1) ? 0.1 : scale;
            await btn.AddComponent(new BS.BanterPlane(planeSize, planeSize));
            await btn.AddComponent(new BS.BanterMaterial("Unlit/Transparent", iconUrl, new BS.Vector4(1, 1, 1, 1)));

            await btn.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0, 0), new BS.Vector3(planeSize, planeSize, 0.05)));

            btn.On("click", callback);
        }

        function toggleUi() {
            const playlistUrl = `https://${HOST_URL}/playlist.html?instance=${CONFIG.instanceId}&mode=${CONFIG.mode}&user=${scene.localUser.uid}-_-${encodeURIComponent(scene.localUser.name)}`;
            if (window.openPage) {
                window.openPage(playlistUrl);
                // Also send state immediately in case it's already open
                checkState();
            } else {
                console.warn("[NativeYT] window.openPage not available");
            }
        }

        function handleAction(type, data) {
            const localActions = ["VOL_UP", "VOL_DOWN", "MUTE"];
            if (localActions.includes(type)) {
                if (type === "VOL_UP") localState.volume = Math.min(100, localState.volume + 10);
                if (type === "VOL_DOWN") localState.volume = Math.max(0, localState.volume - 10);
                if (type === "MUTE") localState.muted = !localState.muted;
                updateVolume();
            } else {
                handleUiMessage({ detail: JSON.stringify({ type, data }) });
            }
        }

        async function sendToUi(msg) {
            const str = JSON.stringify(msg);

            // Send to menu browser
            scene.SendBrowserMessage(str);

            // Send to in-space playlist browser if it exists
            if (inSpacePlaylistBrowserComponent) {
                try {
                    inSpacePlaylistBrowserComponent.RunActions(JSON.stringify({
                        actions: [{ actionType: 'postmessage', strParam1: str }]
                    }));
                } catch (err) {
                    console.error("[NativeYT] Error sending message to in-space playlist:", err);
                }
            }
        }

        async function handleUiMessage(e) {
            let msgString;
            try {
                if (typeof e.detail === 'string') {
                    msgString = e.detail;
                } else if (e.detail && typeof e.detail.message === 'string') {
                    msgString = e.detail.message;
                } else {
                    console.warn("[NativeYT] UI message received, but payload is in an unrecognized format:", e.detail);
                    return;
                }

                const msg = JSON.parse(msgString);

                if (msg.type === 'LOG') {
                    console.log(msg.data);
                    return;
                }

                if (["VOL_UP", "VOL_DOWN", "MUTE"].includes(msg.type)) {
                    if (msg.type === "VOL_UP") localState.volume = Math.min(100, localState.volume + 10);
                    if (msg.type === "VOL_DOWN") localState.volume = Math.max(0, localState.volume - 10);
                    if (msg.type === "MUTE") localState.muted = !localState.muted;
                    updateVolume();
                    return;
                }

                const current = getCombinedState();
                const myId = scene.localUser.uid;

                if (msg.type === "REQUEST_STATE") {
                    sendToUi({ type: "STATE", data: current });
                    return;
                }

                if (msg.type === "LOCK") {
                    const newLocked = !current.locked;
                    updateState({ locked: newLocked, hostId: newLocked ? myId : "" });
                    return;
                }

                if (msg.type === "RESYNC") {
                    if (current.playing) {
                        const elapsed = (Date.now() - current.startTime) / 1000;
                        sendPlayerCommand('SEEK', elapsed);
                    } else {
                        sendPlayerCommand('SEEK', current.pausedAt || 0);
                    }
                    return;
                }

                const actions = {
                    "PLAY_PAUSE": () => {
                        const newPlaying = !current.playing;
                        let updates = { playing: newPlaying };
                        if (newPlaying) {
                            // Resume: calculate new startTime based on pausedAt
                            const offset = (current.pausedAt || 0) * 1000;
                            updates.startTime = Date.now() - offset;
                        } else {
                            // Pause: save current elapsed time
                            const elapsed = (Date.now() - current.startTime) / 1000;
                            updates.pausedAt = elapsed;
                        }
                        updateState(updates);
                    },
                    "NEXT": () => handleNext(current),
                    "PREV": () => { if (current.mode !== 'karaoke') updateTrack(-1); },
                    "SET_TRACK": () => changeIndex(msg.data),
                    "REMOVE": () => {
                        const list = [...current.playlist];
                        list.splice(msg.data, 1);
                        let idx = current.index;
                        if (idx >= list.length) idx = list.length - 1;
                        if (current.mode === 'karaoke' && msg.data === 0) {
                            idx = 0;
                            updateState({ playlist: list, index: 0, startTime: Date.now(), pausedAt: 0, playing: true });
                        } else {
                            updateState({ playlist: list, index: idx, startTime: Date.now(), pausedAt: 0 });
                        }
                    },
                    "MOVE": () => {
                        const { from, to } = msg.data;
                        const list = [...current.playlist];
                        if (from >= 0 && from < list.length && to >= 0 && to < list.length) {
                            const [item] = list.splice(from, 1);
                            list.splice(to, 0, item);

                            // Adjust current index if needed
                            let newIdx = current.index;
                            if (current.index === from) newIdx = to;
                            else if (current.index > from && current.index <= to) newIdx--;
                            else if (current.index < from && current.index >= to) newIdx++;

                            updateState({ playlist: list, index: newIdx });
                        }
                    },
                    "ADD": async () => await resolveAndAdd(msg.data),
                    "SEEK_BY": () => {
                        const delta = msg.data; // seconds
                        let updates = {};
                        if (current.playing) {
                            const currentElapsed = (Date.now() - current.startTime) / 1000;
                            const newElapsed = Math.max(0, currentElapsed + delta);
                            updates.startTime = Date.now() - (newElapsed * 1000);
                        } else {
                            const currentElapsed = current.pausedAt || 0;
                            updates.pausedAt = Math.max(0, currentElapsed + delta);
                        }
                        updateState(updates);
                    },
                    "SEEK_TO": () => {
                        const target = msg.data; // seconds
                        let updates = {};
                        if (current.playing) {
                            updates.startTime = Date.now() - (target * 1000);
                        } else {
                            updates.pausedAt = target;
                        }
                        updateState(updates);
                    }
                };

                if (actions[msg.type]) {
                    if (current.locked && current.hostId !== myId) return;
                    await actions[msg.type]();
                }
            } catch (err) {
                console.error("[NativeYT] Error processing UI message:", err, "Raw message:", msgString);
            }
        }

        function updateVolume() {
            if (!videoPlayer) return;
            const vol = localState.muted ? 0 : localState.volume;
            sendPlayerCommand(localState.muted ? 'MUTE' : 'UNMUTE');
            sendPlayerCommand('SET_VOLUME', vol);
        }

        function sendPlayerCommand(type, data) {
            if (!videoPlayer) return;
            const msg = JSON.stringify({ type, data });
            videoPlayer.RunActions(JSON.stringify({
                actions: [{ actionType: 'postmessage', strParam1: msg }]
            }));
        }

        function handlePlayerMessage(e) {
            try {
                let msgString = e.detail;
                if (typeof e.detail !== 'string' && e.detail.message) msgString = e.detail.message;
                if (typeof msgString !== 'string') return;

                const msg = JSON.parse(msgString);

                if (msg.type === 'LOG') {
                    console.log(msg.data);
                    return;
                }

                if (msg.type === 'VIDEO_INFO') {
                    // Update state with duration and title
                    const current = getCombinedState();
                    const list = [...current.playlist];
                    if (list[current.index]) {
                        let changed = false;
                        if (msg.data.duration && list[current.index].duration !== msg.data.duration) {
                            list[current.index].duration = msg.data.duration;
                            changed = true;
                        }
                        if (msg.data.title && list[current.index].title !== msg.data.title) {
                            list[current.index].title = msg.data.title;
                            changed = true;
                        }
                        if (changed) updateState({ playlist: list });
                    }
                } else if (msg.type === 'VIDEO_ENDED') {
                    const current = getCombinedState();
                    // Only the host should trigger next if locked
                    if (current.locked && current.hostId !== scene.localUser.uid) return;
                    handleAction('NEXT');
                } else if (msg.type === 'PLAYER_STATUS') {
                    console.log('[NativeYT] Player status:', msg.data.status);
                }
            } catch (err) {
                console.error('[NativeYT] Player message error:', err, 'Raw Message:', e.detail.message);
            }
        }

        function checkTimeSync() {
            const current = getCombinedState();
            if (!current.playing || !current.playlist.length) return;

            const vid = current.playlist[current.index];
            if (!vid || !vid.duration) return;

            const elapsed = (Date.now() - current.startTime) / 1000;
            // If we are 5 seconds past the duration, force next
            if (elapsed > vid.duration + 5) {
                // Only host or someone responsible
                if (current.locked) {
                    if (current.hostId === scene.localUser.uid) handleAction('NEXT');
                } else {
                    // If unlocked, we rely on the first client to trigger it.
                    handleAction('NEXT');
                }
            }
        }

        function handleNext(current) {
            if (current.mode === 'karaoke') {
                const list = [...current.playlist];
                if (list.length > 0) {
                    list.shift();
                    updateState({ playlist: list, index: 0, startTime: Date.now(), pausedAt: 0, playing: true });
                }
            } else {
                updateTrack(1);
            }
        }

        async function resolveAndAdd(input) {
            let id = input;
            try {
                const urlObj = new URL(input);
                if (urlObj.hostname.includes("youtube.com")) id = urlObj.searchParams.get("v");
                else if (urlObj.hostname.includes("youtu.be")) id = urlObj.pathname.slice(1);
            } catch (e) { }
            if (!id) return;

            const title = "Video " + id;
            const current = getCombinedState();
            const list = [...current.playlist, { title: title, id: id, user: scene.localUser.name }];
            updateState({ playlist: list });
        }

        function updateTrack(delta) {
            const current = getCombinedState();
            let newIdx = current.index + delta;
            if (newIdx >= current.playlist.length) newIdx = 0;
            if (newIdx < 0) newIdx = current.playlist.length - 1;
            changeIndex(newIdx);
        }

        function changeIndex(idx) {
            updateState({ index: idx, startTime: Date.now(), pausedAt: 0, playing: true });
        }

        function getCombinedState() {
            const props = scene.spaceState?.public || {};
            let synced = {};
            if (props[STATE_KEY]) {
                try { synced = JSON.parse(props[STATE_KEY]); } catch (e) { }
            }
            return { ...localState, ...synced, volume: localState.volume, muted: localState.muted };
        }

        function updateState(updates) {
            const current = getCombinedState();
            const { volume, muted, ...syncSafe } = { ...current, ...updates };

            let updateMap = {};
            updateMap[STATE_KEY] = JSON.stringify(syncSafe);
            scene.SetPublicSpaceProps(updateMap);
        }

        async function onStateChange() { checkState(); }

        let loadedVideoId = "";
        let lastStartTime = 0;
        let lastPausedAt = 0;

        async function checkState() {
            const state = getCombinedState();

            // Send state to all connected UIs (Menu + Space Browsers)
            sendToUi({ type: "STATE", data: state });

            if (!state.playlist || state.playlist.length === 0) return;
            const vid = state.playlist[state.index] || state.playlist[0];

            // Calculate start time based on state
            let startAt = 0;
            if (state.playing) {
                startAt = (Date.now() - state.startTime) / 1000;
                if (startAt < 0) startAt = 0;
            } else {
                startAt = state.pausedAt || 0;
            }

            if (vid.id !== loadedVideoId) {
                loadedVideoId = vid.id;
                console.log("[NativeYT] Loading:", vid.title, "(", vid.id, ")");
                sendPlayerCommand('LOAD_VIDEO', { id: vid.id, startTime: startAt });
                setTimeout(updateVolume, 1000);
            } else {
                // Check if we need to seek due to a state change (e.g. SEEK_TO or SEEK_BY)
                // We compare the state's time basis to our last known values
                if (state.startTime !== lastStartTime || state.pausedAt !== lastPausedAt) {
                    console.log("[NativeYT] Time basis changed, seeking to:", startAt);
                    sendPlayerCommand('SEEK', startAt);
                }
            }

            // Update our tracking variables
            lastStartTime = state.startTime;
            lastPausedAt = state.pausedAt;

            if (state.playing) {
                sendPlayerCommand('PLAY');
            } else {
                sendPlayerCommand('PAUSE');
            }
        }

        init().catch(e => console.error(e));
    }

    if (window.BS) {
        initGame();
    } else {
        window.addEventListener("unity-loaded", initGame);
        window.addEventListener("bs-loaded", initGame);
    }
})();