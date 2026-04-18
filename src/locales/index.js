// All UI strings extracted for EN/AR localization.
export const UI = {
  en: {
    // App shell
    appTitle: 'مكتبة الخط',
    appSubtitle: 'Arabic Script Practice',
    skipLink: 'Skip to canvas',

    // Header
    lessonToggleTitleOn: 'Switch to alphabetical order',
    lessonToggleTitleOff: 'Switch to lesson mode (grouped by shape)',
    settingsTitle: 'Settings',

    // Offline
    offlineBanner: 'You are offline — AI feedback is unavailable',

    // Settings panel
    settingsNote: 'API key is saved on this device.',
    settingsModel: 'Model',
    settingsChangeKey: 'Change key',
    settingsDarkMode: 'Dark mode',
    settingsLightMode: 'Light mode',
    settingsLanguage: 'Language',
    settingsLangEn: 'English',
    settingsLangAr: 'العربية',

    // Mode tabs
    tabLetters: 'Letters',
    tabWords: 'Words',
    tabReview: 'Review',

    // Form names
    formIsolated: 'isolated',
    formInitial: 'initial',
    formMedial: 'medial',
    formFinal: 'final',
    formIsolatedFull: 'isolated (stand-alone)',
    formInitialFull: 'initial (start of word)',
    formMedialFull: 'medial (middle of word)',
    formFinalFull: 'final (end of word)',
    formIsolatedShort: 'isol',
    formInitialShort: 'init',
    formMedialShort: 'med',
    formFinalShort: 'fin',
    formIsolatedDesc: 'Stand-alone — used when the letter appears alone or after a non-joiner.',
    formInitialDesc: 'Start of word — open on the right, connects left into the next letter.',
    formMedialDesc: 'Middle of word — connects on both sides, usually the most compact form.',
    formFinalDesc: 'End of word — connects on the right, tail closes off the word.',

    // Hint / progress
    hintRTL: '← Write right-to-left',
    hintDrawFirst: 'Draw the letter first!',
    hintDrawWordFirst: 'Draw the word first!',
    brushSize: 'Brush size',
    nonJoinerNote: 'Non-joining — no initial or medial form',

    // Buttons
    btnPrev: '‹ Prev',
    btnNext: 'Next ›',
    btnUndo: 'Undo',
    btnClear: 'Clear',
    btnShowMe: '▶ Show me',
    btnShowMePlaying: 'Playing…',
    btnAIFeedback: '✦ AI Feedback',
    btnAIFeedbackLoading: 'Analyzing…',
    btnAIFeedbackNoKey: 'No API Key',
    btnAIFeedbackOffline: 'Offline',

    // Lesson mode
    lessonGroup: 'Lesson',
    // Lesson group names + descriptions
    lessonAlefName: 'Alef',
    lessonAlefDesc: 'Single vertical stroke',
    lessonBaName: 'Ba / Ta / Tha',
    lessonBaDesc: 'Flat baseline, dots vary',
    lessonJimName: 'Jim / Ha / Kha',
    lessonJimDesc: 'Hooked bowl shape',
    lessonDalName: 'Dal / Dhal',
    lessonDalDesc: 'Angular wedge',
    lessonRaName: 'Ra / Zay',
    lessonRaDesc: 'Gentle descending curve',
    lessonSinName: 'Sin / Shin',
    lessonSinDesc: 'Three-wave baseline',
    lessonSadName: 'Sad / Dad',
    lessonSadDesc: 'Round head, long tail',
    lessonTaEmphName: 'Ta / Dha',
    lessonTaEmphDesc: 'Oval loop with upright stroke',
    lessonAinName: 'Ain / Ghain',
    lessonAinDesc: 'Open comma loop',
    lessonFaName: 'Fa / Qaf',
    lessonFaDesc: 'Circle with tail',
    lessonKafName: 'Kaf',
    lessonKafDesc: 'Tooth shape with accent',
    lessonLamName: 'Lam',
    lessonLamDesc: 'Tall hook',
    lessonMimName: 'Mim',
    lessonMimDesc: 'Tight circle with tail',
    lessonNunName: 'Nun',
    lessonNunDesc: 'Shallow bowl',
    lessonHaSoftName: 'Ha',
    lessonHaSoftDesc: 'Figure-eight loops',
    lessonWawName: 'Waw',
    lessonWawDesc: 'Circle with descending tail',
    lessonYaName: 'Ya',
    lessonYaDesc: 'Two humps with hook',

    // Feedback
    feedbackLabel: "Teacher's Notes",
    feedbackScoreExcellent: 'Excellent!',
    feedbackScoreGreat: 'Great work',
    feedbackScoreGood: 'Good effort',
    feedbackScoreKeep: 'Keep practicing',
    feedbackScoreStart: 'Just starting',

    // Comparison
    comparisonShow: '▸ Show',
    comparisonHide: '▾ Hide',
    comparisonLabel: 'comparison',
    comparisonRef: 'Reference',
    comparisonAttempt: 'Your attempt',

    // History
    historyShow: '▸ Past',
    historyHide: '▾ Past',
    historyOf: 'feedback',

    // Words
    wordsLabel: 'words',

    // Progress
    progressComplete: 'complete',

    // Accessibility / ARIA
    ariaPrevBtn: 'Previous letter',
    ariaNextBtn: 'Next letter',
    ariaUndoBtn: 'Undo last stroke',
    ariaClearBtn: 'Clear canvas',
    ariaShowMeBtn: 'Show stroke order animation',
    ariaAIFeedbackBtn: 'Get AI handwriting feedback',
    ariaSettingsBtn: 'Open settings',
    ariaLessonModeBtn: 'Toggle lesson mode',
    ariaDarkModeBtn: 'Toggle dark mode',
    ariaLangBtn: 'Switch language',
    ariaLetterBtn: 'Select letter',
    ariaWordBtn: 'Select word',
    ariaFormBtn: 'Select form',
    ariaCanvas: 'Drawing canvas',
    ariaModeTab: 'Switch to practice mode',
    ariaModelSelect: 'Select AI model',
    ariaBrushSlider: 'Adjust brush size',
    ariaOfflineBanner: 'You are currently offline',
    ariaCompletedBadge: 'letters completed',
    ariaProgressBadge: 'current position',
    ariaPracticeMode: 'Practice mode',
    ariaLetterForm: 'Letter form',
    ariaWordGroup: 'Word group',
    ariaTeacherFeedback: "Teacher's feedback",
    ariaSelectLetter: 'Select a letter',
    ariaSelectWord: 'Select a word',

    // Export / Share
    btnSave: 'Save',
    btnShare: 'Share',
    ariaSaveBtn: 'Save drawing as image',
    ariaShareBtn: 'Share drawing',

    // Spaced repetition
    dashboardTitle: 'Due for Review',
    dashboardEmpty: 'All caught up — no letters due for review.',
    dashboardCount: 'letters due',
    ariaDashboardTab: 'Review dashboard',
    ariaLetterTab: 'Practice letters',

    // Login screen
    loginIntroPrefix: 'This app uses AI for handwriting feedback. Paste your OpenRouter API key below to get started. You can get one at ',
    loginIntroLink: 'openrouter.ai/keys',
    loginIntroSuffix: '.',
    loginNote: 'Your key is stored only on this device and never sent anywhere except OpenRouter.',
    loginPlaceholder: 'sk-or-...',
    loginStart: 'Start Practicing →',
    loginSkip: 'Continue without AI',
    ariaSwitchLight: 'Switch to light mode',
    ariaSwitchDark: 'Switch to dark mode',
  },


  ar: {
    // App shell
    appTitle: 'مكتبة الخط',
    appSubtitle: 'تدريب الخط العربي',
    skipLink: 'تخطي إلى اللوحة',

    // Header
    lessonToggleTitleOn: 'الرجوع للترتيب الأبجدي',
    lessonToggleTitleOff: 'التبديل لوضع الدرس (مجموعات حسب الشكل)',
    settingsTitle: 'الإعدادات',

    // Offline
    offlineBanner: 'أنت غير متصل بالإنترنت — لا يتوفر تحليل الذكاء الاصطناعي',

    // Settings panel
    settingsNote: 'مفتاح API محفوظ على هذا الجهاز.',
    settingsModel: 'النموذج',
    settingsChangeKey: 'تغيير المفتاح',
    settingsDarkMode: 'الوضع الداكن',
    settingsLightMode: 'وضع فاتح',
    settingsLanguage: 'اللغة',
    settingsLangEn: 'English',
    settingsLangAr: 'العربية',

    // Mode tabs
    tabLetters: 'الحروف',
    tabWords: 'الكلمات',
    tabReview: 'مراجعة',

    // Form names
    formIsolated: 'منفرد',
    formInitial: 'مبتدأ',
    formMedial: 'وسطي',
    formFinal: 'النهائي',
    formIsolatedFull: 'منفرد (مستقل)',
    formInitialFull: 'مبتدأ (أول الكلمة)',
    formMedialFull: 'وسطي (وسط الكلمة)',
    formFinalFull: 'النهائي (آخر الكلمة)',
    formIsolatedShort: 'منف',
    formInitialShort: 'مبت',
    formMedialShort: 'وس',
    formFinalShort: 'آخ',
    formIsolatedDesc: 'مستقل — يُستخدم حين يظهر الحرف منفرداً أو بعد حرف غير متصل.',
    formInitialDesc: 'أول الكلمة — مفتوح من اليمين، يتصل يساراً بالحرف التالي.',
    formMedialDesc: 'وسط الكلمة — متصل من الجانبين، وهو عادةً أكثر الأشكال اختصاراً.',
    formFinalDesc: 'آخر الكلمة — متصل من اليمين، وذيله يُغلق الكلمة.',

    // Hint / progress
    hintRTL: '← اكتب من اليمين إلى اليسار',
    hintDrawFirst: 'ارسم الحرف أولاً!',
    hintDrawWordFirst: 'ارسم الكلمة أولاً!',
    brushSize: 'حجم الفرشاة',
    nonJoinerNote: 'غير متصل — لا يوجد شكل مبتدأ أو وسطي',

    // Buttons
    btnPrev: '‹ السابق',
    btnNext: 'التالي ›',
    btnUndo: 'تراجع',
    btnClear: 'مسح',
    btnShowMe: '▶ أرني',
    btnShowMePlaying: 'جارٍ العرض…',
    btnAIFeedback: '✦ تحليل الذكاء الاصطناعي',
    btnAIFeedbackLoading: 'جارٍ التحليل…',
    btnAIFeedbackNoKey: 'لا يوجد مفتاح API',
    btnAIFeedbackOffline: 'غير متصل',

    // Lesson mode
    lessonGroup: 'الدرس',
    // Lesson group names + descriptions
    lessonAlefName: 'الألف',
    lessonAlefDesc: 'خط عمودي واحد',
    lessonBaName: 'باء / تاء / ثاء',
    lessonBaDesc: 'قاعدة مستوية، النقاط تتغير',
    lessonJimName: 'جيم / حاء / خاء',
    lessonJimDesc: 'شكل الوعاء المعقوف',
    lessonDalName: 'دال / ذال',
    lessonDalDesc: 'إسفين زاوي',
    lessonRaName: 'راء / زاي',
    lessonRaDesc: 'منحنى هابط لطيف',
    lessonSinName: 'سين / شين',
    lessonSinDesc: 'ثلاث موجات على السطر',
    lessonSadName: 'صاد / ضاد',
    lessonSadDesc: 'رأس دائري وذيل طويل',
    lessonTaEmphName: 'طاء / ظاء',
    lessonTaEmphDesc: 'حلقة بيضاوية مع خط قائم',
    lessonAinName: 'عين / غين',
    lessonAinDesc: 'حلقة فاصلة مفتوحة',
    lessonFaName: 'فاء / قاف',
    lessonFaDesc: 'دائرة مع ذيل',
    lessonKafName: 'كاف',
    lessonKafDesc: 'شكل السن مع اللمسة',
    lessonLamName: 'لام',
    lessonLamDesc: 'خطاف طويل',
    lessonMimName: 'ميم',
    lessonMimDesc: 'دائرة ضيقة مع ذيل',
    lessonNunName: 'نون',
    lessonNunDesc: 'وعاء ضحل',
    lessonHaSoftName: 'هاء',
    lessonHaSoftDesc: 'حلقات شبيهة بالرقم ثمانية',
    lessonWawName: 'واو',
    lessonWawDesc: 'دائرة مع ذيل هابط',
    lessonYaName: 'ياء',
    lessonYaDesc: 'حدبتان مع خطاف',

    // Feedback
    feedbackLabel: 'ملاحظات المعلم',
    feedbackScoreExcellent: 'ممتاز!',
    feedbackScoreGreat: 'عمل رائع',
    feedbackScoreGood: 'جهد جيد',
    feedbackScoreKeep: 'استمر في التدريب',
    feedbackScoreStart: 'بداية',

    // Comparison
    comparisonShow: '▸ عرض',
    comparisonHide: '▾ إخفاء',
    comparisonLabel: 'المقارنة',
    comparisonRef: 'المرجع',
    comparisonAttempt: 'محاولتك',

    // History
    historyShow: '▸ ملاحظات سابقة',
    historyHide: '▾ ملاحظات سابقة',
    historyOf: 'ملاحظة',

    // Words
    wordsLabel: 'كلمات',

    // Progress
    progressComplete: 'مكتمل',

    // Accessibility / ARIA
    ariaPrevBtn: 'الحرف السابق',
    ariaNextBtn: 'الحرف التالي',
    ariaUndoBtn: 'التراجع عن آخر خط',
    ariaClearBtn: 'مسح اللوحة',
    ariaShowMeBtn: 'عرض ترتيب الخطوط',
    ariaAIFeedbackBtn: 'الحصول على تحليل الذكاء الاصطناعي',
    ariaSettingsBtn: 'فتح الإعدادات',
    ariaLessonModeBtn: 'تبديل وضع الدرس',
    ariaDarkModeBtn: 'تبديل الوضع الداكن',
    ariaLangBtn: 'تبديل اللغة',
    ariaLetterBtn: 'اختيار الحرف',
    ariaWordBtn: 'اختيار الكلمة',
    ariaFormBtn: 'اختيار الشكل',
    ariaCanvas: 'لوحة الرسم',
    ariaModeTab: 'التبديل لوضع التدريب',
    ariaModelSelect: 'اختيار نموذج الذكاء الاصطناعي',
    ariaBrushSlider: 'تعديل حجم الفرشاة',
    ariaOfflineBanner: 'أنت غير متصل حالياً',
    ariaCompletedBadge: 'حروف مكتملة',
    ariaProgressBadge: 'الموضع الحالي',
    ariaPracticeMode: 'وضع التدريب',
    ariaLetterForm: 'شكل الحرف',
    ariaWordGroup: 'مجموعة كلمات',
    ariaTeacherFeedback: 'تعليقات المعلم',
    ariaSelectLetter: 'اختيار الحرف',
    ariaSelectWord: 'اختيار كلمة',

    // Export / Share
    btnSave: 'حفظ',
    btnShare: 'مشاركة',
    ariaSaveBtn: 'حفظ الرسم كصورة',
    ariaShareBtn: 'مشاركة الرسم',

    // Spaced repetition
    dashboardTitle: 'مطلوب المراجعة',
    dashboardEmpty: 'لا توجد حروف تحتاج مراجعة!',
    dashboardCount: 'حروف مطلوبة',
    ariaDashboardTab: 'لوحة المراجعة',
    ariaLetterTab: 'تدريب الحروف',

    // Login screen
    loginIntroPrefix: 'يستخدم هذا التطبيق الذكاء الاصطناعي لتقديم ملاحظات على خطك. الصق مفتاح OpenRouter API أدناه للبدء. يمكنك الحصول على مفتاح من ',
    loginIntroLink: 'openrouter.ai/keys',
    loginIntroSuffix: '.',
    loginNote: 'المفتاح محفوظ فقط على هذا الجهاز ولا يُرسَل إلى أي جهة عدا OpenRouter.',
    loginPlaceholder: 'sk-or-...',
    loginStart: 'ابدأ التدريب →',
    loginSkip: 'المتابعة بدون الذكاء الاصطناعي',
    ariaSwitchLight: 'التبديل إلى الوضع الفاتح',
    ariaSwitchDark: 'التبديل إلى الوضع الداكن',
  },
};

export const FORM_NAMES = {
  isolated: 'formIsolated',
  initial: 'formInitial',
  medial: 'formMedial',
  final: 'formFinal',
};

export const FORM_SHORT = {
  isolated: 'formIsolatedShort',
  initial: 'formInitialShort',
  medial: 'formMedialShort',
  final: 'formFinalShort',
};

export const FORM_FULL = {
  isolated: 'formIsolatedFull',
  initial: 'formInitialFull',
  medial: 'formMedialFull',
  final: 'formFinalFull',
};

export const FORM_DESCRIPTIONS = {
  isolated: 'formIsolatedDesc',
  initial: 'formInitialDesc',
  medial: 'formMedialDesc',
  final: 'formFinalDesc',
};
