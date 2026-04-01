// Wait for the BS code to initialise. BS wont be available before this callback.
window.addEventListener("bs-loaded", ()=> {
    // Get the scene singleton
    const ytscene = BS.BanterScene.GetInstance();
    
    // Wait for the scene to be ready
    ytscene.On("unity-loaded", () => {

    if (typeof window.nativePlayerInitialized !== 'undefined') return;
    window.nativePlayerInitialized = true;

    // --- Configuration ---
    const HOST_URL = "banter-yt-player.firer.at";

    function getAttr(scriptNode, name, def) {
        return scriptNode ? (scriptNode.getAttribute(name) || def) : def;
    }

    function initYouTubePlayer() {
        if (window.nativePlayerGamesInitialized) return;
        window.nativePlayerGamesInitialized = true;

        const scriptUrl = `https://${HOST_URL}/player.js`;
        const allScripts = document.querySelectorAll(`script[src^='${scriptUrl}']`);
        console.log(`[NativeYT] Found ${allScripts.length} native player scripts.`);

        for (const scriptNode of allScripts) {
            if (scriptNode.dataset.processed) continue;
            scriptNode.dataset.processed = "true";
            initGame(scriptNode);
        }
    }

    function initGame(currentScript) {
        console.log("[NativeYT] initGame() Called.");

        const BS = window.BS;
        const scene = BS.BanterScene.GetInstance();

        const ICONS = {
            playlist: getAttr(currentScript, "data-playlist-icon-url", `https://${HOST_URL}/assets/Playlist.png`),
            volUp: getAttr(currentScript, "data-vol-up-icon-url", `https://${HOST_URL}/assets/VolUp.png`),
            volDown: getAttr(currentScript, "data-vol-down-icon-url", `https://${HOST_URL}/assets/VolDown.png`),
            mute: getAttr(currentScript, "data-mute-icon-url", `https://${HOST_URL}/assets/Mute.png`),
            skipFwd: getAttr(currentScript, "data-skip-forward-icon-url", `https://${HOST_URL}/assets/Forward.png`),
            skipBack: getAttr(currentScript, "data-skip-backward-icon-url", `https://${HOST_URL}/assets/Backwards.png`)
        };

        function parseVector3(str, def) {
            if (!str) return def;
            const parts = str.split(' ').map(Number);
            if (parts.length === 3 && !parts.some(isNaN)) {
                return new BS.Vector3(parts[0], parts[1], parts[2]);
            }
            return def;
        }

        const DEFAULT_PLAYLIST = [
            { title: "Spring - Blender Open Movie", id: "WhWc3b3KhnY", user: "System" },
            { title: "HERO – Blender Grease Pencil Showcase", id: "pKmSdY56VtY", user: "System" },
            { title: "The Daily Dweebs - 8K UHD Stereoscopic 3D", id: "apiu3pTIwuY", user: "System" },
            { title: "Agent 327: Operation Barbershop", id: "mN0zPOpADL4", user: "System" },
            { title: "CHARGE - Blender Open Movie", id: "UXqq0ZvbOnk", user: "System" },
            { title: "Elephants Dream", id: "TLkA0RELQ1g", user: "System" },
            { title: "Big Buck Bunny", id: "YE7VzlLtp-4", user: "System" },
            { title: "Sintel - Open Movie by Blender Foundation", id: "eRsGyueVLvQ", user: "System" },
            { title: "Tears of Steel - Blender VFX Open Movie", id: "R6MlUcmOul8", user: "System" },
            { title: "'Caminandes 2: Gran Dillama' - Blender Animated Short", id: "Z4C82eyhwgU", user: "System" },
            { title: "Cosmos Laundromat - First Cycle. Official Blender Foundation release.", id: "Y-rmzh0PI3c", user: "System" },
            { title: "Glass Half - Blender animated cartoon", id: "lqiN98z6Dak", user: "System" },
            { title: "Caminandes 3: Llamigos", id: "SkVqJ1SGeL0", user: "System" },
            { title: "Coffee Run - Blender Open Movie", id: "PVGeM40dABA", user: "System" },
            { title: "WING IT! - Blender Open Movie", id: "u9lj-c29dxI", user: "System" },
            { title: "Sprite Fright - Blender Open Movie", id: "_cMxraX_5RE", user: "System" }
        ];

        const CONFIG = {
            instanceId: getAttr(currentScript, "instance", "default-room"),
            mode: getAttr(currentScript, "mode", "playlist"),
            volume: parseFloat(getAttr(currentScript, "volume", "40")),
            screenPos: parseVector3(getAttr(currentScript, "position", "0 1.5 4"), new BS.Vector3(0, 1.5, 4)),
            screenRot: parseVector3(getAttr(currentScript, "rotation", "0 0 0"), new BS.Vector3(0, 0, 0)),
            screenScale: parseVector3(getAttr(currentScript, "scale", "3.2 1.8 1"), new BS.Vector3(3.2, 1.8, 1)),
            buttonPos: parseVector3(getAttr(currentScript, "button-position", "0 0 0"), new BS.Vector3(0, 0, 0)),
            buttonRot: parseVector3(getAttr(currentScript, "button-rotation", "0 0 0"), new BS.Vector3(0, 0, 0)),
            buttonScale: parseVector3(getAttr(currentScript, "button-scale", "1 1 1"), new BS.Vector3(1, 1, 1)),
            handControls: getAttr(currentScript, "hand-controls", "true") === "true",
            inSpacePlaylist: getAttr(currentScript, "in-space-playlist", "true") === "true",
            playlistPos: parseVector3(getAttr(currentScript, "playlist-position", "2 1.5 4"), new BS.Vector3(2, 1.5, 4)),
            playlistRot: parseVector3(getAttr(currentScript, "playlist-rotation", "0 -30 0"), new BS.Vector3(0, -30, 0)),
            playlistScale: parseVector3(getAttr(currentScript, "playlist-scale", "2 2 1"), new BS.Vector3(2, 2, 1)),
            billboard: getAttr(currentScript, "billboard", "false") === "true",
            mipmaps: getAttr(currentScript, "mipmaps", "1"),
            pixelsperunit: getAttr(currentScript, "pixelsperunit", "1200"),
            width: getAttr(currentScript, "width", "1280"),
            height: getAttr(currentScript, "height", "720"),
            lockPosition: getAttr(currentScript, "lock-position", "true") === "true",
            syncInterval: 2000
        };

        const STATE_KEY = `yt_${CONFIG.instanceId}_state`;
        let screenObj, videoPlayer, buttonsContainer;
        let inSpacePlaylistBrowserGo, inSpacePlaylistBrowserComponent;

        let localVolume = CONFIG.volume;
        let localMuted = false;
        let localPlayerPlaying = true;

        const processedMessages = new Set();
        setInterval(() => {
            const now = Date.now();
            for (const id of processedMessages) {
                const parts = id.split('_');
                if (parts.length > 1) {
                    const timestamp = parseInt(parts[1]);
                    if (now - timestamp > 30000) processedMessages.delete(id);
                }
            }
        }, 30000);

        async function init() {
            console.log(`[NativeYT] init() Instance: ${CONFIG.instanceId}`);

            // Register global listeners EARLY
            scene.On("menu-browser-message", (e) => processUiMessage(e.detail, "menu-browser"));
            scene.On("one-shot", handleOneShot);
            scene.On("space-state-changed", onStateChange);

            screenObj = await new BS.GameObject(`NativeScreen_${CONFIG.instanceId}`).Async();
            const sTrans = await screenObj.AddComponent(new BS.Transform());
            sTrans.position = CONFIG.screenPos;
            sTrans.localEulerAngles = CONFIG.screenRot;
            sTrans.localScale = CONFIG.screenScale;

            await screenObj.SetLayer(5);

            if (CONFIG.billboard) {
                await screenObj.AddComponent(new BS.BanterBillboard(0, true, true, true));
            }

            await screenObj.AddComponent(new BS.BoxCollider(false, new BS.Vector3(0, 0, 0), new BS.Vector3(1, 0.6, 0.05)));
            const screenRb = await screenObj.AddComponent(new BS.BanterRigidbody(1, 10, 10, CONFIG.lockPosition, false, new BS.Vector3(0,0,0), 0, false, false, false, false, false, false, new BS.Vector3(0,0,0), new BS.Vector3(0,0,0)));

            const playerUrl = `https://${HOST_URL}/youtube_player.html`;

            videoPlayer = await screenObj.AddComponent(new BS.BanterBrowser(playerUrl, CONFIG.mipmaps, CONFIG.pixelsperunit, CONFIG.width, CONFIG.height, null));
            videoPlayer.ToggleInteraction(true);

            screenObj.On("browser-message", handlePlayerMessage);

            screenObj.On('grab', () => { if (!CONFIG.lockPosition && screenRb) screenRb.isKinematic = false; });
            screenObj.On('drop', () => { if (screenRb) screenRb.isKinematic = true; });

            await createButtons();
            if (CONFIG.handControls) await createHandControls();

            // Optional In-Space Playlist Browser
            if (CONFIG.inSpacePlaylist) {
                await createInSpacePlaylistBrowser();
            }

            setTimeout(() => checkState(), 3000);
            setInterval(checkTimeSync, 1000);
        }

        async function createInSpacePlaylistBrowser() {
            console.log(`[NativeYT] Creating in-space browser: ${CONFIG.instanceId}`);
            try {
                inSpacePlaylistBrowserGo = await new BS.GameObject(`InSpacePlaylist_${CONFIG.instanceId}`).Async();
                const pTrans = await inSpacePlaylistBrowserGo.AddComponent(new BS.Transform());
                pTrans.position = CONFIG.playlistPos;
                pTrans.localEulerAngles = CONFIG.playlistRot;
                pTrans.localScale = CONFIG.playlistScale;

                const playlistUrl = `https://${HOST_URL}/playlist.html?instance=${CONFIG.instanceId}&mode=${CONFIG.mode}&user=${scene.localUser.uid}-_-${encodeURIComponent(scene.localUser.name)}`;

                inSpacePlaylistBrowserComponent = await inSpacePlaylistBrowserGo.AddComponent(new BS.BanterBrowser(playlistUrl, 1, 1200, 1280, 720));
                inSpacePlaylistBrowserComponent.ToggleInteraction(true);
                await inSpacePlaylistBrowserGo.SetLayer(5);

                inSpacePlaylistBrowserGo.On("browser-message", (e) => processUiMessage(e.detail, "in-space-browser"));
            } catch (err) {
                console.error("[NativeYT] Error creating in-space browser:", err);
                console.error(err);
            }
        }

        async function createButtons() {
            buttonsContainer = await new BS.GameObject(`Buttons_${CONFIG.instanceId}`).Async();
            const t = await buttonsContainer.AddComponent(new BS.Transform());
            const yOffset = CONFIG.screenScale.y * 0.335;
            const basePos = new BS.Vector3(CONFIG.screenPos.x, CONFIG.screenPos.y - yOffset, CONFIG.screenPos.z);
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
                if (scene.LegacyAttachObject) await scene.LegacyAttachObject(handObj, scene.localUser.uid, attachPos);
            }, 1000);

            const wrapper = await new BS.GameObject("HandWrapper").Async();
            await wrapper.SetParent(handObj, false);
            const t = await wrapper.AddComponent(new BS.Transform());
            t.localPosition = new BS.Vector3(0, 0.046, 0.030);
            t.localScale = new BS.Vector3(0.1, 0.1, 0.1);
            t.rotation = new BS.Vector4(0.25, 0, 0.8, 1);

            const r = new BS.Vector3(180, 0, 0);
            await spawnButton(wrapper, "HMute", -0.4, 0.4, 0.3, ICONS.mute, () => handleAction("MUTE"), r, 0.4);
            await spawnButton(wrapper, "HVolD", 0.0, 0.4, 0.3, ICONS.volDown, () => handleAction("VOL_DOWN"), r, 0.4);
            await spawnButton(wrapper, "HVolU", 0.4, 0.4, 0.3, ICONS.volUp, () => handleAction("VOL_UP"), r, 0.4);
            await spawnButton(wrapper, "HPlay", 0.4, -0.1, 0.3, ICONS.playlist, () => toggleUi(), r, 0.4);
            await spawnButton(wrapper, "HPrev", -0.5, -0.1, 0.3, ICONS.skipBack, () => handleAction("PREV"), r, 0.4);
            await spawnButton(wrapper, "HNxt", 0.0, -0.1, 0.3, ICONS.skipFwd, () => handleAction("NEXT"), r, 0.4);
        }

        async function spawnButton(parent, name, x, y, z, iconUrl, callback, rot = null, scale = 0.2) {
            const btn = await new BS.GameObject(`Btn_${name}`).Async();
            await btn.SetParent(parent, false);
            const trans = await btn.AddComponent(new BS.Transform());
            trans.localPosition = new BS.Vector3(x, y, z);
            if (rot) trans.localEulerAngles = rot;
            await btn.SetLayer(5);
            const planeSize = (scale === 1) ? 0.1 : scale;
            await btn.AddComponent(new BS.BanterPlane(planeSize, planeSize));
            await btn.AddComponent(new BS.BanterMaterial("Unlit/Transparent", iconUrl, new BS.Vector4(1, 1, 1, 1)));
            await btn.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0, 0), new BS.Vector3(planeSize, planeSize, 0.05)));
            btn.On("click", callback);
        }

        let lastButtonPress = 0;
        function toggleUi() {
            if (Date.now() - lastButtonPress < 1000) return;
            lastButtonPress = Date.now();
            const playlistUrl = `https://${HOST_URL}/playlist.html?instance=${CONFIG.instanceId}&mode=${CONFIG.mode}&user=${scene.localUser.uid}-_-${encodeURIComponent(scene.localUser.name)}`;
            if (window.openPage) {
                window.openPage(playlistUrl);
                checkState();
            }
        }

        function handleAction(type, data) {
            if (Date.now() - lastButtonPress < 500) return;
            lastButtonPress = Date.now();
            const locals = ["VOL_UP", "VOL_DOWN", "MUTE"];
            if (locals.includes(type)) {
                if (type === "VOL_UP") localVolume = Math.min(100, localVolume + 10);
                if (type === "VOL_DOWN") localVolume = Math.max(0, localVolume - 10);
                if (type === "MUTE") localMuted = !localMuted;
                updateVolume();
                checkState();
            } else {
                processUiMessage(JSON.stringify({ type, data, instanceId: CONFIG.instanceId }), "in-world");
            }
        }

        async function sendToUi(msg) {
            const payload = { ...msg, instanceId: CONFIG.instanceId };
            const str = JSON.stringify(payload);

            // 1. Send to menu browser (native overlay)
            scene.SendBrowserMessage(str);

            // 2. Send to in-space browser
            if (inSpacePlaylistBrowserComponent) {
                try {
                    // Try postmessage action first
                    inSpacePlaylistBrowserComponent.RunActions(JSON.stringify({
                        actions: [{ actionType: 'postmessage', strParam1: str }]
                    }));
                } catch (e) {
                    try {
                        const script = `window.dispatchEvent(new CustomEvent('bantermenumessage', { detail: ${JSON.stringify(str)} }));`;
                        inSpacePlaylistBrowserComponent.RunActions(JSON.stringify({
                            actions: [{ actionType: 'runscript', strparam1: script }]
                        }));
                    } catch (err) {}
                }
            }
        }

        async function processUiMessage(detail, source) {
            let msg;
            try {
                if (typeof detail === 'string') {
                    msg = JSON.parse(detail);
                } else if (detail && typeof detail === 'object') {
                    if (detail.message && typeof detail.message === 'string') msg = JSON.parse(detail.message);
                    else if (detail.type) msg = detail;
                    else return;
                } else return;

                if (msg.type === 'LOG') { console.log(msg.data); return; }

                // Multi-instance filtering
                if (msg.instanceId && msg.instanceId !== CONFIG.instanceId) return;

                if (msg.msgId) {
                    if (processedMessages.has(msg.msgId)) return;
                    processedMessages.add(msg.msgId);
                }

                console.log(`[NativeYT] UI Command: ${msg.type} from ${source}`);
                const current = getSpaceState();
                const myId = scene.localUser.uid;

                if (msg.type === "REQUEST_STATE") {
                    // Slight delay to ensure UI is ready to receive
                    setTimeout(() => {
                        sendToUi({ type: "STATE", data: { ...current, volume: localVolume, muted: localMuted } });
                    }, 500);
                    return;
                }

                if (msg.type === "LOCK") {
                    const newLocked = !current.locked;
                    updateState({ locked: newLocked, hostId: newLocked ? myId : "" });
                    return;
                }

                if (current.locked && current.hostId !== myId) return;

                const doSeekTo = (target) => {
                    let updates = {};
                    if (current.playing) updates.startTime = Date.now() - (target * 1000);
                    else updates.pausedAt = target;
                    scene.OneShot(JSON.stringify({ targetInstance: CONFIG.instanceId, type: 'SEEK', value: target }));
                    sendPlayerCommand('SEEK', target);
                    updateState(updates);
                };

                const actions = {
                    "RESYNC": () => {
                        const elapsed = current.playing ? (Date.now() - current.startTime) / 1000 : (current.pausedAt || 0);
                        sendPlayerCommand('SEEK', elapsed);
                    },
                    "PLAY_PAUSE": () => {
                        const newPlaying = !current.playing;
                        let updates = { playing: newPlaying };
                        if (newPlaying) {
                            updates.startTime = Date.now() - ((current.pausedAt || 0) * 1000);
                            scene.OneShot(JSON.stringify({ targetInstance: CONFIG.instanceId, type: 'PLAY' }));
                            sendPlayerCommand('PLAY');
                        } else {
                            updates.pausedAt = (Date.now() - current.startTime) / 1000;
                            scene.OneShot(JSON.stringify({ targetInstance: CONFIG.instanceId, type: 'PAUSE' }));
                            sendPlayerCommand('PAUSE');
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
                        if (idx >= list.length) idx = Math.max(0, list.length - 1);
                        updateState({ playlist: list, index: idx });
                    },
                    "MOVE": () => {
                        const { from, to } = msg.data;
                        const list = [...current.playlist];
                        if (from >= 0 && from < list.length && to >= 0 && to < list.length) {
                            const [item] = list.splice(from, 1);
                            list.splice(to, 0, item);
                            let newIdx = current.index;
                            if (current.index === from) newIdx = to;
                            else if (current.index > from && current.index <= to) newIdx--;
                            else if (current.index < from && current.index >= to) newIdx++;
                            updateState({ playlist: list, index: newIdx });
                        }
                    },
                    "ADD": async () => await resolveAndAdd(msg.data),
                    "SEEK_TO": () => doSeekTo(msg.data),
                    "SEEK_BY": () => {
                        const delta = msg.data;
                        const elapsed = current.playing ? (Date.now() - current.startTime) / 1000 : (current.pausedAt || 0);
                        doSeekTo(Math.max(0, elapsed + delta));
                    }
                };
                if (actions[msg.type]) await actions[msg.type]();
            } catch (err) { console.error("[NativeYT] UI Process Error:", err); }
        }

        function updateVolume() {
            if (!videoPlayer) return;
            if (localMuted || localVolume === 0) sendPlayerCommand('MUTE');
            else { sendPlayerCommand('UNMUTE'); sendPlayerCommand('SET_VOLUME', localVolume); }
        }

        function sendPlayerCommand(type, data) {
            if (!videoPlayer) return;
            videoPlayer.RunActions(JSON.stringify({ actions: [{ actionType: 'postmessage', strParam1: JSON.stringify({ type, data }) }] }));
        }

        function handlePlayerMessage(e) {
            try {
                let s = (typeof e.detail === 'string') ? e.detail : (e.detail?.message || "");
                if (!s && typeof e.detail === 'object' && e.detail.type) {
                    processPlayerMsg(e.detail);
                    return;
                }
                if (!s) return;
                processPlayerMsg(JSON.parse(s));
            } catch (err) {}
        }

        function processPlayerMsg(msg) {
            if (msg.type === 'PLAY') { localPlayerPlaying = true; checkState(); }
            if (msg.type === 'PAUSE') { localPlayerPlaying = false; checkState(); }
            if (msg.type === 'VIDEO_INFO') {
                const current = getSpaceState();
                const list = [...current.playlist];
                if (list[current.index]) { list[current.index].duration = msg.data.duration; updateState({ playlist: list }); }
            } else if (msg.type === 'VIDEO_ENDED') {
                const current = getSpaceState();
                if (!current.locked || current.hostId === scene.localUser.uid) handleAction('NEXT');
            }
        }

        function checkTimeSync() {
            const current = getSpaceState();
            if (!current.playing || !current.playlist.length) return;
            const vid = current.playlist[current.index];
            if (!vid || !vid.duration) return;
            const elapsed = (Date.now() - current.startTime) / 1000;
            if (elapsed > vid.duration + 5) {
                if (!current.locked || current.hostId === scene.localUser.uid) handleAction('NEXT');
            }
        }

        function handleNext(current) {
            if (current.mode === 'karaoke') {
                const list = [...current.playlist];
                if (list.length > 0) {
                    list.shift();
                    updateState({ playlist: list, index: 0, startTime: Date.now(), pausedAt: 0, playing: true });
                }
            } else updateTrack(1);
        }

        async function resolveAndAdd(input) {
            let newItem = { id: "", title: "", duration: 0, user: scene.localUser.name };
            let mode = 'append';
            if (typeof input === 'object' && input !== null) {
                newItem.id = input.id;
                newItem.title = (input.title || "").replace(/[^\x20-\x7E]/g, '').replace(/[\"\'\|\\]/g, '').trim() || `Video ${input.id}`;
                newItem.duration = input.duration || 0;
                mode = input.mode || 'append';
            } else {
                newItem.id = input;
                try {
                    const url = new URL(input);
                    if (url.hostname.includes("youtube.com")) newItem.id = url.searchParams.get("v");
                    else if (url.hostname.includes("youtu.be")) newItem.id = url.pathname.slice(1);
                } catch (e) {}
                newItem.title = `Video ${newItem.id}`;
            }
            if (!newItem.id) return;
            const current = getSpaceState();
            const list = [...current.playlist];
            if (mode === 'now') {
                const idx = list.length === 0 ? 0 : current.index + 1;
                list.splice(idx, 0, newItem);
                updateState({ playlist: list, index: idx, startTime: Date.now(), pausedAt: 0, playing: true });
            } else if (mode === 'next') {
                const idx = list.length === 0 ? 0 : current.index + 1;
                list.splice(idx, 0, newItem);
                updateState({ playlist: list });
            } else {
                list.push(newItem);
                updateState({ playlist: list });
            }
        }

        function updateTrack(delta) {
            const current = getSpaceState();
            if (!current.playlist.length) return;
            let newIdx = (current.index + delta + current.playlist.length) % current.playlist.length;
            changeIndex(newIdx);
        }

        function changeIndex(idx) {
            updateState({ index: idx, startTime: Date.now(), pausedAt: 0, playing: true });
        }

        function getSpaceState() {
            if (!scene.spaceState) return { playlist: [...DEFAULT_PLAYLIST], index: 0, playing: true, startTime: Date.now(), pausedAt: 0, mode: CONFIG.mode, locked: false, hostId: "" };
            const props = scene.spaceState.public || {};
            if (props[STATE_KEY]) try { return JSON.parse(props[STATE_KEY]); } catch (e) {}
            return { playlist: [...DEFAULT_PLAYLIST], index: 0, playing: true, startTime: Date.now(), pausedAt: 0, mode: CONFIG.mode, locked: false, hostId: "" };
        }

        function updateState(updates) {
            const current = getSpaceState();
            scene.SetPublicSpaceProps({ [STATE_KEY]: JSON.stringify({ ...current, ...updates }) });
        }

        async function onStateChange(e) {
            if (e && e.detail && Array.isArray(e.detail)) {
                if (!scene.spaceState) scene.spaceState = { public: {}, protected: {} };
                if (!scene.spaceState.public) scene.spaceState.public = {};
                e.detail.forEach(c => { if (c.type === 'public') scene.spaceState.public[c.property] = c.newValue; });
            }
            checkState();
        }

        async function handleOneShot(e) {
            try {
                const data = JSON.parse(e.detail.data);
                if (data.targetInstance && data.targetInstance !== CONFIG.instanceId) return;
                const state = getSpaceState();
                if (state.locked && !e.detail.fromAdmin && state.hostId !== e.detail.fromId) return;
                if (data.type === 'PLAY') sendPlayerCommand('PLAY');
                else if (data.type === 'PAUSE') sendPlayerCommand('PAUSE');
                else if (data.type === 'SEEK') sendPlayerCommand('SEEK', data.value);
            } catch (err) {}
        }

        let loadedVideoId = "";
        let lastStartTime = 0;
        let lastPausedAt = 0;

        async function checkState() {
            const state = getSpaceState();
            sendToUi({ type: "STATE", data: { ...state, volume: localVolume, muted: localMuted } });
            if (!state.playlist.length) return;
            const vid = state.playlist[state.index] || state.playlist[0];
            let startAt = state.playing ? (Date.now() - state.startTime) / 1000 : (state.pausedAt || 0);

            if (vid.id !== loadedVideoId) {
                loadedVideoId = vid.id;
                sendPlayerCommand('LOAD_VIDEO', { id: vid.id, startTime: startAt, playing: state.playing });
                setTimeout(updateVolume, 1000);
            } else {
                if (state.playing) sendPlayerCommand('PLAY'); else sendPlayerCommand('PAUSE');
                if (state.startTime !== lastStartTime || state.pausedAt !== lastPausedAt) sendPlayerCommand('SEEK', startAt);
            }
            lastStartTime = state.startTime;
            lastPausedAt = state.pausedAt;
        }

        init().catch(e => console.error(e));
    }

    initYouTubePlayer();

    });
});