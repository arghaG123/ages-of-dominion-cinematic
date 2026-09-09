"""
Ages of Dominion Cinematic — production art generator via Vertex AI (Gemini image model).

Reads assets/source/manifest.json, builds a full dark-fantasy prompt per asset from the
style bible template + per-asset subject description, generates the image, post-processes
(chroma-key to real alpha for silhouette sprites; leaves full-bleed scenes/textures opaque),
saves into assets/approved/, and updates the manifest entry in place.

Usage:
    python scripts/generate-art.py --group benchmark
    python scripts/generate-art.py --group building --dry-run
    python scripts/generate-art.py --ids bench-hero-knight,bench-bld-townhall
    python scripts/generate-art.py --all --force
"""
import os
import sys
import time
import json
import argparse
from io import BytesIO

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST_PATHS = [
    os.path.join(ROOT, "assets", "source", "manifest.json"),
    os.path.join(ROOT, "public", "assets", "manifest.json"),
]
APPROVED_DIR = os.path.join(ROOT, "assets", "approved")

PROJECT = "direct-volt-501306-c5"
LOCATION = "us-central1"
MODEL = "gemini-2.5-flash-image"

STYLE_PREFIX = (
    "Masterpiece cinematic dark-fantasy oil painting for a premium mobile strategy game. "
    "Realistic materials, stylized heroic proportions, dramatic rim lighting from upper-left, "
    "desaturated midtones, high-contrast readable silhouette, soft fog and ember dust. "
)
MAGENTA_SUFFIX = "Isolated on solid magenta #FF00FF background. No text, no watermark, no logo, no UI, no ground plane."
SCENE_SUFFIX = "Full painted environment, wide isometric perspective, no units, no text, no watermark, no UI chrome."
TEXTURE_SUFFIX = "Seamless tileable material swatch, flat-on view, no text, no watermark, no UI chrome."

AGES = ['stone', 'bronze', 'iron', 'medieval', 'gunpowder', 'industrial', 'modern']
AGE_LABEL = ['Stone Age', 'Bronze Age', 'Iron Age', 'Medieval Age', 'Gunpowder Age', 'Industrial Age', 'Modern Age']
AGE_MATERIAL = [
    "rough-hewn timber, animal hide, bone fetishes, stacked fieldstone, primitive lashings",
    "hammered bronze plates with green patina, leather bindings, early dressed masonry",
    "dark riveted iron, legionary geometry, cut ashlar stone",
    "crenellated stone masonry, heraldic banners, timber hoardings, slate roofing",
    "brick and timber with black iron fittings, gunports, powder-stained wood",
    "riveted steel, soot-stained brick chimneys, exposed steam pipes, iron girders",
    "poured concrete, composite armor panels, exposed conduit, cold floodlit steel",
]

BUILDING_DESC = {
    'townhall': 'a civic chieftain hall and seat of the realm, imposing central structure',
    'farm': 'an agricultural farmstead with crop storage and livestock pens',
    'lumber': 'a logging timber camp with a sawmill and stacked logs',
    'quarry': 'a stonecutters masonry yard beside an open quarry pit',
    'mine': 'an underground gold and ore mine headframe with a cart track',
    'barracks': 'a garrisoned barracks with weapon racks and drilling yard',
    'workshop': 'a siege engineers workshop with half-built war machines',
    'hall': 'an ornate hero hall for champions, banners and trophies',
    'armory': 'a blacksmith armory forge with glowing hearth and anvils',
    'walls': 'a fortified defensive wall section with a gatehouse tower',
}

TOWER_FAMILY_DESC = {
    'arrow': 'a projectile watchtower built to loose volleys down a besieged lane',
    'splash': 'a heavy siege engine tower hurling explosive area payloads',
    'slow': 'a control tower rigged with traps and snares to slow attackers',
    'support': 'a signal/aura tower rallying nearby defenders',
}

ROLE_DESC = {
    'melee': 'a frontline melee warrior gripping a close-combat weapon and shield',
    'ranged': 'a ranged skirmisher drawing a projectile weapon, quiver or ammo pouch at the hip',
    'heavy': 'a heavy shock-trooper, oversized weapon or mount, built to break enemy lines',
}

ANIM_POSE = {
    'idle': 'standing ready combat idle stance, weapon lowered but alert',
    'move': 'mid-stride running/advancing pose, dynamic forward motion',
    'attack': 'mid-swing attacking pose, weapon at the peak of a strike',
    'hit': 'staggering hit-reaction pose, flinching from a wound',
    'death': 'collapsing death pose, falling backward, dramatic final moment',
}

HERO_DESC = {
    'knight': 'a might-focused Knight hero in burnished plate armor with sword and heater shield, noble bearing',
    'ranger': 'a Ranger hero in hooded leather and cloak, longbow in hand, watchful forest-wanderer look',
    'warlock': 'a Warlock hero in dark tattered robes with an arcane staff, eyes glowing with restrained power',
}

HERO_VARIANT_DESC = {
    'portrait': 'heroic bust-up three-quarter portrait, dramatic character study',
    'idle': 'full-body standing combat-ready idle pose',
    'turn': 'full-body dynamic action pose showing motion and cape/cloak flow',
}

CREATURE_DESC = {
    'wolf': 'a Dire Wolf, oversized feral predator with matted dark fur and glowing eyes',
    'bandit': 'a ragged Bandit raider in dark leathers wielding a crude blade',
    'bear': 'a hulking Cave Bear, matted fur, scarred hide, primal menace',
    'harpy': 'a Harpy, winged half-bird half-woman monster with talons',
    'golem': 'a Stone Golem, hulking construct of carved rock and moss',
    'griffin': 'a Griffin, majestic winged lion-eagle beast',
    'wyvern': 'a Wyvern, sinewy two-legged dragon with a barbed tail',
    'drone': 'a Drone Swarm, cluster of ominous floating mechanical constructs',
}

SIEGE_ENEMY_DESC = {
    'brute': 'a hulking Brute invader, oversized club, heavy armor plates',
    'runner': 'a fast feral Runner beast, low-slung and sprinting',
    'archer': 'an enemy Archer raider drawing a bow at range',
    'sapper': 'a demolition Sapper laden with explosives, hunched and scheming',
    'shaman': 'an enemy Shaman caster wreathed in dark magic energy',
}

BIOME_DESC = {
    'lowlands': 'rolling green lowland farmland dotted with hedgerows',
    'forest': 'a dense ancient forest with towering dark-canopy trees',
    'swamp': 'a gloomy marshland with stagnant water and twisted roots',
    'desert': 'an arid sun-scorched desert with dunes and cracked earth',
    'snow': 'a frozen tundra with deep snowdrifts and exposed dark rock',
    'darklands': 'a corrupted wasteland with ashen ground and eerie fog',
}

TERRAIN_DESC = {
    'plains': 'a wide grassy tactical battlefield with rolling terrain',
    'forest': 'a woodland clearing battlefield bordered by ancient trees',
    'hills': 'a rugged hillside battlefield with rocky ridges',
    'swamp': 'a gloomy marshland battlefield with dark stagnant water',
    'desert': 'an arid canyon battlefield with sandstone buttes',
    'snow': 'a frozen tundra battlefield with snowdrifts and granite',
    'waste': 'a volcanic wasteland battlefield with scorched earth and embers',
    'ruins': 'an ancient ruined battlefield with broken stone columns',
}

VFX_DESC = {
    'fire': 'a horizontal fire/flame burst particle effect strip, glowing embers',
    'ice': 'a horizontal frost/ice shard particle effect strip, cold blue glow',
    'arrows': 'a horizontal flying arrows particle effect strip, motion streaks',
    'melee': 'a horizontal melee impact slash particle effect strip, sharp flash',
    'heal': 'a horizontal healing light particle effect strip, warm gold glow',
    'smoke': 'a horizontal smoke plume particle effect strip, drifting haze',
    'lightning': 'a horizontal lightning bolt particle effect strip, electric arcs',
    'death': 'a horizontal death/dissolve particle effect strip, fading dark motes',
    'dust': 'a horizontal dust cloud particle effect strip, ground impact haze',
    'rain': 'a horizontal rain splash particle effect strip, water droplets',
    'spell': 'a horizontal arcane spell-light particle effect strip, violet glow',
}

UI_DESC = {
    'metal': 'brushed charcoal gunmetal panel material with subtle gold hairline trim',
    'leather': 'worn dark brown leather panel material with visible grain and stitching',
    'parchment': 'aged parchment paper panel material, warm cream tone, soft creases',
    'glass': 'dark smoked glass panel material with faint gold-edged reflections',
}

BENCHMARK_PROMPTS = {
    'bench-hero-knight': (
        'alpha', 'benchmarks/hero-knight.png',
        'a might-focused Knight hero in burnished plate armor with sword and heater shield, '
        'heroic bust-up three-quarter portrait, noble determined expression',
    ),
    'bench-bld-townhall': (
        'alpha', 'benchmarks/bld-townhall.png',
        'a Stone Age civic chieftain town hall, rough-hewn timber, animal hide, bone fetishes, '
        'stacked fieldstone, 2:1 isometric perspective viewed from southeast',
    ),
    'bench-battle-plains': (
        'scene', 'benchmarks/battle-plains.jpg',
        'a wide grassy tactical battlefield with rolling terrain, seamless wide perspective for isometric tactical combat',
    ),
    'bench-unit-clubman': (
        'alpha', 'benchmarks/unit-clubman.png',
        'a Stone Age Clubman melee warrior gripping a crude stone club and hide shield, '
        'mid-swing attacking pose, weapon at the peak of a strike',
    ),
    'bench-ui-panel': (
        'texture', 'benchmarks/ui-panel.jpg',
        'brushed charcoal gunmetal UI panel material with subtle gold hairline trim, dark smoked glass inlay',
    ),
}


def build_prompt(asset):
    """Return (mode, subject) for a manifest asset. mode in alpha|scene|texture."""
    aid = asset['id']
    cat = asset['category']

    if aid in BENCHMARK_PROMPTS:
        return BENCHMARK_PROMPTS[aid][0], BENCHMARK_PROMPTS[aid][2]

    age_idx = asset.get('age')
    age_label = AGE_LABEL[age_idx] if isinstance(age_idx, int) and 0 <= age_idx < 7 else None
    age_mat = AGE_MATERIAL[age_idx] if isinstance(age_idx, int) and 0 <= age_idx < 7 else None

    if cat == 'building':
        # id: bld-<building>-<age>
        parts = aid.split('-')
        b = parts[1]
        desc = BUILDING_DESC.get(b, b)
        return 'alpha', (
            f"a {age_label} {desc}, {age_mat}, "
            "2:1 isometric perspective viewed from southeast"
        )

    if cat == 'tower':
        parts = aid.split('-')
        t = parts[1]
        desc = TOWER_FAMILY_DESC.get(t, t)
        return 'alpha', (
            f"a {age_label} defensive tower — {desc}, {age_mat}, "
            "2:1 isometric perspective viewed from southeast"
        )

    if cat == 'unit':
        # id: unit-<role>-<age>-<anim>
        parts = aid.split('-')
        role, anim = parts[1], parts[-1]
        desc = ROLE_DESC.get(role, role)
        pose = ANIM_POSE.get(anim, anim)
        return 'alpha', (
            f"{desc} of the {age_label}, wearing gear made of {age_mat}, "
            f"{pose}, full-body, facing right, grounded warrior silhouette"
        )

    if cat == 'hero':
        parts = aid.split('-')
        cls, variant = parts[1], parts[2]
        desc = HERO_DESC.get(cls, cls)
        var = HERO_VARIANT_DESC.get(variant, variant)
        return 'alpha', f"{desc}, {var}"

    if cat == 'creature':
        parts = aid.split('-')
        c, anim = parts[1], parts[-1]
        desc = CREATURE_DESC.get(c, c)
        pose = ANIM_POSE.get(anim, anim)
        return 'alpha', f"{desc}, {pose}, full-body monster silhouette"

    if cat == 'siege-enemy':
        e = aid.split('-')[-1]
        desc = SIEGE_ENEMY_DESC.get(e, e)
        return 'alpha', f"{desc}, full-body invader silhouette advancing"

    if cat == 'rival':
        return 'alpha', (
            "a menacing rival warlord antagonist, dark ornate armor, scarred face, "
            "heroic bust-up three-quarter portrait, cold hostile expression"
        )

    if cat == 'map':
        b = aid.split('-', 1)[1]
        return 'scene', f"a top-down/overhead campaign map tile of {BIOME_DESC.get(b, b)}, muted dark-fantasy palette"

    if cat == 'siege-lane':
        b = aid.split('-', 2)[2] if aid.count('-') >= 2 else aid
        return 'scene', f"a defensive siege lane corridor through {BIOME_DESC.get(b, b)}, winding path toward a besieged core"

    if cat == 'battleground':
        t = aid.split('-', 1)[1]
        return 'scene', TERRAIN_DESC.get(t, t)

    if cat == 'vfx':
        v = aid.split('-', 1)[1]
        return 'alpha', VFX_DESC.get(v, v)

    if cat == 'ui':
        m = aid.split('-', 1)[1]
        return 'texture', UI_DESC.get(m, m)

    if cat == 'prop':
        return 'alpha', "a wooden construction scaffold with dust and rope lashings, mid-build"

    return 'alpha', asset.get('id', 'dark fantasy game asset')


def full_prompt(mode, subject):
    if mode == 'alpha':
        return f"{STYLE_PREFIX}Subject: {subject}. {MAGENTA_SUFFIX}"
    if mode == 'scene':
        return f"{STYLE_PREFIX}Subject: {subject}. {SCENE_SUFFIX}"
    return f"{STYLE_PREFIX}Subject: {subject}. {TEXTURE_SUFFIX}"


def out_filename(asset, mode):
    if asset['id'] in BENCHMARK_PROMPTS:
        return BENCHMARK_PROMPTS[asset['id']][1]
    base = os.path.splitext(asset['file'])[0]
    ext = 'png' if mode == 'alpha' else 'jpg'
    return f"{base}.{ext}"


def get_client():
    from google import genai
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return genai.Client(api_key=key)
    return genai.Client(vertexai=True, project=PROJECT, location=LOCATION)


def _is_magenta_hue(r, g, b, ratio=0.72):
    """Hue-relative magenta/rose test: robust to the vignette the model paints around
    the requested flat #FF00FF (observed drifting toward raspberry/rose, R != B), and
    to brightness falloff — the defining trait kept is G being clearly suppressed
    relative to both other channels, not R vs B or a fixed anchor distance."""
    mn = min(r, b)
    if mn < 10:
        return False  # near-black — could be subject shadow, never background
    return g < mn * ratio


def punch_alpha(img, feather=2):
    """Remove the magenta background via flood-fill from the border using a
    hue-relative test — so a disconnected subject color that happens to be
    magenta-ish (a red cape, warm rim-light) never gets eaten, only the truly
    connected background, regardless of the vignette the model painted."""
    import collections
    from PIL import Image, ImageFilter
    img = img.convert("RGBA")
    w, h = img.size
    pixels = img.load()

    visited = bytearray(w * h)
    bg_mask = bytearray(w * h)  # 1 = background
    q = collections.deque()

    def seed(x, y):
        idx = y * w + x
        if not visited[idx]:
            visited[idx] = 1
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    # Hysteresis: a pixel already reached through solid background may pull in
    # more marginal (softer glow/mist) neighbors than a fresh seed could on its own —
    # this is what actually clears the rim-light halos without eating into the subject.
    while q:
        x, y = q.popleft()
        idx = y * w + x
        r, g, b, _a = pixels[x, y]
        if not _is_magenta_hue(r, g, b, ratio=0.9):
            continue
        bg_mask[idx] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if not visited[nidx]:
                    visited[nidx] = 1
                    nr, ng, nb, _na = pixels[nx, ny]
                    if _is_magenta_hue(nr, ng, nb, ratio=0.9):
                        q.append((nx, ny))

    mask_img = Image.frombytes('L', (w, h), bytes(255 if not v else 0 for v in bg_mask))
    if feather:
        mask_img = mask_img.filter(ImageFilter.GaussianBlur(feather))
    img.putalpha(mask_img)
    return img


RAW_DIR = os.path.join(ROOT, "assets", "source", "raw")


def raw_path_for(out_path):
    name = os.path.splitext(os.path.basename(out_path))[0]
    return os.path.join(RAW_DIR, name + ".raw.png")


def generate_one(client, prompt, out_path, mode, force=False):
    if os.path.exists(out_path) and not force:
        print(f"  [SKIP] exists: {os.path.relpath(out_path, ROOT)}")
        return True
    from PIL import Image
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)
    for attempt in range(5):
        try:
            response = client.models.generate_content(model=MODEL, contents=prompt)
            image = None
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    image = Image.open(BytesIO(part.inline_data.data))
                    break
            if image is None:
                print(f"  [FAIL] no image returned for {out_path}")
                return False
            if mode == 'alpha':
                image.convert("RGB").save(raw_path_for(out_path), format="PNG")
                processed = punch_alpha(image)
                processed.save(out_path, format="PNG", optimize=True)
                image = processed
            else:
                image = image.convert("RGB")
                image.save(out_path, format="JPEG", quality=92)
            print(f"  [OK] {os.path.relpath(out_path, ROOT)} ({image.size[0]}x{image.size[1]})")
            return True
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                wait = 10 * (attempt + 1)
                print(f"  [WAIT] rate limited, retry in {wait}s ({attempt + 1}/5)")
                time.sleep(wait)
            else:
                print(f"  [FAIL] {out_path}: {e}")
                return False
    return False


def reprocess_alpha(out_path):
    """Re-run punch_alpha on the cached raw image without calling the API again."""
    from PIL import Image
    rp = raw_path_for(out_path)
    if not os.path.exists(rp):
        return False
    img = Image.open(rp)
    processed = punch_alpha(img)
    processed.save(out_path, format="PNG", optimize=True)
    return True


def checksum_of(path):
    from hashlib import sha256
    with open(path, 'rb') as f:
        return sha256(f.read()).hexdigest()[:16]


def load_manifest():
    with open(MANIFEST_PATHS[0], 'r', encoding='utf-8') as f:
        return json.load(f)


def save_manifest(manifest):
    for p in MANIFEST_PATHS:
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--group', help='category to generate (building, unit, tower, hero, creature, siege-enemy, rival, map, siege-lane, battleground, vfx, ui, prop, benchmark)')
    ap.add_argument('--ids', help='comma-separated asset ids')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--reprocess', action='store_true', help='re-run alpha punch on cached raw images, no API calls')
    args = ap.parse_args()

    manifest = load_manifest()
    assets = manifest['assets']

    if args.ids:
        wanted = set(args.ids.split(','))
        targets = [a for a in assets if a['id'] in wanted]
    elif args.group == 'benchmark':
        targets = [a for a in assets if a['category'] == 'benchmark']
    elif args.group:
        targets = [a for a in assets if a['category'] == args.group]
    elif args.all:
        targets = [a for a in assets if a['category'] != 'icon']
    else:
        print("Specify --group, --ids, or --all")
        sys.exit(2)

    if args.limit:
        targets = targets[:args.limit]

    print(f"{len(targets)} asset(s) targeted")

    if args.dry_run:
        for a in targets:
            mode, subject = build_prompt(a)
            print(f"{a['id']:32s} [{mode:8s}] {out_filename(a, mode)}")
            print(f"    {full_prompt(mode, subject)[:140]}...")
        return

    if args.reprocess:
        n = 0
        for a in targets:
            mode, _ = build_prompt(a)
            if mode != 'alpha':
                continue
            fname = out_filename(a, mode)
            out_path = os.path.join(APPROVED_DIR, fname)
            if reprocess_alpha(out_path):
                print(f"  [REPROCESSED] {fname}")
                n += 1
        print(f"\n[DONE] reprocessed {n}")
        return

    client = get_client()
    ok, fail = 0, 0
    for a in targets:
        mode, subject = build_prompt(a)
        prompt = full_prompt(mode, subject)
        fname = out_filename(a, mode)
        out_path = os.path.join(APPROVED_DIR, fname)
        success = generate_one(client, prompt, out_path, mode, force=args.force)
        if success:
            ok += 1
            a['file'] = fname
            a['prompt'] = prompt
            a['generator'] = f"vertex-ai:{MODEL}"
            a['humanEditor'] = 'ai-generated-pending-review'
            a['sourceSize'] = list(__import__('PIL.Image', fromlist=['Image']).open(out_path).size)
            a['checksum'] = checksum_of(out_path)
        else:
            fail += 1
        save_manifest(manifest)  # persist progress after every asset

    print(f"\n[DONE] {ok} ok, {fail} failed")


if __name__ == '__main__':
    main()
