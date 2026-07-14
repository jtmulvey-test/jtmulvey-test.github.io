from PIL import Image
import os
import json


# ==========================
# Base folder
# ==========================

base_folder = r"C:\Users\jm1\Pictures\JM_Photos"


# ==========================
# Settings
# ==========================

thumbnail_size = (400, 400)
title_thumbnail_size = (399, 399)

thumbnail_quality = 85
title_thumbnail_quality = 90

image_extensions = (
    ".jpg",
    ".jpeg",
    ".png"
)

title_folder_name = "title_thumbnail"
title_output_filename = "collection_thumbnail.jpg"

collections = []


# ==========================
# Process collections
# ==========================

for collection in sorted(os.listdir(base_folder)):

    collection_path = os.path.join(
        base_folder,
        collection
    )

    if not os.path.isdir(collection_path):
        continue

    print(f"\nProcessing collection: {collection}")

    # ============================================================
    # Rename originals to 1.jpg, 2.jpg, 3.jpg...
    # ============================================================

    originals_folder = os.path.join(
        collection_path,
        "originals"
    )

    if not os.path.exists(originals_folder):

        print("  No originals folder found")

        continue

    image_files = sorted([
        f for f in os.listdir(originals_folder)
        if f.lower().endswith(image_extensions)
    ])

    # ----- Pass 1 -----
    # Rename everything to temporary names

    temp_files = []

    for i, filename in enumerate(image_files):

        old_path = os.path.join(
            originals_folder,
            filename
        )

        extension = os.path.splitext(filename)[1].lower()

        temp_name = f"__tmp_{i:06d}{extension}"

        temp_path = os.path.join(
            originals_folder,
            temp_name
        )

        os.rename(old_path, temp_path)

        temp_files.append(temp_name)

    # ----- Pass 2 -----
    # Rename temp files to 1.jpg, 2.jpg...

    for i, filename in enumerate(temp_files, start=1):

        extension = os.path.splitext(filename)[1].lower()

        old_path = os.path.join(
            originals_folder,
            filename
        )

        new_name = f"{i}{extension}"

        new_path = os.path.join(
            originals_folder,
            new_name
        )

        os.rename(old_path, new_path)

    print(f"  Renamed {len(temp_files)} images")



    # ============================================================
    # Create title thumbnail
    # ============================================================

    title_folder = os.path.join(
        collection_path,
        title_folder_name
    )

    if os.path.exists(title_folder):

        image_files = []

        for file in os.listdir(title_folder):

            if (
                file.lower().endswith(image_extensions)
                and file != title_output_filename
            ):
                image_files.append(file)

        if len(image_files) > 0:

            input_file = os.path.join(
                title_folder,
                image_files[0]
            )

            output_file = os.path.join(
                title_folder,
                title_output_filename
            )

            try:

                img = Image.open(input_file)

                width, height = img.size

                if width != height:

                    print(
                        f"  ERROR: Title image is not square ({width}x{height})"
                    )

                else:

                    img = img.resize(
                        title_thumbnail_size,
                        Image.Resampling.LANCZOS
                    )

                    img.save(
                        output_file,
                        quality=title_thumbnail_quality,
                        optimize=True
                    )

                    os.remove(input_file)

                    print("  Created collection_thumbnail.jpg")

            except Exception as e:

                print(f"  Error processing title thumbnail: {e}")

    else:

        print("  No title_thumbnail folder found")



    # ============================================================
    # Generate thumbnails
    # ============================================================

    thumbnails_folder = os.path.join(
        collection_path,
        "thumbnails"
    )

    os.makedirs(
        thumbnails_folder,
        exist_ok=True
    )

    image_count = 0

    for filename in sorted(os.listdir(originals_folder)):

        if not filename.lower().endswith(image_extensions):
            continue

        image_count += 1

        original_path = os.path.join(
            originals_folder,
            filename
        )

        thumbnail_path = os.path.join(
            thumbnails_folder,
            filename
        )

        if os.path.exists(thumbnail_path):

            print(f"  Thumbnail exists: {filename}")

            continue

        try:

            img = Image.open(original_path)

            img.thumbnail(thumbnail_size)

            img.save(
                thumbnail_path,
                quality=thumbnail_quality,
                optimize=True
            )

            print(f"  Created thumbnail: {filename}")

        except Exception as e:

            print(f"  Error processing {filename}: {e}")



    # ============================================================
    # Add collection to JSON
    # ============================================================

    collections.append(
        {
            "name": collection,
            "images": image_count
        }
    )


# ============================================================
# Generate collections.json
# ============================================================

json_path = os.path.join(
    base_folder,
    "collections.json"
)

with open(
    json_path,
    "w"
) as file:

    json.dump(
        collections,
        file,
        indent=4
    )

print("\nGenerated:")
print(json_path)

print("\nAll processing complete.")