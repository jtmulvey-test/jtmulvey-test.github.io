const grid =
            document.getElementById("collectionsGrid");

        const status =
            document.getElementById("status");

        const collectionSummary =
            document.getElementById("collectionSummary");

        function createSkeletonCards(numberOfCards = 8) {
            grid.innerHTML = "";

            for (let i = 0; i < numberOfCards; i++) {
                const skeleton =
                    document.createElement("div");

                skeleton.className = "skeleton-card";

                skeleton.setAttribute(
                    "aria-hidden",
                    "true"
                );

                skeleton.innerHTML = `
                    <div class="skeleton-image"></div>

                    <div class="skeleton-content">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line small"></div>
                    </div>
                `;

                grid.appendChild(skeleton);
            }
        }

        function formatCollectionName(name) {
            return name
                .replaceAll("_", " ")
                .replaceAll("-", " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        function createCollectionCard(
            base,
            collection
        ) {
            const card =
                document.createElement("a");

            card.className = "collection-card";

            const mobileLayout =
                window.matchMedia(
                    "(max-width: 820px), " +
                    "(pointer: coarse) and (max-width: 1100px)"
                ).matches;

            const galleryPage =
                mobileLayout
                    ? "mobile-gallery.html"
                    : "gallery.html";

            card.href =
                `${galleryPage}?collection=${
                    encodeURIComponent(collection.name)
                }`;

            const imageContainer =
                document.createElement("div");

            imageContainer.className =
                "image-container";

            const image =
                document.createElement("img");

            image.className = "collection-image";

            image.alt =
                formatCollectionName(collection.name);

            image.loading = "lazy";
            image.decoding = "async";

            const normalizedBase =
                base.endsWith("/")
                    ? base
                    : `${base}/`;

            const encodedCollectionName =
                encodeURIComponent(collection.name);

            image.src =
                `${normalizedBase}${encodedCollectionName}` +
                `/title_thumbnail/collection_thumbnail.jpg`;

            image.addEventListener(
                "load",
                function () {
                    image.classList.add("loaded");
                }
            );

            image.addEventListener(
                "error",
                function () {
                    image.alt =
                        `${formatCollectionName(
                            collection.name
                        )} image unavailable`;
                }
            );

            const imageShade =
                document.createElement("div");

            imageShade.className = "image-shade";

            const imageCount =
                document.createElement("div");

            imageCount.className = "image-count";

            const photoCount =
                Number(collection.images) || 0;

            imageCount.textContent =
                `${photoCount} ${
                    photoCount === 1
                        ? "photo"
                        : "photos"
                }`;

            imageContainer.appendChild(image);
            imageContainer.appendChild(imageShade);
            imageContainer.appendChild(imageCount);

            const content =
                document.createElement("div");

            content.className =
                "collection-content";

            const textContainer =
                document.createElement("div");

            textContainer.className =
                "collection-text";

            const title =
                document.createElement("h2");

            title.className = "collection-title";

            title.textContent =
                formatCollectionName(
                    collection.name
                );

            const subtitle =
                document.createElement("p");

            subtitle.className =
                "collection-subtitle";

            subtitle.textContent =
                "View collection";

            const arrow =
                document.createElement("span");

            arrow.className = "card-arrow";
            arrow.setAttribute(
                "aria-hidden",
                "true"
            );

            const arrowSymbol =
                document.createElement("span");

            arrowSymbol.textContent = "→";

            arrow.appendChild(arrowSymbol);

            textContainer.appendChild(title);
            textContainer.appendChild(subtitle);

            content.appendChild(textContainer);
            content.appendChild(arrow);

            card.appendChild(imageContainer);
            card.appendChild(content);

            return card;
        }

        createSkeletonCards();

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

                if (
                    !base ||
                    !Array.isArray(collections)
                ) {
                    throw new Error(
                        "collections.json is not in the expected format"
                    );
                }

                const sortedCollections =
                    [...collections].sort((a, b) => {
                        return String(b.name).localeCompare(
                            String(a.name),
                            undefined,
                            {
                                numeric: true,
                                sensitivity: "base"
                            }
                        );
                    });

                grid.innerHTML = "";

                grid.setAttribute(
                    "aria-busy",
                    "false"
                );

                if (sortedCollections.length === 0) {
                    status.textContent =
                        "No collections found.";

                    collectionSummary.textContent =
                        "";

                    return;
                }

                status.style.display = "none";

                collectionSummary.textContent =
                    `${sortedCollections.length} ${
                        sortedCollections.length === 1
                            ? "collection"
                            : "collections"
                    }`;

                sortedCollections.forEach(collection => {
                    grid.appendChild(
                        createCollectionCard(
                            base,
                            collection
                        )
                    );
                });
            })
            .catch(error => {
                grid.innerHTML = "";

                grid.setAttribute(
                    "aria-busy",
                    "false"
                );

                status.style.display = "block";
                status.classList.add("error");

                status.textContent =
                    "Unable to load the photography collections.";

                collectionSummary.textContent = "";

                console.error(error);
            });
