const version = "v1.4.27";
document.getElementById("version").textContent = version;

const params = new URLSearchParams(window.location.search);
const collection = params.get("collection");

const viewer = document.getElementById("viewer");
const photo = document.getElementById("photo");
const fadeOverlay =
    document.getElementById("fadeOverlay");
const controls =
    document.getElementById("controls");
const toggleControls =
    document.getElementById("toggleControls");
const versionElement =
    document.getElementById("version");
const helpOverlay =
    document.getElementById("helpOverlay");
const modeToast =
    document.getElementById("modeToast");
const autoplayButton =
    document.getElementById("autoplayButton");
const autoplayStatus =
    document.getElementById("autoplayStatus");
const autoplayProgressBar =
    document.getElementById("autoplayProgressBar");
const autoplayDelayInput =
    document.getElementById("autoplayDelay");
const bottomZoomControls =
    document.getElementById("bottomZoomControls");
const bottomZoomIn =
    document.getElementById("bottomZoomIn");
const bottomZoomOut =
    document.getElementById("bottomZoomOut");
const zoomSlider =
    document.getElementById("zoomSlider");

let images = [];
let thumbnails = [];
let current = 0;
let displayedIndex = -1;

let zoomLevel = 1;
let panX = 0;
let panY = 0;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let startingPanX = 0;
let startingPanY = 0;

let controlsCollapsed = true;
let initialMediaControlsExpanded = false;

let transitionRunning = false;
let pendingImageIndex = null;

let autoplayActive = false;
let autoplayPlaying = false;
let autoplayTimer = null;
let autoplayDelaySeconds = 7;
let autoplayProgressFrame = null;
let autoplayProgressStart = null;

let modeToastTimer = null;
let modeToastFadeTimer = null;
let modeToastAnimationFrame = null;

const imageCache = new Map();

const minimumZoom = 1;
const maximumZoom = 4;
const zoomStep = 0.5;
const fadeDuration = 340;

fetch("collections.json")
    .then(response => {
        if (!response.ok) {
            throw new Error(
                `Unable to load collections.json: ${response.status}`
            );
        }

        return response.json();
    })
    .then(data => {
        const base = data.base;
        const collections = data.collections;

        if (!base || !Array.isArray(collections)) {
            throw new Error(
                "collections.json is not in the expected format"
            );
        }

        const selected = collections.find(
            item => item.name === collection
        );

        if (!selected) {
            document.getElementById("counter").textContent =
                "Collection not found";

            return;
        }

        const normalizedBase =
            base.endsWith("/") ? base : `${base}/`;

        for (let i = 1; i <= selected.images; i++) {
            images.push(
                `${normalizedBase}${selected.name}` +
                `/originals/${i}.jpg`
            );

            thumbnails.push(
                `${normalizedBase}${selected.name}` +
                `/thumbnails/${i}.jpg`
            );
        }

        createThumbnails();
        requestImageChange();
    })
    .catch(error => {
        document.getElementById("counter").textContent =
            "Error loading collection";

        console.error(error);
    });

function showModeToast(message) {
    window.clearTimeout(modeToastTimer);
    window.clearTimeout(modeToastFadeTimer);

    if (modeToastAnimationFrame !== null) {
        window.cancelAnimationFrame(
            modeToastAnimationFrame
        );

        modeToastAnimationFrame = null;
    }

    modeToast.classList.remove(
        "visible",
        "leaving"
    );

    modeToast.textContent =
        message === "Autoplay Mode" ? "Autoplay Start" : message;

    void modeToast.getBoundingClientRect();

    modeToastAnimationFrame =
        window.requestAnimationFrame(function () {
            modeToast.classList.add("visible");
            modeToastAnimationFrame = null;
        });

    modeToastTimer = window.setTimeout(
        function () {
            modeToast.classList.remove("visible");
            modeToast.classList.add("leaving");

            modeToastFadeTimer = window.setTimeout(
                function () {
                    modeToast.classList.remove("leaving");
                },
                500
            );
        },
        3900
    );
}

function expandMediaControlsAfterFirstImageLoad() {
    if (initialMediaControlsExpanded) {
        return;
    }

    initialMediaControlsExpanded = true;
    setMediaControlsCollapsed(false);
}

function waitForTwoFrames() {
    return new Promise(resolve => {
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(resolve);
        });
    });
}

function waitForOverlayTransition() {
    return new Promise(resolve => {
        let completed = false;

        function finish() {
            if (completed) {
                return;
            }

            completed = true;

            fadeOverlay.removeEventListener(
                "transitionend",
                handleTransitionEnd
            );

            resolve();
        }

        function handleTransitionEnd(event) {
            if (
                event.target === fadeOverlay &&
                event.propertyName === "opacity"
            ) {
                finish();
            }
        }

        fadeOverlay.addEventListener(
            "transitionend",
            handleTransitionEnd
        );

        window.setTimeout(
            finish,
            fadeDuration + 100
        );
    });
}

function getCachedImage(src, decodeImage) {
    let cacheEntry = imageCache.get(src);

    if (!cacheEntry) {
        const loader = new Image();

        loader.decoding = "async";

        const loadPromise = new Promise(
            (resolve, reject) => {
                loader.onload = function () {
                    resolve(loader);
                };

                loader.onerror = function () {
                    reject(
                        new Error(
                            `Unable to load image: ${src}`
                        )
                    );
                };

                loader.src = src;
            }
        );

        cacheEntry = {
            loader: loader,
            loadPromise: loadPromise
        };

        imageCache.set(src, cacheEntry);
    }

    return cacheEntry.loadPromise.then(
        async loadedImage => {
            if (
                decodeImage &&
                typeof loadedImage.decode === "function"
            ) {
                try {
                    await loadedImage.decode();
                } catch (error) {
                    /*
                    Continue because the image loaded.
                    */
                }
            }

            return loadedImage;
        }
    );
}

function waitForDisplayedPhoto() {
    return new Promise(resolve => {
        let completed = false;

        function finish() {
            if (completed) {
                return;
            }

            completed = true;

            photo.removeEventListener(
                "load",
                handleLoad
            );

            photo.removeEventListener(
                "error",
                handleError
            );

            resolve();
        }

        function handleLoad() {
            finish();
        }

        function handleError() {
            finish();
        }

        if (
            photo.complete &&
            photo.naturalWidth > 0
        ) {
            finish();
            return;
        }

        photo.addEventListener(
            "load",
            handleLoad
        );

        photo.addEventListener(
            "error",
            handleError
        );

        window.setTimeout(finish, 2000);
    }).then(async function () {
        if (typeof photo.decode === "function") {
            try {
                await photo.decode();
            } catch (error) {
                /*
                Continue if decoding rejects.
                */
            }
        }
    });
}

function preloadNearbyImages() {
    if (images.length < 2) {
        return;
    }

    const indexes = [
        (current - 1 + images.length) %
            images.length,
        (current + 1) % images.length
    ];

    indexes.forEach(index => {
        getCachedImage(
            images[index],
            false
        ).catch(function () {
            /*
            A later display request will report the error.
            */
        });
    });
}

async function transitionToImage(index) {
    const src = images[index];
    let loadedImage;

    try {
        loadedImage =
            await getCachedImage(src, true);
    } catch (error) {
        console.error(error);
        return;
    }

    const loadedSource =
        loadedImage.currentSrc ||
        loadedImage.src ||
        src;

    if (displayedIndex === -1) {
        photo.src = loadedSource;

        await waitForDisplayedPhoto();
        await waitForTwoFrames();

        photo.style.visibility = "visible";
        displayedIndex = index;

        expandMediaControlsAfterFirstImageLoad();

        return;
    }

    if (displayedIndex === index) {
        return;
    }

    fadeOverlay.classList.add("visible");

    await waitForOverlayTransition();
    await waitForTwoFrames();

    photo.style.visibility = "hidden";
    photo.src = loadedSource;

    await waitForDisplayedPhoto();
    await waitForTwoFrames();

    displayedIndex = index;
    photo.style.visibility = "visible";

    await waitForTwoFrames();

    fadeOverlay.classList.remove("visible");
    await waitForOverlayTransition();
}

async function processImageQueue() {
    if (transitionRunning) {
        return;
    }

    transitionRunning = true;

    try {
        while (pendingImageIndex !== null) {
            const targetIndex = pendingImageIndex;
            pendingImageIndex = null;

            await transitionToImage(targetIndex);
        }
    } finally {
        transitionRunning = false;

        if (autoplayPlaying) {
            scheduleAutoplay();
        }
    }
}

function requestImageChange() {
    if (images.length === 0) {
        return;
    }

    if (autoplayPlaying) {
        clearAutoplayTimer();
        stopProgressBar();
    }

    resetZoom();
    updateCounter();
    updateThumbnails();
    preloadNearbyImages();

    pendingImageIndex = current;
    processImageQueue();
}

function createThumbnails() {
    const container =
        document.getElementById("thumbnails");

    container.innerHTML = "";

    thumbnails.forEach((src, index) => {
        const thumbnail =
            document.createElement("img");

        thumbnail.src = src;
        thumbnail.loading = "lazy";
        thumbnail.decoding = "async";
        thumbnail.className = "thumb";
        thumbnail.alt = `Photo ${index + 1}`;

        thumbnail.addEventListener(
            "click",
            function () {
                current = index;
                requestImageChange();
            }
        );

        container.appendChild(thumbnail);
    });
}

function updateThumbnails() {
    const thumbnailElements =
        document.querySelectorAll(".thumb");

    thumbnailElements.forEach(
        (thumbnail, index) => {
            if (index === current) {
                thumbnail.classList.add("active");

                thumbnail.scrollIntoView({
                    behavior: "auto",
                    inline: "center",
                    block: "nearest"
                });
            } else {
                thumbnail.classList.remove("active");
            }
        }
    );
}

function updateCounter() {
    document.getElementById("counter").textContent =
        `${current + 1} / ${images.length}`;
}

function nextImage() {
    if (images.length === 0) {
        return;
    }

    current =
        (current + 1) % images.length;

    requestImageChange();
}

function previousImage() {
    if (images.length === 0) {
        return;
    }

    current =
        (current - 1 + images.length) %
        images.length;

    requestImageChange();
}

function clearAutoplayTimer() {
    if (autoplayTimer !== null) {
        window.clearTimeout(autoplayTimer);
        autoplayTimer = null;
    }
}

function stopProgressBar() {
    if (autoplayProgressFrame !== null) {
        window.cancelAnimationFrame(
            autoplayProgressFrame
        );

        autoplayProgressFrame = null;
    }
}

function resetProgressBar() {
    stopProgressBar();

    autoplayProgressStart = null;
    autoplayProgressBar.style.width = "0%";
}

function animateProgressBar(timestamp) {
    if (!autoplayPlaying) {
        return;
    }

    if (autoplayProgressStart === null) {
        autoplayProgressStart = timestamp;
    }

    const elapsed =
        timestamp - autoplayProgressStart;

    const duration =
        autoplayDelaySeconds * 1000;

    const progress =
        Math.min(1, elapsed / duration);

    autoplayProgressBar.style.width =
        `${progress * 100}%`;

    if (progress < 1) {
        autoplayProgressFrame =
            window.requestAnimationFrame(
                animateProgressBar
            );
    }
}

function startProgressBar() {
    resetProgressBar();

    autoplayProgressFrame =
        window.requestAnimationFrame(
            animateProgressBar
        );
}

function scheduleAutoplay() {
    clearAutoplayTimer();

    if (
        !autoplayPlaying ||
        images.length < 2 ||
        transitionRunning
    ) {
        return;
    }

    startProgressBar();

    autoplayTimer = window.setTimeout(
        function () {
            autoplayTimer = null;
            resetProgressBar();

            if (!autoplayPlaying) {
                return;
            }

            current =
                (current + 1) %
                images.length;

            requestImageChange();
        },
        autoplayDelaySeconds * 1000
    );
}

function updateAutoplayDisplay() {
    if (autoplayActive) {
        document.body.classList.add(
            "autoplay-active"
        );

        autoplayStatus.textContent =
            autoplayPlaying
                ? "playing"
                : "paused";
    } else {
        document.body.classList.remove(
            "autoplay-active"
        );

        autoplayStatus.textContent = "";
    }

    autoplayButton.setAttribute(
        "aria-label",
        autoplayPlaying
            ? "Pause autoplay"
            : "Play autoplay"
    );
}

async function startAutoplay() {
    if (images.length === 0) {
        return;
    }

    autoplayActive = true;
    autoplayPlaying = true;

    updateAutoplayDisplay();

    if (
        !document.body.classList.contains(
            "ui-hidden"
        )
    ) {
        await enterHideMode("Autoplay Mode");
    } else {
        showModeToast("Autoplay Mode");
    }

    if (!transitionRunning) {
        scheduleAutoplay();
    }
}

function pauseAutoplay() {
    if (!autoplayActive) {
        return;
    }

    autoplayPlaying = false;

    clearAutoplayTimer();
    stopProgressBar();
    updateAutoplayDisplay();
    showModeToast("Autoplay Paused");
}

async function resumeAutoplay() {
    if (images.length === 0) {
        return;
    }

    autoplayActive = true;
    autoplayPlaying = true;

    updateAutoplayDisplay();

    if (
        !document.body.classList.contains(
            "ui-hidden"
        )
    ) {
        await enterHideMode("Autoplay Mode");
    } else {
        showModeToast("Autoplay Mode");
    }

    if (!transitionRunning) {
        scheduleAutoplay();
    }
}

function stopAutoplay() {
    autoplayActive = false;
    autoplayPlaying = false;

    clearAutoplayTimer();
    resetProgressBar();
    updateAutoplayDisplay();
}

async function toggleAutoplay() {
    if (!autoplayActive) {
        await startAutoplay();
        return;
    }

    if (autoplayPlaying) {
        pauseAutoplay();
    } else {
        await resumeAutoplay();
    }
}

function updateAutoplayDelay() {
    const newDelay =
        Number(autoplayDelayInput.value);

    if (
        Number.isFinite(newDelay) &&
        newDelay >= 2 &&
        newDelay <= 60
    ) {
        autoplayDelaySeconds = newDelay;

        if (
            autoplayPlaying &&
            !transitionRunning
        ) {
            scheduleAutoplay();
        }
    }
}

function validateAutoplayDelay() {
    let newDelay =
        Number(autoplayDelayInput.value);

    if (!Number.isFinite(newDelay)) {
        newDelay = 7;
    }

    newDelay =
        Math.min(60, Math.max(2, newDelay));

    autoplayDelaySeconds = newDelay;
    autoplayDelayInput.value =
        String(newDelay);

    if (
        autoplayPlaying &&
        !transitionRunning
    ) {
        scheduleAutoplay();
    }
}

function updateZoom() {
    if (
        zoomLevel === minimumZoom &&
        panX === 0 &&
        panY === 0
    ) {
        photo.style.transform = "none";
    } else {
        photo.style.transform =
            `translate(${panX}px, ${panY}px) ` +
            `scale(${zoomLevel})`;
    }

    const isZoomed =
        zoomLevel > minimumZoom;

    viewer.classList.toggle(
        "zoomed",
        isZoomed
    );

    bottomZoomControls.classList.toggle(
        "visible",
        isZoomed
    );

    zoomSlider.value =
        String(zoomLevel);

    bottomZoomOut.disabled =
        zoomLevel <= minimumZoom;

    bottomZoomIn.disabled =
        zoomLevel >= maximumZoom;
}

function zoomIn() {
    zoomLevel = Math.min(
        maximumZoom,
        zoomLevel + zoomStep
    );

    updateZoom();
}

function zoomOut() {
    zoomLevel = Math.max(
        minimumZoom,
        zoomLevel - zoomStep
    );

    if (zoomLevel === minimumZoom) {
        panX = 0;
        panY = 0;
    }

    updateZoom();
}

function resetZoom() {
    zoomLevel = minimumZoom;
    panX = 0;
    panY = 0;
    isDragging = false;

    viewer.classList.remove("dragging");

    updateZoom();
}

function doubleClickZoom(event) {
    if (zoomLevel > minimumZoom) {
        resetZoom();
        return;
    }

    const viewerRect =
        viewer.getBoundingClientRect();

    const viewerCenterX =
        viewerRect.left +
        viewerRect.width / 2;

    const viewerCenterY =
        viewerRect.top +
        viewerRect.height / 2;

    const clickOffsetX =
        event.clientX - viewerCenterX;

    const clickOffsetY =
        event.clientY - viewerCenterY;

    zoomLevel = Math.min(
        maximumZoom,
        minimumZoom + zoomStep * 3
    );

    panX =
        -clickOffsetX *
        (zoomLevel - minimumZoom);

    panY =
        -clickOffsetY *
        (zoomLevel - minimumZoom);

    updateZoom();
    showModeToast("Zoom Mode");
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement
            .requestFullscreen()
            .then(function () {
                showModeToast(
                    "Full Screen Mode"
                );
            })
            .catch(error => {
                console.error(
                    "Unable to enter fullscreen:",
                    error
                );
            });
    } else {
        document.exitFullscreen();
    }
}

function updateToggleButtonState() {
    toggleControls.classList.toggle(
        "expanded",
        !controlsCollapsed
    );
}

function setMediaControlsCollapsed(collapsed) {
    controlsCollapsed = collapsed;

    controls.classList.toggle(
        "collapsed",
        controlsCollapsed
    );

    versionElement.classList.toggle(
        "collapsed",
        controlsCollapsed
    );

    updateToggleButtonState();
}

function toggleMediaControls() {
    setMediaControlsCollapsed(
        !controlsCollapsed
    );
}

function showHelp() {
    helpOverlay.classList.add("visible");

    helpOverlay.setAttribute(
        "aria-hidden",
        "false"
    );
}

function hideHelp() {
    helpOverlay.classList.remove("visible");

    helpOverlay.setAttribute(
        "aria-hidden",
        "true"
    );
}

function toggleHelp() {
    if (
        helpOverlay.classList.contains(
            "visible"
        )
    ) {
        hideHelp();
    } else {
        showHelp();
        showModeToast("Help Mode");
    }
}

function showUI() {
    document.body.classList.remove(
        "ui-hidden"
    );

    controls.classList.toggle(
        "collapsed",
        controlsCollapsed
    );

    versionElement.classList.toggle(
        "collapsed",
        controlsCollapsed
    );

    updateToggleButtonState();
}

async function enterHideMode(
    toastMessage = "Hide Mode"
) {
    hideHelp();

    if (!document.fullscreenElement) {
        try {
            await document.documentElement
                .requestFullscreen();
        } catch (error) {
            console.error(
                "Unable to enter fullscreen:",
                error
            );
        }
    }

    document.body.classList.add(
        "ui-hidden"
    );

    showModeToast(toastMessage);
}

function exitHideMode() {
    stopAutoplay();
    showUI();
}

function toggleUI() {
    if (
        document.body.classList.contains(
            "ui-hidden"
        )
    ) {
        exitHideMode();
    } else {
        stopAutoplay();
        enterHideMode("Hide Mode");
    }
}

bottomZoomIn.addEventListener(
    "click",
    zoomIn
);

bottomZoomOut.addEventListener(
    "click",
    zoomOut
);

zoomSlider.addEventListener(
    "input",
    function () {
        zoomLevel = Number(zoomSlider.value);

        if (zoomLevel <= minimumZoom) {
            zoomLevel = minimumZoom;
            panX = 0;
            panY = 0;
        }

        updateZoom();
    }
);

bottomZoomControls.addEventListener(
    "mousedown",
    function (event) {
        event.stopPropagation();
    }
);

bottomZoomControls.addEventListener(
    "dblclick",
    function (event) {
        event.stopPropagation();
    }
);

document
    .getElementById("zoomIn")
    .addEventListener(
        "click",
        function () {
            zoomIn();
            showModeToast("Zoom Mode");
        }
    );

document
    .getElementById("zoomOut")
    .addEventListener("click", zoomOut);

document
    .getElementById("fullscreen")
    .addEventListener(
        "click",
        toggleFullscreen
    );

document
    .getElementById("hideUI")
    .addEventListener("click", toggleUI);

autoplayButton.addEventListener(
    "click",
    toggleAutoplay
);

autoplayDelayInput.addEventListener(
    "input",
    updateAutoplayDelay
);

autoplayDelayInput.addEventListener(
    "change",
    validateAutoplayDelay
);

document
    .getElementById("helpButton")
    .addEventListener("click", toggleHelp);

document
    .getElementById("closeHelp")
    .addEventListener("click", hideHelp);

toggleControls.addEventListener(
    "click",
    toggleMediaControls
);

helpOverlay.addEventListener(
    "click",
    function (event) {
        if (event.target === helpOverlay) {
            hideHelp();
        }
    }
);

viewer.addEventListener(
    "dblclick",
    function (event) {
        event.preventDefault();
        doubleClickZoom(event);
    }
);

viewer.addEventListener(
    "mousedown",
    function (event) {
        if (zoomLevel <= minimumZoom) {
            return;
        }

        event.preventDefault();

        isDragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        startingPanX = panX;
        startingPanY = panY;

        viewer.classList.add("dragging");
    }
);

document.addEventListener(
    "mousemove",
    function (event) {
        if (!isDragging) {
            return;
        }

        panX =
            startingPanX +
            event.clientX -
            dragStartX;

        panY =
            startingPanY +
            event.clientY -
            dragStartY;

        updateZoom();
    }
);

document.addEventListener(
    "mouseup",
    function () {
        isDragging = false;
        viewer.classList.remove("dragging");
    }
);

document.addEventListener(
    "fullscreenchange",
    function () {
        if (!document.fullscreenElement) {
            stopAutoplay();
            showUI();
        }
    }
);

document.addEventListener(
    "keydown",
    function (event) {
        if (event.repeat) {
            return;
        }

        const key = event.key.toLowerCase();

        if (key === "escape") {
            hideHelp();
            stopAutoplay();
            showUI();

            if (document.fullscreenElement) {
                document.exitFullscreen();
            }

            return;
        }

        if (
            helpOverlay.classList.contains(
                "visible"
            )
        ) {
            return;
        }

        if (
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
        ) {
            return;
        }

        if (key === "arrowright") {
            nextImage();
        }

        if (key === "arrowleft") {
            previousImage();
        }

        if (
            key === "+" ||
            key === "="
        ) {
            zoomIn();
            showModeToast("Zoom Mode");
        }

        if (
            key === "-" ||
            key === "_"
        ) {
            zoomOut();
        }

        if (key === "f") {
            toggleFullscreen();
        }

        if (key === "h") {
            toggleUI();
        }

        if (key === "p") {
            toggleAutoplay();
        }

        if (key === "c") {
            toggleMediaControls();
        }
    }
);

updateToggleButtonState();
