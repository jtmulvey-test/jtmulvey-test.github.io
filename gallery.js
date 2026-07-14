const version = "v1.5.9";
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
const previousImageButton =
    document.getElementById("previousImageButton");
const nextImageButton =
    document.getElementById("nextImageButton");
const loadingIndicator =
    document.getElementById("loadingIndicator");
const filmstripButton =
    document.getElementById("filmstripButton");
const thumbnailsContainer =
    document.getElementById("thumbnails");
const thumbnailBar =
    document.getElementById("thumbnailBar");
const mosaicOverlay =
    document.getElementById("mosaicOverlay");
const mosaicPanel =
    document.getElementById("mosaicPanel");
const mosaicGrid =
    document.getElementById("mosaicGrid");
const controlArea =
    document.getElementById("controlArea");
const helpPanel =
    document.getElementById("helpPanel");

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
let zoomControlsHideTimer = null;
let loadingIndicatorTimer = null;
let idleInterfaceTimer = null;
let filmstripExpanded = false;
let mosaicBuildToken = 0;
let mosaicResizeTimer = null;
let thumbnailAspectPromise = null;
let mosaicSelectionRunning = false;

const imageCache = new Map();
const mosaicLayoutCache = new Map();

const minimumZoom = 1;
const maximumZoom = 5;
const zoomStep = 0.5;
const fadeDuration = 340;
const zoomControlsHideDelay = 650;
const loadingIndicatorDelay = 2000;
const interfaceIdleDelay = 4680;
const autoplayDelayStorageKey =
    "jmPhotographyAutoplayDelay";

function loadStoredAutoplayDelay() {
    try {
        const storedDelay = Number(
            window.localStorage.getItem(
                autoplayDelayStorageKey
            )
        );

        if (
            Number.isFinite(storedDelay) &&
            storedDelay >= 2 &&
            storedDelay <= 60
        ) {
            autoplayDelaySeconds = storedDelay;
            autoplayDelayInput.value =
                String(storedDelay);
        }
    } catch (error) {
        /* Continue with the default delay. */
    }
}

function saveAutoplayDelay() {
    try {
        window.localStorage.setItem(
            autoplayDelayStorageKey,
            String(autoplayDelaySeconds)
        );
    } catch (error) {
        /* The gallery still works without storage. */
    }
}

loadStoredAutoplayDelay();

fetch("data/collections.json")
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

function showLoadingIndicator() {
    window.clearTimeout(loadingIndicatorTimer);

    loadingIndicatorTimer = window.setTimeout(
        function () {
            viewer.classList.add("loading");
            loadingIndicator.classList.add("visible");
        },
        loadingIndicatorDelay
    );
}

function hideLoadingIndicator() {
    window.clearTimeout(loadingIndicatorTimer);
    loadingIndicator.classList.remove("visible");
    viewer.classList.remove("loading");
}

async function transitionToImage(index) {
    const src = images[index];
    let loadedImage;

    showLoadingIndicator();

    try {
        loadedImage =
            await getCachedImage(src, true);
    } catch (error) {
        hideLoadingIndicator();
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

        hideLoadingIndicator();
        expandMediaControlsAfterFirstImageLoad();

        return;
    }

    if (displayedIndex === index) {
        hideLoadingIndicator();
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
    hideLoadingIndicator();
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

    document
        .querySelectorAll(".mosaic-item")
        .forEach(tile => {
            tile.classList.toggle(
                "active",
                Number(tile.dataset.imageIndex) === current
            );
        });
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
        saveAutoplayDelay();

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
    saveAutoplayDelay();

    if (
        autoplayPlaying &&
        !transitionRunning
    ) {
        scheduleAutoplay();
    }
}

function updateBottomZoomControls(isZoomed) {
    window.clearTimeout(zoomControlsHideTimer);

    if (isZoomed) {
        bottomZoomControls.classList.add("visible");
        return;
    }

    zoomControlsHideTimer = window.setTimeout(
        function () {
            bottomZoomControls.classList.remove("visible");
        },
        zoomControlsHideDelay
    );
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

    updateBottomZoomControls(isZoomed);

    zoomSlider.value =
        String(zoomLevel);

    bottomZoomOut.disabled =
        zoomLevel <= minimumZoom;

    bottomZoomIn.disabled =
        zoomLevel >= maximumZoom;
}

function setZoomAroundPoint(
    requestedZoom,
    anchorX = 0,
    anchorY = 0
) {
    const newZoom = Math.min(
        maximumZoom,
        Math.max(minimumZoom, requestedZoom)
    );

    if (newZoom === zoomLevel) {
        return;
    }

    const zoomRatio =
        newZoom / zoomLevel;

    panX =
        anchorX -
        (anchorX - panX) * zoomRatio;

    panY =
        anchorY -
        (anchorY - panY) * zoomRatio;

    zoomLevel = newZoom;

    if (zoomLevel === minimumZoom) {
        panX = 0;
        panY = 0;
    }

    updateZoom();
}

function getZoomAnchor(clientX, clientY) {
    const stageRect =
        document
            .getElementById("photoStage")
            .getBoundingClientRect();

    return {
        x:
            clientX -
            (stageRect.left + stageRect.width / 2),
        y:
            clientY -
            (stageRect.top + stageRect.height / 2)
    };
}

function zoomIn() {
    setZoomAroundPoint(
        zoomLevel + zoomStep,
        0,
        0
    );
}

function zoomOut() {
    setZoomAroundPoint(
        zoomLevel - zoomStep,
        0,
        0
    );
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

function clamp(value, minimum, maximum) {
    return Math.min(
        maximum,
        Math.max(minimum, value)
    );
}

function hashText(text) {
    let hash = 2166136261;

    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function createSeededRandom(seed) {
    let state = seed >>> 0;

    return function () {
        state += 0x6D2B79F5;

        let value = state;

        value = Math.imul(
            value ^ (value >>> 15),
            value | 1
        );

        value ^= value +
            Math.imul(
                value ^ (value >>> 7),
                value | 61
            );

        return (
            (value ^ (value >>> 14)) >>> 0
        ) / 4294967296;
    };
}

function shuffleWithRandom(values, random) {
    const shuffled = [...values];

    for (
        let i = shuffled.length - 1;
        i > 0;
        i--
    ) {
        const randomIndex =
            Math.floor(random() * (i + 1));

        [
            shuffled[i],
            shuffled[randomIndex]
        ] = [
            shuffled[randomIndex],
            shuffled[i]
        ];
    }

    return shuffled;
}

function loadThumbnailAspectRatio(
    source,
    imageIndex
) {
    const existingThumbnail =
        thumbnailsContainer.children[imageIndex];

    if (
        existingThumbnail &&
        existingThumbnail.complete &&
        existingThumbnail.naturalWidth > 0 &&
        existingThumbnail.naturalHeight > 0
    ) {
        return Promise.resolve(
            clamp(
                existingThumbnail.naturalWidth /
                existingThumbnail.naturalHeight,
                0.38,
                2.8
            )
        );
    }

    return new Promise(resolve => {
        const image = new Image();
        let finished = false;

        function finish(ratio) {
            if (finished) {
                return;
            }

            finished = true;

            window.clearTimeout(timeout);

            resolve(
                clamp(ratio, 0.38, 2.8)
            );
        }

        const timeout = window.setTimeout(
            function () {
                finish(4 / 3);
            },
            2400
        );

        image.onload = function () {
            if (
                image.naturalWidth > 0 &&
                image.naturalHeight > 0
            ) {
                finish(
                    image.naturalWidth /
                    image.naturalHeight
                );
            } else {
                finish(4 / 3);
            }
        };

        image.onerror = function () {
            finish(4 / 3);
        };

        image.src = source;
    });
}

function getThumbnailAspectRatios() {
    if (
        thumbnailAspectPromise === null
    ) {
        thumbnailAspectPromise =
            Promise.all(
                thumbnails.map(
                    loadThumbnailAspectRatio
                )
            );
    }

    return thumbnailAspectPromise;
}

function rectangleOverlapArea(first, second) {
    const overlapWidth =
        Math.max(
            0,
            Math.min(
                first.x + first.width,
                second.x + second.width
            ) -
            Math.max(first.x, second.x)
        );

    const overlapHeight =
        Math.max(
            0,
            Math.min(
                first.y + first.height,
                second.y + second.height
            ) -
            Math.max(first.y, second.y)
        );

    return overlapWidth * overlapHeight;
}

function rectangleGap(first, second) {
    const horizontalGap =
        Math.max(
            0,
            Math.max(
                first.x,
                second.x
            ) -
            Math.min(
                first.x + first.width,
                second.x + second.width
            )
        );

    const verticalGap =
        Math.max(
            0,
            Math.max(
                first.y,
                second.y
            ) -
            Math.min(
                first.y + first.height,
                second.y + second.height
            )
        );

    return Math.hypot(
        horizontalGap,
        verticalGap
    );
}

function createMosaicTileSizes(
    aspectRatios,
    canvasWidth,
    canvasHeight,
    random
) {
    const imageCount =
        aspectRatios.length;

    const densityReduction =
        Math.max(0, imageCount - 10) * 0.009;

    const coverageTarget =
        clamp(
            0.57 -
            densityReduction +
            (random() - 0.5) * 0.08,
            0.39,
            0.61
        );

    const baseArea =
        canvasWidth *
        canvasHeight *
        coverageTarget /
        imageCount;

    return aspectRatios.map(
        (aspectRatio, imageIndex) => {
            const prominence =
                0.70 +
                random() * 0.72;

            let area =
                baseArea * prominence;

            let width =
                Math.sqrt(
                    area * aspectRatio
                );

            let height =
                width / aspectRatio;

            const maximumWidth =
                canvasWidth *
                (
                    imageCount <= 10
                        ? 0.42
                        : 0.32
                );

            const maximumHeight =
                canvasHeight *
                (
                    imageCount <= 10
                        ? 0.49
                        : 0.38
                );

            const maximumScale =
                Math.min(
                    1,
                    maximumWidth / width,
                    maximumHeight / height
                );

            width *= maximumScale;
            height *= maximumScale;

            const minimumLongSide =
                Math.min(
                    canvasWidth,
                    canvasHeight
                ) *
                (
                    imageCount <= 10
                        ? 0.19
                        : 0.13
                );

            const currentLongSide =
                Math.max(width, height);

            if (
                currentLongSide <
                minimumLongSide
            ) {
                const scale =
                    minimumLongSide /
                    currentLongSide;

                width *= scale;
                height *= scale;
            }

            area = width * height;

            return {
                imageIndex: imageIndex,
                aspectRatio: aspectRatio,
                width: width,
                height: height,
                area: area,
                rotation:
                    (random() - 0.5) * 1.2
            };
        }
    );
}

function scoreMosaicPlacement(
    candidate,
    placedTiles,
    canvasWidth,
    canvasHeight
) {
    const candidateCenterX =
        candidate.x +
        candidate.width / 2;

    const candidateCenterY =
        candidate.y +
        candidate.height / 2;

    const canvasCenterX =
        canvasWidth / 2;

    const canvasCenterY =
        canvasHeight / 2;

    const normalizedCenterDistance =
        Math.hypot(
            candidateCenterX - canvasCenterX,
            candidateCenterY - canvasCenterY
        ) /
        Math.hypot(
            canvasCenterX,
            canvasCenterY
        );

    let score =
        normalizedCenterDistance * 22;

    let nearestGap = Infinity;

    placedTiles.forEach(tile => {
        const overlapArea =
            rectangleOverlapArea(
                candidate,
                tile
            );

        if (overlapArea > 0) {
            const smallerArea =
                Math.min(
                    candidate.width *
                    candidate.height,
                    tile.width *
                    tile.height
                );

            score +=
                overlapArea /
                Math.max(1, smallerArea) *
                24000;
        }

        const gap =
            rectangleGap(
                candidate,
                tile
            );

        nearestGap =
            Math.min(nearestGap, gap);

        if (
            overlapArea === 0 &&
            gap < 12
        ) {
            score +=
                Math.pow(12 - gap, 2) *
                2.2;
        }

        const tileCenterX =
            tile.x + tile.width / 2;

        const tileCenterY =
            tile.y + tile.height / 2;

        const horizontalAlignments = [
            Math.abs(
                candidate.x - tile.x
            ),
            Math.abs(
                candidate.x +
                candidate.width -
                tile.x -
                tile.width
            ),
            Math.abs(
                candidateCenterX -
                tileCenterX
            )
        ];

        const verticalAlignments = [
            Math.abs(
                candidate.y - tile.y
            ),
            Math.abs(
                candidate.y +
                candidate.height -
                tile.y -
                tile.height
            ),
            Math.abs(
                candidateCenterY -
                tileCenterY
            )
        ];

        horizontalAlignments.forEach(
            distance => {
                if (distance < 6) {
                    score +=
                        (6 - distance) * 3.5;
                }
            }
        );

        verticalAlignments.forEach(
            distance => {
                if (distance < 6) {
                    score +=
                        (6 - distance) * 3.5;
                }
            }
        );
    });

    if (
        placedTiles.length > 0 &&
        nearestGap > 95
    ) {
        score +=
            Math.pow(
                nearestGap - 95,
                2
            ) * 0.09;
    }

    const edgeClearance = Math.min(
        candidate.x,
        candidate.y,
        canvasWidth -
            candidate.x -
            candidate.width,
        canvasHeight -
            candidate.y -
            candidate.height
    );

    if (edgeClearance < 4) {
        score +=
            Math.pow(
                4 - edgeClearance,
                2
            ) * 4;
    }

    return score;
}

function findBestMosaicPosition(
    tile,
    placedTiles,
    canvasWidth,
    canvasHeight,
    random
) {
    if (placedTiles.length === 0) {
        return {
            x:
                canvasWidth / 2 -
                tile.width / 2 +
                (random() - 0.5) *
                canvasWidth * 0.08,
            y:
                canvasHeight / 2 -
                tile.height / 2 +
                (random() - 0.5) *
                canvasHeight * 0.08
        };
    }

    let bestPosition = null;
    let bestScore = Infinity;

    const sampleCount =
        Math.min(
            120,
            58 + placedTiles.length * 4
        );

    for (
        let sample = 0;
        sample < sampleCount;
        sample++
    ) {
        let x;
        let y;

        if (random() < 0.64) {
            const anchor =
                placedTiles[
                    Math.floor(
                        random() *
                        placedTiles.length
                    )
                ];

            const gap =
                10 + random() * 36;

            const side =
                Math.floor(random() * 4);

            if (side === 0) {
                x =
                    anchor.x -
                    tile.width -
                    gap;

                y =
                    anchor.y +
                    (random() - 0.5) *
                    (
                        anchor.height +
                        tile.height
                    ) *
                    0.72;
            } else if (side === 1) {
                x =
                    anchor.x +
                    anchor.width +
                    gap;

                y =
                    anchor.y +
                    (random() - 0.5) *
                    (
                        anchor.height +
                        tile.height
                    ) *
                    0.72;
            } else if (side === 2) {
                x =
                    anchor.x +
                    (random() - 0.5) *
                    (
                        anchor.width +
                        tile.width
                    ) *
                    0.72;

                y =
                    anchor.y -
                    tile.height -
                    gap;
            } else {
                x =
                    anchor.x +
                    (random() - 0.5) *
                    (
                        anchor.width +
                        tile.width
                    ) *
                    0.72;

                y =
                    anchor.y +
                    anchor.height +
                    gap;
            }
        } else {
            const angle =
                random() * Math.PI * 2;

            const radius =
                Math.pow(
                    random(),
                    0.72
                ) *
                Math.min(
                    canvasWidth,
                    canvasHeight
                ) *
                0.47;

            x =
                canvasWidth / 2 +
                Math.cos(angle) * radius -
                tile.width / 2;

            y =
                canvasHeight / 2 +
                Math.sin(angle) * radius -
                tile.height / 2;
        }

        x = clamp(
            x,
            0,
            canvasWidth - tile.width
        );

        y = clamp(
            y,
            0,
            canvasHeight - tile.height
        );

        const candidate = {
            ...tile,
            x: x,
            y: y
        };

        const score =
            scoreMosaicPlacement(
                candidate,
                placedTiles,
                canvasWidth,
                canvasHeight
            ) +
            random() * 0.001;

        if (score < bestScore) {
            bestScore = score;
            bestPosition = {
                x: x,
                y: y
            };
        }
    }

    return bestPosition;
}

function fitAndCenterMosaicLayout(
    tiles,
    canvasWidth,
    canvasHeight
) {
    let minimumX = Infinity;
    let minimumY = Infinity;
    let maximumX = -Infinity;
    let maximumY = -Infinity;

    tiles.forEach(tile => {
        minimumX =
            Math.min(minimumX, tile.x);

        minimumY =
            Math.min(minimumY, tile.y);

        maximumX =
            Math.max(
                maximumX,
                tile.x + tile.width
            );

        maximumY =
            Math.max(
                maximumY,
                tile.y + tile.height
            );
    });

    const boundsWidth =
        maximumX - minimumX;

    const boundsHeight =
        maximumY - minimumY;

    const scale =
        Math.min(
            1,
            canvasWidth * 0.96 /
                Math.max(1, boundsWidth),
            canvasHeight * 0.96 /
                Math.max(1, boundsHeight)
        );

    tiles.forEach(tile => {
        tile.x =
            (tile.x - minimumX) *
            scale;

        tile.y =
            (tile.y - minimumY) *
            scale;

        tile.width *= scale;
        tile.height *= scale;
        tile.area =
            tile.width * tile.height;
    });

    const scaledWidth =
        boundsWidth * scale;

    const scaledHeight =
        boundsHeight * scale;

    const boundingOffsetX =
        (canvasWidth - scaledWidth) / 2;

    const boundingOffsetY =
        (canvasHeight - scaledHeight) / 2;

    tiles.forEach(tile => {
        tile.x += boundingOffsetX;
        tile.y += boundingOffsetY;
    });

    let weightedX = 0;
    let weightedY = 0;
    let totalArea = 0;

    tiles.forEach(tile => {
        weightedX +=
            (
                tile.x +
                tile.width / 2
            ) * tile.area;

        weightedY +=
            (
                tile.y +
                tile.height / 2
            ) * tile.area;

        totalArea += tile.area;
    });

    if (totalArea > 0) {
        const massCenterX =
            weightedX / totalArea;

        const massCenterY =
            weightedY / totalArea;

        let shiftX =
            canvasWidth / 2 -
            massCenterX;

        let shiftY =
            canvasHeight / 2 -
            massCenterY;

        const minimumTileX =
            Math.min(
                ...tiles.map(tile => tile.x)
            );

        const maximumTileX =
            Math.max(
                ...tiles.map(
                    tile =>
                        tile.x + tile.width
                )
            );

        const minimumTileY =
            Math.min(
                ...tiles.map(tile => tile.y)
            );

        const maximumTileY =
            Math.max(
                ...tiles.map(
                    tile =>
                        tile.y + tile.height
                )
            );

        shiftX = clamp(
            shiftX,
            -minimumTileX,
            canvasWidth - maximumTileX
        );

        shiftY = clamp(
            shiftY,
            -minimumTileY,
            canvasHeight - maximumTileY
        );

        tiles.forEach(tile => {
            tile.x += shiftX;
            tile.y += shiftY;
        });
    }

    return tiles;
}

function scoreMosaicLayout(
    tiles,
    canvasWidth,
    canvasHeight
) {
    const canvasArea =
        canvasWidth * canvasHeight;

    let totalImageArea = 0;
    let overlapArea = 0;
    let weightedX = 0;
    let weightedY = 0;
    let nearestGapPenalty = 0;
    let alignmentPenalty = 0;

    let minimumX = Infinity;
    let minimumY = Infinity;
    let maximumX = -Infinity;
    let maximumY = -Infinity;

    tiles.forEach((tile, index) => {
        const tileArea =
            tile.width * tile.height;

        totalImageArea += tileArea;

        weightedX +=
            (
                tile.x +
                tile.width / 2
            ) * tileArea;

        weightedY +=
            (
                tile.y +
                tile.height / 2
            ) * tileArea;

        minimumX =
            Math.min(minimumX, tile.x);

        minimumY =
            Math.min(minimumY, tile.y);

        maximumX =
            Math.max(
                maximumX,
                tile.x + tile.width
            );

        maximumY =
            Math.max(
                maximumY,
                tile.y + tile.height
            );

        let nearestGap = Infinity;

        for (
            let otherIndex = index + 1;
            otherIndex < tiles.length;
            otherIndex++
        ) {
            const other =
                tiles[otherIndex];

            overlapArea +=
                rectangleOverlapArea(
                    tile,
                    other
                );

            nearestGap =
                Math.min(
                    nearestGap,
                    rectangleGap(
                        tile,
                        other
                    )
                );

            const centerX =
                tile.x + tile.width / 2;

            const centerY =
                tile.y + tile.height / 2;

            const otherCenterX =
                other.x +
                other.width / 2;

            const otherCenterY =
                other.y +
                other.height / 2;

            if (
                Math.abs(
                    centerX - otherCenterX
                ) < 5
            ) {
                alignmentPenalty += 1;
            }

            if (
                Math.abs(
                    centerY - otherCenterY
                ) < 5
            ) {
                alignmentPenalty += 1;
            }
        }

        if (
            Number.isFinite(nearestGap) &&
            nearestGap > 105
        ) {
            nearestGapPenalty +=
                Math.pow(
                    nearestGap - 105,
                    2
                );
        }
    });

    const coverage =
        totalImageArea / canvasArea;

    const boundsWidth =
        maximumX - minimumX;

    const boundsHeight =
        maximumY - minimumY;

    const widthFill =
        boundsWidth / canvasWidth;

    const heightFill =
        boundsHeight / canvasHeight;

    const massCenterX =
        weightedX /
        Math.max(1, totalImageArea);

    const massCenterY =
        weightedY /
        Math.max(1, totalImageArea);

    const centerDistance =
        Math.hypot(
            massCenterX -
                canvasWidth / 2,
            massCenterY -
                canvasHeight / 2
        ) /
        Math.hypot(
            canvasWidth / 2,
            canvasHeight / 2
        );

    const targetCoverage =
        tiles.length <= 10
            ? 0.55
            : 0.47;

    return (
        overlapArea /
            Math.max(1, totalImageArea) *
            100000 +
        Math.abs(
            coverage - targetCoverage
        ) * 1400 +
        Math.abs(
            widthFill - 0.90
        ) * 520 +
        Math.abs(
            heightFill - 0.87
        ) * 520 +
        centerDistance * 3600 +
        nearestGapPenalty * 0.018 +
        alignmentPenalty * 20
    );
}

function generateMosaicCandidate(
    aspectRatios,
    canvasWidth,
    canvasHeight,
    random
) {
    const sizedTiles =
        createMosaicTileSizes(
            aspectRatios,
            canvasWidth,
            canvasHeight,
            random
        );

    const placementOrder =
        shuffleWithRandom(
            sizedTiles,
            random
        ).sort(
            (first, second) =>
                second.area -
                first.area +
                (random() - 0.5) *
                first.area * 0.08
        );

    const placedTiles = [];

    placementOrder.forEach(tile => {
        const position =
            findBestMosaicPosition(
                tile,
                placedTiles,
                canvasWidth,
                canvasHeight,
                random
            );

        placedTiles.push({
            ...tile,
            x: position.x,
            y: position.y
        });
    });

    return fitAndCenterMosaicLayout(
        placedTiles,
        canvasWidth,
        canvasHeight
    );
}

function generateBestMosaicLayout(
    aspectRatios,
    canvasWidth,
    canvasHeight
) {
    const widthBucket =
        Math.round(canvasWidth / 20);

    const heightBucket =
        Math.round(canvasHeight / 20);

    const ratioSignature =
        aspectRatios
            .map(ratio => ratio.toFixed(3))
            .join(",");

    const layoutKey =
        `${collection}|${widthBucket}|` +
        `${heightBucket}|${ratioSignature}`;

    if (mosaicLayoutCache.has(layoutKey)) {
        return mosaicLayoutCache.get(
            layoutKey
        );
    }

    const masterSeed =
        hashText(layoutKey);

    const masterRandom =
        createSeededRandom(masterSeed);

    const candidateCount =
        aspectRatios.length <= 14
            ? 84
            : 58;

    let bestLayout = null;
    let bestScore = Infinity;

    for (
        let candidateIndex = 0;
        candidateIndex < candidateCount;
        candidateIndex++
    ) {
        const candidateSeed =
            Math.floor(
                masterRandom() *
                4294967295
            );

        const candidateRandom =
            createSeededRandom(
                candidateSeed
            );

        const candidate =
            generateMosaicCandidate(
                aspectRatios,
                canvasWidth,
                canvasHeight,
                candidateRandom
            );

        const score =
            scoreMosaicLayout(
                candidate,
                canvasWidth,
                canvasHeight
            );

        if (score < bestScore) {
            bestScore = score;
            bestLayout =
                candidate.map(tile => ({
                    ...tile
                }));
        }
    }

    const orderedLayout =
        bestLayout.sort(
            (first, second) =>
                first.imageIndex -
                second.imageIndex
        );

    mosaicLayoutCache.set(
        layoutKey,
        orderedLayout
    );

    return orderedLayout;
}

function wait(milliseconds) {
    return new Promise(resolve => {
        window.setTimeout(resolve, milliseconds);
    });
}

function waitForDisplayedIndex(
    targetIndex,
    timeoutMilliseconds = 5000
) {
    return new Promise(resolve => {
        const startTime =
            performance.now();

        function checkDisplayedImage() {
            if (
                displayedIndex === targetIndex ||
                performance.now() - startTime >=
                    timeoutMilliseconds
            ) {
                resolve();
                return;
            }

            window.requestAnimationFrame(
                checkDisplayedImage
            );
        }

        checkDisplayedImage();
    });
}

async function selectMosaicImage(
    imageIndex,
    selectedTile
) {
    if (mosaicSelectionRunning) {
        return;
    }

    mosaicSelectionRunning = true;

    /*
    Immediately hide the currently displayed full-size
    photograph so the background becomes black.
    */
    viewer.classList.add(
        "mosaic-photo-blackout"
    );

    selectedTile.classList.add(
        "mosaic-selected"
    );

    /*
    Force the browser to paint the selected state before
    the quick and slow fades begin together.
    */
    void selectedTile.getBoundingClientRect();

    mosaicOverlay.classList.add(
        "selecting"
    );

    const minimumMosaicFade =
        wait(900);

    current = imageIndex;
    requestImageChange();

    await waitForDisplayedIndex(
        imageIndex
    );

    /*
    Reveal the newly loaded full-size photograph while
    the selected mosaic thumbnail is still fading.
    */
    viewer.classList.remove(
        "mosaic-photo-blackout"
    );

    await minimumMosaicFade;

    mosaicSelectionRunning = false;

    setFilmstripExpanded(
        false,
        true
    );

    await wait(260);

    mosaicOverlay.classList.remove(
        "selecting"
    );

    selectedTile.classList.remove(
        "mosaic-selected"
    );

    mosaicGrid.innerHTML = "";
}

function renderMosaicLayout(layout) {
    mosaicGrid.innerHTML = "";

    layout.forEach(tileData => {
        const tile =
            document.createElement("button");

        tile.type = "button";
        tile.className = "mosaic-item";
        tile.dataset.imageIndex =
            String(tileData.imageIndex);

        tile.setAttribute(
            "aria-label",
            `Open photograph ${
                tileData.imageIndex + 1
            }`
        );

        tile.style.left =
            `${tileData.x.toFixed(1)}px`;

        tile.style.top =
            `${tileData.y.toFixed(1)}px`;

        tile.style.width =
            `${tileData.width.toFixed(1)}px`;

        tile.style.height =
            `${tileData.height.toFixed(1)}px`;

        tile.style.setProperty(
            "--mosaic-tilt",
            `${tileData.rotation.toFixed(2)}deg`
        );

        if (
            tileData.imageIndex === current
        ) {
            tile.classList.add("active");
        }

        const image =
            document.createElement("img");

        image.src =
            thumbnails[tileData.imageIndex];

        image.loading = "lazy";
        image.decoding = "async";
        image.alt = "";

        tile.appendChild(image);

        tile.addEventListener(
            "click",
            function () {
                selectMosaicImage(
                    tileData.imageIndex,
                    tile
                );
            }
        );

        mosaicGrid.appendChild(tile);
    });
}

async function buildSeededMosaic() {
    const buildToken =
        ++mosaicBuildToken;

    mosaicGrid.innerHTML = "";

    const aspectRatios =
        await getThumbnailAspectRatios();

    if (
        !filmstripExpanded ||
        buildToken !== mosaicBuildToken
    ) {
        return;
    }

    const panelRect =
        mosaicPanel.getBoundingClientRect();

    const horizontalPadding = 24;
    const verticalPadding = 24;

    const canvasWidth =
        Math.max(
            320,
            panelRect.width -
            horizontalPadding * 2
        );

    const canvasHeight =
        Math.max(
            260,
            panelRect.height -
            verticalPadding * 2
        );

    mosaicGrid.style.width =
        `${canvasWidth}px`;

    mosaicGrid.style.height =
        `${canvasHeight}px`;

    const layout =
        generateBestMosaicLayout(
            aspectRatios,
            canvasWidth,
            canvasHeight
        );

    if (
        !filmstripExpanded ||
        buildToken !== mosaicBuildToken
    ) {
        return;
    }

    renderMosaicLayout(layout);
}

function setFilmstripExpanded(
    expanded,
    preserveContent = false
) {
    if (
        mosaicSelectionRunning &&
        expanded === false &&
        !preserveContent
    ) {
        return;
    }

    filmstripExpanded = expanded;

    document.body.classList.toggle(
        "mosaic-open",
        filmstripExpanded
    );

    mosaicOverlay.classList.toggle(
        "visible",
        filmstripExpanded
    );

    mosaicOverlay.setAttribute(
        "aria-hidden",
        String(!filmstripExpanded)
    );

    filmstripButton.classList.toggle(
        "active",
        filmstripExpanded
    );

    filmstripButton.setAttribute(
        "aria-pressed",
        String(filmstripExpanded)
    );

    filmstripButton.setAttribute(
        "aria-label",
        filmstripExpanded
            ? "Close thumbnail mosaic"
            : "Open thumbnail mosaic"
    );

    if (filmstripExpanded) {
        buildSeededMosaic();
    } else {
        mosaicBuildToken += 1;

        if (!preserveContent) {
            mosaicGrid.innerHTML = "";
        }
    }

    wakeInterface();
}

function toggleFilmstrip() {
    if (mosaicSelectionRunning) {
        return;
    }

    setFilmstripExpanded(!filmstripExpanded);
}

function clearInterfaceIdleTimer() {
    if (idleInterfaceTimer !== null) {
        window.clearTimeout(idleInterfaceTimer);
        idleInterfaceTimer = null;
    }
}

function shouldKeepInterfaceVisible() {
    return (
        document.body.classList.contains("ui-hidden") ||
        helpOverlay.classList.contains("visible") ||
        isDragging ||
        filmstripExpanded
    );
}

function scheduleInterfaceIdle() {
    clearInterfaceIdleTimer();

    if (shouldKeepInterfaceVisible()) {
        return;
    }

    idleInterfaceTimer = window.setTimeout(
        function () {
            if (!shouldKeepInterfaceVisible()) {
                document.body.classList.add("ui-idle");
            }
        },
        interfaceIdleDelay
    );
}

function wakeInterface() {
    document.body.classList.remove("ui-idle");
    scheduleInterfaceIdle();
}

function keepInterfaceVisibleWhileHovered(element) {
    element.addEventListener(
        "mouseenter",
        function () {
            clearInterfaceIdleTimer();
            document.body.classList.remove("ui-idle");
        }
    );

    element.addEventListener(
        "mouseleave",
        scheduleInterfaceIdle
    );
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
    if (filmstripExpanded) {
        setFilmstripExpanded(false);
    }

    clearInterfaceIdleTimer();
    document.body.classList.remove("ui-idle");
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

    scheduleInterfaceIdle();
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

    wakeInterface();

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
    setFilmstripExpanded(false);

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

    clearInterfaceIdleTimer();
    document.body.classList.remove("ui-idle");

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

previousImageButton.addEventListener(
    "click",
    previousImage
);

nextImageButton.addEventListener(
    "click",
    nextImage
);

filmstripButton.addEventListener(
    "click",
    toggleFilmstrip
);

mosaicOverlay.addEventListener(
    "click",
    function (event) {
        if (event.target === mosaicOverlay) {
            setFilmstripExpanded(false);
        }
    }
);

window.addEventListener(
    "resize",
    function () {
        if (!filmstripExpanded) {
            return;
        }

        window.clearTimeout(
            mosaicResizeTimer
        );

        mosaicResizeTimer =
            window.setTimeout(
                buildSeededMosaic,
                180
            );
    }
);

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
        setZoomAroundPoint(
            Number(zoomSlider.value),
            0,
            0
        );
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

[
    previousImageButton,
    nextImageButton
].forEach(button => {
    button.addEventListener(
        "mousedown",
        function (event) {
            event.stopPropagation();
        }
    );

    button.addEventListener(
        "dblclick",
        function (event) {
            event.stopPropagation();
        }
    );
});

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
    "wheel",
    function (event) {
        if (
            event.target.closest(
                "#bottomZoomControls, .edge-nav"
            )
        ) {
            return;
        }

        event.preventDefault();
        wakeInterface();

        const anchor =
            getZoomAnchor(
                event.clientX,
                event.clientY
            );

        if (event.deltaY < 0) {
            setZoomAroundPoint(
                zoomLevel + zoomStep,
                anchor.x,
                anchor.y
            );
        } else if (event.deltaY > 0) {
            setZoomAroundPoint(
                zoomLevel - zoomStep,
                anchor.x,
                anchor.y
            );
        }
    },
    { passive: false }
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
        wakeInterface();

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
        scheduleInterfaceIdle();
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
        wakeInterface();

        if (event.repeat) {
            return;
        }

        const key = event.key.toLowerCase();

        if (key === "escape") {
            if (filmstripExpanded) {
                setFilmstripExpanded(false);
                return;
            }

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

        if (key === "t") {
            toggleFilmstrip();
        }

    }
);

[
    controlArea,
    thumbnailBar,
    mosaicPanel,
    bottomZoomControls,
    helpPanel,
    previousImageButton,
    nextImageButton
].forEach(keepInterfaceVisibleWhileHovered);

document.addEventListener(
    "pointerdown",
    wakeInterface
);

updateToggleButtonState();
scheduleInterfaceIdle();
