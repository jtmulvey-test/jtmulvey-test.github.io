#!/usr/bin/env python3
"""
Scans content/ and writes data/manifest.json, then mirrors the publication
TOC figures into assets/.

Authoring rules
---------------
Only folders whose name starts with a number and a dash are research cards.
Anything else in content/ is support material and is left alone — that is
what keeps content/TOC_images/ and content/professional_photo/ off the
research page.

content/<NN-card-id>/
    card.md     card title + intro blurb (front matter: title, description)
    1.mp4       slide 1 media   (number = order, extension = type)
    1.md        slide 1 text    (front matter: title, journal, journal_link,
                                 description, alt)
    2.png
    2.md
    ...

A slide needs a media file to appear. A .md with no matching media is skipped
with a warning. Media with no matching .md renders with empty text.
Optional poster frames for video: NN-poster.jpg / NN-poster.webp

Any front-matter field beyond title/journal/journal_link/description/alt is
passed through automatically and rendered as a small "Label: value" line
under the slide description — e.g. add `data: "Jane Doe"` or
`analysis: "Jane Doe"` to credit who collected/analyzed that dataset. No
code change needed to add a new field; the label is the key, title-cased.

Credited names
--------------
Every name in one of those credit lines is mirrored into data/people.json
with an empty URL. Paste a Google Scholar profile beside a name there and it
becomes a link on the research page; leave it blank and it stays plain text.
The sync only ever adds names, so URLs you have already filled in are safe.

Publication figures
-------------------
content/TOC_images/<exact paper title>.png is the master copy of a paper's
TOC figure. The publications page does not read that folder; it reads the
resized copy under assets/img/publications/ named by the "image" field in
data/publications.json. This script keeps the second in step with the first,
matching them on the paper title, so updating a figure means replacing the
file in content/TOC_images/ and running the build.

Run locally with `python build.py`, or let the GitHub Action run it on push.
"""

import hashlib
import json
import os
import re
import shutil
import sys
import unicodedata
from datetime import datetime, timezone

CONTENT_DIR = "content"
OUTPUT = os.path.join("data", "manifest.json")

# a research card folder: leading number, dash, slug. Everything else in
# content/ is support material.
CARD_DIR = re.compile(r"^\d+-")

TOC_DIR = os.path.join(CONTENT_DIR, "TOC_images")
PUBLICATIONS = os.path.join("data", "publications.json")
PEOPLE = os.path.join("data", "people.json")
TOC_MAX_WIDTH = 900

VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v"}
IMAGE_EXT = {".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif", ".tif", ".tiff"}

KNOWN_SLIDE_FIELDS = {"title", "journal", "journal_link", "description", "alt"}

warnings = []


def format_label(key):
    """'data_collection' -> 'Data Collection'; 'analysis' -> 'Analysis'."""
    return " ".join(w.capitalize() for w in key.replace("_", " ").replace("-", " ").split())


# --------------------------------------------------------------------------
# front matter + tiny markdown
# --------------------------------------------------------------------------

def parse_front_matter(text):
    """Return (dict_of_fields, body_text). Front matter is a --- delimited
    block of `key: value` lines at the top of the file."""
    fields, body = {}, text

    if text.lstrip().startswith("---"):
        stripped = text.lstrip()
        end = stripped.find("\n---", 3)
        if end != -1:
            block = stripped[3:end]
            body = stripped[end + 4:].lstrip("\n")
            key = None
            for line in block.splitlines():
                if not line.strip():
                    continue
                # continuation line: indented, belongs to the previous key
                if line[:1] in " \t" and key:
                    fields[key] = (fields[key] + " " + line.strip()).strip()
                    continue
                if ":" in line:
                    key, value = line.split(":", 1)
                    key = key.strip().lower()
                    fields[key] = unquote(value.strip())

    return fields, body.strip()


def unquote(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def md_to_html(text):
    """Deliberately minimal: paragraphs, links, bold, italic, inline code."""
    if not text:
        return ""

    def inline(s):
        s = (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)",
                   r'<a href="\2" target="_blank" rel="noopener">\1</a>', s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", s)
        s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
        return s

    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    return "".join(f"<p>{inline(b)}</p>" for b in blocks)


# --------------------------------------------------------------------------
# scanning
# --------------------------------------------------------------------------

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def media_type(ext):
    if ext in VIDEO_EXT:
        return "video"
    if ext in IMAGE_EXT:
        return "image"
    return None


def file_version(path):
    """Short hash of a media file's CONTENTS, used as a ?v= cache key.

    Media URLs never change — slide 2's image is always 2.png — so a browser
    that has cached 2.png will keep showing it after the file is replaced.
    Stamping the URL with a key derived from the bytes makes a changed file a
    different URL, and an unchanged file the same URL, so only what actually
    changed gets re-downloaded. That matters here: the videos run to tens of
    megabytes, and a key that changed on every build would re-send all of
    them to every visitor for the sake of one edited caption.

    Contents rather than size+mtime on purpose. Renaming a file leaves its
    mtime untouched, and reordering slides is exactly renaming — the case a
    timestamp-based key would silently miss.
    """
    h = hashlib.sha1()
    try:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
    except OSError as exc:
        warnings.append(f"{path}: could not hash for cache key ({exc})")
        return ""
    return h.hexdigest()[:8]


def find_poster(folder, stem, files):
    for ext in (".webp", ".jpg", ".jpeg", ".png"):
        name = f"{stem}-poster{ext}"
        if name in files:
            return f"{CONTENT_DIR}/{folder}/{name}"
    return None


def build_card(folder):
    path = os.path.join(CONTENT_DIR, folder)
    files = sorted(os.listdir(path))

    card = {"id": folder, "title": folder, "description": "", "body_html": "",
            "slides": []}

    if "card.md" in files:
        fields, body = parse_front_matter(read(os.path.join(path, "card.md")))
        card["title"] = fields.get("title") or folder
        card["description"] = fields.get("description", "")
        card["body_html"] = md_to_html(body)
    else:
        warnings.append(f"{folder}: no card.md, using folder name as title")

    # group files by numeric stem
    slides = {}
    for name in files:
        stem, ext = os.path.splitext(name)
        ext = ext.lower()
        if "-poster" in stem or not stem.isdigit():
            continue
        n = int(stem)
        entry = slides.setdefault(n, {"media": None, "ext": None, "md": None})
        if ext == ".md":
            entry["md"] = name
        elif media_type(ext):
            if entry["media"] and media_type(entry["ext"]) == media_type(ext):
                warnings.append(
                    f"{folder}/{name}: slide {n} already has media "
                    f"({entry['media']}), ignoring")
                continue
            entry["media"], entry["ext"] = name, ext

    for n in sorted(slides):
        entry = slides[n]

        if not entry["media"]:
            warnings.append(f"{folder}/{n}.md: no media file for slide {n}, skipped")
            continue

        fields = {}
        body_html = ""
        if entry["md"]:
            fields, body = parse_front_matter(read(os.path.join(path, entry["md"])))
            body_html = md_to_html(body)
        else:
            warnings.append(f"{folder}/{entry['media']}: no {n}.md, text will be empty")

        extra = [{"label": format_label(k), "value": v}
                 for k, v in fields.items()
                 if k not in KNOWN_SLIDE_FIELDS and v]

        stem = str(n)
        poster = find_poster(folder, stem, files)
        card["slides"].append({
            "n": n,
            "type": media_type(entry["ext"]),
            "src": f"{CONTENT_DIR}/{folder}/{entry['media']}",
            "v": file_version(os.path.join(path, entry["media"])),
            "poster": poster,
            # poster is already a repo-relative path
            "poster_v": file_version(poster) if poster else "",
            "title": fields.get("title", ""),
            "journal": fields.get("journal", ""),
            "journal_link": fields.get("journal_link", ""),
            "description": fields.get("description", ""),
            "alt": fields.get("alt", fields.get("title", "")),
            "body_html": body_html,
            "extra": extra,
        })

    if not card["slides"]:
        warnings.append(f"{folder}: no slides with media yet")

    return card


# --------------------------------------------------------------------------
# publication TOC figures -> assets/img/publications/
# --------------------------------------------------------------------------

def title_key(s):
    """Compare titles ignoring case, punctuation and dash flavour, so
    'Metal–Organic' and 'Metal-Organic' match."""
    s = unicodedata.normalize("NFKD", s)
    for dash in "–—−":
        s = s.replace(dash, "-")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def copy_resized(src, dst):
    """Resize to TOC_MAX_WIDTH if Pillow is available, otherwise copy as is —
    a build without Pillow should still produce a correct site, just with
    heavier images."""
    try:
        from PIL import Image
    except ImportError:
        shutil.copy2(src, dst)
        return "copied (install Pillow to resize)"

    im = Image.open(src)
    if im.width > TOC_MAX_WIDTH:
        im = im.resize((TOC_MAX_WIDTH, round(im.height * TOC_MAX_WIDTH / im.width)),
                       Image.LANCZOS)
    if dst.lower().endswith((".jpg", ".jpeg")):
        im.convert("RGB").save(dst, quality=90, optimize=True, progressive=True)
    else:
        im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB").save(dst, optimize=True)
    return f"{im.width}x{im.height}"


def sync_toc_images():
    """Refresh assets/img/publications/ from content/TOC_images/. Only files
    whose master is newer than the copy are rewritten, so a build with no
    figure changes leaves the working tree clean."""
    if not os.path.isdir(TOC_DIR):
        return 0
    if not os.path.exists(PUBLICATIONS):
        warnings.append(f"{PUBLICATIONS} not found, skipping TOC figures")
        return 0

    with open(PUBLICATIONS, encoding="utf-8") as f:
        pubs = json.load(f).get("publications", [])

    masters = {}
    for name in os.listdir(TOC_DIR):
        path = os.path.join(TOC_DIR, name)
        if os.path.isfile(path) and not name.startswith("."):
            masters[title_key(os.path.splitext(name)[0])] = path

    updated, used = 0, set()
    for pub in pubs:
        dst = pub.get("image")
        if not dst:
            continue
        key = title_key(pub.get("title", ""))
        src = masters.get(key)
        if not src:
            warnings.append(f"no TOC figure in {TOC_DIR}/ for: {pub.get('title', '')[:60]}")
            continue
        used.add(key)

        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        size = copy_resized(src, dst)
        print(f"  figure: {os.path.basename(dst)} <- TOC_images ({size})")
        updated += 1

    for key, path in masters.items():
        if key not in used:
            warnings.append(f"{os.path.basename(path)}: no publication with this title")

    return updated


# --------------------------------------------------------------------------
# credited names -> data/people.json
# --------------------------------------------------------------------------

def sync_people(cards):
    """Add any newly credited name to data/people.json with an empty URL.

    Only ever adds. An existing name keeps whatever URL is already beside it,
    and a name that no longer appears on any slide is left in place rather
    than deleted — dropping it would throw away a link that took someone
    effort to find, for a file that costs nothing to carry.

    This is what keeps the authoring promise intact: adding a slide that
    credits a new collaborator does not also mean remembering to edit a JSON
    file by hand. Run the build, then fill in the blank.
    """
    names = set()
    for card in cards:
        for slide in card["slides"]:
            for field in slide["extra"]:
                for part in str(field["value"]).split(","):
                    if part.strip():
                        names.add(part.strip())

    if not names:
        return 0

    data = {}
    if os.path.exists(PEOPLE):
        try:
            with open(PEOPLE, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError) as exc:
            warnings.append(f"{PEOPLE}: unreadable ({exc}), leaving it alone")
            return 0

    people = data.get("people")
    if not isinstance(people, dict):
        people = {}

    added = sorted(n for n in names if n not in people)
    if not added:
        return 0

    for name in added:
        people[name] = ""

    data["people"] = dict(sorted(people.items(), key=lambda kv: kv[0].lower()))

    os.makedirs("data", exist_ok=True)
    with open(PEOPLE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"{PEOPLE}: added {len(added)} name(s) — {', '.join(added)}")
    return len(added)


def main():
    if not os.path.isdir(CONTENT_DIR):
        sys.exit(f"error: no {CONTENT_DIR}/ directory found")

    entries = sorted(d for d in os.listdir(CONTENT_DIR)
                     if os.path.isdir(os.path.join(CONTENT_DIR, d))
                     and not d.startswith("."))

    folders = [d for d in entries if CARD_DIR.match(d)]
    skipped = [d for d in entries if not CARD_DIR.match(d)]

    cards = [build_card(f) for f in folders]

    os.makedirs("data", exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump({
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "cards": cards,
        }, f, indent=2, ensure_ascii=False)
        f.write("\n")

    total = sum(len(c["slides"]) for c in cards)
    print(f"wrote {OUTPUT}: {len(cards)} cards, {total} slides")
    if skipped:
        print(f"  not cards (no NN- prefix), left alone: {', '.join(skipped)}")

    sync_people(cards)

    updated = sync_toc_images()
    print(f"publication figures: {updated} updated")

    for w in warnings:
        print(f"  warning: {w}")


if __name__ == "__main__":
    main()
