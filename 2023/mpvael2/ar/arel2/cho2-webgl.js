(() => {
    "use strict";

    let view, instance, notices, fullscreen;
    let starting = false;
    let cameraRequest, stream, cameraDeadline, cameraTimer;
    let resumeCamera = false;
    let cameraRevision = 0;
    let lastTime = -1, lastTexture;
    let locationPending = false, locationAttempt = 0;
    let sensorListening = false, sensorRequest, lastSensor, sensorTimer;
    let absoluteAt = -Infinity, sentSensorAt = -Infinity;

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
        if (!instance) return;
        if (data === undefined) instance.SendMessage("LocationManager", method);
        else instance.SendMessage("LocationManager", method, data);
    }

    function mount(options) {
        view = options;
        document.documentElement.classList.add("cho2-webgl");
        document.querySelector('meta[name="viewport"]').content =
            "width=device-width, initial-scale=1, viewport-fit=cover";
        function updatePixelRatio() {
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            view.config.devicePixelRatio = ratio;
            if (instance) instance.Module.devicePixelRatio = ratio;
        }
        updatePixelRatio();
        window.addEventListener("resize", updatePixelRatio);

        notices = document.createElement("div");
        notices.className = "cho2-notices";
        notices.hidden = true;
        document.body.append(notices);

        fullscreen = document.createElement("button");
        fullscreen.type = "button";
        fullscreen.id = view.fullscreenButton.id;
        fullscreen.setAttribute("aria-label", "전체화면");
        fullscreen.title = "전체화면";
        fullscreen.style.display = "none";
        fullscreen.onclick = toggleFullscreen;
        view.fullscreenButton.replaceWith(fullscreen);
        document.addEventListener("fullscreenchange", updateFullscreenLabel);
        document.addEventListener("webkitfullscreenchange", updateFullscreenLabel);
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) suspend();
            else resume();
        });
        window.addEventListener("pagehide", suspend);
        window.addEventListener("pageshow", resume);
    }

    function fullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement;
    }

    function updateFullscreenLabel() {
        const label = fullscreenElement() ? "전체화면 종료" : "전체화면";
        fullscreen.setAttribute("aria-label", label);
        fullscreen.title = label;
    }

    async function toggleFullscreen() {
        try {
            const root = document.documentElement;
            if (fullscreenElement())
                await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            else
                await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
            notice("fullscreen", "");
        } catch {
            notice("fullscreen", "전체화면을 사용할 수 없습니다.", "닫기", () => notice("fullscreen", ""));
        }
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

    async function start() {
        if (starting || instance) return;
        starting = true;
        const intro = document.getElementById("startARDiv");
        const button = document.getElementById("startARButton");
        const introText = intro.querySelector("p");
        const loadStatus = document.createElement("p");
        loadStatus.setAttribute("role", "status");
        loadStatus.textContent = "콘텐츠를 불러오는 중…";
        view.progressBarEmpty.before(loadStatus);
        intro.style.display = "none";
        view.loadingCover.style.display = "";
        view.progressBarEmpty.style.display = "none";
        view.spinner.style.display = "";
        requestSensor();
        startCamera();
        try {
            await loader();
            instance = await window.createUnityInstance(view.canvas, view.config, progress => {
                const percentage = Math.round(100 * progress);
                loadStatus.textContent = "콘텐츠를 불러오는 중… " + percentage + "%";
                view.spinner.style.display = "none";
                view.progressBarEmpty.style.display = "";
                view.progressBarFull.style.width = percentage + "%";
            });
            window.dispatchEvent(new Event("resize"));
            if (document.fullscreenEnabled || document.webkitFullscreenEnabled)
                fullscreen.style.display = "";
            notices.hidden = false;
            if (lastSensor) publishSensor(lastSensor);
            scheduleSensorCheck();
            requestLocation();
        } catch (error) {
            console.error("Unity startup failed", error);
            resumeCamera = false;
            stopCamera();
            introText.textContent = "콘텐츠를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.";
            button.textContent = "다시 시도";
            button.onclick = () => window.location.reload();
            intro.style.display = "";
        } finally {
            view.loadingCover.style.display = "none";
            loadStatus.remove();
            starting = false;
        }
    }

    function cameraFailure(message) {
        resumeCamera = false;
        stopCamera();
        notice("camera", message, "카메라 재시도", startCamera);
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

    function cameraErrorMessage(error) {
        switch (error.name) {
            case "NotAllowedError":
            case "SecurityError":
                return "카메라 접근이 차단됐습니다. 브라우저의 사이트 권한을 확인해 주세요.";
            case "NotFoundError":
                return "사용할 수 있는 카메라가 없습니다. 카메라 없이 계속 이용할 수 있습니다.";
            default:
                return "카메라를 시작하지 못했습니다. 기기 연결이나 다른 앱의 카메라 사용을 확인해 주세요.";
        }
    }

    function startCamera() {
        if (cameraRequest || stream || document.hidden) return;
        if (!navigator.mediaDevices?.getUserMedia) {
            cameraFailure("카메라를 사용할 수 없습니다. HTTPS 연결 또는 브라우저 설정을 확인해 주세요.");
            return;
        }
        notice("camera", "");
        resumeCamera = true;
        cameraTimer = setTimeout(() => {
            if (cameraRequest && !stream && !document.hidden)
                notice("camera", "카메라 권한을 기다리는 중입니다. 브라우저의 권한 창을 확인해 주세요.");
        }, 8000);
        cameraRequest = openCamera(cameraRevision);
    }

    async function openCamera(revision) {

        try {
            const incoming = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {facingMode: {ideal: "environment"}, width: {ideal: 960}, height: {ideal: 540}, frameRate: {ideal: 24, max: 30}}
            });
            clearTimeout(cameraTimer);
            if (!resumeCamera || document.hidden || revision !== cameraRevision) {
                incoming.getTracks().forEach(track => track.stop());
                return;
            }
            stream = incoming;
            const track = incoming.getVideoTracks()[0];
            track.addEventListener("ended", () => {
                if (stream === incoming)
                    cameraFailure("카메라 연결이 끊겼습니다. 카메라를 다시 연결할 수 있습니다.");
            }, {once: true});
            video.srcObject = incoming;
            cameraDeadline = performance.now() + 8000;
            cameraTimer = setTimeout(() => {
                if (stream === incoming && video.readyState < 2)
                    cameraFailure("카메라 영상을 받지 못했습니다. 다시 시도해 주세요.");
            }, 8000);
            await video.play();
            if (stream === incoming) notice("camera", "");
        } catch (error) {
            if (revision === cameraRevision && resumeCamera && !document.hidden)
                cameraFailure(cameraErrorMessage(error));
        } finally {
            cameraRequest = undefined;
            if (revision !== cameraRevision && resumeCamera) startCamera();
        }
    }

    function cameraSize() {
        if (!stream || video.readyState < 2 || document.hidden) return 0;
        return (video.videoWidth << 16) | video.videoHeight;
    }

    function uploadCamera(gl, texture) {
        if (!texture || !cameraSize()) return;
        if (lastTexture === texture && lastTime === video.currentTime) {
            if (cameraDeadline && performance.now() > cameraDeadline)
                cameraFailure("카메라 영상이 멈췄습니다. 다시 연결해 주세요.");
            return;
        }
        cameraDeadline = performance.now() + 8000;
        const binding = gl.getParameter(gl.TEXTURE_BINDING_2D);
        const flipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
        try {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            // Some camera backends pad the video frame beyond its visible size.
            // Normalize the source before copying it into Unity's fixed-size texture.
            if (frame.width !== video.videoWidth || frame.height !== video.videoHeight) {
                frame.width = video.videoWidth;
                frame.height = video.videoHeight;
            }
            frameContext.drawImage(video, 0, 0, frame.width, frame.height);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, frame);
            lastTime = video.currentTime;
            lastTexture = texture;
        } catch {
            cameraFailure("카메라 영상을 표시하지 못했습니다. 다시 연결해 주세요.");
        } finally {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
            gl.bindTexture(gl.TEXTURE_2D, binding);
        }
    }

    function suspend() {
        cameraRevision++;
        send("HandleCho2SensorUnavailable");
        stopCamera();
        clearTimeout(sensorTimer);
        lastSensor = undefined;
        absoluteAt = -Infinity;
        sentSensorAt = -Infinity;
    }

    function resume() {
        if (document.hidden) return;
        if (resumeCamera) startCamera();
        if (instance) scheduleSensorCheck();
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
        notice("sensor", message, retry ? "센서 재시도" : "", retry ? requestSensor : null);
    }

    function scheduleSensorCheck() {
        clearTimeout(sensorTimer);
        if (sensorListening && !lastSensor)
            sensorTimer = setTimeout(() => sensorUnavailable("방향 센서 값을 받을 수 없습니다. 화면을 끌어 둘러보세요.", false), 3500);
    }

    function requestSensor() {
        if (sensorListening || sensorRequest) return;
        const orientation = window.DeviceOrientationEvent;
        if (!orientation || !window.isSecureContext) {
            sensorUnavailable("방향 센서를 사용할 수 없습니다. 화면을 끌어 둘러보세요.", false);
            return;
        }

        function listen() {
            sensorListening = true;
            window.addEventListener("deviceorientationabsolute", onOrientation);
            window.addEventListener("deviceorientation", onOrientation);
            scheduleSensorCheck();
        }

        if (typeof orientation.requestPermission !== "function") {
            listen();
            return;
        }
        // Call directly in the start/retry gesture, before the loader or camera Promise.
        try {
            sensorRequest = orientation.requestPermission().then(permission => {
                if (permission === "granted") listen();
                else sensorUnavailable("방향 센서 접근이 차단됐습니다. 화면을 끌어 둘러보세요.", true);
            }).catch(() => sensorUnavailable("방향 센서 권한을 확인하지 못했습니다. 화면을 끌어 둘러보세요.", true))
              .finally(() => { sensorRequest = undefined; });
        } catch {
            sensorUnavailable("방향 센서 권한을 확인하지 못했습니다. 화면을 끌어 둘러보세요.", true);
        }
    }

    function onOrientation(event) {
        const {alpha, beta, gamma, webkitCompassHeading, webkitCompassAccuracy} = event;
        if (document.hidden || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;
        const compass = Number.isFinite(webkitCompassHeading) && webkitCompassHeading >= 0 &&
            !(Number.isFinite(webkitCompassAccuracy) && webkitCompassAccuracy < 0);
        if (!compass && !Number.isFinite(alpha)) return;
        const absolute = compass || event.absolute || event.type === "deviceorientationabsolute";
        const now = performance.now();
        if (!absolute && now - absoluteAt < 1500) return;
        if (absolute) absoluteAt = now;
        const heading = compass ? webkitCompassHeading : -alpha;
        const angle = screen.orientation?.angle ?? window.orientation ?? 0;
        lastSensor = [heading, beta, gamma, angle, absolute ? 1 : 0];
        if (now - sentSensorAt >= 30) {
            sentSensorAt = now;
            publishSensor(lastSensor);
        }
    }

    function publishSensor(sample) {
        if (!instance) return;
        clearTimeout(sensorTimer);
        notice("sensor", "");
        send("HandleCho2Orientation", sample.join(","));
    }

    function exit() {
        if (!window.confirm("체험을 종료하고 시작 화면으로 돌아가시겠습니까?")) return;
        resumeCamera = false;
        stopCamera();
        window.location.reload();
    }

    window.Cho2WebGL = {mount, start, requestLocation, cameraSize, uploadCamera, exit};
})();
