from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(
    r"C:\Users\Dominik\Documents\GitHub\HSK_WI_KURS_ARS\26SS\QM\review\qm_exam_review.sqlite"
)
OUT_PATH = ROOT / "data" / "cards.json"


CHAPTER_LABELS = {
    1: "Kapitel 1 Einführung",
    2: "Kapitel 2 Qualitätsmanagementsysteme",
    3: "Kapitel 3 Qualitätsmanagement in der Beschaffung inkl. 3.6 Wareneingangsprüfung",
    4: "Kapitel 4 Statistische Prozessregelung",
    5: "Kapitel 5 Messsysteme",
    6: "Kapitel 6 Qualitätswerkzeuge",
    7: "Kapitel 7 FMEA",
    8: "Kapitel 8 Prozesskettenmanagement",
    9: "Kapitel 9 Qualitätsbezogene Kosten",
    10: "Kapitel 10 Servicequalität",
    11: "Kapitel 11 Projektplanung",
    12: "Kapitel 12 Führung von Projektteams",
}

TEXT_REPLACEMENTS = [
    ("Qualit?ts", "Qualitäts"),
    ("Qualit?t", "Qualität"),
    ("qualit?t", "qualität"),
    ("Arbeitsqualität", "Arbeitsqualität"),
    ("?bungs", "Übungs"),
    ("?bung", "Übung"),
    ("?ber", "über"),
    ("?bers", "übers"),
    ("?berw", "überw"),
    ("F?hig", "Fähig"),
    ("f?hig", "fähig"),
    ("F?lle", "Fälle"),
    ("F?hr", "Führ"),
    ("f?hr", "führ"),
    ("Pr?f", "Prüf"),
    ("pr?f", "prüf"),
    ("R?ck", "Rück"),
    ("r?ck", "rück"),
    ("Zur?ck", "Zurück"),
    ("zur?ck", "zurück"),
    ("Ma?nahme", "Maßnahme"),
    ("Ma?e", "Maße"),
    ("gro?e", "große"),
    ("gro?", "groß"),
    ("N?herung", "Näherung"),
    ("?hnlich", "ähnlich"),
    ("Abh?ng", "Abhäng"),
    ("Abl?ufe", "Abläufe"),
    ("Aufl?sung", "Auflösung"),
    ("Best?t", "Bestät"),
    ("Begr?nd", "Begründ"),
    ("Verst?ndnis", "Verständnis"),
    ("Erkl?r", "Erklär"),
    ("erkl?r", "erklär"),
    ("erl?utert", "erläutert"),
    ("ausf?hrlich", "ausführlich"),
    ("ausdr?cklich", "ausdrücklich"),
    ("w?rden", "würden"),
    ("w?rde", "würde"),
    ("w?re", "wäre"),
    ("k?nnen", "können"),
    ("k?nne", "könne"),
    ("k?nnte", "könnte"),
    ("m?ssen", "müssen"),
    ("m?sse", "müsse"),
    ("m?glich", "möglich"),
    ("geh?ren", "gehören"),
    ("K?rper", "Körper"),
    ("k?rper", "körper"),
    ("Pr?senz", "Präsenz"),
    ("Tr?nen", "Tränen"),
    ("H?gel", "Hügel"),
    ("Wir-Gef?hl", "Wir-Gefühl"),
    ("tempor?rer", "temporärer"),
    ("erg?nz", "ergänz"),
    ("Probleml?s", "Problemlös"),
    ("l?sen", "lösen"),
    ("fr?her", "früher"),
    ("sp?ter", "später"),
    ("n?chste", "nächste"),
    ("tats?ch", "tatsäch"),
    ("vollst?ndig", "vollständig"),
    ("verk?rzen", "verkürzen"),
    ("verl?ngern", "verlängern"),
    ("unterst?tzen", "unterstützen"),
    ("zuf?llig", "zufällig"),
    ("ausw?hlen", "auswählen"),
    ("eingeschr?nkt", "eingeschränkt"),
    ("erf?llen", "erfüllen"),
    ("Gew?hr", "Gewähr"),
    ("Versch?rfte", "Verschärfte"),
    ("Priorit?t", "Priorität"),
    ("pr?gen", "prägen"),
    ("pr?ventiv", "präventiv"),
    ("zus?tzlich", "zusätzlich"),
    ("h?chstens", "höchstens"),
    ("G?te", "Güte"),
    ("K?stchen", "Kästchen"),
    ("Gr?ten", "Gräten"),
    ("gew?nschte", "gewünschte"),
    ("Vorw?rts", "Vorwärts"),
    ("R?ckw?rts", "Rückwärts"),
    ("Rückw?rts", "Rückwärts"),
    ("Vorg?nge", "Vorgänge"),
    ("Vorg?ngen", "Vorgängen"),
    ("Vorg?nger", "Vorgänger"),
    ("f?nf", "fünf"),
    ("f?r", "für"),
    ("?berschaubare", "überschaubare"),
    ("?berschaubare/lineare", "überschaubare/lineare"),
]


def chapter_no(card_id: str) -> int:
    match = re.match(r"QM-K(\d{2})-", card_id)
    if not match:
        return 999
    return int(match.group(1))


def parse_tags(raw: str) -> list[str]:
    try:
        value = json.loads(raw)
    except Exception:
        return []
    return value if isinstance(value, list) else []


def fix_text(value: str) -> str:
    text = str(value or "")
    for old, new in TEXT_REPLACEMENTS:
        text = text.replace(old, new)
    return text


def main() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(DB_PATH)

    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row

    rows = con.execute(
        """
        select id, course, chapter, kind, priority, front, back, source, reason,
               why_exam_relevant, tags, teacher_hint_level, teacher_hint_reason, updated_at
        from review_items
        order by id
        """
    ).fetchall()

    status_rows = con.execute(
        "select chapter, status, summary, sources, updated_at from chapter_status"
    ).fetchall()
    con.close()

    cards = []
    for row in rows:
        no = chapter_no(row["id"])
        reason = row["why_exam_relevant"] or row["reason"] or ""
        teacher_hint_level = row["teacher_hint_level"] or ""
        cards.append(
            {
                "id": row["id"],
                "course": fix_text(row["course"]),
                "chapterNo": no,
                "chapter": CHAPTER_LABELS.get(no, row["chapter"]),
                "kind": row["kind"],
                "priority": int(row["priority"]),
                "front": fix_text(row["front"]),
                "back": fix_text(row["back"]),
                "source": fix_text(row["source"]),
                "whyExamRelevant": fix_text(reason),
                "teacherHint": bool(teacher_hint_level),
                "teacherHintLevel": teacher_hint_level,
                "teacherHintReason": fix_text(row["teacher_hint_reason"] or ""),
                "tags": [fix_text(tag) for tag in parse_tags(row["tags"])],
                "updatedAt": row["updated_at"],
            }
        )

    counts_by_chapter = {
        n: {"total": 0, "memorize": 0, "skill": 0, "teacherHint": 0} for n in range(1, 13)
    }
    for card in cards:
        bucket = counts_by_chapter.setdefault(
            card["chapterNo"], {"total": 0, "memorize": 0, "skill": 0, "teacherHint": 0}
        )
        bucket["total"] += 1
        bucket[card["kind"]] += 1
        if card["teacherHint"]:
            bucket["teacherHint"] += 1

    status_by_chapter = {}
    for row in status_rows:
        raw_sources = row["sources"] or "[]"
        try:
            sources = json.loads(raw_sources)
        except Exception:
            sources = []
        status_by_chapter[row["chapter"]] = {
            "status": row["status"],
            "summary": row["summary"],
            "sources": sources,
            "updatedAt": row["updated_at"],
        }

    chapters = []
    for no in range(1, 13):
        label = CHAPTER_LABELS[no]
        status = "prepared" if counts_by_chapter[no]["total"] else "skipped"
        matching_status = next(
            (
                value
                for key, value in status_by_chapter.items()
                if key.startswith(f"Kapitel {no} ") or key == label
            ),
            None,
        )
        if matching_status:
            status = matching_status["status"]
        chapters.append(
            {
                "chapterNo": no,
                "title": label,
                "status": status,
                **counts_by_chapter[no],
            }
        )

    payload = {
        "course": "PQM / Prozessorientiertes Qualitätsmanagement",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceDatabase": str(DB_PATH),
        "totalCards": len(cards),
        "teacherHintCards": sum(1 for card in cards if card["teacherHint"]),
        "chapters": chapters,
        "cards": cards,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_PATH} with {len(cards)} cards.")


if __name__ == "__main__":
    main()
