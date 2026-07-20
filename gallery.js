const version = "v1.6.63";
document.getElementById("version").textContent = version;

const params = new URLSearchParams(window.location.search);
const collection = params.get("collection");

const viewer = document.getElementById("viewer");
const backLink =
    document.getElementById("backLink");
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
const mosaicReshuffleButton =
    document.getElementById("mosaicReshuffleButton");
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
const initialMosaicFullscreenButton =
    document.getElementById(
        "initialMosaicFullscreenButton"
    );
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
let pendingPhotoFadeOutPromise = null;

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
let loadingIndicatorTimer = null;
let idleInterfaceTimer = null;
let initialUiProtectionUntil = 0;
let initialMosaicChromeRevealRequested = false;
let filmstripExpanded = false;
let mosaicBuildToken = 0;
let expandedMosaicEntryToken = 0;
let expandedMosaicAnimations = [];
let mosaicReshuffleRunning = false;
let mosaicAutoReshuffleActive = false;
let mosaicAutoReshuffleTimer = null;
let mosaicReshuffleSeed = 0;
let currentMosaicLayout = [];
let savedMosaicOrder = null;
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
const fadeDuration = 700;
const zoomControlsHideDelay = 650;
const loadingIndicatorDelay = 2000;
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
        "leaving",
        "bottom-entry"
    );

    if (
        message === "Auto Shuffle Started" ||
        message === "Auto Shuffle Stopped"
    ) {
        modeToast.classList.add(
            "bottom-entry"
        );
    }

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
                    modeToast.classList.remove(
                        "leaving",
                        "bottom-entry"
                    );
                },
                500
            );
        },
        3900
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
}

function waitForTwoFrames() {
    return new Promise(resolve => {
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(resolve);
        });
    });
}

function waitForOverlayTransition(
    fallbackDuration = fadeDuration
) {
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
            fallbackDuration + 100
        );
    });
}

function beginPhotoFadeOut() {
    if (
        displayedIndex === -1 ||
        mosaicSelectionRunning
    ) {
        return Promise.resolve();
    }

    if (fadeOverlay.classList.contains("visible")) {
        return (
            pendingPhotoFadeOutPromise ||
            Promise.resolve()
        );
    }

    pendingPhotoFadeOutPromise =
        waitForOverlayTransition(440)
            .finally(function () {
                pendingPhotoFadeOutPromise = null;
            });

    fadeOverlay.classList.add("visible");

    return pendingPhotoFadeOutPromise;
}

function coverPhotoWithBlackOverlayInstantly() {
    /*
    Mosaic selections already cover the viewer visually, so
    put the simple black overlay at full opacity without
    animating the large photographic texture underneath.
    */
    fadeOverlay.classList.add(
        "instant-black"
    );

    fadeOverlay.classList.add(
        "visible"
    );

    void fadeOverlay.offsetWidth;

    fadeOverlay.classList.remove(
        "instant-black"
    );
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
            loadingIndicator.classList.add("visible");
        },
        loadingIndicatorDelay
    );
}

function hideLoadingIndicator() {
    window.clearTimeout(loadingIndicatorTimer);
    loadingIndicator.classList.remove("visible");
}

async function hideLoadingIndicatorAfterFadeStarts() {
    /*
    Keep the loader visible through the first 0.1 seconds of
    the newly loaded photograph's fade-in.
    */
    await wait(100);
    hideLoadingIndicator();
}

async function transitionToImage(index) {
    const src = images[index];
    let loadedImage;

    /*
    Keep the photographic layer static while any black-overlay
    transition is running. Autoplay motion resumes only after
    the overlay has completely cleared.
    */
    stopAutoplayPan();
    showLoadingIndicator();

    const shouldUseNormalFade =
        displayedIndex !== -1 &&
        displayedIndex !== index &&
        !mosaicSelectionRunning;

    const fadeOutPromise =
        shouldUseNormalFade
            ? beginPhotoFadeOut()
            : Promise.resolve();

    try {
        [
            loadedImage
        ] = await Promise.all([
            getCachedImage(src, true),
            fadeOutPromise
        ]);
    } catch (error) {
        if (shouldUseNormalFade) {
            fadeOverlay.classList.remove("visible");
        }

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

        /*
        A startup mosaic selection owns the visible reveal.
        For any direct first-image load, reveal through the
        same simple black overlay.
        */
        if (!mosaicSelectionRunning) {
            if (
                !fadeOverlay.classList.contains(
                    "visible"
                )
            ) {
                coverPhotoWithBlackOverlayInstantly();
            }

            const photoReveal =
                waitForOverlayTransition(
                    fadeDuration
                );

            fadeOverlay.classList.remove(
                "visible"
            );

            const loaderDismissal =
                hideLoadingIndicatorAfterFadeStarts();

            await photoReveal;
            await loaderDismissal;
            restartAutoplayPan(displayedIndex);
            expandMediaControlsAfterFirstImageLoad();
        }

        return;
    }

    if (displayedIndex === index) {
        updateThumbnails(displayedIndex, null);
        restartAutoplayPan(displayedIndex);
        hideLoadingIndicator();
        return;
    }

    /*
    A mosaic selection already holds the simple black overlay
    at full opacity. Swap the cached/decoded source underneath
    it without animating the photographic texture.
    */
    if (mosaicSelectionRunning) {
        photo.style.visibility = "hidden";
        photo.src = loadedSource;

        await waitForDisplayedPhoto();
        await waitForTwoFrames();

        displayedIndex = index;
        photo.style.visibility = "visible";

        updateThumbnails(displayedIndex, null);
        positionPhotoNavigationIndicators();

        previousPhotoIndicator.classList.remove(
            "clicked"
        );

        nextPhotoIndicator.classList.remove(
            "clicked"
        );

        return;
    }

    /*
    The fade-out started as soon as navigation was requested
    and ran in parallel with the full-size image download and
    decode. At this point both are complete.
    */
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

    const photoReveal =
        waitForOverlayTransition(
            fadeDuration
        );

    fadeOverlay.classList.remove("visible");

    const loaderDismissal =
        hideLoadingIndicatorAfterFadeStarts();

    await photoReveal;
    await loaderDismissal;
    restartAutoplayPan(displayedIndex);

    previousPhotoIndicator.classList.remove(
        "clicked"
    );

    nextPhotoIndicator.classList.remove(
        "clicked"
    );
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

    if (
        displayedIndex !== -1 &&
        current !== displayedIndex &&
        !mosaicSelectionRunning
    ) {
        beginPhotoFadeOut();
    }

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

    /*
    Finish the normal highlighted-photo transition before
    applying autoplay-specific body classes.
    */
    if (
        !document.body.classList.contains(
            "ui-hidden"
        )
    ) {
        await enterHideMode("Autoplay Mode");
    } else {
        showModeToast("Autoplay Mode");
    }

    autoplayActive = true;
    autoplayPlaying = true;

    updateAutoplayDisplay();
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

    if (
        !document.body.classList.contains(
            "ui-hidden"
        )
    ) {
        await enterHideMode("Autoplay Mode");
    } else {
        showModeToast("Autoplay Mode");
    }

    autoplayActive = true;
    autoplayPlaying = true;

    updateAutoplayDisplay();
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

function getPhotoPanLimits() {
    const photoStage =
        document.getElementById("photoStage");

    if (
        !photoStage ||
        !photo.complete ||
        photo.naturalWidth === 0 ||
        photo.naturalHeight === 0 ||
        photoStage.clientWidth <= 0 ||
        photoStage.clientHeight <= 0
    ) {
        return {
            x: 0,
            y: 0
        };
    }

    /*
    Build the smallest centered rectangle that:
    - completely contains the fitted photograph
    - has the same aspect ratio as the visible display stage

    Pan limits are calculated from this display-shaped
    envelope rather than directly from the photo dimensions.
    Portrait photographs therefore retain useful horizontal
    movement, while landscape photographs retain useful
    vertical movement.
    */
    const fittedWidth =
        photo.offsetWidth;

    const fittedHeight =
        photo.offsetHeight;

    const displayAspectRatio =
        photoStage.clientWidth /
        photoStage.clientHeight;

    const photoAspectRatio =
        fittedWidth /
        fittedHeight;

    let envelopeWidth;
    let envelopeHeight;

    if (
        photoAspectRatio >
        displayAspectRatio
    ) {
        envelopeWidth =
            fittedWidth;

        envelopeHeight =
            fittedWidth /
            displayAspectRatio;
    } else {
        envelopeHeight =
            fittedHeight;

        envelopeWidth =
            fittedHeight *
            displayAspectRatio;
    }

    const scaledEnvelopeWidth =
        envelopeWidth * zoomLevel;

    const scaledEnvelopeHeight =
        envelopeHeight * zoomLevel;

    return {
        x:
            Math.max(
                0,
                (
                    scaledEnvelopeWidth -
                    photoStage.clientWidth
                ) / 2
            ),
        y:
            Math.max(
                0,
                (
                    scaledEnvelopeHeight -
                    photoStage.clientHeight
                ) / 2
            )
    };
}

function clampPhotoPan() {
    if (zoomLevel <= minimumZoom) {
        panX = 0;
        panY = 0;
        return;
    }

    const limits =
        getPhotoPanLimits();

    panX =
        Math.max(
            -limits.x,
            Math.min(limits.x, panX)
        );

    panY =
        Math.max(
            -limits.y,
            Math.min(limits.y, panY)
        );
}

function updateZoom() {
    clampPhotoPan();

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

const mosaicPreferredGap = 7;

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

    const isInitialSelection =
        document.body.classList.contains(
            "initial-mosaic-mode"
        );

    const timing =
        isInitialSelection
            ? {
                minimumBeforeReveal: 1050,
                overlayClose: 300,
                imageFadeIn: 1600,
                controlsDelay: 200
            }
            : {
                minimumBeforeReveal: 440,
                overlayClose: 260,
                imageFadeIn: 700,
                controlsDelay: 0
            };

    const selectionClass =
        isInitialSelection
            ? "initial-mosaic-selection"
            : "normal-mosaic-selection";

    mosaicSelectionRunning = true;

    if (isInitialSelection) {
        filmstripButton.classList.remove(
            "active"
        );

        filmstripButton.setAttribute(
            "aria-pressed",
            "false"
        );

        mosaicReshuffleButton.hidden = true;

        /*
        Every first-view exit now uses the exact same path as
        clicking a photograph: the highlighted tile, mosaic
        frame, collapse button, and Full Screen button all
        complete the established selection transition.
        */
        document.body.classList.add(
            "initial-mosaic-controls-exiting"
        );
    } else {
        document.body.classList.add(
            "mosaic-selection-buttons-hidden"
        );
    }

    try {
        resetMosaicRepulsion(true);

        document.body.classList.add(
            "mosaic-photo-transition",
            "mosaic-selection-active",
            selectionClass
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

        mosaicOverlay.classList.add(
            "priority-selection"
        );

        void selectedTile.getBoundingClientRect();
        void photo.getBoundingClientRect();

        /*
        Keep the full-resolution image at full opacity and
        static. A plain black rectangle covers it while the
        source changes, avoiding GPU texture-tile seams.
        */
        stopAutoplayPan();
        coverPhotoWithBlackOverlayInstantly();

        mosaicOverlay.classList.add(
            "selecting"
        );

        current = imageIndex;
        requestImageChange();

        await Promise.all([
            waitForDisplayedIndex(
                imageIndex
            ),
            wait(
                timing.minimumBeforeReveal
            )
        ]);

        if (isInitialSelection) {
            /*
            The 1.05-second fade is now complete. Fully
            unload the first-view controls before closing the
            mosaic so neither can pop or be clipped midway.
            */
            filmstripButton.hidden = true;
            initialMosaicFullscreenButton.hidden = true;

            document.body.classList.remove(
                "initial-mosaic-controls-ready",
                "initial-mosaic-controls-exiting"
            );

            document.body.classList.add(
                "initial-player-ui-held"
            );
        }

        /*
        Close the mosaic only after the first-view chrome has
        completed its own fade.
        */
        setFilmstripExpanded(
            false,
            true
        );

        if (!isInitialSelection) {
            /*
            Restore the expand button at the same moment the
            thumbnail bar begins returning. Its position is
            reset while still invisible, then the hidden
            state is removed so both use the same 0.28-second
            opacity transition.
            */
            filmstripButton.style.left =
                "20px";

            filmstripButton.style.bottom =
                "16px";

            filmstripButton.style.top =
                "auto";

            void filmstripButton.getBoundingClientRect();

            document.body.classList.remove(
                "mosaic-selection-buttons-hidden"
            );
        }

        if (isInitialSelection) {
            filmstripButton.style.left =
                "20px";

            filmstripButton.style.bottom =
                "16px";

            filmstripButton.style.top =
                "auto";

            /*
            Restore the normal player expand button while
            the entire player UI is still fully hidden. It
            then shares the exact thumbnail-bar reveal.
            */
            filmstripButton.hidden = false;
            void filmstripButton.getBoundingClientRect();

            initialMosaicFullscreenButton.hidden = true;
            mosaicReshuffleButton.hidden = true;

            document.body.classList.remove(
                "initial-mosaic-controls-exiting"
            );

            /*
            The held state keeps the complete player UI at
            opacity zero while the button is restored at the
            default location. Removing the held state starts
            one shared 1.3-second fade for the thumbnail bar
            and the expand button inside it.
            */
            document.body.classList.add(
                "initial-gallery-reveal"
            );

            document.body.classList.remove(
                "initial-mosaic-mode"
            );

            void thumbnailBar.getBoundingClientRect();

            await waitForTwoFrames();

            document.body.classList.remove(
                "initial-player-ui-held"
            );
        } else {
            await waitForTwoFrames();
        }

        /*
        Reveal the loaded photo by fading only the black
        overlay. The photo itself remains opacity 1 and does
        not transform while this transition runs.
        */
        const imageFadeIn =
            waitForOverlayTransition(
                timing.imageFadeIn
            );

        fadeOverlay.classList.remove(
            "visible"
        );

        const loaderDismissal =
            hideLoadingIndicatorAfterFadeStarts();

        await wait(
            timing.overlayClose
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

        await imageFadeIn;
        await loaderDismissal;
        restartAutoplayPan(displayedIndex);

        document.body.classList.remove(
            "mosaic-photo-transition",
            "mosaic-selection-active",
            selectionClass
        );

        if (isInitialSelection) {
            document.body.classList.remove(
                "initial-gallery-reveal"
            );

            beginInitialUiVisibilityProtection();

            await wait(
                timing.controlsDelay
            );

            expandMediaControlsAfterFirstImageLoad();
        }
    } finally {
        mosaicOverlay.classList.remove(
            "selecting",
            "priority-selection"
        );

        document.body.classList.remove(
            "mosaic-photo-transition",
            "mosaic-selection-active",
            "initial-mosaic-selection",
            "normal-mosaic-selection",
            "initial-mosaic-controls-exiting",
            "initial-player-ui-held"
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

        /*
        Never leave the viewer covered if an unexpected image
        or transition error interrupts a mosaic selection.
        */
        fadeOverlay.classList.remove(
            "visible",
            "instant-black"
        );

        if (
            isInitialSelection &&
            !document.body.classList.contains(
                "initial-mosaic-mode"
            )
        ) {
            /*
            Keep the reshuffle control suppressed after the
            first-view transition. The expand button has
            already been restored earlier while the player UI
            was still hidden.
            */
            mosaicReshuffleButton.hidden = true;
        }

        mosaicSelectionRunning = false;
    }
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
    currentMosaicLayout =
        layout.map(tile => ({
            ...tile
        }));

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
                    if (
                        !initialMosaicChromeRevealRequested
                    ) {
                        initialMosaicChromeRevealRequested =
                            true;

                        if (
                            document.body.classList.contains(
                                "initial-mosaic-controls-ready"
                            )
                        ) {
                            document.body.classList.add(
                                "initial-mosaic-chrome-visible"
                            );
                        }
                    }

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

    const isInitialMosaic =
        document.body.classList.contains(
            "initial-mosaic-mode"
        );

    let layout = [];

    if (
        !isInitialMosaic &&
        Array.isArray(savedMosaicOrder) &&
        savedMosaicOrder.length ===
            aspectRatios.length
    ) {
        layout =
            generateMosaicLayoutFromOrder(
                aspectRatios,
                canvasWidth,
                canvasHeight,
                savedMosaicOrder
            );
    }

    if (layout.length === 0) {
        layout =
            generateBestMosaicLayout(
                aspectRatios,
                canvasWidth,
                canvasHeight
            );
    }

    if (
        !filmstripExpanded ||
        buildToken !== mosaicBuildToken
    ) {
        return;
    }

    renderMosaicLayout(layout);

    if (
        !document.body.classList.contains(
            "initial-mosaic-mode"
        )
    ) {
        animateExpandedMosaicFromThumbnailBar();
    }
}

async function selectHighlightedPhotoFromInitialMosaic() {
    if (
        !document.body.classList.contains(
            "initial-mosaic-mode"
        )
    ) {
        return false;
    }

    /*
    If a selection is already underway, wait for that exact
    transition instead of starting a competing exit.
    */
    while (mosaicSelectionRunning) {
        await wait(25);

        if (
            !document.body.classList.contains(
                "initial-mosaic-mode"
            )
        ) {
            return true;
        }
    }

    const timeoutAt =
        performance.now() + 3000;

    let highlightedTile = null;

    while (
        !highlightedTile &&
        performance.now() < timeoutAt
    ) {
        highlightedTile =
            mosaicGrid.querySelector(
                ".mosaic-item.active"
            ) ||
            mosaicGrid.querySelector(
                `.mosaic-item[data-image-index="${current}"]`
            ) ||
            mosaicGrid.querySelector(
                ".mosaic-item"
            );

        if (!highlightedTile) {
            await wait(50);
        }
    }

    if (!highlightedTile) {
        return false;
    }

    const highlightedIndex =
        Number(
            highlightedTile.dataset.imageIndex
        );

    await selectMosaicImage(
        Number.isFinite(highlightedIndex)
            ? highlightedIndex
            : current,
        highlightedTile
    );

    return true;
}

function setThumbnailBarImageBlackout(enabled) {
    thumbnailsContainer
        .querySelectorAll(".thumb")
        .forEach(thumbnail => {
            if (enabled) {
                thumbnail.style.setProperty(
                    "filter",
                    "brightness(0)",
                    "important"
                );

                thumbnail.style.setProperty(
                    "opacity",
                    "1",
                    "important"
                );

                thumbnail.style.setProperty(
                    "background-color",
                    "black"
                );

                thumbnail.style.setProperty(
                    "box-shadow",
                    "inset 0 0 0 1px " +
                    "rgba(255, 255, 255, 0.28)"
                );

                thumbnail.style.setProperty(
                    "transition",
                    "none",
                    "important"
                );
            } else {
                thumbnail.style.removeProperty(
                    "filter"
                );

                thumbnail.style.removeProperty(
                    "opacity"
                );

                thumbnail.style.removeProperty(
                    "background-color"
                );

                thumbnail.style.removeProperty(
                    "box-shadow"
                );

                thumbnail.style.removeProperty(
                    "transition"
                );
            }
        });
}

function cancelExpandedMosaicEntry() {
    expandedMosaicEntryToken += 1;

    expandedMosaicAnimations.forEach(
        animation => {
            try {
                animation.cancel();
            } catch (error) {
                /*
                A completed animation may already have
                released its target.
                */
            }
        }
    );

    expandedMosaicAnimations = [];

    mosaicGrid
        .querySelectorAll(
            ".expanded-mosaic-entering"
        )
        .forEach(tile => {
            tile.classList.remove(
                "expanded-mosaic-entering"
            );

            tile.style.removeProperty(
                "opacity"
            );

            tile.style.removeProperty(
                "transform"
            );

            tile.style.removeProperty(
                "pointer-events"
            );
        });

    document.body.classList.remove(
        "expanded-mosaic-entry-active"
    );
}

async function animateExpandedMosaicFromThumbnailBar() {
    if (
        document.body.classList.contains(
            "initial-mosaic-mode"
        ) ||
        !filmstripExpanded
    ) {
        return;
    }

    cancelExpandedMosaicEntry();

    const animationToken =
        expandedMosaicEntryToken;

    /*
    Let the overlay and mosaic panel establish their visible
    geometry before measuring destination positions.
    */
    await waitForTwoFrames();

    if (
        !filmstripExpanded ||
        animationToken !==
            expandedMosaicEntryToken
    ) {
        return;
    }

    const tiles =
        Array.from(
            mosaicGrid.querySelectorAll(
                ".mosaic-item"
            )
        );

    if (tiles.length === 0) {
        return;
    }

    document.body.classList.add(
        "expanded-mosaic-entry-active"
    );

    const barRect =
        thumbnailsContainer.getBoundingClientRect();

    const reducedMotion =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

    const tileAnimations =
        tiles.map(
            async (tile, tilePosition) => {
                const image =
                    tile.querySelector("img");

                if (
                    image &&
                    !image.complete
                ) {
                    tile.style.opacity = "0";

                    await new Promise(resolve => {
                        image.addEventListener(
                            "load",
                            resolve,
                            {
                                once: true
                            }
                        );

                        image.addEventListener(
                            "error",
                            resolve,
                            {
                                once: true
                            }
                        );
                    });
                }

                if (
                    !filmstripExpanded ||
                    animationToken !==
                        expandedMosaicEntryToken
                ) {
                    return;
                }

                const destinationRect =
                    tile.getBoundingClientRect();

                const destinationCenterX =
                    destinationRect.left +
                    destinationRect.width / 2;

                const destinationCenterY =
                    destinationRect.top +
                    destinationRect.height / 2;

                const gridRect =
                    mosaicGrid.getBoundingClientRect();

                const gridCenterX =
                    gridRect.left +
                    gridRect.width / 2;

                const gridCenterY =
                    gridRect.top +
                    gridRect.height / 2;

                const fromCenterX =
                    destinationCenterX -
                    gridCenterX;

                const fromCenterY =
                    destinationCenterY -
                    gridCenterY;

                const distanceFromCenter =
                    Math.hypot(
                        fromCenterX,
                        fromCenterY
                    );

                const maximumGridDistance =
                    Math.max(
                        1,
                        Math.hypot(
                            gridRect.width / 2,
                            gridRect.height / 2
                        )
                    );

                const normalizedDistance =
                    Math.min(
                        1,
                        distanceFromCenter /
                        maximumGridDistance
                    );

                /*
                Tiles begin inward, toward the mosaic center.
                Center tiles move about 10 px; edge tiles move
                up to 80 px.
                */
                const inwardDistance =
                    10 +
                    normalizedDistance *
                    70;

                const directionX =
                    distanceFromCenter > 0
                        ? fromCenterX /
                            distanceFromCenter
                        : 0;

                const directionY =
                    distanceFromCenter > 0
                        ? fromCenterY /
                            distanceFromCenter
                        : -1;

                const offsetX =
                    -directionX *
                    inwardDistance;

                const offsetY =
                    -directionY *
                    inwardDistance;

                /*
                Scaling follows the same distance profile:
                subtle near the center and stronger near the
                outside of the grid.
                */
                const startScale =
                    0.94 -
                    normalizedDistance *
                    0.16;

                const finalOpacity =
                    tile.classList.contains(
                        "active"
                    )
                        ? 1
                        : 0.96;

                tile.classList.add(
                    "expanded-mosaic-entering"
                );

                /*
                Do not use !important here. Important inline
                declarations would override the Web
                Animations API and prevent visible motion.
                */
                tile.style.opacity = "0";

                tile.style.transform =
                    `translate3d(` +
                    `${offsetX.toFixed(1)}px, ` +
                    `${offsetY.toFixed(1)}px, 0) ` +
                    `scale(${startScale.toFixed(4)})`;

                tile.style.pointerEvents =
                    "none";

                void tile.getBoundingClientRect();

                if (reducedMotion) {
                    tile.classList.remove(
                        "expanded-mosaic-entering"
                    );

                    tile.style.removeProperty(
                        "opacity"
                    );

                    tile.style.removeProperty(
                        "transform"
                    );

                    tile.style.removeProperty(
                        "pointer-events"
                    );

                    return;
                }

                /*
                Match the first-view population timing:
                movement 1.3 s, opacity 1.2 s.
                */
                const movement =
                    tile.animate(
                        [
                            {
                                transform:
                                    `translate3d(` +
                                    `${offsetX.toFixed(1)}px, ` +
                                    `${offsetY.toFixed(1)}px, 0) ` +
                                    `scale(${startScale.toFixed(4)})`
                            },
                            {
                                transform:
                                    "translate3d(0, 0, 0) " +
                                    "scale(1)"
                            }
                        ],
                        {
                            duration: 700,
                            easing:
                                "cubic-bezier(" +
                                "0.25, 0.75, " +
                                "0.45, 1)",
                            fill: "forwards"
                        }
                    );

                const fade =
                    tile.animate(
                        [
                            {
                                opacity: 0
                            },
                            {
                                opacity:
                                    finalOpacity
                            }
                        ],
                        {
                            duration: 700,
                            easing:
                                "cubic-bezier(" +
                                "0.25, 0.75, " +
                                "0.45, 1)",
                            fill: "forwards"
                        }
                    );

                expandedMosaicAnimations.push(
                    movement,
                    fade
                );

                await Promise.all([
                    movement.finished
                        .catch(() => undefined),
                    fade.finished
                        .catch(() => undefined)
                ]);

                if (
                    animationToken !==
                        expandedMosaicEntryToken
                ) {
                    return;
                }

                tile.classList.remove(
                    "expanded-mosaic-entering"
                );

                tile.style.removeProperty(
                    "opacity"
                );

                tile.style.removeProperty(
                    "transform"
                );

                tile.style.removeProperty(
                    "pointer-events"
                );

                try {
                    movement.cancel();
                    fade.cancel();
                } catch (error) {
                    /*
                    The final mosaic CSS state is already
                    active.
                    */
                }
            }
        );

    await Promise.all(
        tileAnimations
    );

    if (
        animationToken ===
            expandedMosaicEntryToken
    ) {
        expandedMosaicAnimations = [];

        document.body.classList.remove(
            "expanded-mosaic-entry-active"
        );
    }
}

function positionFilmstripButtonBesideMosaic() {
    const defaultLeft = 20;
    const defaultBottom = 16;

    if (!filmstripExpanded) {
        filmstripButton.style.left =
            `${defaultLeft}px`;

        filmstripButton.style.bottom =
            `${defaultBottom}px`;

        filmstripButton.style.top =
            "auto";

        positionMosaicReshuffleButton();

        return;
    }

    const panelRect =
        mosaicPanel.getBoundingClientRect();

    const shuffleWidth =
        mosaicReshuffleButton.offsetWidth ||
        48;

    const panelGap = 28;
    const verticalInset = 12;

    /*
    Match the media-control panel's 58 px center-to-center
    spacing: 48 px circular buttons with a 10 px gap.
    */
    const verticalButtonStep = 58;

    const buttonLeft =
        Math.max(
            12,
            panelRect.left -
            shuffleWidth -
            panelGap
        );

    const isInitialMosaic =
        document.body.classList.contains(
            "initial-mosaic-mode"
        );

    const bottom =
        Math.max(
            12,
            window.innerHeight -
            panelRect.bottom +
            verticalInset
        );

    /*
    The initial mosaic still shows only the collapse button.
    In the normal mosaic, collapse takes the old shuffle
    position and shuffle stacks directly above it.
    */
    filmstripButton.style.left =
        `${buttonLeft.toFixed(1)}px`;

    filmstripButton.style.bottom =
        `${bottom.toFixed(1)}px`;

    filmstripButton.style.top =
        "auto";

    if (!isInitialMosaic) {
        mosaicReshuffleButton.style.left =
            `${buttonLeft.toFixed(1)}px`;

        mosaicReshuffleButton.style.bottom =
            `${(
                bottom +
                verticalButtonStep
            ).toFixed(1)}px`;
    }

    if (isInitialMosaic) {
        initialMosaicFullscreenButton.style.left =
            `${(
                panelRect.left +
                panelRect.width / 2
            ).toFixed(1)}px`;

        initialMosaicFullscreenButton.style.top =
            `${(
                panelRect.bottom +
                14
            ).toFixed(1)}px`;
    }
}

function scheduleFilmstripButtonPosition() {
    const positioningInitialMosaic =
        filmstripExpanded &&
        document.body.classList.contains(
            "initial-mosaic-mode"
        );

    if (positioningInitialMosaic) {
        document.body.classList.remove(
            "initial-mosaic-controls-ready"
        );
    }

    window.requestAnimationFrame(
        function () {
            window.requestAnimationFrame(
                function () {
                    positionFilmstripButtonBesideMosaic();

                    if (
                        filmstripExpanded &&
                        document.body.classList.contains(
                            "initial-mosaic-mode"
                        )
                    ) {
                        document.body.classList.add(
                            "initial-mosaic-controls-ready"
                        );

                        if (
                            initialMosaicChromeRevealRequested
                        ) {
                            document.body.classList.add(
                                "initial-mosaic-chrome-visible"
                            );
                        }
                    }
                }
            );
        }
    );
}

function createSeededRandom(seed) {
    let value = seed >>> 0;

    return function () {
        value += 0x6D2B79F5;

        let result = value;

        result =
            Math.imul(
                result ^ result >>> 15,
                result | 1
            );

        result ^=
            result +
            Math.imul(
                result ^ result >>> 7,
                result | 61
            );

        return (
            (
                result ^
                result >>> 14
            ) >>> 0
        ) / 4294967296;
    };
}

function createShuffledImageOrder(
    imageCount,
    seed
) {
    const order =
        Array.from(
            {
                length: imageCount
            },
            (
                _,
                index
            ) => index
        );

    const random =
        createSeededRandom(seed);

    for (
        let index =
            order.length - 1;
        index > 0;
        index--
    ) {
        const swapIndex =
            Math.floor(
                random() *
                (
                    index +
                    1
                )
            );

        [
            order[index],
            order[swapIndex]
        ] = [
            order[swapIndex],
            order[index]
        ];
    }

    return order;
}

function remapShuffledLayout(
    shuffledLayout,
    shuffledOrder
) {
    return shuffledLayout.map(tile => ({
        ...tile,
        imageIndex:
            shuffledOrder[
                tile.imageIndex
            ]
    }));
}

function generateMosaicLayoutFromOrder(
    aspectRatios,
    canvasWidth,
    canvasHeight,
    imageOrder
) {
    if (
        !Array.isArray(imageOrder) ||
        imageOrder.length !==
            aspectRatios.length
    ) {
        return [];
    }

    const orderedRatios =
        imageOrder.map(
            imageIndex =>
                aspectRatios[
                    imageIndex
                ]
        );

    return remapShuffledLayout(
        generateJustifiedMosaicLayout(
            orderedRatios,
            canvasWidth,
            canvasHeight
        ),
        imageOrder
    );
}

function measureLayoutDifference(
    firstLayout,
    secondLayout
) {
    if (
        firstLayout.length === 0 ||
        firstLayout.length !==
            secondLayout.length
    ) {
        return Infinity;
    }

    const secondByImage =
        new Map(
            secondLayout.map(
                tile => [
                    tile.imageIndex,
                    tile
                ]
            )
        );

    let totalDifference = 0;

    firstLayout.forEach(tile => {
        const other =
            secondByImage.get(
                tile.imageIndex
            );

        if (!other) {
            totalDifference += 1000;
            return;
        }

        totalDifference +=
            Math.hypot(
                tile.x - other.x,
                tile.y - other.y
            ) +
            Math.abs(
                tile.width -
                other.width
            ) *
            0.5 +
            Math.abs(
                tile.height -
                other.height
            ) *
            0.5;
    });

    return (
        totalDifference /
        firstLayout.length
    );
}

function generateReshuffledMosaicLayout(
    aspectRatios,
    canvasWidth,
    canvasHeight
) {
    let bestCandidate = null;
    let bestOrder = null;
    let bestDifference = -Infinity;

    for (
        let attempt = 0;
        attempt < 8;
        attempt++
    ) {
        mosaicReshuffleSeed += 1;

        const order =
            createShuffledImageOrder(
                aspectRatios.length,
                (
                    mosaicReshuffleSeed *
                    2654435761
                ) >>> 0
            );

        const shuffledRatios =
            order.map(
                imageIndex =>
                    aspectRatios[
                        imageIndex
                    ]
            );

        const candidate =
            remapShuffledLayout(
                generateJustifiedMosaicLayout(
                    shuffledRatios,
                    canvasWidth,
                    canvasHeight
                ),
                order
            );

        const difference =
            measureLayoutDifference(
                currentMosaicLayout,
                candidate
            );

        if (
            difference >
            bestDifference
        ) {
            bestDifference =
                difference;

            bestCandidate =
                candidate;

            bestOrder =
                order.slice();
        }

        if (difference >= 70) {
            break;
        }
    }

    return {
        layout:
            bestCandidate || [],
        order:
            bestOrder || []
    };
}

async function reshuffleMosaic() {
    if (
        !filmstripExpanded ||
        mosaicSelectionRunning ||
        mosaicReshuffleRunning ||
        document.body.classList.contains(
            "initial-mosaic-mode"
        )
    ) {
        return;
    }

    const tiles =
        Array.from(
            mosaicGrid.querySelectorAll(
                ".mosaic-item"
            )
        );

    if (tiles.length === 0) {
        return;
    }

    mosaicReshuffleRunning = true;

    mosaicGrid.classList.add(
        "reshuffling"
    );

    mosaicReshuffleButton.classList.add(
        "reshuffling"
    );

    resetMosaicRepulsion(true);

    const activeAnimations = [];

    try {
        const aspectRatios =
            await getThumbnailAspectRatios();

        if (!filmstripExpanded) {
            return;
        }

        const reshuffleResult =
            generateReshuffledMosaicLayout(
                aspectRatios,
                mosaicBaseWidth,
                mosaicBaseHeight
            );

        const newLayout =
            reshuffleResult.layout;

        if (
            newLayout.length !==
            tiles.length
        ) {
            return;
        }

        const oldLayoutByImage =
            new Map(
                currentMosaicLayout.map(
                    tile => [
                        tile.imageIndex,
                        tile
                    ]
                )
            );

        const newLayoutByImage =
            new Map(
                newLayout.map(
                    tile => [
                        tile.imageIndex,
                        tile
                    ]
                )
            );

        /*
        Forward-transform animation:

        The tiles keep their existing left, top, width, and
        height for the entire animation. Therefore the first
        animation frame is exactly the currently displayed
        grid: translate 0 and scale 1.

        Only after every animation reaches its target do we
        commit the new layout values and remove the finished
        transforms in the same JavaScript task.
        */
        const animationRecords =
            tiles.map(tile => {
                const imageIndex =
                    Number(
                        tile.dataset.imageIndex
                    );

                const oldLayout =
                    oldLayoutByImage.get(
                        imageIndex
                    );

                const newTileLayout =
                    newLayoutByImage.get(
                        imageIndex
                    );

                if (
                    !oldLayout ||
                    !newTileLayout
                ) {
                    return null;
                }

                const oldCenterX =
                    oldLayout.x +
                    oldLayout.width / 2;

                const oldCenterY =
                    oldLayout.y +
                    oldLayout.height / 2;

                const newCenterX =
                    newTileLayout.x +
                    newTileLayout.width / 2;

                const newCenterY =
                    newTileLayout.y +
                    newTileLayout.height / 2;

                const targetTranslateX =
                    newCenterX -
                    oldCenterX;

                const targetTranslateY =
                    newCenterY -
                    oldCenterY;

                const targetScaleX =
                    newTileLayout.width /
                    Math.max(
                        1,
                        oldLayout.width
                    );

                const targetScaleY =
                    newTileLayout.height /
                    Math.max(
                        1,
                        oldLayout.height
                    );

                const verticalCenter =
                    newTileLayout.y +
                    newTileLayout.height / 2;

                const verticalProgress =
                    Math.max(
                        0,
                        Math.min(
                            1,
                            verticalCenter /
                            Math.max(
                                1,
                                mosaicBaseHeight
                            )
                        )
                    );

                /*
                Preserve the existing depth pulse. The pulse
                is expressed relative to the final target
                size because the underlying tile still has
                its old width and height during animation.
                */
                const middleDepthScale =
                    1.36 -
                    verticalProgress *
                    0.72;

                const middleScaleX =
                    targetScaleX *
                    middleDepthScale;

                const middleScaleY =
                    targetScaleY *
                    middleDepthScale;

                const transitionZIndex =
                    Math.round(
                        (
                            1 -
                            verticalProgress
                        ) *
                        20
                    ) +
                    2;

                tile.style.zIndex =
                    String(
                        transitionZIndex
                    );

                const movementAnimation =
                    tile.animate(
                        [
                            {
                                translate:
                                    "0px 0px"
                            },
                            {
                                translate:
                                    `${targetTranslateX}px ` +
                                    `${targetTranslateY}px`
                            }
                        ],
                        {
                            duration: 2400,
                            easing:
                                "cubic-bezier(" +
                                "0.65, 0, " +
                                "0.35, 1)",
                            fill: "both"
                        }
                    );

                const scaleAnimation =
                    tile.animate(
                        [
                            {
                                scale:
                                    "1 1"
                            },
                            {
                                offset: 0.20,
                                scale:
                                    `${middleScaleX.toFixed(4)} ` +
                                    `${middleScaleY.toFixed(4)}`
                            },
                            {
                                scale:
                                    `${targetScaleX.toFixed(4)} ` +
                                    `${targetScaleY.toFixed(4)}`
                            }
                        ],
                        {
                            duration: 2400,
                            easing:
                                "cubic-bezier(" +
                                "0.42, 0, " +
                                "0.58, 1)",
                            fill: "both"
                        }
                    );

                activeAnimations.push(
                    movementAnimation,
                    scaleAnimation
                );

                return {
                    tile,
                    newTileLayout,
                    movementAnimation,
                    scaleAnimation
                };
            })
            .filter(Boolean);

        if (
            animationRecords.length !==
            tiles.length
        ) {
            return;
        }

        await Promise.all(
            animationRecords.flatMap(
                record => [
                    record.movementAnimation
                        .finished
                        .catch(
                            () => undefined
                        ),
                    record.scaleAnimation
                        .finished
                        .catch(
                            () => undefined
                        )
                ]
            )
        );

        /*
        At this instant, each transformed old tile visually
        matches its new rectangle exactly. Commit the new box
        geometry and cancel the transforms synchronously so
        the browser never paints an intermediate state.
        */
        animationRecords.forEach(
            function ({
                tile,
                newTileLayout,
                movementAnimation,
                scaleAnimation
            }) {
                tile.style.left =
                    `${newTileLayout.x.toFixed(1)}px`;

                tile.style.top =
                    `${newTileLayout.y.toFixed(1)}px`;

                tile.style.width =
                    `${newTileLayout.width.toFixed(1)}px`;

                tile.style.height =
                    `${newTileLayout.height.toFixed(1)}px`;

                try {
                    movementAnimation.cancel();
                    scaleAnimation.cancel();
                } catch (error) {
                    /*
                    The final geometry is already committed.
                    */
                }

                tile.style.removeProperty(
                    "z-index"
                );
            }
        );

        currentMosaicLayout =
            newLayout.map(tile => ({
                ...tile
            }));

        savedMosaicOrder =
            reshuffleResult.order.slice();
    } finally {
        activeAnimations.forEach(
            animation => {
                try {
                    animation.cancel();
                } catch (error) {
                    /* Animation may already be cancelled. */
                }
            }
        );

        mosaicGrid.classList.remove(
            "reshuffling"
        );

        mosaicReshuffleButton.classList.remove(
            "reshuffling"
        );

        mosaicReshuffleRunning = false;
    }
}

function stopAutomaticMosaicReshuffle(
    showStoppedToast = false
) {
    const wasActive =
        mosaicAutoReshuffleActive;

    if (
        mosaicAutoReshuffleTimer !==
        null
    ) {
        window.clearInterval(
            mosaicAutoReshuffleTimer
        );

        mosaicAutoReshuffleTimer =
            null;
    }

    mosaicAutoReshuffleActive =
        false;

    document.body.classList.remove(
        "mosaic-shuffle-mode-active"
    );

    /*
    Once automatic reshuffling has been stopped, keep the
    current-photo border hidden for the rest of this page
    session rather than restoring it immediately.
    */
    if (wasActive) {
        document.body.classList.add(
            "mosaic-current-border-hidden"
        );
    }

    mosaicReshuffleButton.classList.remove(
        "active"
    );

    mosaicReshuffleButton.setAttribute(
        "aria-pressed",
        "false"
    );

    mosaicReshuffleButton.setAttribute(
        "aria-label",
        "Start automatic mosaic reshuffling"
    );

    if (
        wasActive &&
        showStoppedToast
    ) {
        showModeToast(
            "Auto Shuffle Stopped"
        );
    }
}

function startAutomaticMosaicReshuffle() {
    stopAutomaticMosaicReshuffle();

    if (
        !filmstripExpanded ||
        document.body.classList.contains(
            "initial-mosaic-mode"
        )
    ) {
        return;
    }

    mosaicAutoReshuffleActive =
        true;

    document.body.classList.add(
        "mosaic-shuffle-mode-active"
    );

    mosaicReshuffleButton.classList.add(
        "active"
    );

    mosaicReshuffleButton.setAttribute(
        "aria-pressed",
        "true"
    );

    mosaicReshuffleButton.setAttribute(
        "aria-label",
        "Stop automatic mosaic reshuffling"
    );

    showModeToast(
        "Auto Shuffle Started"
    );

    /*
    Run one immediately, then continue every five seconds.
    The animation itself lasts 2.4 seconds.
    */
    reshuffleMosaic();

    mosaicAutoReshuffleTimer =
        window.setInterval(
            function () {
                reshuffleMosaic();
            },
            5000
        );
}

function toggleAutomaticMosaicReshuffle() {
    if (mosaicAutoReshuffleActive) {
        stopAutomaticMosaicReshuffle(
            true
        );
    } else {
        startAutomaticMosaicReshuffle();
    }
}

function positionMosaicReshuffleButton() {
    if (
        !filmstripExpanded ||
        document.body.classList.contains(
            "initial-mosaic-mode"
        )
    ) {
        mosaicReshuffleButton.style.removeProperty(
            "left"
        );

        mosaicReshuffleButton.style.removeProperty(
            "bottom"
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
        const isInitialMosaic =
            document.body.classList.contains(
                "initial-mosaic-mode"
            );

        /*
        The reshuffle control exists only in the later,
        expanded mosaic. The hidden attribute is the source
        of truth, so CSS state changes cannot expose it.
        */
        mosaicReshuffleButton.hidden =
            isInitialMosaic;

        if (isInitialMosaic) {
            initialMosaicChromeRevealRequested = false;

            document.body.classList.remove(
                "initial-mosaic-controls-ready",
                "initial-mosaic-chrome-visible"
            );
        }

        buildSeededMosaic();
        scheduleFilmstripButtonPosition();
    } else {
        mosaicBuildToken += 1;
        mosaicReshuffleRunning = false;

        stopAutomaticMosaicReshuffle();

        mosaicReshuffleButton.hidden = true;
        mosaicReshuffleButton.style.removeProperty(
            "left"
        );
        mosaicReshuffleButton.style.removeProperty(
            "bottom"
        );

        if (!mosaicSelectionRunning) {
            positionFilmstripButtonBesideMosaic();
        }

        cancelExpandedMosaicEntry();

        setThumbnailBarImageBlackout(
            false
        );

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

function scheduleInterfaceIdle() {
    clearInterfaceIdleTimer();

    /*
    Gallery UI now remains visible regardless of cursor
    inactivity. Explicit Hide mode still works normally.
    */
    document.body.classList.remove(
        "ui-idle"
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

async function activateFirstPhotoForMode() {
    if (
        !document.body.classList.contains(
            "initial-mosaic-mode"
        )
    ) {
        return;
    }

    /*
    Mode keys and buttons now leave the startup mosaic by
    selecting the highlighted photograph through the same
    function used by an ordinary photo click.
    */
    await selectHighlightedPhotoFromInitialMosaic();
}

function updateInitialMosaicFullscreenButton() {
    const isFullscreen =
        Boolean(
            document.fullscreenElement
        );

    initialMosaicFullscreenButton.classList.toggle(
        "active",
        isFullscreen
    );

    initialMosaicFullscreenButton.setAttribute(
        "aria-pressed",
        String(isFullscreen)
    );
}

async function toggleInitialMosaicFullscreen() {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement
                .requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (error) {
        console.error(
            "Unable to toggle initial mosaic fullscreen:",
            error
        );
    }

    updateInitialMosaicFullscreenButton();
    scheduleFilmstripButtonPosition();
}

async function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement
            .requestFullscreen()
            .then(async function () {
                await activateFirstPhotoForMode();

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

async function toggleHelp() {
    if (
        helpOverlay.classList.contains(
            "visible"
        )
    ) {
        hideHelp();
    } else {
        await activateFirstPhotoForMode();

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

    await activateFirstPhotoForMode();

    setFilmstripExpanded(false);

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

async function restoreDefaultGalleryView(
    event
) {
    const isInitialMosaic =
        document.body.classList.contains(
            "initial-mosaic-mode"
        );

    const isMosaicOpen =
        document.body.classList.contains(
            "mosaic-open"
        );

    const isHideOrPlayMode =
        document.body.classList.contains(
            "ui-hidden"
        ) ||
        document.body.classList.contains(
            "autoplay-active"
        );

    /*
    The startup Back link still returns to Collections.
    */
    if (isInitialMosaic) {
        return;
    }

    /*
    Any later expanded mosaic closes first, including when
    the browser is currently fullscreen.
    */
    if (isMosaicOpen) {
        event.preventDefault();
        setFilmstripExpanded(false);
        return;
    }

    /*
    Ordinary fullscreen Back navigation returns to
    Collections.
    */
    if (
        document.fullscreenElement &&
        !isHideOrPlayMode
    ) {
        return;
    }

    /*
    Hide and autoplay modes restore the default gallery
    rather than navigating away.
    */
    if (!isHideOrPlayMode) {
        return;
    }

    event.preventDefault();

    stopAutoplay();
    showUI();
    setFilmstripExpanded(false);

    if (document.fullscreenElement) {
        try {
            await document.exitFullscreen();
        } catch (error) {
            console.error(
                "Unable to exit fullscreen:",
                error
            );
        }
    }
}

backLink.addEventListener(
    "click",
    restoreDefaultGalleryView
);

filmstripButton.addEventListener(
    "click",
    function () {
        if (
            document.body.classList.contains(
                "initial-mosaic-mode"
            )
        ) {
            selectHighlightedPhotoFromInitialMosaic();
            return;
        }

        toggleFilmstrip();
    }
);

mosaicReshuffleButton.addEventListener(
    "click",
    toggleAutomaticMosaicReshuffle
);

initialMosaicFullscreenButton.addEventListener(
    "click",
    toggleInitialMosaicFullscreen
);

document.addEventListener(
    "fullscreenchange",
    function () {
        updateInitialMosaicFullscreenButton();

        if (filmstripExpanded) {
            scheduleFilmstripButtonPosition();
        }
    }
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
            selectHighlightedPhotoFromInitialMosaic();
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

        /*
        Recalculate the zoom boundaries after viewport or
        fullscreen dimensions change.
        */
        if (zoomLevel > minimumZoom) {
            updateZoom();
        }

        if (!filmstripExpanded) {
            return;
        }

        window.clearTimeout(
            mosaicResizeTimer
        );

        mosaicResizeTimer =
            window.setTimeout(
                function () {
                    scaleExistingMosaicToPanel();
                    positionFilmstripButtonBesideMosaic();
                },
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
                selectHighlightedPhotoFromInitialMosaic();
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
