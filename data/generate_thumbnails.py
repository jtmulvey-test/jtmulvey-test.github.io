from PIL import Image, ImageOps
import json
import os
import re
import shutil


# ==========================
# Base folder
# ==========================

base_folder = r"C:\Users\jm1\Pictures\JM_Photos"

pcloud_base_url = (
    "https://filedn.com/"
    "lbA2Vsf4s7Fj5KoVfXs5UL4/"
    "JM_Photos/"
)


# ==========================
# Settings
# ==========================

thumbnail_size = (400, 400)
title_thumbnail_size = (399, 399)

thumbnail_quality = 85
title_thumbnail_quality = 90

half_resolution_quality = 95
half_resolution_subsampling = 0

image_extensions = (
    ".jpg",
    ".jpeg",
    ".png"
)

title_folder_name = "title_thumbnail"
title_output_filename = "collection_thumbnail.jpg"

thumbnails_folder_name = "thumbnails"
half_resolution_folder_name = "originals_half_resolution"

orientation_exif_tag = 274
gps_exif_tag = 34853


def natural_sort_key(filename):
    """Sort text alphabetically while treating digit groups as numbers."""

    return [
        int(part) if part.isdigit() else part.casefold()
        for part in re.split(r"(\d+)", filename)
    ]


def list_images(folder):
    """Return supported image files in deterministic natural-sort order."""

    return sorted(
        [
            filename
            for filename in os.listdir(folder)
            if filename.lower().endswith(image_extensions)
        ],
        key=natural_sort_key
    )


def clear_generated_folder(folder):
    """Delete generated files while preserving the folder itself."""

    os.makedirs(
        folder,
        exist_ok=True
    )

    for entry in os.listdir(folder):
        path = os.path.join(
            folder,
            entry
        )

        if os.path.isfile(path) or os.path.islink(path):
            os.remove(path)
        elif os.path.isdir(path):
            shutil.rmtree(path)


def original_names_need_normalizing(image_files):
    """Check whether originals need sequential 100, 200, 300... names."""

    return any(
        filename !=
        f"{(index + 1) * 100}" +
        f"{os.path.splitext(filename)[1].lower()}"
        for index, filename in enumerate(image_files)
    )


def normalize_original_names(originals_folder, image_files):
    """
    Rename originals without recompressing or changing their image data.

    Temporary names prevent collisions when files exchange positions.
    """

    if not original_names_need_normalizing(
        image_files
    ):
        print("  Original filenames already normalized")

        return False

    temporary_files = []

    for index, filename in enumerate(image_files):
        old_path = os.path.join(
            originals_folder,
            filename
        )

        extension = os.path.splitext(
            filename
        )[1].lower()

        temporary_name = (
            f"__tmp_{index:06d}" +
            extension
        )

        temporary_path = os.path.join(
            originals_folder,
            temporary_name
        )

        os.rename(
            old_path,
            temporary_path
        )

        temporary_files.append(
            temporary_name
        )

    for index, filename in enumerate(
        temporary_files,
        start=1
    ):
        extension = os.path.splitext(
            filename
        )[1].lower()

        old_path = os.path.join(
            originals_folder,
            filename
        )

        new_name = (
            f"{index * 100}" +
            extension
        )

        new_path = os.path.join(
            originals_folder,
            new_name
        )

        os.rename(
            old_path,
            new_path
        )

    print(
        f"  Renamed {len(temporary_files)} images"
    )

    return True


def cleaned_exif_bytes(image):
    """
    Preserve useful EXIF metadata while removing orientation and GPS.

    Orientation is removed because ImageOps.exif_transpose permanently
    applies it to the derivative pixels. GPS is intentionally excluded
    from web derivatives.
    """

    exif = image.getexif()

    if orientation_exif_tag in exif:
        del exif[orientation_exif_tag]

    if gps_exif_tag in exif:
        del exif[gps_exif_tag]

    if len(exif) == 0:
        return None

    return exif.tobytes()


def jpeg_save_options(source_image):
    """Build metadata-preserving JPEG save options."""

    options = {
        "format": "JPEG",
        "quality": half_resolution_quality,
        "subsampling": half_resolution_subsampling,
        "optimize": True,
        "progressive": True
    }

    exif_bytes = cleaned_exif_bytes(
        source_image
    )

    if exif_bytes:
        options["exif"] = exif_bytes

    icc_profile = source_image.info.get(
        "icc_profile"
    )

    if icc_profile:
        options["icc_profile"] = icc_profile

    dpi = source_image.info.get(
        "dpi"
    )

    if (
        isinstance(dpi, tuple) and
        len(dpi) == 2
    ):
        options["dpi"] = dpi

    return options


def half_resolution_filename(original_filename):
    """Half-resolution derivatives are always high-quality JPEG files."""

    stem = os.path.splitext(
        original_filename
    )[0]

    return f"{stem}.jpg"


def half_resolution_needs_update(
    original_path,
    half_resolution_path
):
    """
    Regenerate when missing or when the source has a newer timestamp.
    """

    if not os.path.exists(
        half_resolution_path
    ):
        return True

    return (
        os.stat(
            original_path
        ).st_mtime_ns >
        os.stat(
            half_resolution_path
        ).st_mtime_ns
    )


def create_half_resolution_image(
    original_path,
    output_path
):
    """
    Create a JPEG with half the source width and half the source height.

    Example: 6000 x 4000 becomes 3000 x 2000.
    """

    temporary_output = (
        output_path +
        ".tmp"
    )

    try:
        with Image.open(
            original_path
        ) as source_image:
            save_options = jpeg_save_options(
                source_image
            )

            oriented_image = ImageOps.exif_transpose(
                source_image
            )

            width, height = oriented_image.size

            target_size = (
                max(
                    1,
                    width // 2
                ),
                max(
                    1,
                    height // 2
                )
            )

            resized_image = oriented_image.resize(
                target_size,
                Image.Resampling.LANCZOS
            )

            if resized_image.mode != "RGB":
                resized_image = resized_image.convert(
                    "RGB"
                )

            resized_image.save(
                temporary_output,
                **save_options
            )

        os.replace(
            temporary_output,
            output_path
        )

    finally:
        if os.path.exists(
            temporary_output
        ):
            os.remove(
                temporary_output
            )


def create_or_update_title_thumbnail(
    collection_path
):
    """Create the square collection title thumbnail when supplied."""

    title_folder = os.path.join(
        collection_path,
        title_folder_name
    )

    if not os.path.exists(
        title_folder
    ):
        print(
            "  No title_thumbnail folder found"
        )

        return

    title_images = [
        filename
        for filename in os.listdir(
            title_folder
        )
        if (
            filename.lower().endswith(
                image_extensions
            ) and
            filename !=
                title_output_filename
        )
    ]

    if not title_images:
        return

    input_file = os.path.join(
        title_folder,
        title_images[0]
    )

    output_file = os.path.join(
        title_folder,
        title_output_filename
    )

    try:
        with Image.open(
            input_file
        ) as source_image:
            image = ImageOps.exif_transpose(
                source_image
            )

            width, height = image.size

            if width != height:
                print(
                    "  ERROR: Title image is not square "
                    f"({width}x{height})"
                )

                return

            image = image.resize(
                title_thumbnail_size,
                Image.Resampling.LANCZOS
            )

            if image.mode not in (
                "RGB",
                "L"
            ):
                image = image.convert(
                    "RGB"
                )

            image.save(
                output_file,
                quality=title_thumbnail_quality,
                optimize=True
            )

        os.remove(
            input_file
        )

        print(
            "  Created collection_thumbnail.jpg"
        )

    except Exception as error:
        print(
            "  Error processing title thumbnail: "
            f"{error}"
        )


def process_collection(
    collection,
    collection_path
):
    """Process one photo collection and return its JSON entry."""

    print(
        f"\nProcessing collection: {collection}"
    )

    originals_folder = os.path.join(
        collection_path,
        "originals"
    )

    if not os.path.exists(
        originals_folder
    ):
        print(
            "  No originals folder found"
        )

        return None

    original_images = list_images(
        originals_folder
    )

    originals_names_changed = (
        normalize_original_names(
            originals_folder,
            original_images
        )
    )

    original_images = list_images(
        originals_folder
    )

    thumbnails_folder = os.path.join(
        collection_path,
        thumbnails_folder_name
    )

    half_resolution_folder = os.path.join(
        collection_path,
        half_resolution_folder_name
    )

    os.makedirs(
        thumbnails_folder,
        exist_ok=True
    )

    os.makedirs(
        half_resolution_folder,
        exist_ok=True
    )

    if originals_names_changed:
        print(
            "  Original filenames changed; "
            "clearing thumbnails folder"
        )

        clear_generated_folder(
            thumbnails_folder
        )

        print(
            "  Original filenames changed; "
            "clearing half-resolution folder"
        )

        clear_generated_folder(
            half_resolution_folder
        )

    create_or_update_title_thumbnail(
        collection_path
    )

    image_count = 0
    aspect_ratios = []

    expected_half_resolution_files = set()

    for filename in original_images:
        image_count += 1

        original_path = os.path.join(
            originals_folder,
            filename
        )

        thumbnail_path = os.path.join(
            thumbnails_folder,
            filename
        )

        half_filename = half_resolution_filename(
            filename
        )

        expected_half_resolution_files.add(
            half_filename.casefold()
        )

        half_resolution_path = os.path.join(
            half_resolution_folder,
            half_filename
        )

        try:
            with Image.open(
                original_path
            ) as source_image:
                image = ImageOps.exif_transpose(
                    source_image
                )

                width, height = image.size

                aspect_ratios.append(
                    round(
                        width /
                        max(
                            1,
                            height
                        ),
                        6
                    )
                )

                if os.path.exists(
                    thumbnail_path
                ):
                    print(
                        f"  Thumbnail exists: {filename}"
                    )
                else:
                    thumbnail_image = image.copy()

                    thumbnail_image.thumbnail(
                        thumbnail_size,
                        Image.Resampling.LANCZOS
                    )

                    if thumbnail_image.mode not in (
                        "RGB",
                        "L"
                    ):
                        thumbnail_image = (
                            thumbnail_image.convert(
                                "RGB"
                            )
                        )

                    thumbnail_image.save(
                        thumbnail_path,
                        quality=thumbnail_quality,
                        optimize=True
                    )

                    print(
                        f"  Created thumbnail: {filename}"
                    )

            if half_resolution_needs_update(
                original_path,
                half_resolution_path
            ):
                create_half_resolution_image(
                    original_path,
                    half_resolution_path
                )

                print(
                    "  Created half-resolution image: "
                    f"{half_filename}"
                )
            else:
                print(
                    "  Half-resolution image current: "
                    f"{half_filename}"
                )

        except Exception as error:
            aspect_ratios.append(
                1.0
            )

            print(
                f"  Error processing {filename}: "
                f"{error}"
            )

    for filename in os.listdir(
        half_resolution_folder
    ):
        path = os.path.join(
            half_resolution_folder,
            filename
        )

        if (
            os.path.isfile(path) and
            filename.casefold() not in
                expected_half_resolution_files
        ):
            os.remove(
                path
            )

            print(
                "  Removed stale half-resolution image: "
                f"{filename}"
            )

    if collection.lower() == "blank":
        print(
            "  Skipped blank collection "
            "in collections.json"
        )

        return None

    return {
        "name": collection,
        "images": image_count,
        "aspect_ratios": aspect_ratios
    }


def main():
    """Process every collection and write collections.json."""

    collections = []

    for collection in sorted(
        os.listdir(
            base_folder
        ),
        key=natural_sort_key
    ):
        collection_path = os.path.join(
            base_folder,
            collection
        )

        if not os.path.isdir(
            collection_path
        ):
            continue

        collection_entry = process_collection(
            collection,
            collection_path
        )

        if collection_entry is not None:
            collections.append(
                collection_entry
            )

    json_path = os.path.join(
        base_folder,
        "collections.json"
    )

    with open(
        json_path,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            {
                "base": pcloud_base_url,
                "collections": collections
            },
            file,
            indent=4
        )

    print(
        "\nGenerated:"
    )

    print(
        json_path
    )

    print(
        "\nAll processing complete."
    )


if __name__ == "__main__":
    main()
