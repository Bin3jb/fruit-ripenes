"""
Deterministic ripeness knowledge base.

The language model answers free-form questions, but the *facts* it is allowed
to state about a detection come from here.  Grounding the assistant in a fixed
table is what keeps the application safe to demo: the LLM can rephrase and
translate, it cannot invent a shelf life.
"""

# days_left: typical remaining window at room temperature / refrigerated.
KB = {
    "banana": {
        "unripe":   dict(days_room=3, days_fridge=5,  action="ripen",
                         en="Starchy and firm. Leave at room temperature, ideally in a paper bag with an apple to trap ethylene.",
                         ar="صلبة ونشوية. اتركها في حرارة الغرفة، ويفضل في كيس ورقي مع تفاحة لحبس غاز الإيثيلين."),
        "ripe":     dict(days_room=2, days_fridge=5,  action="eat",
                         en="Peak sweetness and aroma. Eat now, or refrigerate — the peel will darken but the flesh stays good.",
                         ar="في ذروة الحلاوة والنكهة. تناولها الآن أو ضعها في الثلاجة؛ ستسود القشرة لكن اللب يبقى صالحًا."),
        "overripe": dict(days_room=1, days_fridge=2,  action="cook",
                         en="Very sweet, soft flesh. Best for banana bread, smoothies or freezing — not for eating raw.",
                         ar="حلوة جدًا ولبها طري. الأفضل استخدامها في الكيك أو العصائر أو تجميدها بدل أكلها طازجة."),
    },
    "red_apple": {
        "unripe":   dict(days_room=5, days_fridge=14, action="ripen",
                         en="Tart and hard, with green shoulders. Keep at room temperature for a few days.",
                         ar="حامضة وصلبة مع أطراف خضراء. اتركها في حرارة الغرفة بضعة أيام."),
        "ripe":     dict(days_room=5, days_fridge=25, action="eat",
                         en="Crisp and juicy. Refrigerate to hold this state for three to four weeks.",
                         ar="مقرمشة وغنية بالعصير. التبريد يحافظ عليها من ثلاثة إلى أربعة أسابيع."),
        "overripe": dict(days_room=1, days_fridge=4,  action="cook",
                         en="Mealy texture and bruising. Use for sauce, juice or baking.",
                         ar="قوامها مفتّت وبها كدمات. استخدمها للصلصة أو العصير أو الخبز."),
    },
    "green_apple": {
        "unripe":   dict(days_room=6, days_fridge=16, action="ripen",
                         en="Very sharp acidity, dense flesh. Give it a few more days.",
                         ar="حموضة عالية جدًا ولب كثيف. امنحها بضعة أيام إضافية."),
        "ripe":     dict(days_room=5, days_fridge=28, action="eat",
                         en="Balanced tart-sweet and crisp. Excellent raw or in salads.",
                         ar="توازن بين الحموضة والحلاوة مع قرمشة. ممتازة طازجة أو في السلطات."),
        "overripe": dict(days_room=1, days_fridge=4,  action="cook",
                         en="Softening with brown patches. Best cooked down or juiced.",
                         ar="بدأت تلين مع بقع بنية. الأفضل طهيها أو عصرها."),
    },
    "pear": {
        "unripe":   dict(days_room=4, days_fridge=10, action="ripen",
                         en="Hard at the neck. Ripen on the counter and check the neck daily — pears ripen from the inside out.",
                         ar="صلبة عند العنق. انضجها على الطاولة وافحص العنق يوميًا؛ الكمثرى تنضج من الداخل للخارج."),
        "ripe":     dict(days_room=2, days_fridge=5,  action="eat",
                         en="Neck yields to gentle pressure and the aroma is floral. Eat within two days.",
                         ar="العنق يلين عند الضغط الخفيف ورائحتها عطرية. تناولها خلال يومين."),
        "overripe": dict(days_room=1, days_fridge=2,  action="cook",
                         en="Grainy and leaking juice. Poach it or blend it.",
                         ar="قوامها حبيبي وتسرّب العصير. اسلقها أو اخلطها."),
    },
    "orange": {
        "unripe":   dict(days_room=5, days_fridge=14, action="ripen",
                         en="Green-tinged rind and low sugar. Citrus does not sweeten much after picking — expect tartness.",
                         ar="القشرة مائلة للأخضر والسكر منخفض. الحمضيات لا تحلو كثيرًا بعد القطف، توقع الحموضة."),
        "ripe":     dict(days_room=7, days_fridge=21, action="eat",
                         en="Heavy for its size with a glossy rind — that weight is juice.",
                         ar="ثقيلة بالنسبة لحجمها وقشرتها لامعة، وهذا الثقل يعني عصيرًا وفيرًا."),
        "overripe": dict(days_room=1, days_fridge=3,  action="discard",
                         en="Soft spots and white mould spread fast in citrus. Discard affected fruit.",
                         ar="البقع الطرية والعفن الأبيض ينتشران سريعًا في الحمضيات. تخلص من الثمرة المصابة."),
    },
    "lemon": {
        "unripe":   dict(days_room=6, days_fridge=20, action="ripen",
                         en="Green and firm with thick pith. Juice yield will be low.",
                         ar="خضراء وصلبة بقشرة سميكة، وكمية العصير قليلة."),
        "ripe":     dict(days_room=7, days_fridge=28, action="eat",
                         en="Bright yellow with a slight give. Store in the fridge for up to a month.",
                         ar="صفراء زاهية وتلين قليلًا عند الضغط. احفظها في الثلاجة حتى شهر."),
        "overripe": dict(days_room=1, days_fridge=3,  action="discard",
                         en="Shrivelled skin and dry flesh. Zest is still usable if there is no mould.",
                         ar="القشرة متجعدة واللب جاف. يمكن استخدام القشر المبشور إن لم يوجد عفن."),
    },
    "kiwi": {
        "unripe":   dict(days_room=4, days_fridge=21, action="ripen",
                         en="Rock hard and sour. Ripen next to a banana for two to three days.",
                         ar="صلبة جدًا وحامضة. انضجها بجانب موزة لمدة يومين إلى ثلاثة."),
        "ripe":     dict(days_room=2, days_fridge=7,  action="eat",
                         en="Yields to gentle thumb pressure. Refrigerate to slow it down.",
                         ar="تلين عند الضغط الخفيف بالإبهام. برّدها لإبطاء النضج."),
        "overripe": dict(days_room=1, days_fridge=2,  action="cook",
                         en="Very soft and fermenting at the stem. Blend it rather than slicing it.",
                         ar="طرية جدًا وبدأت تتخمر عند الساق. اخلطها بدل تقطيعها."),
    },
    "blueberry": {
        "unripe":   dict(days_room=2, days_fridge=7,  action="discard",
                         en="Red or pink berries will not sweeten after picking. Sort them out.",
                         ar="الحبات الحمراء أو الوردية لن تحلو بعد القطف. افرزها جانبًا."),
        "ripe":     dict(days_room=2, days_fridge=10, action="eat",
                         en="Deep blue with a silvery bloom — leave the bloom on, it is a natural preservative.",
                         ar="زرقاء داكنة مع طبقة فضية طبيعية؛ لا تغسلها قبل الاستخدام فهي طبقة حافظة."),
        "overripe": dict(days_room=0, days_fridge=1,  action="discard",
                         en="Leaking juice and dull skin. Remove soft berries — mould spreads through the punnet.",
                         ar="تسرّب العصير وبهتان القشرة. أزل الحبات الطرية لأن العفن ينتشر في العبوة."),
    },
}

ACTION_LABELS = {
    "eat":     {"en": "Eat now",        "ar": "تناولها الآن"},
    "ripen":   {"en": "Let it ripen",   "ar": "اتركها لتنضج"},
    "cook":    {"en": "Cook or blend",  "ar": "اطبخها أو اخلطها"},
    "discard": {"en": "Discard",        "ar": "تخلّص منها"},
}


def lookup(fruit: str, stage: str) -> dict:
    entry = KB.get(fruit, {}).get(stage)
    if entry is None:
        return dict(days_room=None, days_fridge=None, action="eat",
                    en="No stored guidance for this combination.",
                    ar="لا توجد إرشادات مخزنة لهذه الحالة.")
    return entry


def describe(fruit: str, stage: str, lang: str = "en") -> dict:
    """Structured, language-aware advice for one detection."""
    e = lookup(fruit, stage)
    return {
        "advice": e["en"] if lang == "en" else e["ar"],
        "action": e["action"],
        "action_label": ACTION_LABELS[e["action"]]["en" if lang == "en" else "ar"],
        "days_room_temperature": e["days_room"],
        "days_refrigerated": e["days_fridge"],
    }


def grounding_block(detections: list, lang: str = "en") -> str:
    """
    Render the knowledge-base rows for the current detections as plain text.
    This string is injected into the LLM prompt so the assistant answers from
    verified facts instead of memory.
    """
    lines = []
    for d in detections:
        e = lookup(d["fruit"], d["stage"])
        lines.append(
            f"- {d['fruit']} / {d['stage']} (confidence {d['confidence']:.2f}): "
            f"{e['en']} Recommended action: {e['action']}. "
            f"Approx. {e['days_room']} day(s) at room temperature, "
            f"{e['days_fridge']} day(s) refrigerated."
        )
    return "\n".join(lines) if lines else "- no fruit detected in the image"
