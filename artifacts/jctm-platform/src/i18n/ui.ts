/**
 * Pre-built UI string translations for all 17 supported languages.
 * Key = English string  →  Value = { langCode: translated string }
 * These are used by useT() for instant, no-API-call UI rendering.
 * Dynamic content (sermon descriptions, testimony text) is translated
 * on-demand via the /api/translate backend.
 */

type LangCode = "en" | "yo" | "ig" | "ha" | "fr" | "es" | "pt" | "de" | "ar" | "zh" | "hi" | "sw" | "ru" | "it" | "ko" | "ja" | "id";

type UIStrings = Record<string, Record<LangCode, string>>;

export const UI: UIStrings = {
  // ── Navigation ────────────────────────────────────────────────────────────
  "Home": {
    en: "Home", yo: "Ilé", ig: "Ụlọ", ha: "Gida", fr: "Accueil",
    es: "Inicio", pt: "Início", de: "Startseite", ar: "الرئيسية",
    zh: "首页", hi: "होम", sw: "Nyumbani", ru: "Главная", it: "Home",
    ko: "홈", ja: "ホーム", id: "Beranda",
  },
  "Sermons": {
    en: "Sermons", yo: "Ìwàásù", ig: "Ozizi", ha: "Wa'azi", fr: "Sermons",
    es: "Sermones", pt: "Sermões", de: "Predigten", ar: "العظات",
    zh: "讲道", hi: "उपदेश", sw: "Mahubiri", ru: "Проповеди", it: "Sermoni",
    ko: "설교", ja: "説教", id: "Khotbah",
  },
  "Moments": {
    en: "Moments", yo: "Àkókò", ig: "Oge", ha: "Lokaci", fr: "Moments",
    es: "Momentos", pt: "Momentos", de: "Momente", ar: "لحظات",
    zh: "时刻", hi: "पल", sw: "Nyakati", ru: "Моменты", it: "Momenti",
    ko: "순간", ja: "瞬間", id: "Momen",
  },
  "Crusade": {
    en: "Crusade", yo: "Àgùntàn", ig: "Crusade", ha: "Crusade", fr: "Croisade",
    es: "Cruzada", pt: "Cruzada", de: "Kreuzzug", ar: "الحملة",
    zh: "布道会", hi: "धर्मयुद्ध", sw: "Msafara", ru: "Крестовый поход", it: "Crociata",
    ko: "십자군", ja: "クルセード", id: "Perang Salib",
  },
  "Prayer": {
    en: "Prayer", yo: "Àdúrà", ig: "Ekpere", ha: "Addu'a", fr: "Prière",
    es: "Oración", pt: "Oração", de: "Gebet", ar: "صلاة",
    zh: "祷告", hi: "प्रार्थना", sw: "Sala", ru: "Молитва", it: "Preghiera",
    ko: "기도", ja: "祈り", id: "Doa",
  },
  "Resources": {
    en: "Resources", yo: "Àwọn Ohun-ìní", ig: "Ihe ndị dị", ha: "Albarkatu", fr: "Ressources",
    es: "Recursos", pt: "Recursos", de: "Ressourcen", ar: "الموارد",
    zh: "资源", hi: "संसाधन", sw: "Rasilimali", ru: "Ресурсы", it: "Risorse",
    ko: "자료", ja: "リソース", id: "Sumber Daya",
  },
  "About": {
    en: "About", yo: "Nípa", ig: "Banyere", ha: "Game da", fr: "À propos",
    es: "Acerca de", pt: "Sobre", de: "Über uns", ar: "عن",
    zh: "关于", hi: "के बारे में", sw: "Kuhusu", ru: "О нас", it: "Chi siamo",
    ko: "소개", ja: "について", id: "Tentang",
  },

  // ── Dropdown items ────────────────────────────────────────────────────────
  "Testimonies": {
    en: "Testimonies", yo: "Ìjẹ́rìísí", ig: "Ọchịchọ", ha: "Shaida", fr: "Témoignages",
    es: "Testimonios", pt: "Testemunhos", de: "Zeugnisse", ar: "الشهادات",
    zh: "见证", hi: "गवाही", sw: "Ushuhuda", ru: "Свидетельства", it: "Testimonianze",
    ko: "간증", ja: "証言", id: "Kesaksian",
  },
  "Events": {
    en: "Events", yo: "Àwọn Ìṣẹ̀lẹ̀", ig: "Ihe omume", ha: "Abubuwa", fr: "Événements",
    es: "Eventos", pt: "Eventos", de: "Veranstaltungen", ar: "الأحداث",
    zh: "活动", hi: "कार्यक्रम", sw: "Matukio", ru: "События", it: "Eventi",
    ko: "이벤트", ja: "イベント", id: "Acara",
  },
  "Give": {
    en: "Give", yo: "Fún", ig: "Nye", ha: "Baiwa", fr: "Donner",
    es: "Dar", pt: "Dar", de: "Geben", ar: "العطاء",
    zh: "奉献", hi: "दें", sw: "Toa", ru: "Пожертвовать", it: "Dare",
    ko: "헌금", ja: "捧げる", id: "Memberi",
  },
  "About JCTM": {
    en: "About JCTM", yo: "Nípa JCTM", ig: "Banyere JCTM", ha: "Game da JCTM", fr: "À propos de JCTM",
    es: "Sobre JCTM", pt: "Sobre JCTM", de: "Über JCTM", ar: "عن JCTM",
    zh: "关于JCTM", hi: "JCTM के बारे में", sw: "Kuhusu JCTM", ru: "О JCTM", it: "Chi è JCTM",
    ko: "JCTM 소개", ja: "JCTMについて", id: "Tentang JCTM",
  },
  "Leadership": {
    en: "Leadership", yo: "Aṣáájú", ig: "Ndị ọchịchọ", ha: "Jagoranci", fr: "Direction",
    es: "Liderazgo", pt: "Liderança", de: "Führung", ar: "القيادة",
    zh: "领导层", hi: "नेतृत्व", sw: "Uongozi", ru: "Руководство", it: "Leadership",
    ko: "리더십", ja: "リーダーシップ", id: "Kepemimpinan",
  },
  "Ask AI": {
    en: "Ask AI", yo: "Béèrè lọwọ AI", ig: "Jụọ AI ajụjụ", ha: "Tambayi AI", fr: "Demander à l'IA",
    es: "Preguntar a la IA", pt: "Perguntar à IA", de: "KI fragen", ar: "اسأل الذكاء الاصطناعي",
    zh: "问AI", hi: "AI से पूछें", sw: "Uliza AI", ru: "Спросить ИИ", it: "Chiedi all'IA",
    ko: "AI에게 물어보기", ja: "AIに聞く", id: "Tanya AI",
  },

  // ── Sermon Hub ────────────────────────────────────────────────────────────
  "Sermon Hub": {
    en: "Sermon Hub", yo: "Ibi Àárọ̀", ig: "Ebe ozizi", ha: "Cibiyar Wa'azi", fr: "Centre de Sermons",
    es: "Centro de Sermones", pt: "Central de Sermões", de: "Predigtzentrum", ar: "مركز العظات",
    zh: "讲道中心", hi: "उपदेश केंद्र", sw: "Kituo cha Mahubiri", ru: "Центр проповедей", it: "Hub dei Sermoni",
    ko: "설교 허브", ja: "説教センター", id: "Pusat Khotbah",
  },
  "Temple TV Library": {
    en: "Temple TV Library", yo: "Ibi Ìkóhun-ìmọ̀ Temple TV", ig: "Ọchịchọ Temple TV", ha: "Dakin Karatu na Temple TV", fr: "Bibliothèque Temple TV",
    es: "Biblioteca Temple TV", pt: "Biblioteca Temple TV", de: "Temple TV Bibliothek", ar: "مكتبة Temple TV",
    zh: "Temple TV 资料库", hi: "Temple TV लाइब्रेरी", sw: "Maktaba ya Temple TV", ru: "Библиотека Temple TV", it: "Libreria Temple TV",
    ko: "Temple TV 라이브러리", ja: "Temple TVライブラリ", id: "Perpustakaan Temple TV",
  },
  "Search sermons…": {
    en: "Search sermons…", yo: "Wa àwọn ìwàásù…", ig: "Chọọ ozizi…", ha: "Nemo wa'azin…", fr: "Rechercher des sermons…",
    es: "Buscar sermones…", pt: "Pesquisar sermões…", de: "Predigten suchen…", ar: "البحث في العظات…",
    zh: "搜索讲道…", hi: "उपदेश खोजें…", sw: "Tafuta mahubiri…", ru: "Поиск проповедей…", it: "Cerca sermoni…",
    ko: "설교 검색…", ja: "説教を検索…", id: "Cari khotbah…",
  },
  "All Sermons": {
    en: "All Sermons", yo: "Gbogbo Ìwàásù", ig: "Ozizi nile", ha: "Dukan Wa'azi", fr: "Tous les sermons",
    es: "Todos los sermones", pt: "Todos os sermões", de: "Alle Predigten", ar: "كل العظات",
    zh: "所有讲道", hi: "सभी उपदेश", sw: "Mahubiri Yote", ru: "Все проповеди", it: "Tutti i sermoni",
    ko: "모든 설교", ja: "すべての説教", id: "Semua Khotbah",
  },
  "Join Live": {
    en: "Join Live", yo: "Darapọ Mọ Àárọ̀", ig: "Sonye Live", ha: "Shiga Rayuwa", fr: "Rejoindre en direct",
    es: "Unirse en vivo", pt: "Participar ao vivo", de: "Live beitreten", ar: "انضم مباشرة",
    zh: "加入直播", hi: "लाइव जॉइन करें", sw: "Jiunge Moja kwa Moja", ru: "Присоединиться к прямому эфиру", it: "Partecipa in diretta",
    ko: "라이브 참여", ja: "ライブ参加", id: "Bergabung Langsung",
  },
  "Watch": {
    en: "Watch", yo: "Wò", ig: "lee", ha: "Kallo", fr: "Regarder",
    es: "Ver", pt: "Assistir", de: "Ansehen", ar: "مشاهدة",
    zh: "观看", hi: "देखें", sw: "Angalia", ru: "Смотреть", it: "Guarda",
    ko: "시청", ja: "視聴", id: "Tonton",
  },
  "Audio Only": {
    en: "Audio Only", yo: "Ohùn Nìkan", ig: "Olu naanị", ha: "Sauti Kawai", fr: "Audio seulement",
    es: "Solo audio", pt: "Somente áudio", de: "Nur Audio", ar: "صوت فقط",
    zh: "仅音频", hi: "केवल ऑडियो", sw: "Sauti Tu", ru: "Только аудио", it: "Solo audio",
    ko: "오디오만", ja: "音声のみ", id: "Audio Saja",
  },
  "Live Now": {
    en: "Rebroadcast Now", yo: "Àtúnṣàárọ̀ Báyìí", ig: "Ntụgharị ugbu a", ha: "Sake Watsa Yanzu", fr: "Rediffusion maintenant",
    es: "Redifusión ahora", pt: "Retransmissão agora", de: "Jetzt Wiederholung", ar: "إعادة البث الآن",
    zh: "重播中", hi: "अभी पुनः प्रसारण", sw: "Kurudia Sasa", ru: "Повтор сейчас", it: "Replica ora",
    ko: "지금 재방송", ja: "ただいま再放送", id: "Siaran Ulang Sekarang",
  },
  "Sync": {
    en: "Sync", yo: "Sọ̀kan", ig: "Melite", ha: "Daidaita", fr: "Synchroniser",
    es: "Sincronizar", pt: "Sincronizar", de: "Synchronisieren", ar: "مزامنة",
    zh: "同步", hi: "सिंक", sw: "Sawazisha", ru: "Синхронизировать", it: "Sincronizza",
    ko: "동기화", ja: "同期", id: "Sinkronkan",
  },
  "Harvest All": {
    en: "Harvest All", yo: "Gba Gbogbo", ig: "Nweta Nile", ha: "Tattara Duka", fr: "Tout récupérer",
    es: "Obtener todo", pt: "Obter tudo", de: "Alles laden", ar: "تحميل الكل",
    zh: "获取全部", hi: "सब लाओ", sw: "Pata Yote", ru: "Загрузить всё", it: "Carica tutto",
    ko: "모두 가져오기", ja: "すべて取得", id: "Ambil Semua",
  },

  // ── Homepage ──────────────────────────────────────────────────────────────
  "The Land of Good News": {
    en: "The Land of Good News", yo: "Ilẹ̀ Ìhìn Rere", ig: "Ala Ọzọzọ Ọma", ha: "Ƙasar Labarai Masu Daɗi", fr: "La Terre des Bonnes Nouvelles",
    es: "La Tierra de las Buenas Noticias", pt: "A Terra das Boas Notícias", de: "Das Land der Guten Nachrichten", ar: "أرض البشارة",
    zh: "好消息之地", hi: "सुसमाचार की भूमि", sw: "Nchi ya Habari Njema", ru: "Земля Благой Вести", it: "La Terra delle Buone Notizie",
    ko: "복음의 땅", ja: "良い知らせの地", id: "Tanah Kabar Baik",
  },
  "The Bible Is Our Standard": {
    en: "The Bible Is Our Standard", yo: "Bíbélì Ni Ìpele Wa", ig: "Baibul bụ nchekwa anyị", ha: "Littafi Mai Tsarki Shine Matakinmu", fr: "La Bible est notre référence",
    es: "La Biblia es nuestro estándar", pt: "A Bíblia é o nosso padrão", de: "Die Bibel ist unser Maßstab", ar: "الكتاب المقدس هو معيارنا",
    zh: "圣经是我们的标准", hi: "बाइबल हमारा मानक है", sw: "Biblia ni Kiwango Chetu", ru: "Библия — наш стандарт", it: "La Bibbia è il nostro standard",
    ko: "성경이 우리의 표준입니다", ja: "聖書が私たちの基準です", id: "Alkitab Adalah Standar Kami",
  },
  "Featured Sermon": {
    en: "Featured Sermon", yo: "Ìwàásù Àkànṣe", ig: "Ozizi a họpụtara", ha: "Wa'azi Fitattu", fr: "Sermon en vedette",
    es: "Sermón destacado", pt: "Sermão em destaque", de: "Ausgewählte Predigt", ar: "العظة المميزة",
    zh: "精选讲道", hi: "विशेष उपदेश", sw: "Huduma Maalum", ru: "Избранная проповедь", it: "Sermone in evidenza",
    ko: "추천 설교", ja: "注目の説教", id: "Khotbah Pilihan",
  },
  "Recent Messages": {
    en: "Recent Messages", yo: "Àwọn Ìhìn Àìpẹ́", ig: "Ozi ndị ọhụrụ", ha: "Saƙonnin Kwanan Nan", fr: "Messages récents",
    es: "Mensajes recientes", pt: "Mensagens recentes", de: "Neueste Botschaften", ar: "الرسائل الأخيرة",
    zh: "最新讲道", hi: "हाल के संदेश", sw: "Ujumbe wa Hivi Karibuni", ru: "Последние проповеди", it: "Messaggi recenti",
    ko: "최신 메시지", ja: "最近のメッセージ", id: "Pesan Terbaru",
  },
  "Watch Now": {
    en: "Watch Now", yo: "Wò Báyìí", ig: "lee ugbu a", ha: "Kallo Yanzu", fr: "Regarder maintenant",
    es: "Ver ahora", pt: "Assistir agora", de: "Jetzt ansehen", ar: "شاهد الآن",
    zh: "立即观看", hi: "अभी देखें", sw: "Angalia Sasa", ru: "Смотреть сейчас", it: "Guarda ora",
    ko: "지금 보기", ja: "今すぐ視聴", id: "Tonton Sekarang",
  },
  "View All Sermons": {
    en: "View All Sermons", yo: "Wo Gbogbo Ìwàásù", ig: "lee ozizi nile", ha: "Duba Dukan Wa'azi", fr: "Voir tous les sermons",
    es: "Ver todos los sermones", pt: "Ver todos os sermões", de: "Alle Predigten ansehen", ar: "عرض كل العظات",
    zh: "查看所有讲道", hi: "सभी उपदेश देखें", sw: "Angalia Mahubiri Yote", ru: "Все проповеди", it: "Vedi tutti i sermoni",
    ko: "모든 설교 보기", ja: "すべての説教を見る", id: "Lihat Semua Khotbah",
  },
  "Connect With Us": {
    en: "Connect With Us", yo: "Sopọ Mọ Wa", ig: "Jikọọ anyị", ha: "Haɗu da Mu", fr: "Connectez-vous avec nous",
    es: "Conéctate con nosotros", pt: "Conecte-se conosco", de: "Verbinde dich mit uns", ar: "تواصل معنا",
    zh: "联系我们", hi: "हमसे जुड़ें", sw: "Wasiliana Nasi", ru: "Свяжитесь с нами", it: "Connettiti con noi",
    ko: "우리와 연결하기", ja: "私たちとつながる", id: "Hubungi Kami",
  },
  "Location": {
    en: "Location", yo: "Ibi", ig: "Ebe", ha: "Wuri", fr: "Emplacement",
    es: "Ubicación", pt: "Localização", de: "Standort", ar: "الموقع",
    zh: "位置", hi: "स्थान", sw: "Mahali", ru: "Местоположение", it: "Posizione",
    ko: "위치", ja: "場所", id: "Lokasi",
  },
  "Quick Links": {
    en: "Quick Links", yo: "Àwọn Ìjápọ Kíákíá", ig: "Njikọ ndị ngwa", ha: "Hanyoyin Hanzari", fr: "Liens rapides",
    es: "Enlaces rápidos", pt: "Links rápidos", de: "Schnelllinks", ar: "روابط سريعة",
    zh: "快速链接", hi: "त्वरित लिंक", sw: "Viungo vya Haraka", ru: "Быстрые ссылки", it: "Link rapidi",
    ko: "빠른 링크", ja: "クイックリンク", id: "Tautan Cepat",
  },

  // ── Prayer page ───────────────────────────────────────────────────────────
  "Generate Prayer": {
    en: "Generate Prayer", yo: "Ṣe Àdúrà", ig: "Mepụta ekpere", ha: "Ƙirƙiri Addu'a", fr: "Générer une prière",
    es: "Generar oración", pt: "Gerar oração", de: "Gebet generieren", ar: "إنشاء صلاة",
    zh: "生成祷告", hi: "प्रार्थना उत्पन्न करें", sw: "Tengeneza Sala", ru: "Создать молитву", it: "Genera preghiera",
    ko: "기도 생성", ja: "祈りを生成", id: "Buat Doa",
  },
  "Copy Prayer": {
    en: "Copy Prayer", yo: "Daakọ Àdúrà", ig: "Detuo ekpere", ha: "Kwafi Addu'a", fr: "Copier la prière",
    es: "Copiar oración", pt: "Copiar oração", de: "Gebet kopieren", ar: "نسخ الصلاة",
    zh: "复制祷告", hi: "प्रार्थना कॉपी करें", sw: "Nakili Sala", ru: "Скопировать молитву", it: "Copia preghiera",
    ko: "기도 복사", ja: "祈りをコピー", id: "Salin Doa",
  },

  // ── Testimony ─────────────────────────────────────────────────────────────
  "Share Your Testimony": {
    en: "Share Your Testimony", yo: "Pin Ìjẹ́rìísí Rẹ", ig: "Kọọ ihe i hụrụ n'anya", ha: "Raba Shaida Naka", fr: "Partagez votre témoignage",
    es: "Comparte tu testimonio", pt: "Compartilhe seu testemunho", de: "Zeugnis teilen", ar: "شارك شهادتك",
    zh: "分享你的见证", hi: "अपनी गवाही साझा करें", sw: "Shiriki Ushuhuda Wako", ru: "Поделиться свидетельством", it: "Condividi la tua testimonianza",
    ko: "간증 나누기", ja: "証を分かち合う", id: "Bagikan Kesaksian Anda",
  },
  "Amen": {
    en: "Amen", yo: "Àmín", ig: "Amen", ha: "Amin", fr: "Amen",
    es: "Amén", pt: "Amém", de: "Amen", ar: "آمين",
    zh: "阿门", hi: "आमेन", sw: "Amina", ru: "Аминь", it: "Amen",
    ko: "아멘", ja: "アーメン", id: "Amin",
  },

  // ── Leadership ────────────────────────────────────────────────────────────
  "Leadership & Transparency": {
    en: "Leadership & Transparency", yo: "Aṣáájú & Ìfarahàn", ig: "Ndị ọchịchọ & Ọdịnaya", ha: "Jagoranci & Gaskiya", fr: "Direction & Transparence",
    es: "Liderazgo & Transparencia", pt: "Liderança & Transparência", de: "Führung & Transparenz", ar: "القيادة والشفافية",
    zh: "领导层与透明度", hi: "नेतृत्व और पारदर्शिता", sw: "Uongozi & Uwazi", ru: "Руководство и прозрачность", it: "Leadership & Trasparenza",
    ko: "리더십과 투명성", ja: "リーダーシップと透明性", id: "Kepemimpinan & Transparansi",
  },

  // ── Common UI ─────────────────────────────────────────────────────────────
  "Loading…": {
    en: "Loading…", yo: "Ń gbé sù…", ig: "Na-abufe…", ha: "Ana lodawa…", fr: "Chargement…",
    es: "Cargando…", pt: "Carregando…", de: "Laden…", ar: "جارٍ التحميل…",
    zh: "加载中…", hi: "लोड हो रहा है…", sw: "Inapakia…", ru: "Загрузка…", it: "Caricamento…",
    ko: "로딩 중…", ja: "読み込み中…", id: "Memuat…",
  },
  "Read More": {
    en: "Read More", yo: "Ka Sí i", ig: "Gụọ ọzọ", ha: "Karanta Ƙari", fr: "Lire la suite",
    es: "Leer más", pt: "Leia mais", de: "Mehr lesen", ar: "اقرأ المزيد",
    zh: "阅读更多", hi: "और पढ़ें", sw: "Soma Zaidi", ru: "Читать далее", it: "Leggi di più",
    ko: "더 읽기", ja: "もっと読む", id: "Baca Selengkapnya",
  },
  "Select Language": {
    en: "Select Language", yo: "Yan Èdè", ig: "Họrọ Asụsụ", ha: "Zaɓi Harshe", fr: "Choisir la langue",
    es: "Seleccionar idioma", pt: "Selecionar idioma", de: "Sprache wählen", ar: "اختر اللغة",
    zh: "选择语言", hi: "भाषा चुनें", sw: "Chagua Lugha", ru: "Выбрать язык", it: "Seleziona lingua",
    ko: "언어 선택", ja: "言語を選択", id: "Pilih Bahasa",
  },
  "50+ languages via AI translation": {
    en: "50+ languages via AI translation",
    yo: "50+ èdè pẹ̀lú ìtumọ̀ AI",
    ig: "50+ asụsụ site na ntụgharị AI",
    ha: "Harsuna 50+ ta hanyar fassarar AI",
    fr: "Plus de 50 langues via traduction IA",
    es: "Más de 50 idiomas vía traducción IA",
    pt: "Mais de 50 idiomas via tradução IA",
    de: "Über 50 Sprachen via KI-Übersetzung",
    ar: "أكثر من 50 لغة عبر الترجمة بالذكاء الاصطناعي",
    zh: "通过AI翻译支持50多种语言",
    hi: "AI अनुवाद के माध्यम से 50+ भाषाएँ",
    sw: "Lugha 50+ kupitia tafsiri ya AI",
    ru: "Более 50 языков через ИИ-перевод",
    it: "Oltre 50 lingue tramite traduzione IA",
    ko: "AI 번역으로 50개 이상의 언어",
    ja: "AI翻訳による50以上の言語",
    id: "50+ bahasa melalui terjemahan AI",
  },
  "Stories of God's faithfulness": {
    en: "Stories of God's faithfulness",
    yo: "Àwọn Ìtàn Ìgbẹ́kẹ̀lé Ọlọ́run",
    ig: "Akụkọ nke ekele Chukwu",
    ha: "Labarun amincin Allah",
    fr: "Histoires de la fidélité de Dieu",
    es: "Historias de la fidelidad de Dios",
    pt: "Histórias da fidelidade de Deus",
    de: "Geschichten von Gottes Treue",
    ar: "قصص وفاء الله",
    zh: "神信实的故事",
    hi: "परमेश्वर की विश्वासयोग्यता की कहानियाँ",
    sw: "Hadithi za uaminifu wa Mungu",
    ru: "Истории о верности Бога",
    it: "Storie della fedeltà di Dio",
    ko: "하나님의 신실하심 이야기",
    ja: "神の誠実さの物語",
    id: "Kisah kesetiaan Allah",
  },
  "Upcoming services & programmes": {
    en: "Upcoming services & programmes",
    yo: "Àwọn Ìsìn & Ètò Tí Ń Bọ̀",
    ig: "Ọrụ na mmemme ndị ọzọ n'ihu",
    ha: "Sabis da shirye-shirye masu zuwa",
    fr: "Services et programmes à venir",
    es: "Servicios y programas próximos",
    pt: "Serviços e programas futuros",
    de: "Bevorstehende Gottesdienste & Programme",
    ar: "الخدمات والبرامج القادمة",
    zh: "即将到来的礼拜和活动",
    hi: "आगामी सेवाएं और कार्यक्रम",
    sw: "Huduma na mipango inayokuja",
    ru: "Предстоящие богослужения и программы",
    it: "Servizi e programmi imminenti",
    ko: "예정된 예배 및 프로그램",
    ja: "今後の礼拝とプログラム",
    id: "Layanan dan program mendatang",
  },
  "Support the Correction Mandate": {
    en: "Support the Correction Mandate",
    yo: "Ṣe Àtìlẹ́yìn Àṣẹ Àtúnṣe",
    ig: "Kwado Iwu Ndụzị",
    ha: "Tallafa wa'azin gyara",
    fr: "Soutenir le Mandat de Correction",
    es: "Apoyar el Mandato de Corrección",
    pt: "Apoiar o Mandato de Correção",
    de: "Das Korrekturmandat unterstützen",
    ar: "دعم تفويض التصحيح",
    zh: "支持纠正使命",
    hi: "सुधार आदेश का समर्थन करें",
    sw: "Kuunga mkono Amri ya Usahihishaji",
    ru: "Поддержать Мандат Исправления",
    it: "Sostenere il Mandato di Correzione",
    ko: "교정 사명 지원하기",
    ja: "訂正命令を支援する",
    id: "Dukung Mandat Koreksi",
  },
  "Our mission and history": {
    en: "Our mission and history",
    yo: "Ìsìn wa àti Ìtàn wa",
    ig: "Ọrụ anyị na akụkọ ihe mere",
    ha: "Manufarmu da tarihinmu",
    fr: "Notre mission et notre histoire",
    es: "Nuestra misión e historia",
    pt: "Nossa missão e história",
    de: "Unsere Mission und Geschichte",
    ar: "مهمتنا وتاريخنا",
    zh: "我们的使命和历史",
    hi: "हमारा मिशन और इतिहास",
    sw: "Dhamira yetu na historia yetu",
    ru: "Наша миссия и история",
    it: "La nostra missione e storia",
    ko: "우리의 사명과 역사",
    ja: "私たちの使命と歴史",
    id: "Misi dan sejarah kami",
  },
  "Prophet Amos & ministry team": {
    en: "Prophet Amos & ministry team",
    yo: "Wòlíì Amos & Ẹgbẹ́ Iṣẹ́ Ọlọ́run",
    ig: "Onye amụma Amos & ndị ozi ya",
    ha: "Annabi Amos & ƙungiyar hidima",
    fr: "Prophète Amos & équipe du ministère",
    es: "Profeta Amos & equipo ministerial",
    pt: "Profeta Amos & equipe ministerial",
    de: "Prophet Amos & Ministeriumsteam",
    ar: "النبي أموس وفريق الوزارة",
    zh: "阿摩司先知与事工团队",
    hi: "भविष्यवक्ता अमोस और सेवकाई दल",
    sw: "Nabii Amos & timu ya huduma",
    ru: "Пророк Амос и команда служения",
    it: "Profeta Amos & team ministeriale",
    ko: "아모스 선지자 & 사역팀",
    ja: "アモス預言者＆ミニストリーチーム",
    id: "Nabi Amos & tim pelayanan",
  },
  "Chat with our sermon AI": {
    en: "Chat with our sermon AI",
    yo: "Bá AI Ìwàásù Wa sọ̀rọ̀",
    ig: "Kọọrọ na AI ozizi anyị",
    ha: "Yi hira da AI wa'azin mu",
    fr: "Discutez avec notre IA de sermons",
    es: "Chatea con nuestra IA de sermones",
    pt: "Converse com nossa IA de sermões",
    de: "Chatte mit unserer Predigt-KI",
    ar: "تحدث مع ذكاء اصطناعي عظاتنا",
    zh: "与我们的讲道AI对话",
    hi: "हमारे उपदेश AI से चैट करें",
    sw: "Zungumza na AI ya mahubiri yetu",
    ru: "Общайтесь с нашим ИИ проповедей",
    it: "Chatta con la nostra IA sermoni",
    ko: "설교 AI와 채팅하기",
    ja: "説教AIとチャットする",
    id: "Obrol dengan AI khotbah kami",
  },
};

/**
 * Look up a translated UI string.
 * Falls back to English if translation is missing.
 */
export function uiString(key: string, lang: string): string {
  const entry = UI[key];
  if (!entry) return key;
  return (entry as Record<string, string>)[lang] ?? entry.en ?? key;
}
