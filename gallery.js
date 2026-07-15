const version = "v1.5.80";
document.getElementById("version").textContent = version;

const params = new URLSearchParams(window.location.search);
const collection = params.get("collection");

const viewer = document.getElementById("viewer");
const photo = document.getElementById("photo");
const photoMotionLayer =
    document.getElementById("photoMotionLayer");
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
const previousPhotoIndicator =
    document.getElementById("previousPhotoIndicator");
const nextPhotoIndicator =
    document.getElementById("nextPhotoIndicator");
const loadingIndicator =
    document.getElementById("loadingIndicator");
const filmstripButton =
    document.getElementById("filmstripButton");
const thumbnailsContainer =
    document.getElementById("thumbnails");
const thumbnailScrollLeft =
    document.getElementById("thumbnailScrollLeft");
const thumbnailScrollRight =
    document.getElementById("thumbnailScrollRight");
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
let autoplayDelaySeconds = 6;
let autoplayProgressFrame = null;
let autoplayProgressStart = null;

let modeToastTimer = null;
let modeToastFadeTimer = null;
let modeToastAnimationFrame = null;
let zoomControlsHideTimer = null;
let wheelZoomFrame = null;
let wheelZoomTarget = 1;
let wheelZoomAnchorX = 0;
let wheelZoomAnchorY = 0;
let wheelZoomEasing = 0.22;
let lastWheelEventTime = 0;
let mediaControlsPopTimer = null;
let autoplayPanDirection = 0;
let firstMosaicCueTimer = null;
let firstMosaicCueShown = false;
let loadingIndicatorTimer = null;
let idleInterfaceTimer = null;
let initialUiProtectionUntil = 0;
let filmstripExpanded = false;
let mosaicBuildToken = 0;
let mosaicResizeTimer = null;
let mosaicBaseWidth = 0;
let mosaicBaseHeight = 0;
let thumbnailAspectPromise = null;
let mosaicSelectionRunning = false;
let mosaicRepulsionFrame = null;
let mosaicRepulsionResetTimer = null;
let mosaicHoveredTile = null;
let photoNavigationClickTimer = null;
let thumbnailDragActive = false;
let thumbnailDragMoved = false;
let thumbnailDragStartX = 0;
let thumbnailDragStartScrollLeft = 0;
let suppressThumbnailClick = false;
let thumbnailPointerDownIndex = null;

const imageCache = new Map();
const mosaicLayoutCache = new Map();

const minimumZoom = 1;
const maximumZoom = 5;
const zoomStep = 0.5;
const fadeDuration = 340;
const zoomControlsHideDelay = 650;
const loadingIndicatorDelay = 2000;
const interfaceIdleDelay = 4680;
const initialUiProtectionDuration = 25000;
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
updateAutoplayPanDuration();

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
            const imageFilename =
                `${i * 100}.jpg`;

            images.push(
                `${normalizedBase}${selected.name}` +
                `/originals/${imageFilename}`
            );

            thumbnails.push(
                `${normalizedBase}${selected.name}` +
                `/thumbnails/${imageFilename}`
            );
        }

        createThumbnails();

        current = 0;
        updateCounter();

        setFilmstripExpanded(true);
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

function triggerFirstMosaicButtonCue() {
    if (firstMosaicCueShown) {
        return;
    }

    firstMosaicCueShown = true;

    window.clearTimeout(
        firstMosaicCueTimer
    );

    filmstripButton.classList.remove(
        "first-load-attention"
    );

    void filmstripButton.offsetWidth;

    filmstripButton.classList.add(
        "first-load-attention"
    );

    firstMosaicCueTimer =
        window.setTimeout(
            function () {
                filmstripButton.classList.remove(
                    "first-load-attention"
                );
            },
            2300
        );
}

function expandMediaControlsAfterFirstImageLoad() {
    if (
        initialMediaControlsExpanded ||
        document.body.classList.contains(
            "initial-mosaic-mode"
        ) ||
        document.body.classList.contains(
            "initial-gallery-reveal"
        )
    ) {
        return;
    }

    initialMediaControlsExpanded = true;

    setMediaControlsCollapsed(
        false,
        true
    );

    /*
    The media-control pop lasts up to about 0.85 seconds.
    Wait an additional 0.1 seconds before drawing attention
    to the mosaic button.
    */
    window.clearTimeout(
        firstMosaicCueTimer
    );

    firstMosaicCueTimer =
        window.setTimeout(
            triggerFirstMosaicButtonCue,
            950
        );
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
        updateThumbnails(displayedIndex, null);

        positionPhotoNavigationIndicators();

        document.body.classList.add(
            "photo-navigation-ready"
        );

        restartAutoplayPan(displayedIndex);

        hideLoadingIndicator();
        expandMediaControlsAfterFirstImageLoad();

        return;
    }

    if (displayedIndex === index) {
        updateThumbnails(displayedIndex, null);
        restartAutoplayPan(displayedIndex);
        hideLoadingIndicator();
        return;
    }

    /*
    A mosaic selection already hides the full-size photo
    behind a black viewer. Swap the cached/loaded image
    directly instead of performing the normal fade-to-black
    and fade-from-black sequence underneath that blackout.
    */
    if (mosaicSelectionRunning) {
        fadeOverlay.classList.remove(
            "visible"
        );

        photo.style.visibility = "hidden";
        photo.src = loadedSource;

        await waitForDisplayedPhoto();
        await waitForTwoFrames();

        displayedIndex = index;
        photo.style.visibility = "visible";

        updateThumbnails(displayedIndex, null);
        positionPhotoNavigationIndicators();
        restartAutoplayPan(displayedIndex);

        previousPhotoIndicator.classList.remove(
            "clicked"
        );

        nextPhotoIndicator.classList.remove(
            "clicked"
        );

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

    updateThumbnails(displayedIndex, null);

    positionPhotoNavigationIndicators();
    restartAutoplayPan(displayedIndex);

    fadeOverlay.classList.remove("visible");
    await waitForOverlayTransition();

    previousPhotoIndicator.classList.remove(
        "clicked"
    );

    nextPhotoIndicator.classList.remove(
        "clicked"
    );

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

function requestImageChange(
    updateThumbnailImmediately = false
) {
    if (images.length === 0) {
        return;
    }

    if (autoplayPlaying) {
        clearAutoplayTimer();
        stopProgressBar();
    }

    resetZoom();
    updateCounter();

    if (updateThumbnailImmediately) {
        updateThumbnails(
            current,
            "smooth"
        );
    } else {
        centerThumbnailByIndex(
            current,
            "smooth"
        );
    }

    preloadNearbyImages();

    window.requestAnimationFrame(
        positionPhotoNavigationIndicators
    );

    pendingImageIndex = current;
    processImageQueue();
}

function getThumbnailScrollDistance() {
    const thumbnailElements =
        Array.from(
            thumbnailsContainer.querySelectorAll(
                ".thumb"
            )
        );

    if (thumbnailElements.length === 0) {
        return 0;
    }

    const visibleThumbs =
        thumbnailElements.slice(0, 6);

    const totalWidth =
        visibleThumbs.reduce(
            (sum, thumbnail) =>
                sum +
                thumbnail.getBoundingClientRect().width,
            0
        );

    const gap =
        Number.parseFloat(
            window.getComputedStyle(
                thumbnailsContainer
            ).columnGap
        ) || 8;

    return (
        totalWidth +
        gap *
            Math.max(
                0,
                visibleThumbs.length - 1
            )
    );
}

function beginThumbnailDrag(event) {
    if (event.button !== 0) {
        return;
    }

    const clickedThumb =
        event.target.closest(".thumb");

    thumbnailPointerDownIndex =
        clickedThumb
            ? Number.parseInt(
                clickedThumb.dataset.index,
                10
            )
            : null;

    thumbnailDragActive = true;
    thumbnailDragMoved = false;
    suppressThumbnailClick = false;

    thumbnailDragStartX =
        event.clientX;

    thumbnailDragStartScrollLeft =
        thumbnailsContainer.scrollLeft;

    thumbnailsContainer.setPointerCapture(
        event.pointerId
    );

    thumbnailsContainer.classList.add(
        "dragging"
    );
}

function moveThumbnailDrag(event) {
    if (!thumbnailDragActive) {
        return;
    }

    const movement =
        event.clientX -
        thumbnailDragStartX;

    if (Math.abs(movement) > 5) {
        thumbnailDragMoved = true;
        suppressThumbnailClick = true;
    }

    if (
        thumbnailDragMoved &&
        thumbnailsContainer.classList.contains(
            "has-overflow"
        )
    ) {
        event.preventDefault();

        thumbnailsContainer.scrollLeft =
            thumbnailDragStartScrollLeft -
            movement;
    }
}

function endThumbnailDrag(event) {
    if (!thumbnailDragActive) {
        return;
    }

    const clickedIndex =
        thumbnailPointerDownIndex;

    const dragged =
        thumbnailDragMoved;

    thumbnailDragActive = false;
    thumbnailPointerDownIndex = null;

    if (
        thumbnailsContainer.hasPointerCapture(
            event.pointerId
        )
    ) {
        thumbnailsContainer.releasePointerCapture(
            event.pointerId
        );
    }

    thumbnailsContainer.classList.remove(
        "dragging"
    );

    if (
        !dragged &&
        clickedIndex !== null &&
        !Number.isNaN(clickedIndex)
    ) {
        current = clickedIndex;
        requestImageChange(true);
    }

    window.setTimeout(
        function () {
            suppressThumbnailClick = false;
            thumbnailDragMoved = false;
        },
        0
    );
}

function updateThumbnailScrollButtons() {
    const maximumScroll =
        thumbnailsContainer.scrollWidth -
        thumbnailsContainer.clientWidth;

    const hasOverflow =
        maximumScroll > 2;

    thumbnailBar.classList.toggle(
        "no-thumbnail-overflow",
        !hasOverflow
    );

    thumbnailsContainer.classList.toggle(
        "has-overflow",
        hasOverflow
    );

    thumbnailScrollLeft.disabled =
        !hasOverflow ||
        thumbnailsContainer.scrollLeft <= 2;

    thumbnailScrollRight.disabled =
        !hasOverflow ||
        thumbnailsContainer.scrollLeft >=
            maximumScroll - 2;
}

function scrollThumbnails(direction) {
    const distance =
        getThumbnailScrollDistance();

    thumbnailsContainer.scrollBy({
        left: direction * distance,
        behavior: "smooth"
    });
}

function preloadThumbnail(
    src,
    index
) {
    return new Promise(resolve => {
        const thumbnail =
            document.createElement("img");

        thumbnail.loading = "eager";
        thumbnail.decoding = "async";
        thumbnail.className = "thumb";
        thumbnail.alt = `Photo ${index + 1}`;

        thumbnail.addEventListener(
            "load",
            function () {
                resolve(thumbnail);
            },
            { once: true }
        );

        thumbnail.addEventListener(
            "error",
            function () {
                resolve(thumbnail);
            },
            { once: true }
        );

        thumbnail.src = src;
    });
}

async function createThumbnails() {
    const container =
        document.getElementById("thumbnails");

    thumbnailBar.classList.remove(
        "thumbnails-ready"
    );

    container.innerHTML = "";

    const loadedThumbnails =
        await Promise.all(
            thumbnails.map(
                preloadThumbnail
            )
        );

    const fragment =
        document.createDocumentFragment();

    loadedThumbnails.forEach(
        (thumbnail, index) => {
            thumbnail.dataset.index =
                String(index);

            thumbnail.draggable = false;

            fragment.appendChild(
                thumbnail
            );
        }
    );

    container.appendChild(fragment);

    window.requestAnimationFrame(
        function () {
            updateThumbnailScrollButtons();

            thumbnailBar.classList.add(
                "thumbnails-ready"
            );
        }
    );
}

function centerThumbnailByElement(
    thumbnail,
    behavior = "smooth"
) {
    if (
        !thumbnail ||
        !thumbnailsContainer.classList.contains(
            "has-overflow"
        )
    ) {
        return;
    }

    const targetScrollLeft =
        thumbnail.offsetLeft +
        thumbnail.offsetWidth / 2 -
        thumbnailsContainer.clientWidth / 2;

    const maximumScroll =
        thumbnailsContainer.scrollWidth -
        thumbnailsContainer.clientWidth;

    const clampedScrollLeft =
        Math.max(
            0,
            Math.min(
                maximumScroll,
                targetScrollLeft
            )
        );

    thumbnailsContainer.scrollTo({
        left: clampedScrollLeft,
        behavior: behavior
    });
}

function centerThumbnailByIndex(
    index,
    behavior = "smooth"
) {
    const thumbnail =
        thumbnailsContainer.querySelector(
            `.thumb[data-index="${index}"]`
        );

    centerThumbnailByElement(
        thumbnail,
        behavior
    );
}

function updateThumbnails(
    activeIndex = current,
    centerBehavior = null
) {
    const thumbnailElements =
        document.querySelectorAll(".thumb");

    thumbnailElements.forEach(
        (thumbnail, index) => {
            thumbnail.classList.toggle(
                "active",
                index === activeIndex
            );
        }
    );

    if (centerBehavior !== null) {
        centerThumbnailByIndex(
            activeIndex,
            centerBehavior
        );
    }

    if (!mosaicSelectionRunning) {
        document
            .querySelectorAll(".mosaic-item")
            .forEach(tile => {
                tile.classList.toggle(
                    "active",
                    Number(
                        tile.dataset.imageIndex
                    ) === activeIndex
                );
            });
    }
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

function updateAutoplayPanDuration() {
    photoMotionLayer.style.setProperty(
        "--autoplay-pan-duration",
        `${autoplayDelaySeconds}s`
    );
}

function restartAutoplayPan(
    imageIndex = displayedIndex
) {
    updateAutoplayPanDuration();

    photoMotionLayer.classList.remove(
        "autoplay-pan-active",
        "autoplay-pan-0",
        "autoplay-pan-1",
        "autoplay-pan-2",
        "autoplay-pan-3"
    );

    if (
        !autoplayActive ||
        !autoplayPlaying ||
        imageIndex < 0
    ) {
        return;
    }

    autoplayPanDirection =
        imageIndex % 4;

    photoMotionLayer.classList.add(
        `autoplay-pan-${autoplayPanDirection}`
    );

    void photoMotionLayer.offsetWidth;

    photoMotionLayer.classList.add(
        "autoplay-pan-active"
    );
}

function stopAutoplayPan() {
    photoMotionLayer.classList.remove(
        "autoplay-pan-active",
        "autoplay-pan-0",
        "autoplay-pan-1",
        "autoplay-pan-2",
        "autoplay-pan-3"
    );
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
    document.body.classList.toggle(
        "autoplay-active",
        autoplayActive
    );

    document.body.classList.toggle(
        "autoplay-playing",
        autoplayPlaying
    );

    autoplayStatus.textContent =
        autoplayActive
            ? (
                autoplayPlaying
                    ? "playing"
                    : "paused"
            )
            : "";

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

    restartAutoplayPan();

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

    restartAutoplayPan();

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
    stopAutoplayPan();
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
        updateAutoplayPanDuration();

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
        newDelay = 6;
    }

    newDelay =
        Math.min(60, Math.max(2, newDelay));

    autoplayDelaySeconds = newDelay;
    autoplayDelayInput.value =
        String(newDelay);
    saveAutoplayDelay();
    updateAutoplayPanDuration();

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

    if (wheelZoomFrame === null) {
        wheelZoomTarget = zoomLevel;
    }

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

function normalizeWheelDelta(event) {
    let delta = event.deltaY;

    if (event.deltaMode === 1) {
        delta *= 16;
    } else if (event.deltaMode === 2) {
        delta *= window.innerHeight;
    }

    return Math.max(
        -240,
        Math.min(240, delta)
    );
}

function classifyWheelInput(
    event,
    normalizedDelta
) {
    const now = performance.now();
    const elapsed =
        now - lastWheelEventTime;

    lastWheelEventTime = now;

    const absoluteDelta =
        Math.abs(normalizedDelta);

    const hasFractionalDelta =
        Math.abs(
            event.deltaY -
            Math.round(event.deltaY)
        ) > 0.001;

    const isSmallPixelDelta =
        event.deltaMode === 0 &&
        absoluteDelta < 45;

    const isRapidModerateDelta =
        event.deltaMode === 0 &&
        elapsed < 45 &&
        absoluteDelta < 85;

    if (
        hasFractionalDelta ||
        isSmallPixelDelta ||
        isRapidModerateDelta
    ) {
        return "trackpad";
    }

    return "mouse";
}

function animateWheelZoom() {
    const distance =
        wheelZoomTarget - zoomLevel;

    if (Math.abs(distance) < 0.002) {
        setZoomAroundPoint(
            wheelZoomTarget,
            wheelZoomAnchorX,
            wheelZoomAnchorY
        );

        wheelZoomFrame = null;
        return;
    }

    setZoomAroundPoint(
        zoomLevel + distance * wheelZoomEasing,
        wheelZoomAnchorX,
        wheelZoomAnchorY
    );

    wheelZoomFrame =
        window.requestAnimationFrame(
            animateWheelZoom
        );
}

function queueWheelZoom(
    delta,
    anchorX,
    anchorY,
    inputType
) {
    wheelZoomAnchorX = anchorX;
    wheelZoomAnchorY = anchorY;

    if (wheelZoomFrame === null) {
        wheelZoomTarget = zoomLevel;
    }

    const isTrackpad =
        inputType === "trackpad";

    const sensitivity =
        isTrackpad
            ? 0.009
            : 0.002;

    wheelZoomEasing =
        isTrackpad
            ? 0.30
            : 0.20;

    const zoomFactor =
        Math.exp(
            -delta * sensitivity
        );

    wheelZoomTarget =
        Math.min(
            maximumZoom,
            Math.max(
                minimumZoom,
                wheelZoomTarget * zoomFactor
            )
        );

    if (wheelZoomFrame === null) {
        wheelZoomFrame =
            window.requestAnimationFrame(
                animateWheelZoom
            );
    }
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
                rotation: 0
            };
        }
    );
}

const mosaicPreferredGap = 7;
const mosaicMinimumGap = 2;

function isMosaicPlacementValid(
    candidate,
    placedTiles,
    minimumGap = mosaicMinimumGap
) {
    return placedTiles.every(tile => {
        return (
            rectangleOverlapArea(
                candidate,
                tile
            ) === 0 &&
            rectangleGap(
                candidate,
                tile
            ) >= minimumGap
        );
    });
}

function isMosaicLayoutValid(
    tiles,
    canvasWidth,
    canvasHeight,
    minimumGap = mosaicMinimumGap
) {
    const tolerance = 0.01;

    for (const tile of tiles) {
        if (
            tile.x < -tolerance ||
            tile.y < -tolerance ||
            tile.x + tile.width >
                canvasWidth + tolerance ||
            tile.y + tile.height >
                canvasHeight + tolerance
        ) {
            return false;
        }
    }

    for (
        let firstIndex = 0;
        firstIndex < tiles.length;
        firstIndex++
    ) {
        for (
            let secondIndex = firstIndex + 1;
            secondIndex < tiles.length;
            secondIndex++
        ) {
            const first = tiles[firstIndex];
            const second = tiles[secondIndex];

            if (
                rectangleOverlapArea(
                    first,
                    second
                ) > tolerance ||
                rectangleGap(
                    first,
                    second
                ) <
                    minimumGap - tolerance
            ) {
                return false;
            }
        }
    }

    return true;
}

function scoreMosaicPlacement(
    candidate,
    placedTiles,
    canvasWidth,
    canvasHeight
) {
    if (
        !isMosaicPlacementValid(
            candidate,
            placedTiles
        )
    ) {
        return Infinity;
    }

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
        const gap =
            rectangleGap(
                candidate,
                tile
            );

        nearestGap =
            Math.min(nearestGap, gap);

        if (gap < mosaicPreferredGap) {
            score +=
                Math.pow(
                    mosaicPreferredGap - gap,
                    2
                ) * 10;
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
                tile.width / 2,
            y:
                canvasHeight / 2 -
                tile.height / 2
        };
    }

    let bestPosition = null;
    let bestScore = Infinity;

    function considerPosition(x, y) {
        if (
            x < 0 ||
            y < 0 ||
            x + tile.width > canvasWidth ||
            y + tile.height > canvasHeight
        ) {
            return;
        }

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
            );

        if (
            Number.isFinite(score) &&
            score < bestScore
        ) {
            bestScore = score;
            bestPosition = {
                x: x,
                y: y
            };
        }
    }

    /*
    Exact placements around existing tiles make valid
    non-overlapping options much easier to find.
    */
    placedTiles.forEach(anchor => {
        const gapOptions = [
            mosaicPreferredGap,
            mosaicPreferredGap + 8,
            mosaicPreferredGap + 18
        ];

        const verticalPositions = [
            anchor.y,
            anchor.y +
                anchor.height / 2 -
                tile.height / 2,
            anchor.y +
                anchor.height -
                tile.height
        ];

        const horizontalPositions = [
            anchor.x,
            anchor.x +
                anchor.width / 2 -
                tile.width / 2,
            anchor.x +
                anchor.width -
                tile.width
        ];

        gapOptions.forEach(gap => {
            verticalPositions.forEach(y => {
                considerPosition(
                    anchor.x -
                        tile.width -
                        gap,
                    y
                );

                considerPosition(
                    anchor.x +
                        anchor.width +
                        gap,
                    y
                );
            });

            horizontalPositions.forEach(x => {
                considerPosition(
                    x,
                    anchor.y -
                        tile.height -
                        gap
                );

                considerPosition(
                    x,
                    anchor.y +
                        anchor.height +
                        gap
                );
            });
        });
    });

    const sampleCount =
        Math.min(
            220,
            110 + placedTiles.length * 8
        );

    for (
        let sample = 0;
        sample < sampleCount;
        sample++
    ) {
        let x;
        let y;

        if (random() < 0.72) {
            const anchor =
                placedTiles[
                    Math.floor(
                        random() *
                        placedTiles.length
                    )
                ];

            const gap =
                mosaicPreferredGap +
                random() * 38;

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

        considerPosition(x, y);
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

    const firstCollectionTile =
        tiles.find(
            tile => tile.imageIndex === 0
        );

    if (firstCollectionTile) {
        let firstShiftX =
            canvasWidth / 2 -
            (
                firstCollectionTile.x +
                firstCollectionTile.width / 2
            );

        let firstShiftY =
            canvasHeight / 2 -
            (
                firstCollectionTile.y +
                firstCollectionTile.height / 2
            );

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

        firstShiftX = clamp(
            firstShiftX,
            -minimumTileX,
            canvasWidth - maximumTileX
        );

        firstShiftY = clamp(
            firstShiftY,
            -minimumTileY,
            canvasHeight - maximumTileY
        );

        tiles.forEach(tile => {
            tile.x += firstShiftX;
            tile.y += firstShiftY;
        });
    }

    return tiles;
}

function scoreMosaicLayout(
    tiles,
    canvasWidth,
    canvasHeight
) {
    if (
        !isMosaicLayoutValid(
            tiles,
            canvasWidth,
            canvasHeight
        )
    ) {
        return Infinity;
    }

    const canvasArea =
        canvasWidth * canvasHeight;

    let totalImageArea = 0;
    let weightedX = 0;
    let weightedY = 0;
    let nearestGapPenalty = 0;
    let preferredGapPenalty = 0;
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

            const pairGap =
                rectangleGap(
                    tile,
                    other
                );

            nearestGap =
                Math.min(
                    nearestGap,
                    pairGap
                );

            if (pairGap < mosaicPreferredGap) {
                preferredGapPenalty +=
                    Math.pow(
                        mosaicPreferredGap -
                        pairGap,
                        2
                    );
            }

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
        preferredGapPenalty * 8 +
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

    const firstTile =
        sizedTiles.find(
            tile => tile.imageIndex === 0
        );

    const remainingTiles =
        shuffleWithRandom(
            sizedTiles.filter(
                tile => tile.imageIndex !== 0
            ),
            random
        ).sort(
            (first, second) =>
                second.area -
                first.area +
                (random() - 0.5) *
                first.area * 0.08
        );

    const placementOrder =
        firstTile
            ? [firstTile, ...remainingTiles]
            : remainingTiles;

    const placedTiles = [];

    for (const tile of placementOrder) {
        const position =
            findBestMosaicPosition(
                tile,
                placedTiles,
                canvasWidth,
                canvasHeight,
                random
            );

        if (!position) {
            return null;
        }

        placedTiles.push({
            ...tile,
            x: position.x,
            y: position.y
        });
    }

    const fittedLayout =
        fitAndCenterMosaicLayout(
            placedTiles,
            canvasWidth,
            canvasHeight
        );

    if (
        !isMosaicLayoutValid(
            fittedLayout,
            canvasWidth,
            canvasHeight
        )
    ) {
        return null;
    }

    return fittedLayout;
}

function generateFallbackMosaicLayout(
    aspectRatios,
    canvasWidth,
    canvasHeight
) {
    const imageCount =
        aspectRatios.length;

    const outerMargin =
        Math.max(
            10,
            mosaicPreferredGap * 2
        );

    let bestLayout = null;
    let bestImageArea = -Infinity;

    const maximumColumns =
        Math.min(
            imageCount,
            8
        );

    for (
        let columns = 1;
        columns <= maximumColumns;
        columns++
    ) {
        const rows =
            Math.ceil(
                imageCount / columns
            );

        const cellWidth =
            (
                canvasWidth -
                outerMargin * 2 -
                mosaicPreferredGap *
                    Math.max(
                        0,
                        columns - 1
                    )
            ) / columns;

        const cellHeight =
            (
                canvasHeight -
                outerMargin * 2 -
                mosaicPreferredGap *
                    Math.max(
                        0,
                        rows - 1
                    )
            ) / rows;

        if (
            cellWidth <= 1 ||
            cellHeight <= 1
        ) {
            continue;
        }

        const layout =
            aspectRatios.map(
                (aspectRatio, imageIndex) => {
                    const column =
                        imageIndex % columns;

                    const row =
                        Math.floor(
                            imageIndex / columns
                        );

                    let width =
                        cellWidth;

                    let height =
                        width / aspectRatio;

                    if (height > cellHeight) {
                        height = cellHeight;
                        width =
                            height * aspectRatio;
                    }

                    const cellX =
                        outerMargin +
                        column *
                            (
                                cellWidth +
                                mosaicPreferredGap
                            );

                    const cellY =
                        outerMargin +
                        row *
                            (
                                cellHeight +
                                mosaicPreferredGap
                            );

                    const x =
                        cellX +
                        (
                            cellWidth - width
                        ) / 2;

                    const y =
                        cellY +
                        (
                            cellHeight - height
                        ) / 2;

                    return {
                        imageIndex: imageIndex,
                        aspectRatio: aspectRatio,
                        width: width,
                        height: height,
                        area: width * height,
                        rotation: 0,
                        x: x,
                        y: y
                    };
                }
            );

        if (
            !isMosaicLayoutValid(
                layout,
                canvasWidth,
                canvasHeight
            )
        ) {
            continue;
        }

        const imageArea =
            layout.reduce(
                (sum, tile) =>
                    sum + tile.area,
                0
            );

        if (imageArea > bestImageArea) {
            bestImageArea = imageArea;
            bestLayout = layout;
        }
    }

    return bestLayout || [];
}

function createJustifiedMosaicOrder(
    imageCount,
    firstImagePosition
) {
    const order = [];

    for (
        let imageIndex = 1;
        imageIndex < imageCount;
        imageIndex++
    ) {
        order.push(imageIndex);
    }

    order.splice(
        firstImagePosition,
        0,
        0
    );

    return order;
}

function createJustifiedMosaicRows(
    order,
    aspectRatios,
    availableWidth,
    targetHeight,
    gap
) {
    const rows = [];
    let currentIndexes = [];
    let currentRatioSum = 0;

    function finishRow(
        isLastRow = false
    ) {
        if (currentIndexes.length === 0) {
            return;
        }

        const gapWidth =
            gap *
            Math.max(
                0,
                currentIndexes.length - 1
            );

        const justifiedHeight =
            (
                availableWidth -
                gapWidth
            ) /
            Math.max(
                0.01,
                currentRatioSum
            );

        let rowHeight =
            justifiedHeight;

        let fillsWidth = true;

        if (isLastRow) {
            const naturalWidth =
                currentRatioSum *
                targetHeight +
                gapWidth;

            const fillRatio =
                naturalWidth /
                availableWidth;

            const maximumLastRowHeight =
                targetHeight * 1.14;

            if (
                fillRatio < 0.74 ||
                justifiedHeight >
                    maximumLastRowHeight
            ) {
                rowHeight =
                    Math.min(
                        targetHeight,
                        justifiedHeight
                    );

                fillsWidth = false;
            }
        }

        const rowWidth =
            currentRatioSum *
            rowHeight +
            gapWidth;

        rows.push({
            indexes: currentIndexes,
            ratioSum: currentRatioSum,
            height: rowHeight,
            width: rowWidth,
            fillsWidth: fillsWidth
        });

        currentIndexes = [];
        currentRatioSum = 0;
    }

    order.forEach(imageIndex => {
        const ratio =
            clamp(
                aspectRatios[imageIndex],
                0.18,
                7
            );

        const candidateCount =
            currentIndexes.length + 1;

        const candidateRatioSum =
            currentRatioSum + ratio;

        const candidateWidth =
            candidateRatioSum *
            targetHeight +
            gap *
            Math.max(
                0,
                candidateCount - 1
            );

        if (
            currentIndexes.length > 0 &&
            candidateWidth >=
                availableWidth
        ) {
            const currentGapWidth =
                gap *
                Math.max(
                    0,
                    currentIndexes.length - 1
                );

            const heightWithout =
                (
                    availableWidth -
                    currentGapWidth
                ) /
                Math.max(
                    0.01,
                    currentRatioSum
                );

            const candidateGapWidth =
                gap *
                Math.max(
                    0,
                    candidateCount - 1
                );

            const heightWith =
                (
                    availableWidth -
                    candidateGapWidth
                ) /
                Math.max(
                    0.01,
                    candidateRatioSum
                );

            const useCandidate =
                Math.abs(
                    heightWith -
                    targetHeight
                ) <=
                Math.abs(
                    heightWithout -
                    targetHeight
                );

            if (useCandidate) {
                currentIndexes.push(
                    imageIndex
                );

                currentRatioSum =
                    candidateRatioSum;

                finishRow(false);
            } else {
                finishRow(false);

                currentIndexes = [
                    imageIndex
                ];

                currentRatioSum = ratio;
            }
        } else {
            currentIndexes.push(
                imageIndex
            );

            currentRatioSum =
                candidateRatioSum;
        }
    });

    finishRow(true);

    return rows;
}

function layoutJustifiedMosaicRows(
    rows,
    aspectRatios,
    canvasWidth,
    canvasHeight,
    gap,
    outerMargin
) {
    const availableWidth =
        canvasWidth -
        outerMargin * 2;

    const availableHeight =
        canvasHeight -
        outerMargin * 2;

    const rowGapHeight =
        gap *
        Math.max(
            0,
            rows.length - 1
        );

    const totalRowHeight =
        rows.reduce(
            (
                sum,
                row
            ) =>
                sum +
                row.height,
            0
        );

    const totalHeight =
        totalRowHeight +
        rowGapHeight;

    let y =
        outerMargin +
        Math.max(
            0,
            (
                availableHeight -
                totalHeight
            ) / 2
        );

    const layout = [];

    rows.forEach(row => {
        let x =
            outerMargin;

        if (!row.fillsWidth) {
            x +=
                Math.max(
                    0,
                    (
                        availableWidth -
                        row.width
                    ) / 2
                );
        }

        row.indexes.forEach(
            (
                imageIndex,
                positionInRow
            ) => {
                const aspectRatio =
                    clamp(
                        aspectRatios[
                            imageIndex
                        ],
                        0.18,
                        7
                    );

                const width =
                    aspectRatio *
                    row.height;

                layout.push({
                    imageIndex: imageIndex,
                    aspectRatio:
                        aspectRatio,
                    width: width,
                    height: row.height,
                    area:
                        width *
                        row.height,
                    rotation: 0,
                    x: x,
                    y: y
                });

                x += width;

                if (
                    positionInRow <
                    row.indexes.length - 1
                ) {
                    x += gap;
                }
            }
        );

        y +=
            row.height +
            gap;
    });

    return {
        layout: layout,
        totalHeight: totalHeight,
        availableWidth:
            availableWidth,
        availableHeight:
            availableHeight
    };
}

function scoreJustifiedMosaicLayout(
    result,
    targetHeight,
    canvasWidth,
    canvasHeight
) {
    const layout =
        result.layout;

    if (layout.length === 0) {
        return Infinity;
    }

    const firstTile =
        layout.find(
            tile =>
                tile.imageIndex === 0
        );

    const centerX =
        canvasWidth / 2;

    const rowYValues =
        Array.from(
            new Set(
                layout.map(
                    tile =>
                        Number(
                            tile.y.toFixed(1)
                        )
                )
            )
        ).sort(
            (
                first,
                second
            ) =>
                first - second
        );

    /*
    For an odd row count, target the true middle row.
    For an even row count, target the upper of the two
    middle rows: row 1 of 2, row 2 of 4, and so on.
    */
    const targetRowIndex =
        Math.floor(
            (
                rowYValues.length -
                1
            ) /
            2
        );

    const firstRowIndex =
        firstTile
            ? rowYValues.findIndex(
                rowY =>
                    Math.abs(
                        firstTile.y -
                        rowY
                    ) < 0.6
            )
            : -1;

    const firstRowPenalty =
        firstRowIndex ===
        targetRowIndex
            ? 0
            : 100000000;

    const firstHorizontalDistance =
        firstTile
            ? Math.abs(
                (
                    firstTile.x +
                    firstTile.width / 2
                ) -
                    centerX
            ) /
            Math.max(
                1,
                canvasWidth / 2
            )
            : 1;

    const unusedHeight =
        Math.max(
            0,
            result.availableHeight -
            result.totalHeight
        );

    const overflowHeight =
        Math.max(
            0,
            result.totalHeight -
            result.availableHeight
        );

    const lastRowTiles =
        layout.filter(tile => {
            const maximumY =
                Math.max(
                    ...layout.map(
                        item => item.y
                    )
                );

            return (
                Math.abs(
                    tile.y -
                    maximumY
                ) < 0.5
            );
        });

    const lastRowMinimumX =
        Math.min(
            ...lastRowTiles.map(
                tile => tile.x
            )
        );

    const lastRowMaximumX =
        Math.max(
            ...lastRowTiles.map(
                tile =>
                    tile.x +
                    tile.width
            )
        );

    const lastRowUnusedWidth =
        Math.max(
            0,
            result.availableWidth -
            (
                lastRowMaximumX -
                lastRowMinimumX
            )
        );

    const heights =
        layout.map(
            tile => tile.height
        );

    const averageHeight =
        heights.reduce(
            (
                sum,
                height
            ) =>
                sum +
                height,
            0
        ) /
        Math.max(
            1,
            heights.length
        );

    const heightVariation =
        heights.reduce(
            (
                sum,
                height
            ) =>
                sum +
                Math.abs(
                    height -
                    averageHeight
                ),
            0
        ) /
        Math.max(
            1,
            heights.length *
            Math.max(
                1,
                targetHeight
            )
        );

    return (
        overflowHeight * 100000 +
        unusedHeight * 9 +
        lastRowUnusedWidth * 0.55 +
        heightVariation * 700 +
        firstRowPenalty +
        firstHorizontalDistance * 5200
    );
}

function generateJustifiedMosaicLayout(
    aspectRatios,
    canvasWidth,
    canvasHeight
) {
    const imageCount =
        aspectRatios.length;

    if (imageCount === 0) {
        return [];
    }

    const gap =
        mosaicPreferredGap;

    const outerMargin =
        mosaicPreferredGap;

    const availableWidth =
        Math.max(
            1,
            canvasWidth -
            outerMargin * 2
        );

    const maximumTargetHeight =
        Math.min(
            420,
            canvasHeight -
            outerMargin * 2
        );

    const centralPosition =
        Math.floor(
            imageCount / 2
        );

    const candidatePositions = [];

    for (
        let offset = 0;
        offset < imageCount;
        offset++
    ) {
        const left =
            centralPosition -
            offset;

        const right =
            centralPosition +
            offset;

        if (
            left >= 0 &&
            left < imageCount &&
            !candidatePositions.includes(
                left
            )
        ) {
            candidatePositions.push(
                left
            );
        }

        if (
            right >= 0 &&
            right < imageCount &&
            !candidatePositions.includes(
                right
            )
        ) {
            candidatePositions.push(
                right
            );
        }
    }

    let bestLayout = null;
    let bestScore = Infinity;

    candidatePositions.forEach(
        firstImagePosition => {
            const order =
                createJustifiedMosaicOrder(
                    imageCount,
                    firstImagePosition
                );

            for (
                let targetHeight = 24;
                targetHeight <=
                    maximumTargetHeight;
                targetHeight += 3
            ) {
                const rows =
                    createJustifiedMosaicRows(
                        order,
                        aspectRatios,
                        availableWidth,
                        targetHeight,
                        gap
                    );

                const result =
                    layoutJustifiedMosaicRows(
                        rows,
                        aspectRatios,
                        canvasWidth,
                        canvasHeight,
                        gap,
                        outerMargin
                    );

                const score =
                    scoreJustifiedMosaicLayout(
                        result,
                        targetHeight,
                        canvasWidth,
                        canvasHeight
                    );

                if (
                    Number.isFinite(score) &&
                    score < bestScore
                ) {
                    bestScore = score;

                    bestLayout =
                        result.layout.map(
                            tile => ({
                                ...tile
                            })
                        );
                }
            }
        }
    );

    if (!bestLayout) {
        return [];
    }

    return bestLayout.sort(
        (
            first,
            second
        ) =>
            first.imageIndex -
            second.imageIndex
    );
}

function generateBestMosaicLayout(
    aspectRatios,
    canvasWidth,
    canvasHeight
) {
    const widthBucket =
        Math.round(
            canvasWidth / 20
        );

    const heightBucket =
        Math.round(
            canvasHeight / 20
        );

    const ratioSignature =
        aspectRatios
            .map(
                ratio =>
                    ratio.toFixed(3)
            )
            .join(",");

    const layoutKey =
        `${collection}|${widthBucket}|` +
        `${heightBucket}|${ratioSignature}|` +
        `justified-grid-v1|` +
        `gap-${mosaicPreferredGap}`;

    if (
        mosaicLayoutCache.has(
            layoutKey
        )
    ) {
        return mosaicLayoutCache.get(
            layoutKey
        );
    }

    const layout =
        generateJustifiedMosaicLayout(
            aspectRatios,
            canvasWidth,
            canvasHeight
        );

    mosaicLayoutCache.set(
        layoutKey,
        layout
    );

    return layout;
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

function setMosaicCenterShift(selectedTile) {
    const tileRect =
        selectedTile.getBoundingClientRect();

    const tileCenterX =
        tileRect.left + tileRect.width / 2;

    const tileCenterY =
        tileRect.top + tileRect.height / 2;

    const shiftX =
        Math.max(
            -42,
            Math.min(
                42,
                (
                    window.innerWidth / 2 -
                    tileCenterX
                ) * 0.12
            )
        );

    const shiftY =
        Math.max(
            -42,
            Math.min(
                42,
                (
                    window.innerHeight / 2 -
                    tileCenterY
                ) * 0.12
            )
        );

    selectedTile.style.setProperty(
        "--mosaic-center-shift-x",
        `${shiftX.toFixed(1)}px`
    );

    selectedTile.style.setProperty(
        "--mosaic-center-shift-y",
        `${shiftY.toFixed(1)}px`
    );
}

async function selectMosaicImage(
    imageIndex,
    selectedTile
) {
    if (mosaicSelectionRunning) {
        return;
    }

    const wasInitialMosaic =
        document.body.classList.contains(
            "initial-mosaic-mode"
        );

    mosaicSelectionRunning = true;

    resetMosaicRepulsion(true);

    document.body.classList.add(
        "mosaic-photo-transition"
    );

    /*
    Hide the full-size image while preserving the visible
    mosaic animation. The selected photo can now be swapped
    immediately behind this blackout.
    */
    viewer.classList.add(
        "mosaic-photo-blackout"
    );

    setMosaicCenterShift(
        selectedTile
    );

    selectedTile.classList.remove(
        "active"
    );

    selectedTile.classList.add(
        "mosaic-selected"
    );

    if (!wasInitialMosaic) {
        mosaicOverlay.classList.add(
            "priority-selection"
        );
    }

    /*
    Force the browser to paint the selected state before
    the mosaic animation starts.
    */
    void selectedTile.getBoundingClientRect();

    mosaicOverlay.classList.add(
        "selecting"
    );

    /*
    Keep the longer introductory animation only on the
    first page load. Later selections prioritize revealing
    the chosen photograph.
    */
    const minimumMosaicFade =
        wait(
            wasInitialMosaic
                ? 900
                : 760
        );

    current = imageIndex;
    requestImageChange();

    await Promise.all([
        waitForDisplayedIndex(imageIndex),
        minimumMosaicFade
    ]);

    /*
    Close the mosaic against black. Once its 0.24-second
    opacity transition is complete, reveal the photograph.
    */
    setFilmstripExpanded(
        false,
        true
    );

    await wait(
        wasInitialMosaic
            ? 300
            : 260
    );

    mosaicOverlay.classList.remove(
        "selecting",
        "priority-selection"
    );

    selectedTile.classList.remove(
        "mosaic-selected"
    );

    selectedTile.style.removeProperty(
        "--mosaic-center-shift-x"
    );

    selectedTile.style.removeProperty(
        "--mosaic-center-shift-y"
    );

    mosaicGrid.innerHTML = "";

    await waitForTwoFrames();

    /*
    Only the first-load reveal receives the special
    1.3-second transition. Later mosaic selections use the
    normal 0.58-second photograph fade.
    */
    if (wasInitialMosaic) {
        document.body.classList.add(
            "initial-gallery-reveal"
        );
    }

    viewer.classList.remove(
        "mosaic-photo-blackout"
    );

    document.body.classList.remove(
        "mosaic-photo-transition"
    );

    if (wasInitialMosaic) {
        document.body.classList.remove(
            "initial-mosaic-mode"
        );

        await wait(1300);

        document.body.classList.remove(
            "initial-gallery-reveal"
        );

        beginInitialUiVisibilityProtection();

        await wait(200);
        expandMediaControlsAfterFirstImageLoad();
    } else {
        await wait(580);
    }

    mosaicSelectionRunning = false;
}

function canUseMosaicHoverMotion() {
    return (
        window.matchMedia(
            "(hover: hover) and (pointer: fine)"
        ).matches &&
        !window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches
    );
}

function clearMosaicRepulsionFrame() {
    if (mosaicRepulsionFrame !== null) {
        window.cancelAnimationFrame(
            mosaicRepulsionFrame
        );

        mosaicRepulsionFrame = null;
    }
}

function resetMosaicRepulsion(
    immediate = false
) {
    clearMosaicRepulsionFrame();

    window.clearTimeout(
        mosaicRepulsionResetTimer
    );

    mosaicHoveredTile = null;

    mosaicGrid.classList.remove(
        "mosaic-repulsion-active"
    );

    mosaicGrid.classList.toggle(
        "mosaic-repulsion-immediate",
        immediate
    );

    mosaicGrid
        .querySelectorAll(
            ".mosaic-item"
        )
        .forEach(tile => {
            tile.style.setProperty(
                "--mosaic-repel-x",
                "0px"
            );

            tile.style.setProperty(
                "--mosaic-repel-y",
                "0px"
            );

            tile.style.setProperty(
                "--mosaic-hover-scale",
                "1"
            );
        });

    if (immediate) {
        void mosaicGrid.offsetWidth;

        mosaicGrid.classList.remove(
            "mosaic-repulsion-immediate"
        );

        return;
    }

    mosaicGrid.classList.add(
        "mosaic-repulsion-returning"
    );

    mosaicRepulsionResetTimer =
        window.setTimeout(
            function () {
                mosaicGrid.classList.remove(
                    "mosaic-repulsion-returning"
                );
            },
            700
        );
}

function applyMosaicRepulsion(
    hoveredTile,
    cursorX,
    cursorY
) {
    if (
        !Number.isFinite(cursorX) ||
        !Number.isFinite(cursorY) ||
        !filmstripExpanded ||
        mosaicSelectionRunning ||
        !canUseMosaicHoverMotion()
    ) {
        resetMosaicRepulsion(true);
        return;
    }

    const tiles = Array.from(
        mosaicGrid.querySelectorAll(
            ".mosaic-item"
        )
    );

    if (tiles.length === 0) {
        return;
    }

    const hoveredRect =
        hoveredTile
            ? hoveredTile.getBoundingClientRect()
            : null;

    const hoveredDiagonal =
        hoveredRect
            ? Math.hypot(
                hoveredRect.width,
                hoveredRect.height
            )
            : 160;

    const influenceRadius =
        Math.max(
            220.5,
            hoveredDiagonal * 1.4175
        );

    const maximumPush = 8.568;
    mosaicGrid.classList.remove(
        "mosaic-repulsion-returning",
        "mosaic-repulsion-immediate"
    );

    mosaicGrid.classList.add(
        "mosaic-repulsion-active"
    );

    tiles.forEach(tile => {
        if (
            hoveredTile &&
            tile === hoveredTile
        ) {
            tile.style.setProperty(
                "--mosaic-repel-x",
                "0px"
            );

            tile.style.setProperty(
                "--mosaic-repel-y",
                "0px"
            );

            tile.style.setProperty(
                "--mosaic-hover-scale",
                "1.0375"
            );

            return;
        }

        const tileRect =
            tile.getBoundingClientRect();

        const tileCenterX =
            tileRect.left +
            tileRect.width / 2;

        const tileCenterY =
            tileRect.top +
            tileRect.height / 2;

        const differenceX =
            tileCenterX -
            cursorX;

        const differenceY =
            tileCenterY -
            cursorY;

        const distance =
            Math.max(
                0.001,
                Math.hypot(
                    differenceX,
                    differenceY
                )
            );

        const normalizedDistance =
            Math.min(
                1,
                distance /
                influenceRadius
            );

        const influence =
            Math.pow(
                1 -
                normalizedDistance,
                1.45
            );

        if (influence <= 0) {
            tile.style.setProperty(
                "--mosaic-repel-x",
                "0px"
            );

            tile.style.setProperty(
                "--mosaic-repel-y",
                "0px"
            );

            tile.style.setProperty(
                "--mosaic-hover-scale",
                "1"
            );

            return;
        }

        let repelX =
            (
                differenceX /
                distance
            ) *
            maximumPush *
            influence;

        let repelY =
            (
                differenceY /
                distance
            ) *
            maximumPush *
            influence;

        tile.style.setProperty(
            "--mosaic-repel-x",
            `${repelX.toFixed(2)}px`
        );

        tile.style.setProperty(
            "--mosaic-repel-y",
            `${repelY.toFixed(2)}px`
        );

        tile.style.setProperty(
            "--mosaic-hover-scale",
            "1"
        );
    });
}

function queueMosaicRepulsion(
    hoveredTile,
    cursorX,
    cursorY
) {
    mosaicHoveredTile =
        hoveredTile;

    clearMosaicRepulsionFrame();

    mosaicRepulsionFrame =
        window.requestAnimationFrame(
            function () {
                mosaicRepulsionFrame = null;

                applyMosaicRepulsion(
                    mosaicHoveredTile,
                    cursorX,
                    cursorY
                );
            }
        );
}

function renderMosaicLayout(layout) {
    mosaicGrid.innerHTML = "";

    layout.forEach((tileData, tilePosition) => {
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

        const isInitialMosaic =
            document.body.classList.contains(
                "initial-mosaic-mode"
            );

        if (isInitialMosaic) {
            const displacementSeed =
                (
                    (
                        tileData.imageIndex +
                        1
                    ) *
                    47 +
                    tilePosition *
                    29
                ) %
                101;

            const angleSeed =
                (
                    displacementSeed *
                    53 +
                    tilePosition *
                    17
                ) %
                360;

            const displacement =
                50 +
                displacementSeed /
                    100 *
                    50;

            const angle =
                angleSeed *
                Math.PI /
                180;

            const offsetX =
                Math.cos(angle) *
                displacement;

            const offsetY =
                Math.sin(angle) *
                displacement;

            tile.classList.add(
                "initial-thumbnail-entry"
            );

            tile.style.setProperty(
                "--initial-thumbnail-offset-x",
                `${offsetX.toFixed(1)}px`
            );

            tile.style.setProperty(
                "--initial-thumbnail-offset-y",
                `${offsetY.toFixed(1)}px`
            );

            const revealThumbnail =
                function () {
                    window.requestAnimationFrame(
                        function () {
                            window.requestAnimationFrame(
                                function () {
                                    tile.classList.add(
                                        "initial-thumbnail-visible"
                                    );

                                    window.setTimeout(
                                        function () {
                                            tile.classList.remove(
                                                "initial-thumbnail-entry",
                                                "initial-thumbnail-visible"
                                            );

                                            tile.style.removeProperty(
                                                "--initial-thumbnail-offset-x"
                                            );

                                            tile.style.removeProperty(
                                                "--initial-thumbnail-offset-y"
                                            );
                                        },
                                        1340
                                    );
                                }
                            );
                        }
                    );
                };

            if (image.complete) {
                revealThumbnail();
            } else {
                image.addEventListener(
                    "load",
                    revealThumbnail,
                    {
                        once: true
                    }
                );

                image.addEventListener(
                    "error",
                    revealThumbnail,
                    {
                        once: true
                    }
                );
            }
        }

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

    /*
    Track the pointer across the entire mosaic grid so the
    repulsion continues through the black gaps between
    photographs. A tile is enlarged only while the cursor
    is directly over that tile.
    */
    mosaicGrid.onpointermove =
        function (event) {
            const targetTile =
                event.target.closest(
                    ".mosaic-item"
                );

            queueMosaicRepulsion(
                targetTile,
                event.clientX,
                event.clientY
            );
        };

    mosaicGrid.onpointerleave =
        function () {
            resetMosaicRepulsion();
        };
}

function scaleExistingMosaicToPanel() {
    if (
        !filmstripExpanded ||
        mosaicBaseWidth <= 0 ||
        mosaicBaseHeight <= 0 ||
        mosaicGrid.children.length === 0
    ) {
        return;
    }

    const panelRect =
        mosaicPanel.getBoundingClientRect();

    const horizontalPadding = 24;
    const verticalPadding = 24;

    const availableWidth =
        Math.max(
            1,
            panelRect.width -
            horizontalPadding * 2
        );

    const availableHeight =
        Math.max(
            1,
            panelRect.height -
            verticalPadding * 2
        );

    const scale =
        Math.min(
            availableWidth / mosaicBaseWidth,
            availableHeight / mosaicBaseHeight
        );

    mosaicGrid.style.transform =
        `scale(${scale})`;
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

    mosaicBaseWidth = canvasWidth;
    mosaicBaseHeight = canvasHeight;

    mosaicGrid.style.width =
        `${canvasWidth}px`;

    mosaicGrid.style.height =
        `${canvasHeight}px`;

    mosaicGrid.style.transform =
        "scale(1)";

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

async function selectFirstPhotoFromInitialMosaic() {
    if (
        !document.body.classList.contains(
            "initial-mosaic-mode"
        ) ||
        mosaicSelectionRunning
    ) {
        return;
    }

    const timeoutAt =
        performance.now() + 3000;

    let firstTile = null;

    while (
        !firstTile &&
        performance.now() < timeoutAt
    ) {
        firstTile =
            mosaicGrid.querySelector(
                '.mosaic-item[data-image-index="0"]'
            );

        if (!firstTile) {
            await wait(50);
        }
    }

    if (firstTile) {
        selectMosaicImage(
            0,
            firstTile
        );
    }
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

    if (!filmstripExpanded) {
        resetMosaicRepulsion(true);
    }

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
            mosaicGrid.style.transform =
                "scale(1)";
            mosaicBaseWidth = 0;
            mosaicBaseHeight = 0;
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

function beginInitialUiVisibilityProtection() {
    initialUiProtectionUntil =
        performance.now() +
        initialUiProtectionDuration;

    document.body.classList.remove(
        "ui-idle"
    );

    scheduleInterfaceIdle();
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

    const protectionRemaining =
        Math.max(
            0,
            initialUiProtectionUntil -
            performance.now()
        );

    const delay =
        Math.max(
            interfaceIdleDelay,
            protectionRemaining
        );

    idleInterfaceTimer = window.setTimeout(
        function () {
            if (shouldKeepInterfaceVisible()) {
                return;
            }

            if (
                performance.now() <
                initialUiProtectionUntil
            ) {
                scheduleInterfaceIdle();
                return;
            }

            document.body.classList.add(
                "ui-idle"
            );
        },
        delay
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

function triggerMediaControlsPopAnimation() {
    window.clearTimeout(
        mediaControlsPopTimer
    );

    controls.classList.remove(
        "physics-pop"
    );

    void controls.offsetWidth;

    controls.classList.add(
        "physics-pop"
    );

    mediaControlsPopTimer =
        window.setTimeout(
            function () {
                controls.classList.remove(
                    "physics-pop"
                );
            },
            850
        );
}

function setMediaControlsCollapsed(
    collapsed,
    animateExpansion = false
) {
    const isExpanding =
        controlsCollapsed &&
        !collapsed;

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

    if (
        isExpanding &&
        animateExpansion
    ) {
        triggerMediaControlsPopAnimation();
    } else if (collapsed) {
        window.clearTimeout(
            mediaControlsPopTimer
        );

        controls.classList.remove(
            "physics-pop"
        );
    }
}

function toggleMediaControls(
    animateExpansion = false
) {
    setMediaControlsCollapsed(
        !controlsCollapsed,
        animateExpansion
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

filmstripButton.addEventListener(
    "click",
    toggleFilmstrip
);

thumbnailScrollLeft.addEventListener(
    "click",
    function () {
        scrollThumbnails(-1);
    }
);

thumbnailScrollRight.addEventListener(
    "click",
    function () {
        scrollThumbnails(1);
    }
);

thumbnailsContainer.addEventListener(
    "scroll",
    updateThumbnailScrollButtons,
    { passive: true }
);

thumbnailsContainer.addEventListener(
    "pointerdown",
    beginThumbnailDrag
);

thumbnailsContainer.addEventListener(
    "pointermove",
    moveThumbnailDrag
);

thumbnailsContainer.addEventListener(
    "pointerup",
    endThumbnailDrag
);

thumbnailsContainer.addEventListener(
    "pointercancel",
    endThumbnailDrag
);

mosaicOverlay.addEventListener(
    "click",
    function (event) {
        if (event.target !== mosaicOverlay) {
            return;
        }

        if (
            document.body.classList.contains(
                "initial-mosaic-mode"
            )
        ) {
            selectFirstPhotoFromInitialMosaic();
            return;
        }

        setFilmstripExpanded(false);
    }
);

window.addEventListener(
    "resize",
    function () {
        positionPhotoNavigationIndicators();
        updateThumbnailScrollButtons();

        if (!filmstripExpanded) {
            return;
        }

        window.clearTimeout(
            mosaicResizeTimer
        );

        mosaicResizeTimer =
            window.setTimeout(
                scaleExistingMosaicToPanel,
                80
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


document
    .getElementById("zoomIn")
    .addEventListener(
        "click",
        function () {
            zoomIn();
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
    function () {
        toggleMediaControls(true);
    }
);

helpOverlay.addEventListener(
    "click",
    function (event) {
        if (event.target === helpOverlay) {
            hideHelp();
        }
    }
);


function clearPhotoNavigationClickTimer() {
    if (photoNavigationClickTimer !== null) {
        window.clearTimeout(
            photoNavigationClickTimer
        );

        photoNavigationClickTimer = null;
    }
}

function isNearMediaControls(clientX, clientY) {
    const controlRect =
        controlArea.getBoundingClientRect();

    const safetyMargin = 22;

    return (
        clientX >=
            controlRect.left - safetyMargin &&
        clientX <=
            controlRect.right + safetyMargin &&
        clientY >=
            controlRect.top - safetyMargin &&
        clientY <=
            controlRect.bottom + safetyMargin
    );
}

function getPhotoNavigationDirection(
    clientX,
    clientY
) {
    if (
        zoomLevel !== minimumZoom ||
        isDragging ||
        transitionRunning ||
        filmstripExpanded ||
        helpOverlay.classList.contains("visible") ||
        !photo.complete ||
        photo.naturalWidth === 0
    ) {
        return null;
    }

    const photoRect =
        photo.getBoundingClientRect();

    /*
    The navigation zones span the left and right halves
    of the screen, but stop at the bottom edge of the
    displayed photograph.
    */
    if (
        clientY < 0 ||
        clientY > photoRect.bottom ||
        isNearMediaControls(clientX, clientY)
    ) {
        return null;
    }

    return clientX < window.innerWidth / 2
        ? "previous"
        : "next";
}

function positionPhotoNavigationIndicators() {
    if (
        !photo.complete ||
        photo.naturalWidth === 0
    ) {
        return;
    }

    const photoRect =
        photo.getBoundingClientRect();

    const verticalPosition =
        Math.max(
            photoRect.top + 48,
            photoRect.bottom - 124
        );

    previousPhotoIndicator.style.left =
        `${Math.max(
            0,
            photoRect.left - 52
        )}px`;

    previousPhotoIndicator.style.top =
        `${verticalPosition}px`;

    nextPhotoIndicator.style.left =
        `${Math.min(
            window.innerWidth - 52,
            photoRect.right
        )}px`;

    nextPhotoIndicator.style.top =
        `${verticalPosition}px`;
}

function updatePhotoNavigationIndicators(event) {
    positionPhotoNavigationIndicators();

    const direction =
        getPhotoNavigationDirection(
            event.clientX,
            event.clientY
        );

    previousPhotoIndicator.classList.toggle(
        "active",
        direction === "previous"
    );

    nextPhotoIndicator.classList.toggle(
        "active",
        direction === "next"
    );
}

function clearPhotoNavigationIndicators() {
    previousPhotoIndicator.classList.remove(
        "active"
    );

    nextPhotoIndicator.classList.remove(
        "active"
    );
}

function handlePhotoNavigationClick(event) {
    if (event.detail > 1) {
        clearPhotoNavigationClickTimer();
        return;
    }

    if (
        event.button !== 0 ||
        event.target.closest(
            "button, input, a, #bottomZoomControls, " +
            "#controlArea, #loadingIndicator, " +
            "#thumbnailBar"
        )
    ) {
        return;
    }

    const direction =
        getPhotoNavigationDirection(
            event.clientX,
            event.clientY
        );

    if (direction === null) {
        return;
    }

    clearPhotoNavigationClickTimer();

    photoNavigationClickTimer =
        window.setTimeout(
            function () {
                photoNavigationClickTimer = null;

                const currentDirection =
                    getPhotoNavigationDirection(
                        event.clientX,
                        event.clientY
                    );

                if (
                    currentDirection ===
                    "previous"
                ) {
                    previousPhotoIndicator.classList.add(
                        "clicked"
                    );

                    previousImage();
                } else if (
                    currentDirection ===
                    "next"
                ) {
                    nextPhotoIndicator.classList.add(
                        "clicked"
                    );

                    nextImage();
                }
            },
            300
        );
}

viewer.addEventListener(
    "wheel",
    function (event) {
        if (
            event.target.closest(
                "#bottomZoomControls"
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

        const normalizedDelta =
            normalizeWheelDelta(event);

        const inputType =
            classifyWheelInput(
                event,
                normalizedDelta
            );

        queueWheelZoom(
            normalizedDelta,
            anchor.x,
            anchor.y,
            inputType
        );
    },
    { passive: false }
);

viewer.addEventListener(
    "pointermove",
    updatePhotoNavigationIndicators
);

viewer.addEventListener(
    "pointerleave",
    clearPhotoNavigationIndicators
);

viewer.addEventListener(
    "click",
    handlePhotoNavigationClick
);

viewer.addEventListener(
    "dblclick",
    function (event) {
        clearPhotoNavigationClickTimer();
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

        if (filmstripExpanded) {
            window.setTimeout(
                scaleExistingMosaicToPanel,
                120
            );
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
            if (
                document.body.classList.contains(
                    "initial-mosaic-mode"
                )
            ) {
                event.preventDefault();
                selectFirstPhotoFromInitialMosaic();
                return;
            }

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
            toggleMediaControls(true);
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
    helpPanel
].forEach(keepInterfaceVisibleWhileHovered);

document.addEventListener(
    "pointerdown",
    wakeInterface
);

updateToggleButtonState();
scheduleInterfaceIdle();
