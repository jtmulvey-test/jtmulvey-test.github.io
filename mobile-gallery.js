/*
Lightweight mobile gallery v2.4.7
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


const mosaicGap = 3;
const maximumImagesPerRow = 2;
const ratioLoadConcurrency = 6;

let photographs = [];
let currentIndex = -1;
let viewerOpen = false;
let viewerHistoryActive = false;
let viewerLoadToken = 0;
let mosaicRenderTimer = null;
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

let pinchStartDistance = 0;
let pinchStartZoom = 1;
let pinchFocalX = 0;
let pinchFocalY = 0;


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
        1000
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

    viewerPreview.classList.remove(
        "visible",
        "thumbnail-blur"
    );

    viewerPreview.removeAttribute(
        "src"
    );

    if (animate) {
        window.setTimeout(
            function () {
                setViewerAnimation(false);
            },
            300
        );
    }
}


function clearSwipePreview() {
    swipeOffsetX = 0;
    swipeDirection = 0;
    swipeTargetIndex = -1;
    swipePreviewStartX = 0;

    viewerPreview.classList.remove(
        "visible",
        "ready-image",
        "resolving"
    );

    viewerPreview.removeAttribute(
        "src"
    );

    viewerPreview.style.transform =
        "translate3d(0, 0, 0)";
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
        clearSwipePreview();
        return false;
    }

    if (
        swipeTargetIndex ===
            targetIndex &&
        viewerPreview.classList.contains(
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

    const targetSource =
        getViewerImageSource(
            targetPhotograph
        );

    const targetRecord =
        getViewerSourceRecord(
            targetPhotograph
        );

    viewerPreview.classList.remove(
        "ready-image",
        "resolving"
    );

    if (
        targetRecord &&
        targetRecord.status ===
            "ready"
    ) {
        viewerPreview.src =
            targetSource;

        viewerPreview.classList.add(
            "ready-image"
        );
    } else {
        viewerPreview.src =
            targetPhotograph.thumbnail;

        /*
        Begin loading and decoding the active-resolution file
        as soon as the swipe direction is known. If it becomes
        ready before the gesture finishes, promote the moving
        preview in place instead of waiting for the final
        image commit.
        */
        preloadViewerSource(
            targetPhotograph
        ).then(function (record) {
            if (
                !viewerOpen ||
                swipeTargetIndex !==
                    targetIndex ||
                !viewerPreview.classList.contains(
                    "visible"
                ) ||
                record.status !==
                    "ready" ||
                getViewerImageSource(
                    targetPhotograph
                ) !== targetSource
            ) {
                return;
            }

            viewerPreview.src =
                targetSource;

            viewerPreview.classList.add(
                "ready-image"
            );
        });
    }

    viewerPreview.classList.add(
        "visible"
    );

    viewerPreview.style.transform =
        `translate3d(` +
        `${swipePreviewStartX.toFixed(2)}px, ` +
        `0, 0)`;

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

    if (hasTarget) {
        viewerPreview.style.transform =
            `translate3d(` +
            `${(
                swipePreviewStartX +
                swipeOffsetX
            ).toFixed(2)}px, ` +
            `0, 0)`;
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

        if (
            swipeTargetIndex >= 0
        ) {
            viewerPreview.style.transform =
                `translate3d(` +
                `${swipePreviewStartX.toFixed(2)}px, ` +
                `0, 0)`;
        }

        waitForViewerTransition(
            function () {
                setViewerAnimation(false);

                /*
                Explicitly re-center after a boundary pull so
                no rubber-band transform can remain applied.
                */
                resetViewerTransform(false);
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

    viewerPreview.style.transform =
        "translate3d(0, 0, 0)";

    waitForViewerTransition(
        function () {
            setViewerAnimation(false);

            showViewerImage(
                targetIndex,
                true,
                true
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

    clearSwipePreview();

    /*
    A second finger cancels any partial one-finger swipe and
    returns the current photograph to its zoom/pan transform
    before pinch scaling begins.
    */
    applyZoomTransform();

    viewerGestureMode =
        "pinch";

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


function loadViewerDisplaySource(
    index,
    token
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
            return;
        }

        /*
        The loaded image is placed underneath the single
        thumbnail overlay. Only then does the overlay perform
        its one and only deblur/fade transition.
        */
        viewerImage.src =
            source;

        window.requestAnimationFrame(
            function () {
                window.requestAnimationFrame(
                    function () {
                        if (
                            token !==
                                viewerLoadToken ||
                            currentIndex !==
                                index
                        ) {
                            return;
                        }

                        viewerPreview.classList.add(
                            "resolving"
                        );

                        window.setTimeout(
                            function () {
                                if (
                                    token ===
                                        viewerLoadToken &&
                                    currentIndex ===
                                        index
                                ) {
                                    clearSwipePreview();
                                }
                            },
                            240
                        );
                    }
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

    const source =
        getViewerImageSource(
            photograph
        );

    const record =
        getViewerSourceRecord(
            photograph
        );

    if (
        record &&
        record.status ===
            "ready"
    ) {
        viewerImage.src =
            source;

        if (preserveOverlay) {
            clearSwipePreview();
        }
    } else {
        if (!preserveOverlay) {
            clearSwipePreview();

            viewerPreview.src =
                photograph.thumbnail;

            viewerPreview.classList.add(
                "visible"
            );

            viewerPreview.style.transform =
                "translate3d(0, 0, 0)";
        }

        loadViewerDisplaySource(
            index,
            loadToken
        );
    }

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


function openViewer(index) {
    if (
        index < 0 ||
        index >= photographs.length
    ) {
        return;
    }

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
}


function closeViewer() {
    if (!viewerOpen) {
        return;
    }

    viewerOpen = false;
    viewerHistoryActive = false;
    viewerLoadToken += 1;

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

    resetViewerTransform(false);

    viewer.hidden = true;

    viewer.setAttribute(
        "aria-hidden",
        "true"
    );

    viewerImage.removeAttribute(
        "src"
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


function chooseRowCount(
    startIndex,
    width,
    rowIndex
) {
    const remaining =
        photographs.length -
        startIndex;

    if (
        remaining <=
        maximumImagesPerRow
    ) {
        return remaining;
    }

    const target =
        getTargetRowHeight(
            width,
            rowIndex
        );

    let bestCount = 2;
    let bestScore = Infinity;

    for (
        let count = 2;
        count <=
            maximumImagesPerRow;
        count += 1
    ) {
        const candidate =
            photographs.slice(
                startIndex,
                startIndex + count
            );

        const height =
            measureJustifiedHeight(
                candidate,
                width
            );

        let score =
            Math.abs(
                height -
                target
            );

        if (height < target * 0.58) {
            score +=
                target * 1.2;
        }

        if (height > target * 1.58) {
            score +=
                target * 1.4;
        }

        /*
        Slightly favor three-image rows when the two choices
        are similarly good, while still allowing two-image
        rows to create a varied desktop-mosaic rhythm.
        */
        if (count === 3) {
            score *= 0.96;
        }

        if (score < bestScore) {
            bestScore = score;
            bestCount = count;
        }
    }

    return bestCount;
}


function buildMosaicRows(width) {
    const rows = [];
    let startIndex = 0;
    let rowIndex = 0;

    while (
        startIndex <
        photographs.length
    ) {
        const count =
            chooseRowCount(
                startIndex,
                width,
                rowIndex
            );

        const items =
            photographs.slice(
                startIndex,
                startIndex + count
            );

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

        const isLastRow =
            startIndex + count >=
            photographs.length;

        const loose =
            isLastRow &&
            (
                count === 1 ||
                justifiedHeight >
                    targetHeight * 1.34
            );

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
                        count - 1
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
                (value, index) => {
                    widths[index] =
                        value *
                        correction;
                }
            );
        }

        rows.push({
            items,
            widths,
            height,
            loose
        });

        startIndex += count;
        rowIndex += 1;
    }

    return rows;
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

    image.loading =
        photograph.index < 8
            ? "eager"
            : "lazy";

    const markLoaded =
        function () {
            image.classList.add(
                "loaded"
            );
        };

    if (image.complete) {
        markLoaded();
    } else {
        image.addEventListener(
            "load",
            markLoaded,
            {
                once: true
            }
        );
    }

    image.addEventListener(
        "error",
        function () {
            button.hidden = true;
        },
        {
            once: true
        }
    );

    button.addEventListener(
        "click",
        function () {
            openViewer(
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

    rows.forEach(rowData => {
        const row =
            document.createElement(
                "div"
            );

        row.className =
            "mobile-mosaic-row";

        if (rowData.loose) {
            row.classList.add(
                "loose"
            );
        }

        row.style.height =
            `${rowData.height.toFixed(2)}px`;

        rowData.items.forEach(
            (photograph, index) => {
                row.appendChild(
                    createMosaicItem(
                        photograph,
                        rowData.widths[index],
                        rowData.height
                    )
                );
            }
        );

        fragment.appendChild(row);
    });

    grid.replaceChildren(fragment);

    grid.setAttribute(
        "aria-busy",
        "false"
    );

    setStatus("");
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
