(() => {
    "use strict";

    let view, instance, notices;
    let starting = false;
    let cameraRequest, stream, cameraDeadline, cameraTimer;
    let wantCamera = false;
    let viewMode = "manual";
    let gateUsed = false;
    let cameraState = "checking";
    let cameraRevision = 0;
    let lastTime = -1, lastTexture;
    let locationPending = false, locationAttempt = 0;
    let sensorListening = false, sensorRequest, sensorDenied = false, lastSensor, sensorTimer;
    let compassOffset = 0, compassOffsetReady = false;
    let absoluteAt = -Infinity, sentSensorAt = -Infinity;
    let sensorSamples = 0, sensorAbsolute = 0, sensorRelative = 0, sensorInvalid = 0, sensorSent = 0;
    let sensorModeLogged = false, hiddenDropLogged = false, nullAlphaLogged = false;
    let userExitedFullscreen = false, sawFullscreen = false, fullscreenPending = false;
    let orientationLocked = false, lockPending = false;
    let fullscreenAttempts = 0, lastFullscreenError = "", orientationLockResult = "not-requested";
    let cameraFrames = 0;
    const cameraTextureEdge = 640;
    let graphicsState = "ready", graphicsContext, displayFrame;
    let graphicsLosses = 0, graphicsRestores = 0, unityStarts = 0, displayUpdates = 0;
    const graphicsErrors = [];
    const isIPhone = /iPhone|iPod/i.test(navigator.userAgent);
    const isIPad = /iPad/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isIOS = isIPhone || isIPad;
    const debugOrientation = document.currentScript?.hasAttribute("data-cho2-orientation-debug");
    let iosPose, sentIOSPose, iosAngle, iosTransition, iosFrame, iosWatchUntil = 0;
    let iosUsesStandard = false, iosLegacyHasTurned = false, iosStandardCandidate, iosStandardSince;
    let iosSensorSource, iosBasis, iosCompassOffset;
    let screenTurns = 0;
    let lastOrientationEvent, lastOrientationLogAt = -Infinity;
    const projections = new Map();
    let projectionPanel, projectionText;

    function projectionReport() {
        return JSON.stringify({
            time: new Date().toISOString(), screenOrientation: screen.orientation?.angle,
            legacyOrientation: window.orientation, appliedScreenAngle: lastSensor?.[3],
            rawSensor: lastOrientationEvent, tracking: sensorListening && viewMode === "ar",
            lastPoseAt: iosPose?.at, holdingPose: !!iosTransition, graphicsState,
            video: {size: [video.videoWidth, video.videoHeight], uploadFlipY: true,
                appliedRotationDeg: 0, orientation: "browser-decoded; rotation metadata is not exposed"},
            landmarks: Object.fromEntries(projections)
        }, null, 2);
    }

    function recordProjection(line) {
        if (!debugOrientation) return;
        const name = line.slice(5, line.indexOf(";"));
        projections.set(name, line);
        if (projectionPanel && !projectionPanel.hidden && document.activeElement !== projectionText)
            projectionText.value = projectionReport();
    }

    function installProjectionPanel() {
        if (!debugOrientation) return;
        const open = document.createElement("button");
        open.textContent = "회전 진단";
        open.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:10001";
        projectionPanel = document.createElement("section");
        projectionPanel.hidden = true;
        projectionPanel.style.cssText = "position:fixed;inset:auto 12px 48px;max-width:620px;z-index:10001;background:white;color:#15212c;padding:10px";
        projectionText = document.createElement("textarea");
        projectionText.readOnly = true;
        projectionText.rows = 11;
        projectionText.style.cssText = "display:block;width:100%;box-sizing:border-box;font-size:16px";
        projectionText.setAttribute("aria-label", "회전 진단 기록");
        const copy = document.createElement("button");
        copy.textContent = "스냅샷 복사";
        copy.onclick = async () => {
            const report = projectionReport();
            projectionText.value = report;
            try {
                await navigator.clipboard.writeText(report);
                copy.textContent = "복사 완료";
            } catch {
                projectionText.focus();
                projectionText.select();
                copy.textContent = "선택한 기록을 복사하세요";
            }
        };
        open.onclick = () => {
            projectionPanel.hidden = !projectionPanel.hidden;
            if (!projectionPanel.hidden) projectionText.value = projectionReport();
        };
        projectionPanel.append(copy, projectionText);
        document.body.append(open, projectionPanel);
    }

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    const frame = document.createElement("canvas");
    frame.id = "cho2-camera-frame";
    const frameContext = frame.getContext("2d", {alpha: false});
    const rows = new Map();

    function notice(key, message, buttonLabel, action) {
        let row = rows.get(key);
        if (!row && !message) return;
        if (!row) {
            const element = document.createElement("div");
            element.className = "cho2-notice";
            const label = document.createElement("span");
            label.setAttribute("role", "status");
            const button = document.createElement("button");
            button.type = "button";
            element.append(label, button);
            notices.append(element);
            row = {element, label, button};
            rows.set(key, row);
        }
        row.element.hidden = !message;
        row.label.textContent = message;
        row.button.hidden = !action;
        row.button.textContent = buttonLabel || "";
        row.button.onclick = action || null;
    }

    function send(method, data) {
        if (!instance || graphicsState !== "ready") return false;
        try {
            if (data === undefined) instance.SendMessage("LocationManager", method);
            else instance.SendMessage("LocationManager", method, data);
            return true;
        } catch (error) {
            console.warn("cho2 SendMessage failed", method, error && error.message);
            return false;
        }
    }

    function updatePixelRatio() {
        if (!view) return;
        const viewportPixels = Math.max(1, window.innerWidth * window.innerHeight);
        const screenPixels = (screen.width || 0) * (screen.height || 0);
        const ratio = isIOS
            ? Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2000000 / Math.max(viewportPixels, screenPixels)))
            : Math.min(window.devicePixelRatio || 1, 2);
        view.config.devicePixelRatio = ratio;
        if (instance) instance.Module.devicePixelRatio = ratio;
    }

    function rememberGraphicsError(source, error) {
        if (graphicsErrors.length === 12) graphicsErrors.shift();
        graphicsErrors.push({at: performance.now(), source, message: String(error).slice(0, 1200)});
    }

    function graphicsSnapshot() {
        const canvas = view.canvas;
        return {at: performance.now(), state: graphicsState, unityStarts, displayUpdates,
            canvases: document.querySelectorAll("#unity-canvas").length, graphicsLosses, graphicsRestores,
            contextLost: graphicsContext?.isContextLost(), backing: [canvas.width, canvas.height],
            drawingBuffer: graphicsContext && [graphicsContext.drawingBufferWidth, graphicsContext.drawingBufferHeight],
            wasmHeapBytes: instance?.Module.HEAPU8?.byteLength,
            viewport: [window.innerWidth, window.innerHeight], pixelRatio: view.config.devicePixelRatio,
            video: [video.videoWidth, video.videoHeight], upload: [frame.width, frame.height],
            cameraFrames, recentErrors: graphicsErrors.slice()};
    }

    function loseGraphics(source) {
        if (graphicsState !== "ready") return;
        graphicsState = "lost";
        graphicsLosses += 1;
        console.error("cho2 WebGL context lost", source, graphicsSnapshot());
        instance?.Module.pauseMainLoop?.();
        wantCamera = false;
        cameraRevision += 1;
        stopCamera();
        view.loadingCover.style.display = "none";
        notices.hidden = false;
        notice("graphics", "그래픽 연결이 끊겼습니다. 체험을 다시 시작해 주세요.",
            "다시 시작", () => location.reload());
    }

    function monitorGraphics() {
        view.canvas.addEventListener("webglcontextlost", event => {
            event.preventDefault();
            loseGraphics("webglcontextlost");
            console.warn("cho2 webglcontextlost", event.statusMessage, graphicsSnapshot());
        });
        view.canvas.addEventListener("webglcontextrestored", event => {
            graphicsState = "restored";
            graphicsRestores += 1;
            console.info("cho2 webglcontextrestored", event.statusMessage, graphicsSnapshot());
            // Old Unity textures and buffers are invalid even after the browser restores GL.
            notice("graphics", "그래픽 연결이 복구됐습니다. 체험을 다시 시작해 주세요.",
                "다시 시작", () => location.reload());
        });
        view.canvas.addEventListener("webglcontextcreationerror", event =>
            rememberGraphicsError("webglcontextcreationerror", event.statusMessage));
        window.addEventListener("error", event => rememberGraphicsError("javascript", event.error?.stack || event.message));
        window.addEventListener("unhandledrejection", event =>
            rememberGraphicsError("unhandledrejection", event.reason?.stack || event.reason));
        const printErr = view.config.printErr || console.error.bind(console);
        view.config.printErr = (...args) => {
            rememberGraphicsError("unity", args.join(" "));
            printErr(...args);
        };
        const previousFrame = view.config.preMainLoop;
        view.config.preMainLoop = function () {
            graphicsContext = this.ctx || graphicsContext;
            // The context can be marked lost before the DOM event is dispatched.
            if (graphicsContext?.isContextLost()) loseGraphics("preMainLoop");
            return graphicsState === "ready" && previousFrame?.call(this) !== false;
        };
    }

    function mount(options) {
        if (view) return;
        view = options;
        document.documentElement.classList.add("cho2-webgl");
        document.querySelector('meta[name="viewport"]').content =
            "width=device-width, initial-scale=1, viewport-fit=cover";
        updatePixelRatio();
        view.canvas.style.width = "100%";
        view.canvas.style.height = "100%";
        window.addEventListener("resize", fitCanvas);
        if (isIOS) window.addEventListener("resize", watchIOSOrientation);
        window.addEventListener("orientationchange", onDisplayChange);
        if (screen.orientation)
            screen.orientation.addEventListener("change", onDisplayChange);
        if (window.visualViewport)
            window.visualViewport.addEventListener("resize", () => {
                watchIOSOrientation();
                fitCanvas();
            });
        window.addEventListener("pointerdown", onUserGesture, true);
        window.addEventListener("mousedown", onUserGesture, true);
        window.addEventListener("pointerup", onUserGesture, true);
        window.addEventListener("touchend", onUserGesture, true);
        window.addEventListener("click", onUserGesture, true);
        if (view.fullscreenButton) view.fullscreenButton.remove();

        notices = document.createElement("div");
        notices.className = "cho2-notices";
        notices.hidden = true;
        document.body.append(notices);
        monitorGraphics();
        installProjectionPanel();
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");
        video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
        video.setAttribute("aria-hidden", "true");
        document.body.append(video);
        const manualButton = document.createElement("button");
        manualButton.id = "cho2-manual-start";
        manualButton.type = "button";
        manualButton.textContent = "카메라 없이 둘러보기";
        manualButton.hidden = true;
        manualButton.onclick = () => {
            if (starting || instance || cameraRequest) return;
            gateUsed = true;
            wantCamera = false;
            stopCamera();
            useManualView();
            hideIntro();
            start();
        };
        document.getElementById("startARDiv").append(manualButton);
        inspectCameras().then(availability => {
            if (starting || instance || gateUsed) return;
            if (availability === "absent" || availability === "denied") {
                gateUsed = true;
                hideIntro();
                start();
            } else {
                showIntro();
            }
        });
        maybeShowInitialRotateHint();
        installApp();

        document.addEventListener("fullscreenchange", onFullscreenChange);
        document.addEventListener("webkitfullscreenchange", onFullscreenChange);
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) suspend();
            else resume();
        });
        window.addEventListener("pagehide", suspend);
        window.addEventListener("pageshow", resume);
        if (navigator.mediaDevices?.addEventListener)
            navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    }

    function fullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement;
    }

    function displayMode() {
        if (window.matchMedia("(display-mode: fullscreen)").matches) return "fullscreen";
        if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) return "standalone";
        return "browser";
    }

    function isAppFullscreen() {
        return !!fullscreenElement() || displayMode() === "fullscreen";
    }

    function isMobileBrowser() {
        return isIPad || window.matchMedia("(pointer: coarse)").matches ||
            /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    function isPortrait() {
        const type = screen.orientation && screen.orientation.type;
        if (type) return type.startsWith("portrait");
        if (typeof window.orientation === "number") return Math.abs(window.orientation) !== 90;
        return window.innerHeight > window.innerWidth;
    }

    function fitCanvas() {
        if (!view || displayFrame !== undefined || graphicsState !== "ready") return;
        displayFrame = requestAnimationFrame(() => {
            displayFrame = undefined;
            if (graphicsState !== "ready") return;
            displayUpdates += 1;
            updatePixelRatio();
            publishSafeArea();
        });
    }

    function onDisplayChange() {
        watchIOSOrientation();
        fitCanvas();
        if (orientationLocked) notice("rotate", "");
        else if (sawFullscreen) updateRotateHint();
    }

    function updateRotateHint() {
        if (!isMobileBrowser() || !isPortrait()) {
            notice("rotate", "");
            return;
        }
        notice("rotate", "가로로 돌려 주세요.");
    }

    function maybeShowInitialRotateHint() {
        if (!isMobileBrowser() || !isPortrait()) return;
        if (screen.orientation && typeof screen.orientation.lock === "function") return;
        updateRotateHint();
    }

    function requestImmersiveFullscreen() {
        const root = document.documentElement;
        if (isAppFullscreen()) return Promise.resolve();
        if (typeof root.requestFullscreen === "function") {
            // Mobile Chrome rejects the navigationUI option asynchronously, after
            // the user gesture has ended, so the fallback would also fail.
            if (isMobileBrowser()) return root.requestFullscreen();
            try {
                return root.requestFullscreen({navigationUI: "hide"});
            } catch (error) {
                console.warn("cho2 fullscreen options rejected synchronously", error && error.name);
                return root.requestFullscreen();
            }
        }
        if (typeof root.webkitRequestFullscreen === "function") {
            root.webkitRequestFullscreen();
            return Promise.resolve();
        }
        return Promise.reject(new Error("fullscreen-unavailable"));
    }

    function tryLockLandscape() {
        if (orientationLocked || lockPending || !isMobileBrowser()) return;
        const orientation = screen.orientation;
        if (!orientation || typeof orientation.lock !== "function") {
            orientationLockResult = "unavailable";
            console.warn("cho2 orientation lock unavailable");
            updateRotateHint();
            return;
        }
        if (!fullscreenElement() && !isAppFullscreen()) return;
        lockPending = true;
        orientationLockResult = "pending";
        Promise.resolve(orientation.lock("landscape")).then(() => {
            lockPending = false;
            orientationLocked = true;
            orientationLockResult = "landscape";
            console.info("cho2 orientation lock: landscape", orientation.type);
            notice("rotate", "");
        }).catch(error => {
            lockPending = false;
            orientationLockResult = "rejected:" + ((error && error.name) || "Error");
            console.warn("cho2 orientation lock rejected", error && error.name, error && error.message);
            updateRotateHint();
        });
    }

    function acceptsFullscreenGesture(event) {
        if (!event.isTrusted || event.isPrimary === false) return false;
        const touch = event.pointerType === "touch" || event.type === "touchend";
        // A mouse click's user activation is pointerdown. Android Chrome accepts
        // the touch's pointerup or touchend, and rejects fullscreen from pointerdown.
        if (touch)
            return event.type === "touchend" || (event.type === "pointerup" && event.pointerType === "touch");
        return event.type === "pointerdown" || event.type === "mousedown" || event.type === "click";
    }

    function onUserGesture(event) {
        if (!acceptsFullscreenGesture(event)) return;
        // Permission requests must retain the activation from the start button.
        if (!instance || event.target.closest?.("#startARDiv")) return;
        if (viewMode === "ar" && isMobileBrowser()) requestSensor(true);
        if (userExitedFullscreen) return;
        if (isAppFullscreen()) {
            tryLockLandscape();
            return;
        }
        if (fullscreenPending) return;
        fullscreenPending = true;
        fullscreenAttempts += 1;
        let pending;
        try {
            pending = requestImmersiveFullscreen();
        } catch (error) {
            pending = Promise.reject(error);
        }
        Promise.resolve(pending).then(() => {
            fullscreenPending = false;
            const active = !!fullscreenElement();
            console.info("cho2 fullscreen request settled", {
                active,
                fullscreenElement: active,
                mode: displayMode(),
                attempts: fullscreenAttempts
            });
            if (active) tryLockLandscape();
            else console.warn("cho2 fullscreen was not entered");
        }).catch(error => {
            fullscreenPending = false;
            lastFullscreenError = ((error && error.name) || "Error") + ": " + ((error && error.message) || "");
            console.warn("cho2 fullscreen rejected", error && error.name, error && error.message);
            updateRotateHint();
        });
    }

    function onFullscreenChange() {
        watchIOSOrientation();
        const active = !!fullscreenElement();
        console.info("cho2 fullscreenchange", {active, mode: displayMode()});
        if (active) {
            sawFullscreen = true;
            tryLockLandscape();
        } else if (sawFullscreen) {
            userExitedFullscreen = true;
            console.info("cho2 fullscreen exited; waiting for a new visit before requesting again");
        }
        fitCanvas();
    }

    function publishSafeArea() {
        if (!document.body) return;
        let probe = document.getElementById("cho2-safe-probe");
        if (!probe) {
            probe = document.createElement("div");
            probe.id = "cho2-safe-probe";
            document.body.append(probe);
        }
        probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
        const style = getComputedStyle(probe);
        const insets = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
            .map(value => parseFloat(value) || 0);
        send("HandleCho2SafeArea", insets.concat([window.innerWidth, window.innerHeight]).join(","));
    }

    function installApp() {
        const mode = displayMode();
        console.info("cho2 display mode", mode);
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.addEventListener("controllerchange", () => {
                console.info("cho2 service worker changed");
            });
            navigator.serviceWorker.register("cho2-sw.js", {scope: "./", updateViaCache: "none"}).then(registration => {
                console.info("cho2 service worker", registration.scope);
            }).catch(error => {
                console.warn("cho2 service worker rejected", error && error.name, error && error.message);
            });
        }
        if (mode === "fullscreen") {
            console.info("cho2 installed app already fullscreen; requestFullscreen skipped");
            tryLockLandscape();
        } else if (mode === "standalone")
            console.info("cho2 standalone app is not display-mode fullscreen");
    }

    function loader() {
        if (typeof window.createUnityInstance === "function") return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = view.loaderUrl;
            script.onload = resolve;
            script.onerror = () => {
                script.remove();
                reject(new Error("Unity loader download failed"));
            };
            document.body.append(script);
        });
    }

    function showIntro() {
        const intro = document.getElementById("startARDiv");
        const button = document.getElementById("startARButton");
        if (!intro || !button) return;
        button.onclick = onDeviceButton;
        intro.style.display = "";
        intro.classList.add("cho2-show");
    }

    function hideIntro() {
        const intro = document.getElementById("startARDiv");
        if (intro) intro.classList.remove("cho2-show");
    }

    function publishViewMode() {
        send("HandleCho2ViewMode", viewMode);
        if (viewMode === "manual") send("HandleCho2SensorUnavailable");
    }

    function useManualView() {
        viewMode = "manual";
        window.removeEventListener("deviceorientationabsolute", onOrientation);
        window.removeEventListener("deviceorientation", onOrientation);
        sensorListening = false;
        lastSensor = undefined;
        iosPose = sentIOSPose = iosSensorSource = iosBasis = iosCompassOffset = iosTransition = undefined;
        publishViewMode();
    }

    async function onDeviceButton(event) {
        if (event) event.preventDefault();
        if (gateUsed || starting || instance) return;
        gateUsed = true;
        const button = document.getElementById("startARButton");
        button.disabled = true;
        button.textContent = "카메라 권한 확인 중…";
        wantCamera = true;
        viewMode = "ar";
        // Both permission APIs are invoked in this click, before awaiting either.
        requestSensor(true);
        try {
            await startCamera();
            if (!stream) {
                if (cameraState === "denied" || cameraState === "absent") {
                    hideIntro();
                    await start();
                    return;
                }
                gateUsed = false;
                document.querySelector("#startARDiv p").textContent =
                    "카메라를 연결하지 못했습니다. 브라우저의 카메라 권한과 HTTPS 연결을 확인하고 다시 시도해 주세요.";
                document.getElementById("cho2-manual-start").hidden = false;
                button.textContent = "카메라 재시도";
                button.disabled = false;
                showIntro();
                return;
            }
            hideIntro();
            await start();
        } catch (error) {
            gateUsed = false;
            button.disabled = false;
            button.textContent = "카메라 재시도";
            showIntro();
            console.warn("cho2 camera permission failed", error && error.name);
        }
    }

    async function start() {
        if (starting || instance || graphicsState !== "ready") return;
        if (!gateUsed) {
            showIntro();
            return;
        }
        starting = true;
        const intro = document.getElementById("startARDiv");
        const button = document.getElementById("startARButton");
        const introText = intro ? intro.querySelector("p") : null;
        const loadStatus = document.createElement("p");
        loadStatus.setAttribute("role", "status");
        loadStatus.textContent = "콘텐츠를 불러오는 중…";
        view.progressBarEmpty.before(loadStatus);
        view.loadingCover.style.display = "";
        view.progressBarEmpty.style.display = "none";
        view.spinner.style.display = "";
        try {
            await loader();
            unityStarts += 1;
            instance = await window.createUnityInstance(view.canvas, view.config, progress => {
                const percentage = Math.round(100 * progress);
                loadStatus.textContent = "콘텐츠를 불러오는 중… " + percentage + "%";
                view.spinner.style.display = "none";
                view.progressBarEmpty.style.display = "";
                view.progressBarFull.style.width = percentage + "%";
            });
            if (graphicsState !== "ready") {
                instance.Module.pauseMainLoop();
                return;
            }
            fitCanvas();
            publishSafeArea();
            notices.hidden = false;
            send("HandleCho2CameraMode", cameraState);
            publishViewMode();
            if (isIOS) queueIOSOrientation();

            requestLocation();
        } catch (error) {
            rememberGraphicsError("startup", error?.stack || error);
            console.error("Unity startup failed", error);
            wantCamera = false;
            stopCamera();
            if (graphicsState === "ready" && intro && introText && button) {
                intro.classList.add("cho2-show");
                introText.textContent = "콘텐츠를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.";
                button.textContent = "다시 시도";
                button.onclick = () => window.location.reload();
                intro.style.display = "";
            }
        } finally {
            view.loadingCover.style.display = "none";
            loadStatus.remove();
            starting = false;
        }
    }

    function setCameraState(state) {
        cameraState = state;
        if (state === "absent") wantCamera = false;
        send("HandleCho2CameraMode", state);
    }

    function stopCamera() {
        clearTimeout(cameraTimer);
        cameraDeadline = 0;
        const previous = stream;
        stream = undefined;
        video.pause();
        video.srcObject = null;
        frame.width = frame.height = 1;
        lastTime = -1;
        lastTexture = undefined;
        if (previous) previous.getTracks().forEach(track => track.stop());
    }

    function failCamera(state) {
        wantCamera = false;
        stopCamera();
        setCameraState(state);
        if (instance) hideIntro();
        useManualView();
        if (state === "denied")
            notice("camera", "카메라 권한이 없어 화면을 끌어 둘러봅니다.");
        else if (state === "failed")
            notice("camera", "카메라에 연결하지 못해 화면을 끌어 둘러봅니다.");
    }

    function onDeviceChange() {
        if (!instance || viewMode === "ar" || gateUsed || cameraRequest || stream) return;
        inspectCameras().then(kind => {
            if ((kind === "available" || kind === "uncertain") && viewMode === "manual" && !gateUsed)
                showIntro();
        }).catch(() => {});
    }

    function cameraPermission() {
        if (!navigator.permissions?.query) return Promise.resolve("unknown");
        return navigator.permissions.query({name: "camera"}).then(status => status.state).catch(() => "unknown");
    }

    function classifyCameras(list, permission) {
        const cameras = (list || []).filter(device => device.kind === "videoinput");
        const onlyVirtual = cameras.length > 0 && cameras.every(device =>
            device.label && device.label.toLowerCase() === "obs virtual camera");
        console.info("cho2 camera enumerate", {
            count: cameras.length,
            permission,
            labels: cameras.map(device => device.label || "(no label)")
        });
        if (onlyVirtual) return "absent";
        if (cameras.length > 0) return permission === "denied" ? "denied" : "available";
        if (permission === "denied") return "denied";
        if (!isMobileBrowser()) return "absent";
        return "uncertain";
    }

    function inspectCameras() {
        const devices = navigator.mediaDevices;
        if (!devices?.enumerateDevices && !devices?.getUserMedia) {
            setCameraState("uncertain");
            return Promise.resolve("uncertain");
        }
        let settled = false;
        return new Promise(resolve => {
            const finish = (kind) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (kind === "absent") setCameraState("absent");
                else if (kind === "denied") setCameraState("denied");
                else if (kind === "available") setCameraState("idle");
                else setCameraState("uncertain");
                resolve(kind);
            };
            const timer = setTimeout(() => finish("uncertain"), 4000);
            Promise.all([
                devices.enumerateDevices ? devices.enumerateDevices() : Promise.resolve([]),
                cameraPermission()
            ]).then(([list, permission]) => {
                console.info("cho2 camera permission", permission);
                finish(classifyCameras(list, permission));
            }).catch(error => {
                console.warn("cho2 camera enumerate failed", error && error.name, error && error.message);
                finish("uncertain");
            });
        });
    }

    function startCamera() {
        if (cameraRequest) return cameraRequest;
        if (!wantCamera || stream) return Promise.resolve();
        if (!navigator.mediaDevices?.getUserMedia) {
            failCamera("failed");
            return Promise.resolve();
        }
        console.info("cho2 getUserMedia");
        setCameraState("prompting");
        cameraRequest = openCamera(cameraRevision);
        return cameraRequest;
    }

    async function openCamera(revision) {
        try {
            const incoming = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {facingMode: {ideal: "environment"}, width: {ideal: 960}, height: {ideal: 540}, frameRate: {ideal: 24, max: 30}}
            });
            if (!wantCamera || revision !== cameraRevision) {
                incoming.getTracks().forEach(track => track.stop());
                return;
            }
            stream = incoming;
            const track = incoming.getVideoTracks()[0];
            console.info("cho2 camera track", track.readyState, track.label || "(no label)");
            track.addEventListener("ended", () => {
                if (stream === incoming) failCamera("failed");
            }, {once: true});
            video.srcObject = incoming;
            cameraDeadline = performance.now() + 8000;
            cameraTimer = setTimeout(() => {
                if (stream === incoming && video.readyState < 2)
                    failCamera("failed");
            }, 8000);
            await video.play();
            if (stream === incoming) setCameraState("live");
        } catch (error) {
            if (revision !== cameraRevision || !wantCamera) return;
            const name = error && error.name;
            console.warn("cho2 camera failed", name, error && error.message);
            if (name === "NotFoundError" || name === "DevicesNotFoundError")
                failCamera("absent");
            else if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError")
                failCamera("denied");
            else
                failCamera("failed");
        } finally {
            cameraRequest = undefined;
            if (revision !== cameraRevision && wantCamera && !document.hidden && !stream)
                startCamera();
        }
    }

    function cameraSize() {
        if (!wantCamera || graphicsState !== "ready") return -1;
        if (!stream || video.readyState < 2 || document.hidden) return 0;
        return (video.videoWidth << 16) | video.videoHeight;
    }

    function uploadCamera(gl, texture) {
        graphicsContext = gl;
        if (gl.isContextLost()) {
            loseGraphics("camera upload");
            return;
        }
        if (!texture || cameraSize() <= 0) return;
        if (lastTexture === texture && lastTime === video.currentTime) {
            if (cameraDeadline && performance.now() > cameraDeadline)
                failCamera("failed");
            return;
        }
        cameraDeadline = performance.now() + 8000;
        const binding = gl.getParameter(gl.TEXTURE_BINDING_2D);
        const flipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
        try {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            if (frame.width !== cameraTextureEdge || frame.height !== cameraTextureEdge) {
                frame.width = frame.height = cameraTextureEdge;
            }
            frameContext.drawImage(video, 0, 0, frame.width, frame.height);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, frame);
            if (cameraFrames === 0)
                console.info("cho2 camera frame", video.videoWidth, video.videoHeight);
            cameraFrames += 1;
            lastTime = video.currentTime;
            lastTexture = texture;
        } catch (error) {
            rememberGraphicsError("camera upload", error?.stack || error);
            if (gl.isContextLost()) loseGraphics("camera upload exception");
            else failCamera("failed");
        } finally {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
            gl.bindTexture(gl.TEXTURE_2D, binding);
        }
    }

    function suspend() {
        if (isIOS) {
            iosPose = sentIOSPose = lastSensor = iosTransition = undefined;
            iosWatchUntil = 0;
        }
        // A permission sheet can hide the page while getUserMedia is still pending.
        // Cancelling that request drops the grant and never shows the camera.
        if (!(cameraRequest && !stream)) {
            cameraRevision++;
            stopCamera();
        }
        clearTimeout(sensorTimer);
    }

    function resume() {
        if (document.hidden || graphicsState !== "ready") return;
        if (wantCamera && !stream && !cameraRequest) startCamera();
        if (instance && sensorListening && !lastSensor) scheduleSensorCheck();
        watchIOSOrientation();
    }

    function locationFailure(error) {
        const message = error.code === 1 ? "위치 접근이 차단되어 기본 위치를 사용합니다."
            : error.code === 3 ? "위치 응답이 지연되어 현재 표시된 위치를 사용합니다."
            : "현재 위치를 가져올 수 없어 기존 위치를 사용합니다.";
        notice("location", message, "위치 재시도", requestLocation);
    }

    function requestLocation() {
        if (!instance || locationPending) return;
        if (!navigator.geolocation || !window.isSecureContext) {
            locationFailure({});
            return;
        }
        locationPending = true;
        const attempt = ++locationAttempt;
        notice("location", "현재 위치를 확인하는 중…");
        const timer = setTimeout(() => {
            if (attempt !== locationAttempt) return;
            locationPending = false;
            locationFailure({code: 3});
        }, 10000);
        function finish() {
            clearTimeout(timer);
            if (attempt !== locationAttempt) return false;
            locationPending = false;
            return true;
        }
        try {
            navigator.geolocation.getCurrentPosition(({coords}) => {
                if (!finish()) return;
                const {latitude, longitude} = coords;
                if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
                    !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
                    locationFailure({});
                    return;
                }
                send("HandleLocation", latitude + "," + longitude);
                notice("location", "");
            }, error => {
                if (finish()) locationFailure(error);
            }, {enableHighAccuracy: true, maximumAge: 0, timeout: 15000});
        } catch {
            if (finish()) locationFailure({});
        }
    }

    function sensorUnavailable(message, retry) {
        notice("sensor", message, retry ? "센서 재시도" : "", retry ? () => {
            sensorDenied = false;
            requestSensor(true);
        } : null);
        send("HandleCho2SensorUnavailable");
    }

    function scheduleSensorCheck() {
        clearTimeout(sensorTimer);
        if (sensorListening && !lastSensor)
            sensorTimer = setTimeout(() => sensorUnavailable("방향 센서 값을 받을 수 없습니다. 화면을 끌어 둘러보세요.", false), 3500);
    }

    function listenForOrientation() {
        if (sensorListening) return;
        sensorListening = true;
        window.addEventListener("deviceorientationabsolute", onOrientation);
        window.addEventListener("deviceorientation", onOrientation);
        scheduleSensorCheck();
    }

    function requestSensor(fromGesture) {
        if (sensorListening || sensorDenied) return;
        const orientation = window.DeviceOrientationEvent;
        if (!orientation || !window.isSecureContext) {
            console.warn("cho2 orientation unavailable", {api: !!orientation, secure: window.isSecureContext});
            sensorUnavailable("방향 센서를 사용할 수 없습니다. 화면을 끌어 둘러보세요.", false);
            return;
        }

        if (typeof orientation.requestPermission !== "function" || !isMobileBrowser()) {
            console.info(typeof orientation.requestPermission === "function"
                ? "cho2 orientation permission api present; listening without a desktop prompt"
                : "cho2 orientation permission api absent; listening");
            listenForOrientation();
            return;
        }
        if (!fromGesture || sensorRequest) return;

        let pending;
        try {
            pending = Promise.resolve(orientation.requestPermission(true)).catch(error => {
                if (!error || error.name !== "TypeError") throw error;
                console.warn("cho2 orientation permission arguments rejected", error.name);
                return orientation.requestPermission();
            });
        } catch (error) {
            console.warn("cho2 orientation permission arguments rejected", error && error.name);
            try {
                pending = orientation.requestPermission();
            } catch (again) {
                console.warn("cho2 orientation permission rejected", again && again.name, again && again.message);
                return;
            }
        }
        sensorRequest = Promise.resolve(pending).then(result => {
            console.info("cho2 orientation permission", result);
            if (result === "granted") listenForOrientation();
            else {
                sensorDenied = true;
                sensorUnavailable("방향 센서 접근이 차단됐습니다. 화면을 끌어 둘러보세요.", true);
            }
        }).catch(error => {
            console.warn("cho2 orientation permission rejected", error && error.name, error && error.message);
            if (!error || error.name !== "NotAllowedError")
                sensorUnavailable("방향 센서 권한을 확인하지 못했습니다. 화면을 끌어 둘러보세요.", true);
        }).finally(() => { sensorRequest = undefined; });
    }

    function deviceCompass(alpha, beta, gamma) {
        const d = Math.PI / 180;
        const cX = Math.cos(beta * d), sX = Math.sin(beta * d);
        const cY = Math.cos(gamma * d), sY = Math.sin(gamma * d);
        const cZ = Math.cos(alpha * d), sZ = Math.sin(alpha * d);
        const east = -cZ * sY - sZ * sX * cY;
        const north = -sZ * sY + cZ * sX * cY;
        let heading = Math.atan2(east, north) / d;
        if (heading < 0) heading += 360;
        return {heading, magnitude: Math.hypot(east, north)};
    }

    function readScreenAngle() {
        const angle = screen.orientation?.angle ?? window.orientation;
        return Number.isFinite(angle) ? ((angle % 360) + 360) % 360 : 0;
    }

    function rightAngle(value) {
        return Number.isFinite(value) && value % 90 === 0 ? ((value % 360) + 360) % 360 : undefined;
    }

    function readIOSAngle(now) {
        const legacy = rightAngle(window.orientation);
        const modern = rightAngle(screen.orientation?.angle);
        const type = screen.orientation?.type;
        const modernMatchesType = modern !== undefined &&
            (type?.startsWith("landscape") && modern % 180 === 90 ||
             type?.startsWith("portrait") && modern % 180 === 0);
        // Some WKWebViews start with a placeholder legacy 0 in landscape.
        // Once the legacy value moves, keep it authoritative across delayed standard events.
        if (legacy !== undefined && legacy !== 0) {
            iosLegacyHasTurned = true;
            iosUsesStandard = false;
        }
        const fallback = !iosLegacyHasTurned && !iosUsesStandard && legacy === 0 &&
            modernMatchesType && modern % 180 === 90 ? modern : undefined;
        if (fallback !== iosStandardCandidate) {
            iosStandardCandidate = fallback;
            iosStandardSince = now;
        }
        if (fallback !== undefined && (iosAngle === undefined || now - iosStandardSince >= 300)) {
            iosUsesStandard = true;
            iosStandardCandidate = undefined;
        }
        return iosUsesStandard && modernMatchesType ? modern : legacy ?? modern;
    }

    function watchIOSOrientation() {
        if (!isIOS || viewMode !== "ar" || document.hidden || graphicsState !== "ready") return;
        if (performance.now() >= iosWatchUntil) logOrientation("display-change", true);
        iosWatchUntil = performance.now() + 2000;
        queueIOSOrientation();
    }

    function queueIOSOrientation() {
        if (iosFrame === undefined) iosFrame = requestAnimationFrame(updateIOSOrientation);
    }

    function updateIOSOrientation(now) {
        iosFrame = undefined;
        if (viewMode !== "ar" || document.hidden) return;
        const angle = readIOSAngle(now);
        if (angle === undefined || angle === iosAngle) iosTransition = undefined;
        else if (angle !== iosTransition?.angle)
            iosTransition = {angle, at: now, began: iosTransition?.began ?? now, pose: iosPose};
        else if (iosAngle === undefined || (iosPose && iosPose !== iosTransition.pose) ||
                 now - iosTransition.at >= 120) {
            if (iosAngle !== undefined) {
                screenTurns += 1;
                // Do not reproject an old pose left over from before this turn.
                if (iosPose && iosTransition.at - iosPose.at > 250) iosPose = undefined;
            }
            iosAngle = angle;
            iosTransition = undefined;
        }

        // Pair a changed angle with the newest sample available. One frame verifies
        // the angle; an arriving sample can finish the transition before the deadline.
        const changedAngle = iosAngle !== lastSensor?.[3];
        const pendingPose = iosPose && iosPose !== sentIOSPose;
        const holding = iosTransition && now - iosTransition.began < 120;
        const ready = iosPose && iosAngle !== undefined && !holding;
        const waitingForThrottle = !changedAngle && pendingPose && now - sentSensorAt < 30;
        if (instance && ready && (changedAngle || pendingPose && !waitingForThrottle)) {
            const {alpha, beta, gamma, basis} = iosPose;
            lastSensor = [alpha, beta, gamma, iosAngle, basis === "relative" ? 0 : 1, basis];
            if (publishSensor(lastSensor)) sentIOSPose = iosPose;
            sentSensorAt = now;
        }
        logOrientation(iosTransition ? "angle-settling" : "frame");
        if (now < iosWatchUntil || iosTransition || iosStandardCandidate !== undefined ||
            instance && ready && waitingForThrottle)
            queueIOSOrientation();
        else if (iosWatchUntil) {
            iosWatchUntil = 0;
            logOrientation("display-settled", true);
        }
    }

    function logOrientation(reason, force = false) {
        if (!debugOrientation) return;
        const now = performance.now();
        if (!force && now - lastOrientationLogAt < 250) return;
        lastOrientationLogAt = now;
        console.info("cho2 orientation trace", {
            reason, browser: /CriOS/i.test(navigator.userAgent) ? "Chrome iOS" : navigator.userAgent,
            now, sensor: lastOrientationEvent, sensorSamples, sensorInvalid,
            legacyAngle: window.orientation, screenAngle: screen.orientation?.angle,
            screenType: screen.orientation?.type, appliedAngle: lastSensor?.[3],
            viewport: [window.innerWidth, window.innerHeight],
            visualViewport: [window.visualViewport?.width, window.visualViewport?.height],
            video: [video.videoWidth, video.videoHeight], sensorListening, viewMode,
            tracking: viewMode === "ar" && sensorListening && !!lastSensor,
            holdingPose: isIOS && viewMode === "ar" &&
                (!iosPose || iosAngle === undefined || !!iosTransition && now - iosTransition.began < 120),
            pendingAngle: iosTransition?.angle, screenTurns, basis: lastSensor?.[5],
            selectedSource: iosSensorSource,
            orientationMessages: sensorSent
        });
    }

    function captureIOSPose(event, now, compass) {
        const {alpha, beta, gamma, type, absolute, webkitCompassHeading} = event;
        const nativeAbsolute = absolute === true || type === "deviceorientationabsolute";
        let basis = nativeAbsolute ? "native-absolute" : "relative";
        let offset;
        if (iosBasis === "webkit-compass" && type === iosSensorSource) {
            basis = iosBasis;
        } else if (iosBasis !== "native-absolute" && compass && type === "deviceorientation") {
            const device = deviceCompass(alpha, beta, gamma);
            if (device.magnitude > 0.25) {
                basis = "webkit-compass";
                offset = webkitCompassHeading - device.heading;
            }
        }
        // Different streams may use different alpha origins. Promote a relative
        // session once when a north reference is available; keep it across gaps.
        if (iosBasis && (basis !== iosBasis || type !== iosSensorSource) &&
            !(iosBasis === "relative" && basis !== "relative")) return;
        iosSensorSource = type;
        iosBasis = basis;
        if (offset !== undefined) iosCompassOffset = offset;
        iosPose = {alpha: basis === "webkit-compass" ? alpha - iosCompassOffset : alpha,
            beta, gamma, basis, at: now};
        clearTimeout(sensorTimer);
        queueIOSOrientation();
    }

    function onOrientation(event) {
        const {alpha, beta, gamma, webkitCompassHeading, webkitCompassAccuracy} = event;
        if (viewMode !== "ar" || graphicsState !== "ready") return;
        if (debugOrientation)
            lastOrientationEvent = {at: performance.now(), type: event.type, alpha, beta, gamma,
                absolute: event.absolute, webkitCompassHeading, webkitCompassAccuracy};
        if (document.hidden) {
            if (!hiddenDropLogged) {
                hiddenDropLogged = true;
                console.warn("cho2 orientation dropped because the page is hidden");
            }
            return;
        }
        if (!Number.isFinite(beta) || !Number.isFinite(gamma) || !Number.isFinite(alpha)) {
            sensorInvalid += 1;
            if (!nullAlphaLogged) {
                nullAlphaLogged = true;
                console.warn("cho2 orientation sample invalid");
            }
            logOrientation("invalid-sensor");
            return;
        }
        const now = performance.now();
        const compass = Number.isFinite(webkitCompassHeading) && webkitCompassHeading >= 0 &&
            !(Number.isFinite(webkitCompassAccuracy) && webkitCompassAccuracy < 0);
        const absolute = compass || event.absolute === true || event.type === "deviceorientationabsolute";
        if (absolute) sensorAbsolute += 1;
        else sensorRelative += 1;
        sensorSamples += 1;
        if (!sensorModeLogged) {
            sensorModeLogged = true;
            console.info("cho2 orientation sample", {
                mode: absolute ? "absolute" : "relative",
                type: event.type
            });
        }
        if (isIOS) {
            captureIOSPose(event, now, compass);
            return;
        }
        const angle = readScreenAngle();
        if (!absolute && now - absoluteAt < 1500) return;
        if (absolute) absoluteAt = now;
        // Pass the device's alpha, not a compass heading. Unity applies beta, gamma
        // and the screen angle together. iOS alpha is not north, so shift it until
        // the pose's heading matches webkitCompassHeading. A non-absolute sample is
        // only a relative rotation and is not treated as true north.
        let alphaForUnity = alpha;
        if (compass) {
            const device = deviceCompass(alpha, beta, gamma);
            if (device.magnitude > 0.25) {
                compassOffset = webkitCompassHeading - device.heading;
                compassOffsetReady = true;
            }
            if (compassOffsetReady)
                alphaForUnity = alpha - compassOffset;
        } else {
            compassOffsetReady = false;
        }
        const screenChanged = !lastSensor || angle !== lastSensor[3];
        lastSensor = [alphaForUnity, beta, gamma, angle, absolute ? 1 : 0];
        if (screenChanged || now - sentSensorAt >= 30) {
            sentSensorAt = now;
            publishSensor(lastSensor);
        }
        logOrientation("sensor");
    }

    function publishSensor(sample) {
        if (!instance) return;
        clearTimeout(sensorTimer);
        notice("sensor", "");
        if (!send("HandleCho2Orientation", sample.join(","))) return;
        sensorSent += 1;
        return true;
    }

    function diagnostics() {
        const track = stream && stream.getVideoTracks()[0];
        return {
            viewMode,
            cameraState,
            cameraTrack: track ? track.readyState : "none",
            cameraFrames,
            sensorListening,
            sensorSamples,
            sensorAbsolute,
            sensorRelative,
            sensorInvalid,
            sensorSent,
            ...(debugOrientation && {lastSensor: lastSensor?.join(",") ?? ""}),
            fullscreenElement: !!fullscreenElement(),
            fullscreenAttempts,
            lastFullscreenError,
            orientationLockResult,
            displayMode: displayMode(),
            graphics: graphicsSnapshot()
        };
    }

    function exit() {
        if (!window.confirm("체험을 종료하고 시작 화면으로 돌아가시겠습니까?")) return;
        wantCamera = false;
        stopCamera();
        window.location.reload();
    }

    window.Cho2WebGL = {mount, start, requestLocation, cameraSize, uploadCamera, exit, diagnostics, recordProjection};
})();
