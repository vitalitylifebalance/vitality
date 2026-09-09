import json

es = json.load(open('testimonio-vipassanna-es.json'))
times = [(s['start'], s['end']) for s in es]

fr_texts = [
    "Après un peu moins",
    "d'un an à utiliser les Vipassana,",
    "je les recommande à 100%",
    "aux personnes comme moi,",
    "qui sont fumeuses, car",
    "pour la respiration et pour",
    "pouvoir bien respirer",
    "elles m'ont fait beaucoup de bien,",
    "et pour les personnes qui ont",
    "des problèmes de stress, d'anxiété,",
    "que j'ai personnellement eus",
    "pour des raisons professionnelles,",
    "elles ont énormément calmé mon",
    "stress, elles m'ont permis de m'endormir",
    "d'une manière très simple,",
    "avec un bon sommeil, huit",
    "heures, en me réveillant reposé,",
    "recommandable à 100% d'après mon",
    "expérience pour ces deux types",
    "de personnes.",
]

de_texts = [
    "Nach etwas weniger",
    "als einem Jahr mit den Vipassanas",
    "kann ich sie zu 100% empfehlen",
    "für Menschen wie mich,",
    "die rauchen, denn",
    "für die Atmung und um",
    "richtig durchatmen zu können,",
    "haben sie mir sehr gutgetan,",
    "und für Menschen, die",
    "Stress- oder Angstprobleme haben,",
    "die ich persönlich",
    "aus beruflichen Gründen hatte,",
    "haben sie meinen Stress sehr",
    "beruhigt und mir geholfen, ganz einfach",
    "einzuschlafen,",
    "mit einem guten Schlaf, acht",
    "Stunden, erholt aufzuwachen,",
    "aus meiner Erfahrung zu 100%",
    "empfehlenswert für diese beiden",
    "Arten von Menschen.",
]

pt_texts = [
    "Depois de pouco menos",
    "de um ano a usar as Vipassana,",
    "recomendo-as a 100%",
    "a pessoas como eu,",
    "que sejam fumadoras, já que",
    "para a respiração e para",
    "conseguir respirar bem",
    "me têm feito muito bem,",
    "e para pessoas que tenham",
    "problemas de stress, ansiedade,",
    "que eu pessoalmente já tive",
    "por questões profissionais,",
    "acalmaram-me muitíssimo o",
    "stress, permitiram-me adormecer",
    "de uma forma super simples,",
    "com um bom sono, oito",
    "horas, acordando descansado,",
    "recomendável a 100% pela minha",
    "experiência para esses dois tipos",
    "de pessoas.",
]

for lang, texts in [('fr', fr_texts), ('de', de_texts), ('pt', pt_texts)]:
    assert len(texts) == len(times), f"{lang}: {len(texts)} vs {len(times)}"
    segs = [{"start": t[0], "end": t[1], "texto": txt} for t, txt in zip(times, texts)]
    with open(f'testimonio-vipassanna-{lang}.json', 'w') as f:
        json.dump(segs, f, ensure_ascii=False, indent=1)
    print(lang, 'written', len(segs), 'segments')
