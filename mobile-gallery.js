/*
Lightweight mobile gallery v2.5.10
Aspect-ratio-preserving justified mosaic.
*/

const params =
    new URLSearchParams(
        window.location.search
    );

const collection =
    params.get("collection");

const backLink =
    document.getElementById(
        "mobileBack"
    );

const landscapeButton =
    document.getElementById(
        "mobileLandscape"
    );

const fullscreenButton =
    document.getElementById(
        "mobileFullscreen"
    );

const menuButton =
    document.getElementById(
        "mobileMenu"
    );

const menuPanel =
    document.getElementById(
        "mobileMenuPanel"
    );

const exitFullscreenButton =
    document.getElementById(
        "mobileExitFullscreen"
    );

const fullResolutionButton =
    document.getElementById(
        "mobileFullResolution"
    );

const downloadPhotoButton =
    document.getElementById(
        "mobileDownloadPhoto"
    );

const downloadToast =
    document.getElementById(
        "mobileDownloadToast"
    );

const boundaryToast =
    document.getElementById(
        "mobileBoundaryToast"
    );

const grid =
    document.getElementById(
        "mobileGrid"
    );

const status =
    document.getElementById(
        "mobileStatus"
    );

const viewer =
    document.getElementById(
        "mobileViewer"
    );

const viewerStage =
    document.getElementById(
        "mobileViewerStage"
    );

const viewerImage =
    document.getElementById(
        "mobileViewerImage"
    );

const viewerPreview =
    document.getElementById(
        "mobileViewerPreview"
    );

const viewerSwipePanel =
    document.getElementById(
        "mobileViewerSwipePanel"
    );

const viewerSwipePreview =
    document.getElementById(
        "mobileViewerSwipePreview"
    );

const viewerFinalMaskTop =
    document.getElementById(
        "mobileViewerFinalMaskTop"
    );

const viewerFinalMaskBottom =
    document.getElementById(
        "mobileViewerFinalMaskBottom"
    );


const mosaicGap = 3;
const maximumImagesPerRow = 2;
const ratioLoadConcurrency = 6;

let photographs = [];
let currentIndex = -1;
let viewerOpen = false;
let viewerHistoryActive = false;
let viewerLoadToken = 0;
let mosaicRenderTimer = null;
let mosaicSelectionAnimating = false;
let mosaicEntranceComplete = false;
let mosaicEntranceGeneration = 0;
let fullscreenControlLiftTimer = null;
let landscapeLockActive = false;
let landscapeOperationId = 0;
let fullResolutionEnabled = false;
let downloadToastTimer = null;
let boundaryToastTimer = null;

const viewerSourceCache =
    new Map();

const activeViewerPointers =
    new Map();

let viewerGestureMode = "none";
let viewerGestureAnimating = false;
let viewerTransitionToken = 0;
let viewerPreviewGeneration = 0;

let gestureStartX = 0;
let gestureStartY = 0;
let gestureStartPanX = 0;
let gestureStartPanY = 0;

let swipeOffsetX = 0;
let swipeDirection = 0;
let swipeTargetIndex = -1;
let swipePreviewStartX = 0;
let swipeRequestedOffsetX = 0;
let swipeRequestedDirection = 0;

let zoomLevel = 1;
let viewerPanX = 0;
let viewerPanY = 0;

let finalLetterboxMasksReady = false;
let finalLetterboxPhotograph = null;

let pinchStartDistance = 0;
let pinchStartZoom = 1;
let pinchFocalX = 0;
let pinchFocalY = 0;

let viewerTapTimer = null;
let lastViewerImageTapTime = 0;
let lastViewerImageTapX = 0;
let lastViewerImageTapY = 0;
let lastViewerImageTapIndex = -1;


function isViewerLandscape() {
    return window.matchMedia(
        "(orientation: landscape)"
    ).matches;
}


function clamp(value, minimum, maximum) {
    return Math.max(
        minimum,
        Math.min(
            maximum,
            value
        )
    );
}


function formatCollectionName(name) {
    return String(name || "")
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .replace(/\s+/g, " ")
        .trim();
}


function setStatus(message) {
    status.textContent = message;
}


function wait(milliseconds) {
    return new Promise(
        resolve => {
            window.setTimeout(
                resolve,
                milliseconds
            );
        }
    );
}


function getViewerImageSource(
    photograph
) {
    return fullResolutionEnabled
        ? photograph.original
        : photograph.halfResolution;
}


function getViewerResolutionName() {
    return fullResolutionEnabled
        ? "full res"
        : "half res";
}


function getViewerSourceRecord(
    photograph
) {
    const source =
        getViewerImageSource(
            photograph
        );

    return viewerSourceCache.get(
        source
    ) || null;
}


function preloadViewerSource(
    photograph
) {
    const source =
        getViewerImageSource(
            photograph
        );

    const existing =
        viewerSourceCache.get(
            source
        );

    if (existing) {
        return existing.promise;
    }

    const image =
        new Image();

    image.decoding =
        "async";

    const record = {
        image,
        status: "loading",
        promise: null
    };

    record.promise =
        new Promise(resolve => {
            let finished = false;

            const finish =
                function (status) {
                    if (finished) {
                        return;
                    }

                    finished = true;
                    record.status = status;
                    resolve(record);
                };

            image.addEventListener(
                "load",
                function () {
                    if (
                        typeof image.decode ===
                        "function"
                    ) {
                        image.decode()
                            .then(
                                function () {
                                    finish("ready");
                                }
                            )
                            .catch(
                                function () {
                                    finish("ready");
                                }
                            );
                    } else {
                        finish("ready");
                    }
                },
                {
                    once: true
                }
            );

            image.addEventListener(
                "error",
                function () {
                    finish("error");
                },
                {
                    once: true
                }
            );

            image.src = source;

            if (
                image.complete &&
                image.naturalWidth > 0
            ) {
                if (
                    typeof image.decode ===
                    "function"
                ) {
                    image.decode()
                        .then(
                            function () {
                                finish("ready");
                            }
                        )
                        .catch(
                            function () {
                                finish("ready");
                            }
                        );
                } else {
                    finish("ready");
                }
            }
        });

    viewerSourceCache.set(
        source,
        record
    );

    return record.promise;
}


function preloadViewerNeighborhood(
    index,
    radius = 1
) {
    const preloadPromises = [];

    for (
        let offset = 1;
        offset <= radius;
        offset += 1
    ) {
        const previousIndex =
            index - offset;

        const nextIndex =
            index + offset;

        if (previousIndex >= 0) {
            preloadPromises.push(
                preloadViewerSource(
                    photographs[
                        previousIndex
                    ]
                )
            );
        }

        if (
            nextIndex <
            photographs.length
        ) {
            preloadPromises.push(
                preloadViewerSource(
                    photographs[
                        nextIndex
                    ]
                )
            );
        }
    }

    return Promise.all(
        preloadPromises
    );
}


function preloadAdjacentViewerSources(
    index
) {
    /*
    Normal viewing keeps one decoded active-resolution image
    ready on each side of the current photograph.
    */
    return preloadViewerNeighborhood(
        index,
        1
    );
}




function updateResolutionButton() {
    fullResolutionButton.textContent =
        fullResolutionEnabled
            ? "Disable Full Resolution Image"
            : "Enable Full Resolution Image";

    fullResolutionButton.setAttribute(
        "aria-pressed",
        String(
            fullResolutionEnabled
        )
    );
}


function hideDownloadToast() {
    window.clearTimeout(
        downloadToastTimer
    );

    downloadToastTimer = null;
    downloadToast.hidden = true;
    downloadToast.textContent = "";
}


async function showDownloadToast(
    message
) {
    window.clearTimeout(
        downloadToastTimer
    );

    downloadToast.textContent =
        message;

    downloadToast.hidden =
        false;

    await wait(
        1800
    );

    hideDownloadToast();
}


function hideBoundaryToast() {
    window.clearTimeout(
        boundaryToastTimer
    );

    boundaryToastTimer = null;

    boundaryToast.classList.remove(
        "show",
        "from-left",
        "from-right"
    );

    boundaryToast.textContent = "";
}


function showBoundaryToast(
    message,
    side
) {
    window.clearTimeout(
        boundaryToastTimer
    );

    /*
    Remove and re-add the classes after a forced layout so
    repeated boundary swipes reliably restart the animation.
    */
    boundaryToast.classList.remove(
        "show",
        "from-left",
        "from-right"
    );

    boundaryToast.textContent = "";

    void boundaryToast.offsetWidth;

    boundaryToast.textContent =
        message;

    boundaryToast.classList.add(
        side === "left"
            ? "from-left"
            : "from-right",
        "show"
    );

    boundaryToastTimer =
        window.setTimeout(
            hideBoundaryToast,
            1650
        );
}


function showCollectionBoundary(
    direction
) {
    if (direction > 0) {
        showBoundaryToast(
            "End of Collection",
            "right"
        );
    } else {
        showBoundaryToast(
            "Start of Collection",
            "left"
        );
    }
}


function resetSwipeRequest() {
    swipeRequestedOffsetX = 0;
    swipeRequestedDirection = 0;
}


function setViewerAddress(index, method) {
    const address =
        `${window.location.pathname}` +
        `${window.location.search}` +
        `#photo-${index + 1}`;

    const state = {
        mobileViewer: true,
        index: index
    };

    window.history[method](
        state,
        "",
        address
    );
}


function liftFullscreenControls() {
    window.clearTimeout(
        fullscreenControlLiftTimer
    );

    document.body.classList.add(
        "fullscreen-controls-lifted"
    );

    fullscreenControlLiftTimer =
        window.setTimeout(
            function () {
                document.body.classList.remove(
                    "fullscreen-controls-lifted"
                );

                fullscreenControlLiftTimer =
                    null;
            },
            3700
        );
}


function closeMobileMenu() {
    menuPanel.hidden = true;

    menuButton.setAttribute(
        "aria-expanded",
        "false"
    );
}


function toggleMobileMenu() {
    const willOpen =
        menuPanel.hidden;

    menuPanel.hidden =
        !willOpen;

    menuButton.setAttribute(
        "aria-expanded",
        String(willOpen)
    );
}


function updateFullscreenButton() {
    if (fullscreenButton.disabled) {
        fullscreenButton.classList.remove(
            "active"
        );

        fullscreenButton.setAttribute(
            "aria-pressed",
            "false"
        );

        fullscreenButton.setAttribute(
            "aria-label",
            "Fullscreen unavailable"
        );

        return;
    }

    const active =
        document.fullscreenElement !==
        null;

    document.body.classList.toggle(
        "fullscreen-active",
        active
    );

    if (!active) {
        window.clearTimeout(
            fullscreenControlLiftTimer
        );

        fullscreenControlLiftTimer =
            null;

        document.body.classList.remove(
            "fullscreen-controls-lifted"
        );
    }

    fullscreenButton.classList.toggle(
        "active",
        active
    );

    fullscreenButton.hidden =
        active;

    fullscreenButton.setAttribute(
        "aria-pressed",
        String(active)
    );

    fullscreenButton.setAttribute(
        "aria-label",
        "Enter fullscreen"
    );

    exitFullscreenButton.disabled =
        fullscreenButton.disabled;

    exitFullscreenButton.textContent =
        active
            ? "Exit Full Screen"
            : "Enter Full Screen";
}


function updateLandscapeButton() {
    landscapeButton.classList.toggle(
        "locked",
        landscapeLockActive
    );

    landscapeButton.textContent =
        landscapeLockActive
            ? "R"
            : "Rotate";

    landscapeButton.setAttribute(
        "aria-pressed",
        String(
            landscapeLockActive
        )
    );

    landscapeButton.setAttribute(
        "aria-label",
        landscapeLockActive
            ? "Release landscape lock"
            : "Rotate to landscape"
    );
}


function unlockLandscape() {
    /*
    Invalidate any unresolved landscape-lock request before
    releasing the lock. This prevents an older lock promise
    from setting the button back to its locked state.
    */
    landscapeOperationId += 1;
    landscapeLockActive = false;

    if (
        screen.orientation &&
        typeof screen.orientation.unlock ===
            "function"
    ) {
        try {
            screen.orientation.unlock();
        } catch (error) {
            /*
            Orientation unlock support varies by browser.
            */
        }
    }

    updateLandscapeButton();
}


function requestLandscapeLock() {
    if (
        !screen.orientation ||
        typeof screen.orientation.lock !==
            "function"
    ) {
        landscapeButton.disabled = true;

        landscapeButton.setAttribute(
            "aria-label",
            "Landscape lock unavailable"
        );

        return Promise.resolve(false);
    }

    const operationId =
        landscapeOperationId + 1;

    landscapeOperationId =
        operationId;

    return screen.orientation.lock(
        "landscape"
    )
        .then(function () {
            if (
                operationId !==
                landscapeOperationId
            ) {
                return false;
            }

            landscapeLockActive = true;
            updateLandscapeButton();
            return true;
        })
        .catch(function () {
            if (
                operationId !==
                landscapeOperationId
            ) {
                return false;
            }

            landscapeLockActive = false;
            updateLandscapeButton();
            return false;
        });
}


function toggleLandscapeMode() {
    if (!viewerOpen) {
        return;
    }

    const viewerIsLandscape =
        window.matchMedia(
            "(orientation: landscape)"
        ).matches;

    /*
    The landscape CSS always labels this control "R". Use the
    actual orientation as well as the stored lock state so the
    first press always releases a landscape view, even if a
    lock promise has not updated the state flag yet.
    */
    if (
        landscapeLockActive ||
        viewerIsLandscape
    ) {
        unlockLandscape();
        return;
    }

    if (document.fullscreenElement) {
        requestLandscapeLock();
        return;
    }

    const page =
        document.documentElement;

    if (
        typeof page.requestFullscreen !==
        "function"
    ) {
        landscapeButton.disabled = true;

        landscapeButton.setAttribute(
            "aria-label",
            "Landscape lock unavailable"
        );

        return;
    }

    page.requestFullscreen({
        navigationUI: "hide"
    })
        .then(function () {
            return requestLandscapeLock();
        })
        .catch(function () {
            /*
            Android Chrome generally requires fullscreen
            before orientation can be locked.
            */
        });
}


function togglePageFullscreen() {
    if (document.fullscreenElement) {
        if (
            typeof document.exitFullscreen ===
            "function"
        ) {
            document.exitFullscreen()
                .catch(function () {
                    /*
                    Browser fullscreen state remains
                    unchanged if the request is rejected.
                    */
                });
        }

        return;
    }

    const page =
        document.documentElement;

    if (
        typeof page.requestFullscreen !==
        "function"
    ) {
        fullscreenButton.disabled = true;

        fullscreenButton.setAttribute(
            "aria-label",
            "Fullscreen unavailable"
        );

        return;
    }

    page.requestFullscreen({
        navigationUI: "hide"
    })
        .then(function () {
            liftFullscreenControls();
        })
        .catch(function () {
            /*
            Chrome may reject fullscreen in some embedded or
            restricted contexts. The gallery remains usable
            as a normal full-viewport page.
            */
        });
}


function setViewerControlsHidden(hidden) {
    document.body.classList.toggle(
        "viewer-controls-hidden",
        Boolean(hidden)
    );

    if (hidden) {
        closeMobileMenu();
    }
}


function toggleViewerControls() {
    setViewerControlsHidden(
        !document.body.classList.contains(
            "viewer-controls-hidden"
        )
    );
}


function resetViewerTapState() {
    window.clearTimeout(
        viewerTapTimer
    );

    viewerTapTimer = null;
    lastViewerImageTapTime = 0;
    lastViewerImageTapX = 0;
    lastViewerImageTapY = 0;
    lastViewerImageTapIndex = -1;
}


function isViewerImageTap(
    event
) {
    const movedX =
        Math.abs(
            event.clientX -
            gestureStartX
        );

    const movedY =
        Math.abs(
            event.clientY -
            gestureStartY
        );

    if (
        movedX >= 14 ||
        movedY >= 14
    ) {
        return false;
    }

    const rect =
        getViewerStageRect();

    const imageSize =
        getContainedImageSize();

    const displayedWidth =
        imageSize.width *
        zoomLevel;

    const displayedHeight =
        imageSize.height *
        zoomLevel;

    const centerX =
        rect.left +
        rect.width / 2 +
        viewerPanX;

    const centerY =
        rect.top +
        rect.height / 2 +
        viewerPanY;

    return (
        event.clientX >=
            centerX -
            displayedWidth / 2 &&
        event.clientX <=
            centerX +
            displayedWidth / 2 &&
        event.clientY >=
            centerY -
            displayedHeight / 2 &&
        event.clientY <=
            centerY +
            displayedHeight / 2
    );
}


function animateDoubleTapZoom(
    event
) {
    clearGestureSwipePreview();
    clearSwipePreview();
    resetSwipeRequest();

    setViewerAnimation(
        true
    );

    if (zoomLevel > 1.001) {
        zoomLevel = 1;
        viewerPanX = 0;
        viewerPanY = 0;

        applyZoomTransform();
    } else {
        const rect =
            getViewerStageRect();

        const targetZoom =
            2;

        const tapOffsetX =
            event.clientX -
            (
                rect.left +
                rect.width / 2
            );

        const tapOffsetY =
            event.clientY -
            (
                rect.top +
                rect.height / 2
            );

        zoomLevel =
            targetZoom;

        const requestedPan =
            clampViewerPan(
                -tapOffsetX *
                    (
                        targetZoom -
                        1
                    ),
                -tapOffsetY *
                    (
                        targetZoom -
                        1
                    ),
                targetZoom
            );

        viewerPanX =
            requestedPan.x;

        viewerPanY =
            requestedPan.y;

        applyZoomTransform();
    }

    window.setTimeout(
        function () {
            setViewerAnimation(
                false
            );
        },
        240
    );
}


function handleViewerImageTap(
    event
) {
    const now =
        performance.now();

    const tapDistance =
        Math.hypot(
            event.clientX -
                lastViewerImageTapX,
            event.clientY -
                lastViewerImageTapY
        );

    const isDoubleTap =
        lastViewerImageTapIndex ===
            currentIndex &&
        now -
            lastViewerImageTapTime <=
                340 &&
        tapDistance <= 48;

    if (isDoubleTap) {
        resetViewerTapState();

        animateDoubleTapZoom(
            event
        );

        return;
    }

    window.clearTimeout(
        viewerTapTimer
    );

    lastViewerImageTapTime =
        now;

    lastViewerImageTapX =
        event.clientX;

    lastViewerImageTapY =
        event.clientY;

    lastViewerImageTapIndex =
        currentIndex;

    /*
    Preserve the existing single-tap controls behavior while
    leaving a brief window for a second tap. A single tap while
    already zoomed retains the prior behavior and does nothing.
    */
    if (zoomLevel <= 1.001) {
        const tapIndex =
            currentIndex;

        viewerTapTimer =
            window.setTimeout(
                function () {
                    viewerTapTimer =
                        null;

                    if (
                        viewerOpen &&
                        currentIndex ===
                            tapIndex
                    ) {
                        toggleViewerControls();
                    }

                    lastViewerImageTapTime =
                        0;

                    lastViewerImageTapIndex =
                        -1;
                },
                340
            );
    }
}


function isViewerControlToggleTap(
    event
) {
    const rect =
        getViewerStageRect();

    const movedX =
        Math.abs(
            event.clientX -
            gestureStartX
        );

    const movedY =
        Math.abs(
            event.clientY -
            gestureStartY
        );

    if (
        movedX >= 18 ||
        movedY >= 18
    ) {
        return false;
    }

    const relativeX =
        event.clientX -
        rect.left;

    const relativeY =
        event.clientY -
        rect.top;

    const landscape =
        rect.width >
        rect.height;

    /*
    Leave a protected strip around the controls so tapping
    nearby black space does not accidentally hide them.
    */
    if (landscape) {
        const protectedRightWidth =
            105;

        return (
            relativeX <
            rect.width -
                protectedRightWidth
        );
    }

    const protectedBottomHeight =
        105;

    return (
        relativeY <
        rect.height -
            protectedBottomHeight
    );
}


function getViewerStageRect() {
    return viewerStage.getBoundingClientRect();
}


function getPointerPair() {
    return Array.from(
        activeViewerPointers.values()
    ).slice(0, 2);
}


function getPointerDistance(points) {
    const deltaX =
        points[1].x -
        points[0].x;

    const deltaY =
        points[1].y -
        points[0].y;

    return Math.hypot(
        deltaX,
        deltaY
    );
}


function getPointerMidpoint(points) {
    return {
        x:
            (
                points[0].x +
                points[1].x
            ) / 2,
        y:
            (
                points[0].y +
                points[1].y
            ) / 2
    };
}


function updateFinalLetterboxMasks(
    photograph
) {
    const rect =
        getViewerStageRect();

    const ratio =
        Number(
            photograph.ratio
        ) > 0
            ? Number(
                photograph.ratio
            )
            : rect.width /
                Math.max(
                    1,
                    rect.height
                );

    const stageRatio =
        rect.width /
        Math.max(
            1,
            rect.height
        );

    let containedHeight =
        rect.height;

    if (ratio > stageRatio) {
        containedHeight =
            rect.width /
            Math.max(
                0.01,
                ratio
            );
    }

    const maskHeight =
        Math.max(
            0,
            (
                rect.height -
                containedHeight
            ) / 2
        );

    let containedWidth =
        rect.width;

    if (ratio <= stageRatio) {
        containedWidth =
            rect.height *
            ratio;
    }

    const maskLeft =
        Math.max(
            0,
            (
                rect.width -
                containedWidth
            ) / 2
        );

    const maskWidth =
        Math.min(
            rect.width,
            containedWidth
        );

    [
        viewerFinalMaskTop,
        viewerFinalMaskBottom
    ].forEach(function (mask) {
        mask.style.height =
            `${maskHeight.toFixed(2)}px`;

        mask.style.left =
            `${maskLeft.toFixed(2)}px`;

        mask.style.width =
            `${maskWidth.toFixed(2)}px`;
    });
}


function concealFinalLetterboxMasks() {
    viewerFinalMaskTop.classList.remove(
        "visible"
    );

    viewerFinalMaskBottom.classList.remove(
        "visible"
    );

    [
        viewerFinalMaskTop,
        viewerFinalMaskBottom
    ].forEach(function (mask) {
        mask.style.height =
            "0px";

        mask.style.removeProperty(
            "left"
        );

        mask.style.removeProperty(
            "width"
        );

        mask.style.transform =
            "translate3d(0, 0, 0)";
    });
}


function showFinalLetterboxMasks(
    photograph
) {
    finalLetterboxMasksReady =
        true;

    finalLetterboxPhotograph =
        photograph;

    /*
    The masks belong only to the unzoomed image. Keeping them
    unloaded during zoom prevents them from covering or
    intercepting the visible zoomed photograph.
    */
    if (
        zoomLevel > 1.001 ||
        viewerGestureMode ===
            "pinch"
    ) {
        concealFinalLetterboxMasks();
        return;
    }

    updateFinalLetterboxMasks(
        photograph
    );

    viewerFinalMaskTop.classList.add(
        "visible"
    );

    viewerFinalMaskBottom.classList.add(
        "visible"
    );
}


function syncFinalLetterboxMasksWithZoom() {
    if (
        zoomLevel > 1.001 ||
        viewerGestureMode ===
            "pinch"
    ) {
        concealFinalLetterboxMasks();
        return;
    }

    if (
        finalLetterboxMasksReady &&
        finalLetterboxPhotograph
    ) {
        updateFinalLetterboxMasks(
            finalLetterboxPhotograph
        );

        viewerFinalMaskTop.classList.add(
            "visible"
        );

        viewerFinalMaskBottom.classList.add(
            "visible"
        );
    }
}


function hideFinalLetterboxMasks() {
    finalLetterboxMasksReady =
        false;

    finalLetterboxPhotograph =
        null;

    concealFinalLetterboxMasks();
}


function getContainedImageSize() {
    const rect =
        getViewerStageRect();

    const naturalWidth =
        viewerImage.naturalWidth ||
        rect.width;

    const naturalHeight =
        viewerImage.naturalHeight ||
        rect.height;

    const imageRatio =
        naturalWidth /
        Math.max(
            1,
            naturalHeight
        );

    const stageRatio =
        rect.width /
        Math.max(
            1,
            rect.height
        );

    if (imageRatio > stageRatio) {
        return {
            width: rect.width,
            height:
                rect.width /
                Math.max(
                    0.01,
                    imageRatio
                )
        };
    }

    return {
        width:
            rect.height *
            imageRatio,
        height: rect.height
    };
}


function clampViewerPan(
    nextX,
    nextY,
    scale = zoomLevel
) {
    const rect =
        getViewerStageRect();

    const imageSize =
        getContainedImageSize();

    const maximumX =
        Math.max(
            0,
            (
                imageSize.width *
                scale -
                rect.width
            ) / 2
        );

    const maximumY =
        Math.max(
            0,
            (
                imageSize.height *
                scale -
                rect.height
            ) / 2
        );

    return {
        x:
            clamp(
                nextX,
                -maximumX,
                maximumX
            ),
        y:
            clamp(
                nextY,
                -maximumY,
                maximumY
            )
    };
}


function setViewerAnimation(active) {
    viewerImage.classList.toggle(
        "animating",
        active
    );

    viewerPreview.classList.toggle(
        "animating",
        active
    );

    viewerSwipePanel.classList.toggle(
        "animating",
        active
    );

    viewerFinalMaskTop.classList.toggle(
        "animating",
        active
    );

    viewerFinalMaskBottom.classList.toggle(
        "animating",
        active
    );
}


function applyZoomTransform() {
    const constrained =
        clampViewerPan(
            viewerPanX,
            viewerPanY
        );

    viewerPanX = constrained.x;
    viewerPanY = constrained.y;

    viewerImage.style.transform =
        `translate3d(` +
        `${viewerPanX.toFixed(2)}px, ` +
        `${viewerPanY.toFixed(2)}px, 0) ` +
        `scale(${zoomLevel.toFixed(4)})`;

    syncFinalLetterboxMasksWithZoom();
}


function resetViewerTransform(
    animate = false
) {
    zoomLevel = 1;
    viewerPanX = 0;
    viewerPanY = 0;
    swipeOffsetX = 0;
    swipeDirection = 0;
    swipeTargetIndex = -1;
    swipePreviewStartX = 0;

    setViewerAnimation(
        animate
    );

    viewerImage.style.transform =
        "translate3d(0, 0, 0) scale(1)";

    viewerPreview.style.transform =
        "translate3d(0, 0, 0) scale(1)";

    viewerSwipePanel.style.transform =
        "translate3d(0, 0, 0) scale(1)";

    viewerFinalMaskTop.style.transform =
        "translate3d(0, 0, 0)";

    viewerFinalMaskBottom.style.transform =
        "translate3d(0, 0, 0)";

    syncFinalLetterboxMasksWithZoom();

    /*
    Do not clear the preview here. This function is also called
    by viewport resize handling, and mobile browser chrome can
    trigger resize events at unpredictable times while an image
    is loading. Preview lifetime is controlled exclusively by
    clearSwipePreview().
    */
    if (animate) {
        window.setTimeout(
            function () {
                setViewerAnimation(false);
            },
            300
        );
    }
}


function resetViewerPreviewVisualState() {
    viewerPreview.classList.remove(
        "ready-image",
        "resolving"
    );

    viewerPreview.style.removeProperty(
        "filter"
    );

    viewerPreview.style.removeProperty(
        "transition"
    );
}


function clearSwipePreview(
    invalidateGeneration = true
) {
    if (invalidateGeneration) {
        viewerPreviewGeneration += 1;
    }

    swipeOffsetX = 0;
    swipeDirection = 0;
    swipeTargetIndex = -1;
    swipePreviewStartX = 0;

    viewerPreview.classList.remove(
        "visible"
    );

    resetViewerPreviewVisualState();

    viewerPreview.removeAttribute(
        "src"
    );

    viewerPreview.style.transform =
        "translate3d(0, 0, 0)";
}


function clearGestureSwipePreview() {
    viewerSwipePanel.classList.remove(
        "visible",
        "animating"
    );

    viewerSwipePreview.removeAttribute(
        "src"
    );

    viewerSwipePanel.style.transform =
        "translate3d(0, 0, 0) scale(1)";
}


function prepareSwipePreview(
    direction
) {
    const targetIndex =
        currentIndex +
        direction;

    if (
        targetIndex < 0 ||
        targetIndex >=
            photographs.length
    ) {
        clearGestureSwipePreview();
        return false;
    }

    if (
        swipeTargetIndex ===
            targetIndex &&
        viewerSwipePanel.classList.contains(
            "visible"
        )
    ) {
        return true;
    }

    const rect =
        getViewerStageRect();

    swipeDirection =
        direction;

    swipeTargetIndex =
        targetIndex;

    swipePreviewStartX =
        direction *
        rect.width;

    const targetPhotograph =
        photographs[targetIndex];

    /*
    The gesture preview is a separate, non-padded layer beneath
    the current full-resolution image. It cannot disturb the
    stationary loading thumbnail or its blur animation.
    */
    viewerSwipePreview.src =
        targetPhotograph.thumbnail;

    preloadViewerSource(
        targetPhotograph
    );

    viewerSwipePanel.classList.add(
        "visible"
    );

    viewerSwipePanel.style.transform =
        `translate3d(` +
        `${swipePreviewStartX.toFixed(2)}px, ` +
        `0, 0) scale(1)`;

    return true;
}


function updateSwipeTransform(
    requestedOffset
) {
    const direction =
        requestedOffset < 0
            ? 1
            : -1;

    swipeRequestedOffsetX =
        requestedOffset;

    swipeRequestedDirection =
        direction;

    const hasTarget =
        prepareSwipePreview(
            direction
        );

    swipeOffsetX =
        hasTarget
            ? requestedOffset
            : requestedOffset * 0.22;

    viewerImage.style.transform =
        `translate3d(` +
        `${swipeOffsetX.toFixed(2)}px, ` +
        `0, 0) scale(1)`;

    const maskSwipeTransform =
        `translate3d(` +
        `${swipeOffsetX.toFixed(2)}px, ` +
        `0, 0)`;

    viewerFinalMaskTop.style.transform =
        maskSwipeTransform;

    viewerFinalMaskBottom.style.transform =
        maskSwipeTransform;

    if (hasTarget) {
        viewerSwipePanel.style.transform =
            `translate3d(` +
            `${(
                swipePreviewStartX +
                swipeOffsetX
            ).toFixed(2)}px, ` +
            `0, 0) scale(1)`;
    }
}


function waitForViewerTransition(
    callback
) {
    let completed = false;

    const transitionToken =
        viewerTransitionToken + 1;

    viewerTransitionToken =
        transitionToken;

    const finish =
        function () {
            if (completed) {
                return;
            }

            completed = true;

            viewerImage.removeEventListener(
                "transitionend",
                finish
            );

            /*
            A Back press invalidates the token before closing,
            so a settling swipe cannot run its completion
            callback after the viewer has already closed.
            */
            if (
                transitionToken !==
                    viewerTransitionToken ||
                !viewerOpen
            ) {
                return;
            }

            callback();
        };

    viewerImage.addEventListener(
        "transitionend",
        finish,
        {
            once: true
        }
    );

    window.setTimeout(
        finish,
        250
    );
}


function finishViewerSwipe() {
    if (
        Math.abs(
            swipeRequestedOffsetX
        ) < 1
    ) {
        clearGestureSwipePreview();
        clearSwipePreview();
        resetSwipeRequest();
        viewerGestureAnimating = false;
        return;
    }

    const rect =
        getViewerStageRect();

    const threshold =
        clamp(
            rect.width * 0.12,
            40,
            80
        );

    const boundaryThreshold =
        clamp(
            rect.width * 0.08,
            34,
            52
        );

    const requestedDistance =
        Math.abs(
            swipeRequestedOffsetX
        );

    const shouldAdvance =
        swipeTargetIndex >= 0 &&
        requestedDistance >=
            threshold;

    const reachedBoundary =
        swipeTargetIndex < 0 &&
        requestedDistance >=
            boundaryThreshold;

    const boundaryDirection =
        swipeRequestedDirection;

    viewerGestureAnimating = true;
    setViewerAnimation(true);

    if (!shouldAdvance) {
        if (
            reachedBoundary &&
            boundaryDirection !== 0
        ) {
            showCollectionBoundary(
                boundaryDirection
            );
        }

        viewerImage.style.transform =
            "translate3d(0, 0, 0) scale(1)";

        viewerFinalMaskTop.style.transform =
            "translate3d(0, 0, 0)";

        viewerFinalMaskBottom.style.transform =
            "translate3d(0, 0, 0)";

        if (
            swipeTargetIndex >= 0
        ) {
            viewerSwipePanel.style.transform =
                `translate3d(` +
                `${swipePreviewStartX.toFixed(2)}px, ` +
                `0, 0) scale(1)`;
        }

        waitForViewerTransition(
            function () {
                setViewerAnimation(false);

                /*
                Explicitly re-center after a boundary pull so
                no rubber-band transform can remain applied.
                */
                resetViewerTransform(false);
                clearGestureSwipePreview();
                clearSwipePreview();
                resetSwipeRequest();
                viewerGestureAnimating = false;
            }
        );

        return;
    }

    const targetIndex =
        swipeTargetIndex;

    const outgoingX =
        -swipeDirection *
        rect.width;

    viewerImage.style.transform =
        `translate3d(` +
        `${outgoingX.toFixed(2)}px, ` +
        `0, 0) scale(1)`;

    const outgoingMaskTransform =
        `translate3d(` +
        `${outgoingX.toFixed(2)}px, ` +
        `0, 0)`;

    viewerFinalMaskTop.style.transform =
        outgoingMaskTransform;

    viewerFinalMaskBottom.style.transform =
        outgoingMaskTransform;

    viewerSwipePanel.style.transform =
        "translate3d(0, 0, 0) scale(1)";

    waitForViewerTransition(
        function () {
            setViewerAnimation(false);
            clearGestureSwipePreview();

            /*
            After the gesture settles, the normal padded preview
            takes over the loading/unblur role for the selected
            photograph.
            */
            showViewerImage(
                targetIndex,
                true,
                false
            );

            resetSwipeRequest();
            viewerGestureAnimating = false;
        }
    );
}


function beginPinchGesture() {
    const points =
        getPointerPair();

    if (points.length < 2) {
        return;
    }

    clearGestureSwipePreview();
    clearSwipePreview();

    /*
    A second finger cancels any partial one-finger swipe and
    returns the current photograph to its zoom/pan transform
    before pinch scaling begins. Set pinch mode first so the
    letterbox masks unload immediately.
    */
    viewerGestureMode =
        "pinch";

    applyZoomTransform();

    pinchStartDistance =
        Math.max(
            1,
            getPointerDistance(
                points
            )
        );

    pinchStartZoom =
        zoomLevel;

    const midpoint =
        getPointerMidpoint(
            points
        );

    const rect =
        getViewerStageRect();

    const centerX =
        rect.left +
        rect.width / 2;

    const centerY =
        rect.top +
        rect.height / 2;

    pinchFocalX =
        (
            midpoint.x -
            centerX -
            viewerPanX
        ) /
        zoomLevel;

    pinchFocalY =
        (
            midpoint.y -
            centerY -
            viewerPanY
        ) /
        zoomLevel;
}


function updatePinchGesture() {
    const points =
        getPointerPair();

    if (points.length < 2) {
        return;
    }

    const distance =
        Math.max(
            1,
            getPointerDistance(
                points
            )
        );

    const midpoint =
        getPointerMidpoint(
            points
        );

    const rect =
        getViewerStageRect();

    const centerX =
        rect.left +
        rect.width / 2;

    const centerY =
        rect.top +
        rect.height / 2;

    zoomLevel =
        clamp(
            pinchStartZoom *
            distance /
            pinchStartDistance,
            1,
            4
        );

    const requestedX =
        midpoint.x -
        centerX -
        pinchFocalX *
        zoomLevel;

    const requestedY =
        midpoint.y -
        centerY -
        pinchFocalY *
        zoomLevel;

    const constrained =
        clampViewerPan(
            requestedX,
            requestedY,
            zoomLevel
        );

    viewerPanX =
        constrained.x;

    viewerPanY =
        constrained.y;

    if (zoomLevel <= 1.001) {
        zoomLevel = 1;
        viewerPanX = 0;
        viewerPanY = 0;
    }

    applyZoomTransform();
}


function waitForViewerImagePaint(
    source,
    token,
    index
) {
    return new Promise(resolve => {
        let completed = false;

        const finish =
            function () {
                if (completed) {
                    return;
                }

                completed = true;

                viewerImage.removeEventListener(
                    "load",
                    handleLoad
                );

                viewerImage.removeEventListener(
                    "error",
                    handleError
                );

                if (
                    token !==
                        viewerLoadToken ||
                    currentIndex !==
                        index
                ) {
                    resolve(false);
                    return;
                }

                const waitForPaint =
                    function () {
                        window.requestAnimationFrame(
                            function () {
                                window.requestAnimationFrame(
                                    function () {
                                        resolve(
                                            token ===
                                                viewerLoadToken &&
                                            currentIndex ===
                                                index
                                        );
                                    }
                                );
                            }
                        );
                    };

                if (
                    typeof viewerImage.decode ===
                        "function"
                ) {
                    viewerImage.decode()
                        .then(waitForPaint)
                        .catch(waitForPaint);
                } else {
                    waitForPaint();
                }
            };

        const handleLoad =
            function () {
                finish();
            };

        const handleError =
            function () {
                resolve(false);
            };

        viewerImage.addEventListener(
            "load",
            handleLoad,
            {
                once: true
            }
        );

        viewerImage.addEventListener(
            "error",
            handleError,
            {
                once: true
            }
        );

        viewerImage.src =
            source;

        if (
            viewerImage.complete &&
            viewerImage.naturalWidth > 0
        ) {
            finish();
        }
    });
}


function loadViewerDisplaySource(
    index,
    token,
    previewGeneration
) {
    const photograph =
        photographs[index];

    const source =
        getViewerImageSource(
            photograph
        );

    preloadViewerSource(
        photograph
    ).then(function (record) {
        if (
            record.status !==
                "ready" ||
            token !==
                viewerLoadToken ||
            currentIndex !==
                index
        ) {
            return false;
        }

        return waitForViewerImagePaint(
            source,
            token,
            index
        );
    }).then(function (painted) {
        if (
            !painted ||
            token !== viewerLoadToken ||
            currentIndex !== index ||
            previewGeneration !==
                viewerPreviewGeneration
        ) {
            return;
        }

        /*
        Animate by painted frames rather than relying on a CSS
        transition clock. The progress cannot advance faster
        than one ninth per rendered frame, so a delayed frame
        cannot skip the visible 8 px to 2 px unblur.
        */
        const unblurDuration =
            150;

        const minimumPaintedFrames =
            9;

        const startBlur =
            8;

        const endBlur =
            2;

        resetViewerPreviewVisualState();

        viewerPreview.style.setProperty(
            "transition",
            "none"
        );

        viewerPreview.style.setProperty(
            "filter",
            `blur(${startBlur}px)`
        );

        let animationStartTime =
            null;

        let paintedFrameCount =
            0;

        const previewStillOwned =
            function () {
                return (
                    token === viewerLoadToken &&
                    currentIndex === index &&
                    previewGeneration ===
                        viewerPreviewGeneration &&
                    viewerPreview.classList.contains(
                        "visible"
                    )
                );
            };

        const finishUnblur =
            function () {
                if (!previewStillOwned()) {
                    return;
                }

                /*
                Leave the final 2 px state on screen for one
                additional painted frame before removing the
                thumbnail and revealing the full-resolution
                image underneath.
                */
                window.requestAnimationFrame(
                    function () {
                        if (!previewStillOwned()) {
                            return;
                        }

                        viewerImage.style.removeProperty(
                            "opacity"
                        );

                        showFinalLetterboxMasks(
                            photograph
                        );

                        clearSwipePreview(false);
                    }
                );
            };

        const animateUnblurFrame =
            function (timestamp) {
                if (!previewStillOwned()) {
                    return;
                }

                if (
                    animationStartTime ===
                        null
                ) {
                    animationStartTime =
                        timestamp;

                    window.requestAnimationFrame(
                        animateUnblurFrame
                    );

                    return;
                }

                paintedFrameCount += 1;

                const elapsedProgress =
                    Math.min(
                        1,
                        (
                            timestamp -
                            animationStartTime
                        ) /
                        unblurDuration
                    );

                const frameProgress =
                    Math.min(
                        1,
                        paintedFrameCount /
                        minimumPaintedFrames
                    );

                const progress =
                    Math.min(
                        elapsedProgress,
                        frameProgress
                    );

                const easedProgress =
                    1 -
                    Math.pow(
                        1 - progress,
                        2
                    );

                const blur =
                    startBlur +
                    (
                        endBlur -
                        startBlur
                    ) *
                    easedProgress;

                viewerPreview.style.setProperty(
                    "filter",
                    `blur(${blur.toFixed(3)}px)`
                );

                if (progress < 1) {
                    window.requestAnimationFrame(
                        animateUnblurFrame
                    );
                } else {
                    finishUnblur();
                }
            };

        /*
        Two initial frames make sure the 8 px thumbnail state
        is painted before the first smaller blur value.
        */
        window.requestAnimationFrame(
            function () {
                window.requestAnimationFrame(
                    animateUnblurFrame
                );
            }
        );
    });
}


function showViewerImage(
    index,
    updateAddress = true,
    preserveOverlay = false
) {
    if (
        index < 0 ||
        index >= photographs.length
    ) {
        return;
    }

    resetViewerTapState();
    hideFinalLetterboxMasks();

    currentIndex =
        index;

    viewerLoadToken += 1;

    const loadToken =
        viewerLoadToken;

    activeViewerPointers.clear();

    viewerGestureMode =
        "none";

    viewerGestureAnimating =
        false;

    resetViewerTransform(false);

    const photograph =
        photographs[index];

    /*
    Always keep a thumbnail overlay visible while the active
    image is assigned underneath. A preloaded/decoded record is
    not treated as proof that the browser has painted the image.
    */
    if (!preserveOverlay) {
        clearSwipePreview();

        viewerPreview.src =
            photograph.thumbnail;

        viewerPreview.classList.add(
            "visible"
        );

        viewerPreview.style.transform =
            "translate3d(0, 0, 0)";

        if (isViewerLandscape()) {
            viewerImage.style.opacity =
                "0.001";
        } else {
            viewerImage.style.removeProperty(
                "opacity"
            );
        }
    } else {
        resetViewerPreviewVisualState();

        viewerPreview.src =
            photograph.thumbnail;

        viewerPreview.classList.add(
            "visible"
        );

        viewerPreview.style.transform =
            "translate3d(0, 0, 0)";

        if (isViewerLandscape()) {
            viewerImage.style.opacity =
                "0.001";
        } else {
            viewerImage.style.removeProperty(
                "opacity"
            );
        }
    }

    const previewGeneration =
        viewerPreviewGeneration + 1;

    viewerPreviewGeneration =
        previewGeneration;

    loadViewerDisplaySource(
        index,
        loadToken,
        previewGeneration
    );

    viewerImage.alt =
        `Photograph ${index + 1}`;

    preloadAdjacentViewerSources(
        index
    );

    if (
        updateAddress &&
        viewerHistoryActive
    ) {
        setViewerAddress(
            index,
            "replaceState"
        );
    }
}


function animateExpandedViewerFadeIn() {
    viewer.classList.remove(
        "viewer-fade-in"
    );

    void viewer.offsetWidth;

    viewer.classList.add(
        "viewer-fade-in"
    );

    window.setTimeout(
        function () {
            viewer.classList.remove(
                "viewer-fade-in"
            );
        },
        420
    );
}


function animateFullscreenControlIntoViewer(
    previousRect
) {
    const isLandscape =
        window.matchMedia(
            "(orientation: landscape)"
        ).matches;

    if (isLandscape) {
        /*
        The fullscreen control is intentionally hidden in the
        landscape viewer. Animate a temporary visual copy from
        its mosaic position so it fades away smoothly instead
        of disappearing abruptly.
        */
        const clone =
            fullscreenButton.cloneNode(true);

        clone.removeAttribute("id");
        clone.className =
            "mobile-fullscreen-transition-clone";

        clone.style.left =
            `${previousRect.left}px`;

        clone.style.top =
            `${previousRect.top}px`;

        clone.style.width =
            `${previousRect.width}px`;

        clone.style.height =
            `${previousRect.height}px`;

        document.body.appendChild(
            clone
        );

        clone.animate(
            [
                {
                    opacity: 1,
                    transform: "scale(1)"
                },
                {
                    opacity: 0,
                    transform: "scale(0.94)"
                }
            ],
            {
                duration: 360,
                easing:
                    "cubic-bezier(0.22, 0.61, 0.36, 1)",
                fill: "forwards"
            }
        ).finished.finally(
            function () {
                clone.remove();
            }
        );

        return;
    }

    const nextRect =
        fullscreenButton.getBoundingClientRect();

    const deltaX =
        previousRect.left -
        nextRect.left;

    const deltaY =
        previousRect.top -
        nextRect.top;

    fullscreenButton.animate(
        [
            {
                opacity: 1,
                transform:
                    `translate3d(${deltaX}px, ${deltaY}px, 0)`
            },
            {
                opacity: 1,
                transform:
                    "translate3d(0, 0, 0)"
            }
        ],
        {
            duration: 420,
            easing:
                "cubic-bezier(0.22, 0.61, 0.36, 1)",
            fill: "none"
        }
    );
}


function openViewer(index) {
    if (
        index < 0 ||
        index >= photographs.length
    ) {
        return;
    }

    const previousFullscreenRect =
        fullscreenButton.getBoundingClientRect();

    viewerOpen = true;
    viewerHistoryActive = true;

    closeMobileMenu();
    setViewerControlsHidden(false);
    landscapeButton.hidden = false;

    viewer.hidden = false;

    viewer.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "viewer-open"
    );

    backLink.setAttribute(
        "aria-label",
        "Back to photograph grid"
    );

    setViewerAddress(
        index,
        "pushState"
    );

    showViewerImage(
        index,
        false
    );

    animateExpandedViewerFadeIn();

    window.requestAnimationFrame(
        function () {
            animateFullscreenControlIntoViewer(
                previousFullscreenRect
            );
        }
    );
}


function closeViewer() {
    if (!viewerOpen) {
        return;
    }

    viewerOpen = false;
    viewerHistoryActive = false;
    viewerLoadToken += 1;

    resetViewerTapState();

    closeMobileMenu();
    hideDownloadToast();
    hideBoundaryToast();
    resetSwipeRequest();
    setViewerControlsHidden(false);

    unlockLandscape();
    landscapeButton.hidden = true;
    currentIndex = -1;

    activeViewerPointers.clear();

    viewerGestureMode =
        "none";

    viewerGestureAnimating =
        false;

    clearGestureSwipePreview();
    hideFinalLetterboxMasks();
    clearSwipePreview();
    resetViewerTransform(false);

    viewer.hidden = true;

    viewer.setAttribute(
        "aria-hidden",
        "true"
    );

    viewerImage.removeAttribute(
        "src"
    );

    viewerImage.style.removeProperty(
        "opacity"
    );

    viewerImage.classList.remove(
        "thumbnail-blur"
    );


    viewerImage.alt = "";

    document.body.classList.remove(
        "viewer-open"
    );

    backLink.setAttribute(
        "aria-label",
        "Back to collections"
    );

}


function cancelViewerGestureForClose() {
    /*
    Back must remain available during swipe, snap-back,
    image-change, pan, and pinch activity.
    */
    activeViewerPointers.forEach(
        function (_, pointerId) {
            if (
                typeof viewerStage.hasPointerCapture ===
                    "function" &&
                typeof viewerStage.releasePointerCapture ===
                    "function"
            ) {
                try {
                    if (
                        viewerStage.hasPointerCapture(
                            pointerId
                        )
                    ) {
                        viewerStage.releasePointerCapture(
                            pointerId
                        );
                    }
                } catch (error) {
                    /*
                    Pointer capture may already have ended.
                    */
                }
            }
        }
    );

    activeViewerPointers.clear();
    viewerGestureMode = "none";
    viewerGestureAnimating = false;
    viewerTransitionToken += 1;

    setViewerAnimation(false);
    clearSwipePreview();
    resetSwipeRequest();
    resetViewerTransform(false);
}


function requestViewerClose() {
    if (!viewerOpen) {
        return;
    }

    const shouldStepBack =
        viewerHistoryActive;

    cancelViewerGestureForClose();

    /*
    Close synchronously instead of waiting for popstate.
    This keeps Back responsive while a swipe transition is
    still active. The later popstate sees viewerOpen=false
    and therefore does not close anything a second time.
    */
    closeViewer();

    if (shouldStepBack) {
        window.history.back();
    }
}


function showPreviousImage() {
    if (viewerGestureAnimating) {
        return;
    }

    if (currentIndex <= 0) {
        showCollectionBoundary(
            -1
        );

        return;
    }

    showViewerImage(
        currentIndex - 1
    );
}


function showNextImage() {
    if (viewerGestureAnimating) {
        return;
    }

    if (
        currentIndex >=
        photographs.length - 1
    ) {
        showCollectionBoundary(
            1
        );

        return;
    }

    showViewerImage(
        currentIndex + 1
    );
}


function readThumbnailRatio(photograph) {
    return new Promise(resolve => {
        const image =
            new Image();

        image.decoding = "async";

        const finish =
            function (ratio) {
                resolve(
                    clamp(
                        Number(ratio) || 1,
                        0.28,
                        4.2
                    )
                );
            };

        image.addEventListener(
            "load",
            function () {
                finish(
                    image.naturalWidth /
                    Math.max(
                        1,
                        image.naturalHeight
                    )
                );
            },
            {
                once: true
            }
        );

        image.addEventListener(
            "error",
            function () {
                finish(1);
            },
            {
                once: true
            }
        );

        image.src =
            photograph.thumbnail;
    });
}


async function fillMissingAspectRatios() {
    const missingIndexes =
        photographs
            .map(
                (photograph, index) => ({
                    photograph,
                    index
                })
            )
            .filter(
                entry =>
                    !Number.isFinite(
                        entry.photograph.ratio
                    ) ||
                    entry.photograph.ratio <= 0
            );

    if (missingIndexes.length === 0) {
        return;
    }

    let nextIndex = 0;

    async function worker() {
        while (
            nextIndex <
            missingIndexes.length
        ) {
            const workIndex =
                nextIndex;

            nextIndex += 1;

            const entry =
                missingIndexes[workIndex];

            entry.photograph.ratio =
                await readThumbnailRatio(
                    entry.photograph
                );
        }
    }

    const workerCount =
        Math.min(
            ratioLoadConcurrency,
            missingIndexes.length
        );

    await Promise.all(
        Array.from(
            {
                length: workerCount
            },
            () => worker()
        )
    );
}


function getTargetRowHeight(
    width,
    rowIndex
) {
    const base =
        clamp(
            width * 0.34,
            124,
            205
        );

    const pattern = [
        0.94,
        1.08,
        0.99,
        1.13,
        0.91
    ];

    return (
        base *
        pattern[
            rowIndex %
            pattern.length
        ]
    );
}


function measureJustifiedHeight(
    row,
    width
) {
    const ratioSum =
        row.reduce(
            (sum, photograph) =>
                sum +
                photograph.ratio,
            0
        );

    return (
        width -
        mosaicGap *
            Math.max(
                0,
                row.length - 1
            )
    ) /
    Math.max(
        0.01,
        ratioSum
    );
}


function isPortraitPhotograph(
    photograph
) {
    return photograph.ratio < 1;
}


function isFullWidthCandidate(
    photograph
) {
    return photograph.ratio >= 2;
}


function createMosaicRandom(
    salt = 0
) {
    let seed =
        photographs.reduce(
            function (
                value,
                photograph,
                index
            ) {
                return (
                    value ^
                    (
                        (
                            photograph.index +
                            1
                        ) *
                        (
                            index +
                            17
                        )
                    )
                ) >>> 0;
            },
            (
                0x9e3779b9 ^
                salt
            ) >>> 0
        );

    return function () {
        seed +=
            0x6d2b79f5;

        let value =
            seed;

        value =
            Math.imul(
                value ^
                value >>> 15,
                value | 1
            );

        value ^=
            value +
            Math.imul(
                value ^
                    value >>> 7,
                value | 61
            );

        return (
            (
                value ^
                value >>> 14
            ) >>> 0
        ) /
        4294967296;
    };
}


function shuffleMosaicRows(
    rows,
    salt
) {
    const shuffled =
        rows.slice();

    const random =
        createMosaicRandom(
            salt
        );

    for (
        let index =
            shuffled.length - 1;
        index > 0;
        index -= 1
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
            shuffled[index],
            shuffled[swapIndex]
        ] = [
            shuffled[swapIndex],
            shuffled[index]
        ];
    }

    return shuffled;
}


function buildRegularRowData(
    items,
    width,
    rowIndex
) {
    const targetHeight =
        getTargetRowHeight(
            width,
            rowIndex
        );

    const justifiedHeight =
        measureJustifiedHeight(
            items,
            width
        );

    const loose =
        items.length === 1;

    const height =
        loose
            ? clamp(
                targetHeight,
                118,
                220
            )
            : clamp(
                justifiedHeight,
                88,
                250
            );

    const widths =
        items.map(
            photograph =>
                photograph.ratio *
                height
        );

    if (!loose) {
        const availableWidth =
            width -
            mosaicGap *
                Math.max(
                    0,
                    items.length - 1
                );

        const rawWidth =
            widths.reduce(
                (sum, value) =>
                    sum + value,
                0
            );

        const correction =
            availableWidth /
            Math.max(
                1,
                rawWidth
            );

        widths.forEach(
            function (
                value,
                index
            ) {
                widths[index] =
                    value *
                    correction;
            }
        );
    }

    return {
        items,
        widths,
        height,
        loose,
        panorama: false
    };
}


function buildFullWidthRowData(
    photograph,
    width
) {
    const height =
        clamp(
            width /
                Math.max(
                    0.01,
                    photograph.ratio
                ),
            88,
            250
        );

    return {
        items: [
            photograph
        ],
        widths: [
            width
        ],
        height,
        loose: false,
        panorama: true
    };
}


function makeMixedPairRows(
    portraits,
    landscapes,
    firstPhotograph
) {
    const rows = [];

    let tallOnLeft = true;

    /*
    The first thumbnail always remains the first thumbnail in
    the first row. Its orientation determines which side the
    first tall photograph occupies.
    */
    if (
        firstPhotograph &&
        !isFullWidthCandidate(
            firstPhotograph
        )
    ) {
        const firstIsPortrait =
            isPortraitPhotograph(
                firstPhotograph
            );

        const oppositePool =
            firstIsPortrait
                ? landscapes
                : portraits;

        const samePool =
            firstIsPortrait
                ? portraits
                : landscapes;

        if (oppositePool.length > 0) {
            rows.push({
                items: [
                    firstPhotograph,
                    oppositePool.shift()
                ],
                panorama: false
            });

            tallOnLeft =
                !firstIsPortrait;
        } else if (samePool.length > 0) {
            rows.push({
                items: [
                    firstPhotograph,
                    samePool.shift()
                ],
                panorama: false
            });
        } else {
            rows.push({
                items: [
                    firstPhotograph
                ],
                panorama: false
            });
        }
    }

    while (
        portraits.length > 0 &&
        landscapes.length > 0
    ) {
        const portrait =
            portraits.shift();

        const landscape =
            landscapes.shift();

        rows.push({
            items:
                tallOnLeft
                    ? [
                        portrait,
                        landscape
                    ]
                    : [
                        landscape,
                        portrait
                    ],
            panorama: false
        });

        tallOnLeft =
            !tallOnLeft;
    }

    return rows;
}


function makeSameOrientationRows(
    portraits,
    landscapes
) {
    const rows = [];

    while (landscapes.length >= 2) {
        rows.push({
            items: [
                landscapes.shift(),
                landscapes.shift()
            ],
            panorama: false
        });
    }

    while (portraits.length >= 2) {
        rows.push({
            items: [
                portraits.shift(),
                portraits.shift()
            ],
            panorama: false
        });
    }

    if (landscapes.length === 1) {
        rows.push({
            items: [
                landscapes.shift()
            ],
            panorama: false
        });
    }

    if (portraits.length === 1) {
        rows.push({
            items: [
                portraits.shift()
            ],
            panorama: false
        });
    }

    return shuffleMosaicRows(
        rows,
        0x51f15e
    );
}


function interlaceFullWidthRows(
    baseRows,
    fullWidthRows
) {
    if (fullWidthRows.length === 0) {
        return baseRows.slice();
    }

    if (baseRows.length === 0) {
        return fullWidthRows.slice();
    }

    const result =
        baseRows.slice();

    fullWidthRows.forEach(
        function (
            row,
            index
        ) {
            const fraction =
                (
                    index +
                    1
                ) /
                (
                    fullWidthRows.length +
                    1
                );

            const position =
                Math.max(
                    1,
                    Math.min(
                        result.length,
                        Math.round(
                            fraction *
                            result.length
                        )
                    )
                );

            result.splice(
                position,
                0,
                row
            );
        }
    );

    return result;
}


function insertRowsRandomly(
    baseRows,
    rowsToInsert
) {
    const result =
        baseRows.slice();

    const random =
        createMosaicRandom(
            0x7a11b0
        );

    rowsToInsert.forEach(
        function (row) {
            const minimumPosition =
                result.length > 0
                    ? 1
                    : 0;

            const availablePositions =
                result.length -
                minimumPosition +
                1;

            const position =
                minimumPosition +
                Math.floor(
                    random() *
                    Math.max(
                        1,
                        availablePositions
                    )
                );

            result.splice(
                position,
                0,
                row
            );
        }
    );

    return result;
}


function buildMosaicRows(
    width
) {
    if (photographs.length === 0) {
        return [];
    }

    const firstPhotograph =
        photographs[0];

    const portraits = [];
    const landscapes = [];
    const fullWidthPhotographs = [];

    photographs
        .slice(1)
        .forEach(
            function (photograph) {
                if (
                    isFullWidthCandidate(
                        photograph
                    )
                ) {
                    fullWidthPhotographs.push(
                        photograph
                    );
                } else if (
                    isPortraitPhotograph(
                        photograph
                    )
                ) {
                    portraits.push(
                        photograph
                    );
                } else {
                    landscapes.push(
                        photograph
                    );
                }
            }
        );

    const firstIsFullWidth =
        isFullWidthCandidate(
            firstPhotograph
        );

    const mixedRows =
        makeMixedPairRows(
            portraits,
            landscapes,
            firstIsFullWidth
                ? null
                : firstPhotograph
        );

    /*
    Build the mixed tall/wide backbone first. The tall image
    alternates from the left side to the right side.
    */
    let orderedRows =
        mixedRows;

    /*
    Next, interlace the dedicated wide single-image rows.
    The fixed first thumbnail remains first even when it is a
    full-width image.
    */
    const fullWidthRows =
        fullWidthPhotographs.map(
            photograph => ({
                items: [
                    photograph
                ],
                panorama: true
            })
        );

    if (firstIsFullWidth) {
        orderedRows = [
            {
                items: [
                    firstPhotograph
                ],
                panorama: true
            },
            ...orderedRows
        ];
    }

    orderedRows =
        interlaceFullWidthRows(
            orderedRows,
            fullWidthRows
        );

    /*
    Finally, place the remaining wide/wide and tall/tall rows
    at deterministic random positions. This makes the layout
    organic without changing every time the page resizes.
    */
    const sameOrientationRows =
        makeSameOrientationRows(
            portraits,
            landscapes
        );

    orderedRows =
        insertRowsRandomly(
            orderedRows,
            sameOrientationRows
        );

    /*
    Any leftover one-image row that is not a true 2:1-or-wider
    full-width image belongs at the very end of the mosaic.
    Panorama rows remain interlaced in their existing positions.
    */
    const pairedAndPanoramaRows =
        orderedRows.filter(
            function (row) {
                return (
                    row.panorama ||
                    row.items.length >= 2
                );
            }
        );

    const leftoverSingleRows =
        orderedRows.filter(
            function (row) {
                return (
                    !row.panorama &&
                    row.items.length === 1
                );
            }
        );

    orderedRows = [
        ...pairedAndPanoramaRows,
        ...leftoverSingleRows
    ];

    return orderedRows.map(
        function (
            row,
            rowIndex
        ) {
            if (row.panorama) {
                return buildFullWidthRowData(
                    row.items[0],
                    width
                );
            }

            return buildRegularRowData(
                row.items,
                width,
                rowIndex
            );
        }
    );
}


function animateMosaicSelection(
    selectedButton,
    photographIndex
) {
    if (mosaicSelectionAnimating) {
        return;
    }

    mosaicSelectionAnimating = true;

    const buttons =
        Array.from(
            grid.querySelectorAll(
                ".mobile-grid-item"
            )
        );

    grid.classList.add(
        "mosaic-selection-active"
    );

    buttons.forEach(function (button) {
        if (button === selectedButton) {
            button.classList.add(
                "mosaic-selected"
            );
        } else {
            button.classList.add(
                "mosaic-not-selected"
            );
        }
    });

    /*
    Unselected photographs finish their 0.3-second fade and
    shrink first. The selected photograph then begins its
    separate 1.5-second fade and shrink.
    */
    window.setTimeout(
        function () {
            if (
                !mosaicSelectionAnimating
            ) {
                return;
            }

            selectedButton.classList.add(
                "mosaic-selected-running"
            );
        },
        300
    );

    window.setTimeout(
        function () {
            openViewer(
                photographIndex
            );

            grid.classList.remove(
                "mosaic-selection-active"
            );

            buttons.forEach(function (button) {
                button.classList.remove(
                    "mosaic-selected",
                    "mosaic-selected-running",
                    "mosaic-not-selected"
                );
            });

            mosaicSelectionAnimating =
                false;
        },
        1000
    );
}


function createMosaicItem(
    photograph,
    width,
    height
) {
    const button =
        document.createElement(
            "button"
        );

    button.type = "button";

    button.className =
        "mobile-grid-item";

    button.style.width =
        `${width.toFixed(2)}px`;

    button.style.height =
        `${height.toFixed(2)}px`;

    button.setAttribute(
        "aria-label",
        `Open photograph ${
            photograph.index + 1
        }`
    );

    const image =
        document.createElement(
            "img"
        );

    image.src =
        photograph.thumbnail;

    image.alt = "";
    image.decoding = "async";
    image.loading = "eager";

    button.thumbnailReadyPromise =
        new Promise(resolve => {
            let settled = false;

            const finish =
                function (loaded) {
                    if (settled) {
                        return;
                    }

                    settled = true;

                    if (loaded) {
                        image.classList.add(
                            "loaded"
                        );
                    } else {
                        button.hidden = true;
                    }

                    resolve();
                };

            image.addEventListener(
                "load",
                function () {
                    finish(true);
                },
                {
                    once: true
                }
            );

            image.addEventListener(
                "error",
                function () {
                    finish(false);
                },
                {
                    once: true
                }
            );

            if (
                image.complete &&
                image.naturalWidth > 0
            ) {
                finish(true);
            }
        });

    button.addEventListener(
        "click",
        function () {
            animateMosaicSelection(
                button,
                photograph.index
            );
        }
    );

    button.appendChild(image);

    return button;
}


function renderMosaic() {
    if (photographs.length === 0) {
        return;
    }

    mosaicEntranceGeneration += 1;

    const renderGeneration =
        mosaicEntranceGeneration;

    const width =
        Math.max(
            1,
            grid.clientWidth ||
            window.innerWidth
        );

    const rows =
        buildMosaicRows(width);

    const fragment =
        document.createDocumentFragment();

    const thumbnailPromises = [];

    grid.classList.remove(
        "mosaic-entrance-ready",
        "mosaic-entrance-complete"
    );

    rows.forEach(
        function (
            rowData,
            rowIndex
        ) {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "mobile-mosaic-row";

            row.style.setProperty(
                "--mosaic-row-delay",
                `${(
                    rowIndex *
                    0.2
                ).toFixed(1)}s`
            );

            if (rowData.loose) {
                row.classList.add(
                    "loose"
                );
            }

            if (rowData.panorama) {
                row.classList.add(
                    "panorama"
                );
            }

            row.style.height =
                `${rowData.height.toFixed(2)}px`;

            rowData.items.forEach(
                function (
                    photograph,
                    index
                ) {
                    const item =
                        createMosaicItem(
                            photograph,
                            rowData.widths[
                                index
                            ],
                            rowData.height
                        );

                    thumbnailPromises.push(
                        item.thumbnailReadyPromise
                    );

                    row.appendChild(
                        item
                    );
                }
            );

            fragment.appendChild(
                row
            );
        }
    );

    grid.replaceChildren(
        fragment
    );

    grid.setAttribute(
        "aria-busy",
        "true"
    );

    if (mosaicEntranceComplete) {
        grid.classList.add(
            "mosaic-entrance-complete"
        );

        grid.setAttribute(
            "aria-busy",
            "false"
        );

        setStatus("");

        return;
    }

    Promise.all(
        thumbnailPromises
    ).then(function () {
        if (
            renderGeneration !==
                mosaicEntranceGeneration
        ) {
            return;
        }

        /*
        All thumbnails are now settled. Two animation frames
        ensure the hidden starting state is painted before the
        top-to-bottom row cascade begins.
        */
        window.requestAnimationFrame(
            function () {
                window.requestAnimationFrame(
                    function () {
                        if (
                            renderGeneration !==
                                mosaicEntranceGeneration
                        ) {
                            return;
                        }

                        grid.classList.add(
                            "mosaic-entrance-ready"
                        );

                        const totalDuration =
                            500 +
                            Math.max(
                                0,
                                rows.length - 1
                            ) *
                            200;

                        window.setTimeout(
                            function () {
                                if (
                                    renderGeneration !==
                                        mosaicEntranceGeneration
                                ) {
                                    return;
                                }

                                mosaicEntranceComplete =
                                    true;

                                grid.classList.remove(
                                    "mosaic-entrance-ready"
                                );

                                grid.classList.add(
                                    "mosaic-entrance-complete"
                                );
                            },
                            totalDuration
                        );

                        grid.setAttribute(
                            "aria-busy",
                            "false"
                        );

                        setStatus("");
                    }
                );
            }
        );
    });
}


function scheduleMosaicRender() {
    window.clearTimeout(
        mosaicRenderTimer
    );

    mosaicRenderTimer =
        window.setTimeout(
            renderMosaic,
            120
        );
}


const mobileControlActionDelay = 150;
const mobileControlReleaseDelay = 280;

const mobileControlReleaseTimers =
    new WeakMap();

const mobileControlActionsPending =
    new WeakSet();


function clearMobileControlReleaseTimer(
    control
) {
    const timer =
        mobileControlReleaseTimers.get(
            control
        );

    if (timer !== undefined) {
        window.clearTimeout(
            timer
        );

        mobileControlReleaseTimers.delete(
            control
        );
    }
}


function scheduleMobileControlRelease(
    control,
    delay =
        mobileControlReleaseDelay
) {
    clearMobileControlReleaseTimer(
        control
    );

    const timer =
        window.setTimeout(
            function () {
                control.classList.remove(
                    "mobile-control-pressed"
                );

                mobileControlReleaseTimers.delete(
                    control
                );
            },
            delay
        );

    mobileControlReleaseTimers.set(
        control,
        timer
    );
}


function scheduleMobileControlAction(
    control,
    action
) {
    if (
        mobileControlActionsPending.has(
            control
        )
    ) {
        return;
    }

    mobileControlActionsPending.add(
        control
    );

    clearMobileControlReleaseTimer(
        control
    );

    control.classList.add(
        "mobile-control-pressed"
    );

    window.setTimeout(
        function () {
            try {
                action();
            } finally {
                mobileControlActionsPending.delete(
                    control
                );

                scheduleMobileControlRelease(
                    control,
                    130
                );
            }
        },
        mobileControlActionDelay
    );
}


const mobilePressControls = [
    backLink,
    landscapeButton,
    fullscreenButton,
    menuButton
];

mobilePressControls.forEach(
    function (control) {
        control.addEventListener(
            "pointerdown",
            function () {
                clearMobileControlReleaseTimer(
                    control
                );

                control.classList.add(
                    "mobile-control-pressed"
                );
            }
        );

        control.addEventListener(
            "pointerup",
            function () {
                scheduleMobileControlRelease(
                    control
                );
            }
        );

        control.addEventListener(
            "pointercancel",
            function () {
                scheduleMobileControlRelease(
                    control,
                    120
                );
            }
        );

        control.addEventListener(
            "pointerleave",
            function () {
                if (
                    !mobileControlActionsPending.has(
                        control
                    )
                ) {
                    scheduleMobileControlRelease(
                        control,
                        120
                    );
                }
            }
        );
    }
);


const expandedControlClickSuppressUntil =
    new WeakMap();


function expandedControlClickIsSuppressed(
    control
) {
    return (
        performance.now() <
        (
            expandedControlClickSuppressUntil.get(
                control
            ) || 0
        )
    );
}


function scheduleExpandedControlAction(
    control,
    action
) {
    /*
    Accept the control on pointerdown so it remains responsive
    while a swipe is settling. Cancel the image gesture
    immediately, then wait for the complete button animation
    before running the requested action.
    */
    expandedControlClickSuppressUntil.set(
        control,
        performance.now() + 800
    );

    cancelViewerGestureForClose();

    scheduleMobileControlAction(
        control,
        function () {
            if (viewerOpen) {
                action();
            }
        }
    );
}


function bindExpandedControlPointerAction(
    control,
    action
) {
    control.addEventListener(
        "pointerdown",
        function (event) {
            if (!viewerOpen) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            scheduleExpandedControlAction(
                control,
                action
            );
        },
        {
            capture: true
        }
    );
}


bindExpandedControlPointerAction(
    backLink,
    requestViewerClose
);


bindExpandedControlPointerAction(
    landscapeButton,
    toggleLandscapeMode
);


bindExpandedControlPointerAction(
    fullscreenButton,
    togglePageFullscreen
);


bindExpandedControlPointerAction(
    menuButton,
    toggleMobileMenu
);


backLink.addEventListener(
    "click",
    function (event) {
        event.preventDefault();

        if (
            expandedControlClickIsSuppressed(
                backLink
            )
        ) {
            return;
        }

        closeMobileMenu();

        if (viewerOpen) {
            scheduleExpandedControlAction(
                backLink,
                requestViewerClose
            );
            return;
        }

        scheduleMobileControlAction(
            backLink,
            function () {
                if (
                    document.fullscreenElement &&
                    typeof document.exitFullscreen ===
                        "function"
                ) {
                    document.exitFullscreen()
                        .catch(function () {
                            /*
                            Keep the mosaic usable if browser
                            fullscreen exit is rejected.
                            */
                        });

                    return;
                }

                window.location.assign(
                    backLink.href
                );
            }
        );
    }
);


landscapeButton.addEventListener(
    "click",
    function () {
        if (
            expandedControlClickIsSuppressed(
                landscapeButton
            )
        ) {
            return;
        }

        if (viewerOpen) {
            scheduleExpandedControlAction(
                landscapeButton,
                toggleLandscapeMode
            );
            return;
        }

        scheduleMobileControlAction(
            landscapeButton,
            toggleLandscapeMode
        );
    }
);


fullscreenButton.addEventListener(
    "click",
    function () {
        if (
            expandedControlClickIsSuppressed(
                fullscreenButton
            )
        ) {
            return;
        }

        if (viewerOpen) {
            scheduleExpandedControlAction(
                fullscreenButton,
                togglePageFullscreen
            );
            return;
        }

        scheduleMobileControlAction(
            fullscreenButton,
            togglePageFullscreen
        );
    }
);


menuButton.addEventListener(
    "click",
    function (event) {
        event.stopPropagation();

        if (
            expandedControlClickIsSuppressed(
                menuButton
            )
        ) {
            return;
        }

        if (viewerOpen) {
            scheduleExpandedControlAction(
                menuButton,
                toggleMobileMenu
            );
            return;
        }

        /*
        Mosaic-view menu behavior remains immediate.
        */
        toggleMobileMenu();
    }
);


exitFullscreenButton.addEventListener(
    "click",
    function () {
        closeMobileMenu();
        togglePageFullscreen();
    }
);


fullResolutionButton.addEventListener(
    "click",
    function () {
        closeMobileMenu();

        fullResolutionEnabled =
            !fullResolutionEnabled;

        updateResolutionButton();

        if (
            currentIndex >= 0 &&
            currentIndex <
                photographs.length
        ) {
            /*
            Refresh the current image immediately, then begin
            downloading and decoding two active-resolution
            neighbors in each direction. This is especially
            important after enabling full resolution.
            */
            showViewerImage(
                currentIndex,
                false,
                false
            );

            preloadViewerNeighborhood(
                currentIndex,
                2
            );
        }
    }
);



downloadPhotoButton.addEventListener(
    "click",
    async function () {
        closeMobileMenu();

        if (
            currentIndex < 0 ||
            currentIndex >=
                photographs.length ||
            downloadPhotoButton.disabled
        ) {
            return;
        }

        const photograph =
            photographs[currentIndex];

        const source =
            getViewerImageSource(
                photograph
            );

        const sourceFilename =
            source
                .split("/")
                .pop() ||
            `photo-${currentIndex + 1}.jpg`;

        const filename =
            fullResolutionEnabled
                ? sourceFilename
                : sourceFilename.replace(
                    /\.jpg$/i,
                    "_half_res.jpg"
                );

        downloadPhotoButton.disabled =
            true;

        try {
            await showDownloadToast(
                `downloading ` +
                `${getViewerResolutionName()}`
            );

            const response =
                await fetch(
                    source,
                    {
                        cache: "no-store",
                        mode: "cors"
                    }
                );

            if (!response.ok) {
                throw new Error(
                    "Unable to download photo."
                );
            }

            const blob =
                await response.blob();

            const objectUrl =
                URL.createObjectURL(
                    blob
                );

            const link =
                document.createElement(
                    "a"
                );

            link.href =
                objectUrl;

            link.download =
                filename;

            link.style.display =
                "none";

            document.body.appendChild(
                link
            );

            link.click();
            link.remove();

            window.setTimeout(
                function () {
                    URL.revokeObjectURL(
                        objectUrl
                    );
                },
                1000
            );
        } catch (error) {
            /*
            If the host blocks cross-origin blob downloads,
            open the active-resolution file so the phone can
            use its native save or download controls.
            */
            const fallbackLink =
                document.createElement(
                    "a"
                );

            fallbackLink.href =
                source;

            fallbackLink.target =
                "_blank";

            fallbackLink.rel =
                "noopener";

            fallbackLink.style.display =
                "none";

            document.body.appendChild(
                fallbackLink
            );

            fallbackLink.click();
            fallbackLink.remove();
        } finally {
            downloadPhotoButton.disabled =
                false;
        }
    }
);


document.addEventListener(
    "click",
    function (event) {
        if (
            menuPanel.hidden ||
            menuPanel.contains(
                event.target
            ) ||
            menuButton.contains(
                event.target
            )
        ) {
            return;
        }

        closeMobileMenu();
    }
);


viewerStage.addEventListener(
    "pointerdown",
    function (event) {
        if (
            viewerGestureAnimating ||
            (
                event.pointerType ===
                    "mouse" &&
                event.button !== 0
            )
        ) {
            return;
        }

        activeViewerPointers.set(
            event.pointerId,
            {
                x: event.clientX,
                y: event.clientY
            }
        );

        if (
            typeof viewerStage.setPointerCapture ===
            "function"
        ) {
            try {
                viewerStage.setPointerCapture(
                    event.pointerId
                );
            } catch (error) {
                /*
                Some browsers reject capture after a gesture
                has already changed ownership.
                */
            }
        }

        if (
            activeViewerPointers.size >=
            2
        ) {
            beginPinchGesture();
            return;
        }

        resetSwipeRequest();
        gestureStartX =
            event.clientX;

        gestureStartY =
            event.clientY;

        gestureStartPanX =
            viewerPanX;

        gestureStartPanY =
            viewerPanY;

        viewerGestureMode =
            zoomLevel > 1.001
                ? "pan"
                : "swipe";
    }
);


viewerStage.addEventListener(
    "pointermove",
    function (event) {
        if (
            !activeViewerPointers.has(
                event.pointerId
            ) ||
            viewerGestureAnimating
        ) {
            return;
        }

        activeViewerPointers.set(
            event.pointerId,
            {
                x: event.clientX,
                y: event.clientY
            }
        );

        if (
            activeViewerPointers.size >=
            2
        ) {
            if (
                viewerGestureMode !==
                "pinch"
            ) {
                beginPinchGesture();
            }

            updatePinchGesture();
            return;
        }

        if (
            viewerGestureMode ===
            "pan"
        ) {
            const requestedX =
                gestureStartPanX +
                event.clientX -
                gestureStartX;

            const requestedY =
                gestureStartPanY +
                event.clientY -
                gestureStartY;

            const constrained =
                clampViewerPan(
                    requestedX,
                    requestedY
                );

            viewerPanX =
                constrained.x;

            viewerPanY =
                constrained.y;

            applyZoomTransform();
            return;
        }

        if (
            viewerGestureMode ===
            "swipe" ||
            viewerGestureMode ===
                "controls-swipe"
        ) {
            const deltaX =
                event.clientX -
                gestureStartX;

            const deltaY =
                event.clientY -
                gestureStartY;

            if (
                viewerGestureMode ===
                    "swipe" &&
                Math.abs(deltaY) >= 18 &&
                Math.abs(deltaY) >
                    Math.abs(deltaX) * 1.15
            ) {
                viewerGestureMode =
                    "controls-swipe";

                clearSwipePreview();
                resetSwipeRequest();
            }

            if (
                viewerGestureMode ===
                    "controls-swipe"
            ) {
                return;
            }

            if (
                Math.abs(deltaX) <
                    Math.abs(deltaY) *
                    0.8
            ) {
                return;
            }

            updateSwipeTransform(
                deltaX
            );
        }
    }
);


function finishViewerPointer(
    event
) {
    activeViewerPointers.delete(
        event.pointerId
    );

    if (
        viewerGestureMode ===
        "pinch"
    ) {
        if (
            activeViewerPointers.size ===
            1
        ) {
            const remaining =
                Array.from(
                    activeViewerPointers.values()
                )[0];

            gestureStartX =
                remaining.x;

            gestureStartY =
                remaining.y;

            gestureStartPanX =
                viewerPanX;

            gestureStartPanY =
                viewerPanY;

            viewerGestureMode =
                zoomLevel > 1.001
                    ? "pan"
                    : "swipe";

            syncFinalLetterboxMasksWithZoom();

            return;
        }

        if (
            activeViewerPointers.size ===
            0
        ) {
            viewerGestureMode =
                "none";

            if (zoomLevel <= 1.01) {
                resetViewerTransform(
                    true
                );
            }
        }

        return;
    }

    if (
        activeViewerPointers.size >
        0
    ) {
        return;
    }

    if (
        (
            viewerGestureMode ===
                "swipe" ||
            viewerGestureMode ===
                "pan"
        ) &&
        isViewerImageTap(
            event
        )
    ) {
        viewerGestureMode =
            "none";

        clearGestureSwipePreview();
        clearSwipePreview();
        resetSwipeRequest();

        handleViewerImageTap(
            event
        );

        return;
    }

    if (
        viewerGestureMode ===
            "controls-swipe"
    ) {
        viewerGestureMode =
            "none";

        const releaseDeltaY =
            event.clientY -
            gestureStartY;

        const verticalDistance =
            Math.abs(
                releaseDeltaY
            );

        if (verticalDistance >= 42) {
            setViewerControlsHidden(
                releaseDeltaY > 0
            );
        }

        clearSwipePreview();
        resetSwipeRequest();

        return;
    }

    if (
        viewerGestureMode ===
        "swipe"
    ) {
        viewerGestureMode =
            "none";

        const releaseDeltaX =
            event.clientX -
            gestureStartX;

        const releaseDeltaY =
            event.clientY -
            gestureStartY;

        if (
            Math.abs(releaseDeltaX) >= 18 &&
            Math.abs(releaseDeltaX) >
                Math.abs(releaseDeltaY) * 0.8
        ) {
            updateSwipeTransform(
                releaseDeltaX
            );
        }

        if (
            zoomLevel <= 1.001 &&
            isViewerControlToggleTap(event)
        ) {
            clearSwipePreview();
            resetSwipeRequest();
            toggleViewerControls();
            return;
        }

        finishViewerSwipe();
        return;
    }

    viewerGestureMode =
        "none";
}


viewerStage.addEventListener(
    "pointerup",
    finishViewerPointer
);


viewerStage.addEventListener(
    "pointercancel",
    function (event) {
        activeViewerPointers.delete(
            event.pointerId
        );

        if (
            activeViewerPointers.size ===
            0
        ) {
            viewerGestureMode =
                "none";

            syncFinalLetterboxMasksWithZoom();

            if (
                Math.abs(
                    swipeOffsetX
                ) > 0
            ) {
                finishViewerSwipe();
            }
        }
    }
);


window.addEventListener(
    "resize",
    function () {
        scheduleMosaicRender();

        if (viewerOpen) {
            if (zoomLevel <= 1.001) {
                resetViewerTransform(false);
            } else {
                applyZoomTransform();
            }

            if (
                currentIndex >= 0 &&
                currentIndex <
                    photographs.length &&
                viewerFinalMaskTop.classList.contains(
                    "visible"
                )
            ) {
                updateFinalLetterboxMasks(
                    photographs[
                        currentIndex
                    ]
                );
            }
        }
    }
);


document.addEventListener(
    "fullscreenchange",
    function () {
        updateFullscreenButton();

        if (
            !document.fullscreenElement &&
            landscapeLockActive
        ) {
            unlockLandscape();
        }
    }
);


window.addEventListener(
    "popstate",
    function () {
        if (viewerOpen) {
            closeViewer();
        }
    }
);


document.addEventListener(
    "keydown",
    function (event) {
        if (!viewerOpen) {
            return;
        }

        if (event.key === "Escape") {
            requestViewerClose();
        } else if (
            event.key === "ArrowLeft"
        ) {
            showPreviousImage();
        } else if (
            event.key === "ArrowRight"
        ) {
            showNextImage();
        }
    }
);


if (
    typeof document.documentElement.requestFullscreen !==
    "function"
) {
    fullscreenButton.disabled = true;

    fullscreenButton.setAttribute(
        "aria-label",
        "Fullscreen unavailable"
    );
}

updateFullscreenButton();

if (
    !screen.orientation ||
    typeof screen.orientation.lock !==
        "function"
) {
    landscapeButton.disabled = true;

    landscapeButton.setAttribute(
        "aria-label",
        "Landscape lock unavailable"
    );
}

updateLandscapeButton();
updateResolutionButton();


if (!collection) {
    grid.setAttribute(
        "aria-busy",
        "false"
    );

    setStatus(
        "Collection not specified."
    );
} else {
    document.title =
        `${formatCollectionName(
            collection
        )} — Gallery`;

    setStatus(
        "Preparing mosaic…"
    );

    fetch(
        "data/collections.json",
        {
            cache: "no-store"
        }
    )
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    "Unable to load collection data."
                );
            }

            return response.json();
        })
        .then(async data => {
            if (
                !data.base ||
                !Array.isArray(
                    data.collections
                )
            ) {
                throw new Error(
                    "Invalid collection data."
                );
            }

            const selected =
                data.collections.find(
                    item =>
                        item.name ===
                        collection
                );

            if (!selected) {
                throw new Error(
                    "Collection not found."
                );
            }

            const normalizedBase =
                data.base.endsWith("/")
                    ? data.base
                    : `${data.base}/`;

            const encodedCollection =
                encodeURIComponent(
                    selected.name
                );

            const imageCount =
                Number(
                    selected.images
                ) || 0;

            const storedRatios =
                Array.isArray(
                    selected.aspect_ratios
                )
                    ? selected.aspect_ratios
                    : [];

            photographs =
                Array.from(
                    {
                        length:
                            imageCount
                    },
                    (_, index) => {
                        const filename =
                            `${(
                                index + 1
                            ) * 100}.jpg`;

                        const collectionBase =
                            `${normalizedBase}` +
                            `${encodedCollection}`;

                        const storedRatio =
                            Number(
                                storedRatios[index]
                            );

                        return {
                            index,
                            ratio:
                                Number.isFinite(
                                    storedRatio
                                ) &&
                                storedRatio > 0
                                    ? clamp(
                                        storedRatio,
                                        0.28,
                                        4.2
                                    )
                                    : null,
                            thumbnail:
                                `${collectionBase}` +
                                `/thumbnails/` +
                                `${filename}`,
                            halfResolution:
                                `${collectionBase}` +
                                `/originals_half_resolution/` +
                                `${filename}`,
                            original:
                                `${collectionBase}` +
                                `/originals/` +
                                `${filename}`
                        };
                    }
                );

            if (
                photographs.length === 0
            ) {
                throw new Error(
                    "This collection is empty."
                );
            }

            /*
            New collections.json files contain aspect ratios,
            so thumbnails remain genuinely lazy. Older JSON
            files still work by reading thumbnail dimensions
            once before the first mosaic render.
            */
            await fillMissingAspectRatios();

            renderMosaic();
        })
        .catch(error => {
            grid.setAttribute(
                "aria-busy",
                "false"
            );

            setStatus(
                error.message ||
                "Unable to load this collection."
            );

            console.error(error);
        });
}
