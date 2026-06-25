#!/usr/bin/env python3
"""
End-to-end Playwright walkthrough of the OpenAlex Research RAG frontend.
- Drives the system chromium (channel="chromium") at 1440x900.
- Records the whole run to a video, and screenshots every feature
  (long pages are scrolled and captured in segments).
Run:  python3 scripts/e2e_capture.py
"""
import os
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:5176").rstrip("/")
ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"
VIDDIR = ROOT / "docs" / "video_raw"
SHOTS.mkdir(parents=True, exist_ok=True)
VIDDIR.mkdir(parents=True, exist_ok=True)
for old in SHOTS.glob("*.png"):
    old.unlink()

VW, VH = 1440, 900
_idx = 0


def shot(page, name):
    global _idx
    _idx += 1
    p = SHOTS / f"{_idx:02d}-{name}.png"
    try:
        page.screenshot(path=str(p))
        print(f"  shot {p.name}")
    except Exception as e:
        print(f"  shot FAILED {name}: {e!r}")


def settle(page, ms=1400):
    page.wait_for_timeout(ms)


def scroll_shots(page, name, max_segments=4):
    """Screenshot the page, scrolling the main container in viewport-sized steps."""
    shot(page, f"{name}")
    try:
        info = page.evaluate(
            "() => { const m = document.querySelector('main'); return m ? {sh:m.scrollHeight, ch:m.clientHeight} : {sh:0,ch:0}; }"
        )
        sh, ch = info["sh"], info["ch"]
        if sh <= ch + 40:
            return
        y, seg = ch - 80, 1
        while y < sh and seg < max_segments:
            page.evaluate("(yy)=>{const m=document.querySelector('main'); if(m) m.scrollTo(0, yy);}", y)
            settle(page, 700)
            shot(page, f"{name}-scroll{seg}")
            y += ch - 80
            seg += 1
        page.evaluate("()=>{const m=document.querySelector('main'); if(m) m.scrollTo(0,0);}")
        settle(page, 300)
    except Exception as e:
        print(f"  scroll FAILED {name}: {e!r}")


def nav(page, key):
    """Navigate via sidebar (no full reload, so the tour stays closed)."""
    try:
        page.click(f'[data-tour="nav-{key}"]', timeout=8000)
        settle(page, 1500)
        return True
    except Exception as e:
        print(f"  nav FAILED {key}: {e!r}")
        return False


def click_tour_next(page):
    for label in ("下一步", "Next"):
        try:
            page.get_by_role("button", name=label, exact=True).click(timeout=2500)
            return True
        except Exception:
            continue
    return False


def close_tour(page):
    for label in ("略過", "Skip"):
        try:
            page.get_by_role("button", name=label, exact=True).first.click(timeout=2500)
            return True
        except Exception:
            continue
    # fallback: press Escape / click X
    try:
        page.keyboard.press("Escape")
    except Exception:
        pass
    return False


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chromium", headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": VW, "height": VH},
            record_video_dir=str(VIDDIR),
            record_video_size={"width": VW, "height": VH},
        )
        page = ctx.new_page()

        # ---- 1. Demo guide + auto guided tour ----
        print("Demo guide + tour")
        page.goto(f"{BASE}/demo-guide", wait_until="domcontentloaded")
        settle(page, 2500)
        shot(page, "tour-welcome")          # auto-triggered welcome card
        for i in range(10):                  # walk core tour steps (spotlight + particles)
            if not click_tour_next(page):
                break
            settle(page, 1700)
            shot(page, f"tour-step{i+1}")
        close_tour(page)
        settle(page, 800)
        scroll_shots(page, "demo-guide")

        # ---- 1b. Dashboard ----
        print("Dashboard")
        if nav(page, "dashboard"):
            scroll_shots(page, "dashboard")

        # ---- 2. Paper Search (+ facets + real search) ----
        print("Paper Search")
        if nav(page, "search"):
            scroll_shots(page, "search-empty")
            try:
                page.fill('input[placeholder]', "transformer attention mechanism")
                page.keyboard.press("Enter")
                settle(page, 2600)
                scroll_shots(page, "search-results")
            except Exception as e:
                print("  search interact failed", repr(e))

        # ---- 3. RAG Q&A (ask a demo question) ----
        print("RAG Q&A")
        if nav(page, "rag"):
            shot(page, "rag-empty")
            try:
                page.get_by_text("recent advances in transformer", exact=False).first.click(timeout=4000)
                settle(page, 6000)           # wait for streamed answer
                scroll_shots(page, "rag-answer")
            except Exception as e:
                print("  rag interact failed", repr(e))

        # ---- 4. Pipeline Tour (run a trace) ----
        print("Pipeline")
        if nav(page, "pipeline"):
            try:
                page.get_by_text("transformer attention mechanism", exact=False).first.click(timeout=4000)
                settle(page, 5000)
                scroll_shots(page, "pipeline")
            except Exception as e:
                print("  pipeline interact failed", repr(e))
                shot(page, "pipeline")

        # ---- 5. Data Story (sample -> journey) ----
        print("Data Story")
        if nav(page, "data-story"):
            shot(page, "data-story-source")
            try:
                page.get_by_text("transformer attention", exact=False).first.click(timeout=4000)
                settle(page, 6000)
                scroll_shots(page, "data-story-journey")
            except Exception as e:
                print("  data-story interact failed", repr(e))

        # ---- 6. Topic Trends — 4 tabs ----
        print("Topic Trends")
        if nav(page, "topics"):
            settle(page, 2200)
            scroll_shots(page, "topics-trends")
            for tabname, altname, key in [("Concept Network", "概念網路", "topics-network"),
                                          ("Concept Heatmap", "概念熱度圖", "topics-heatmap"),
                                          ("Paper Cluster", "論文聚類", "topics-cluster")]:
                try:
                    try:
                        page.get_by_text(tabname, exact=False).first.click(timeout=2000)
                    except Exception:
                        page.get_by_text(altname, exact=False).first.click(timeout=4000)
                    settle(page, 4500 if "Cluster" in tabname else 2500)
                    shot(page, key)
                except Exception as e:
                    print(f"  topics tab {tabname} failed", repr(e))

        # ---- 7. The remaining pages ----
        for key, name, wait in [
            ("journals", "journal-analysis", 2500),
            ("velocity", "research-velocity", 4000),
            ("authors", "authors", 1800),
            ("institutions", "institutions", 1800),
            ("citations", "citation-graph", 1800),
            ("timeline", "paper-timeline", 2500),
            ("reading-list", "reading-list", 1800),
            ("literature-review", "literature-review", 1800),
            ("analytics", "search-analytics", 2500),
            ("playground", "playground", 1800),
            ("ingest", "data-manager", 1500),
        ]:
            print(name)
            if nav(page, key):
                settle(page, wait)
                scroll_shots(page, name)

        # ---- 8. Work detail (open a top paper) ----
        print("Work detail")
        try:
            page.goto(f"{BASE}/works/W2144634347", wait_until="domcontentloaded")
            settle(page, 2500)
            close_tour(page)
            scroll_shots(page, "work-detail")
        except Exception as e:
            print("  work detail failed", repr(e))

        # ---- 9. i18n: switch to English ----
        print("i18n toggle")
        try:
            nav(page, "dashboard")
            page.click('button[title="語言"], button[title="Language"]', timeout=4000)
            settle(page, 1200)
            shot(page, "i18n-english-dashboard")
        except Exception as e:
            print("  i18n toggle failed", repr(e))

        # finalize video
        vid_path = None
        try:
            vid_path = page.video.path()
        except Exception:
            pass
        ctx.close()
        browser.close()
        print("VIDEO:", vid_path)


if __name__ == "__main__":
    main()
