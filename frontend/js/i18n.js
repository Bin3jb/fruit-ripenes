/* Minimal bilingual layer. Arabic switches the document to RTL, which the
   stylesheet already accounts for via logical properties (padding-inline,
   border-inline-start, text-align: start). */
const I18N = {
  en: {
    'app.title': 'Fruit Ripeness Recognizer',
    'nav.logout': 'Sign out', 'nav.scan': 'Scan', 'nav.history': 'History',
    'nav.basket': 'My basket', 'nav.account': 'Account', 'nav.admin': 'Admin',
    'auth.login': 'Sign in', 'auth.register': 'Create account', 'auth.email': 'Email',
    'auth.password': 'Password', 'auth.name': 'Name',
    'auth.passwordHint': 'At least 8 characters.',
    'scan.title': 'Upload a photo', 'scan.drop': 'Drop an image here, or click to choose',
    'scan.formats': 'JPG, PNG or WEBP · up to 10 MB', 'scan.analyze': 'Analyse ripeness',
    'scan.results': 'Results', 'scan.working': 'Running the detector…',
    'scan.empty': 'No scan yet. Upload a photo to begin.',
    'scan.none': 'No fruit found. Try a closer photo with even lighting.',
    'chat.title': 'Ask about this fruit', 'chat.send': 'Send',
    'chat.placeholder': 'How should I store this?',
    'history.title': 'Previous scans', 'history.empty': 'Nothing scanned yet.',
    'basket.title': 'My basket',
    'basket.lede': 'Everything you have scanned, grouped by ripeness. The overripe column is the food that was already lost.',
    'account.title': 'Account', 'account.current': 'Current password',
    'account.new': 'New password', 'account.change': 'Change password',
    'feedback.title': 'Send feedback', 'feedback.send': 'Send feedback',
    'feedback.thanks': 'Thank you — your feedback was recorded.',
    'admin.title': 'Administration', 'admin.feedback': 'User feedback and corrections',
    'stage.unripe': 'Unripe', 'stage.ripe': 'Ripe', 'stage.overripe': 'Overripe',
    'label.confidence': 'Confidence', 'label.room': 'At room temp',
    'label.fridge': 'Refrigerated', 'label.days': 'days', 'label.action': 'Do this',
    'label.wrong': 'Wrong? Correct it:', 'label.corrected': 'Correction saved — thank you.',
    'action.eat': 'Eat now', 'action.ripen': 'Let it ripen',
    'action.cook': 'Cook or blend', 'action.discard': 'Discard',
    'history.hint': 'Select a scan to reopen it and keep asking about it.',
    'feedback.mine': 'What you have sent',
    'feedback.none': 'Nothing sent yet.',
    'feedback.date': 'Date', 'feedback.correction': 'Correction', 'feedback.message': 'Message',
    'label.colourOnly': 'Stage estimated from colour only — the detector has not been fine-tuned for ripeness yet.',
    'label.fallbackMode': 'fallback mode (untrained weights)',
    'q1': 'How should I store this?', 'q2': 'How many days do I have?',
    'q3': 'What can I cook with it?', 'q4': 'Is it still safe to eat?',
  },
  ar: {
    'app.title': 'مُميّز نضج الفواكه',
    'nav.logout': 'تسجيل الخروج', 'nav.scan': 'فحص', 'nav.history': 'السجل',
    'nav.basket': 'سلتي', 'nav.account': 'الحساب', 'nav.admin': 'الإدارة',
    'auth.login': 'تسجيل الدخول', 'auth.register': 'إنشاء حساب', 'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور', 'auth.name': 'الاسم',
    'auth.passwordHint': '8 أحرف على الأقل.',
    'scan.title': 'ارفع صورة', 'scan.drop': 'أفلت الصورة هنا أو اضغط للاختيار',
    'scan.formats': 'JPG أو PNG أو WEBP · حتى 10 ميجابايت', 'scan.analyze': 'حلّل درجة النضج',
    'scan.results': 'النتائج', 'scan.working': 'جارٍ تشغيل النموذج…',
    'scan.empty': 'لا يوجد فحص بعد. ارفع صورة للبدء.',
    'scan.none': 'لم يتم العثور على فاكهة. جرّب صورة أقرب وبإضاءة متساوية.',
    'chat.title': 'اسأل عن هذه الفاكهة', 'chat.send': 'إرسال',
    'chat.placeholder': 'كيف أحفظها؟',
    'history.title': 'عمليات الفحص السابقة', 'history.empty': 'لا توجد عمليات فحص بعد.',
    'basket.title': 'سلتي',
    'basket.lede': 'كل ما فحصته مُصنّفًا حسب النضج. عمود «مفرط النضج» يمثل الطعام المفقود فعليًا.',
    'account.title': 'الحساب', 'account.current': 'كلمة المرور الحالية',
    'account.new': 'كلمة المرور الجديدة', 'account.change': 'تغيير كلمة المرور',
    'feedback.title': 'أرسل ملاحظاتك', 'feedback.send': 'إرسال الملاحظات',
    'feedback.thanks': 'شكرًا لك — تم تسجيل ملاحظتك.',
    'admin.title': 'الإدارة', 'admin.feedback': 'ملاحظات المستخدمين والتصحيحات',
    'stage.unripe': 'غير ناضج', 'stage.ripe': 'ناضج', 'stage.overripe': 'مفرط النضج',
    'label.confidence': 'الثقة', 'label.room': 'في حرارة الغرفة',
    'label.fridge': 'في الثلاجة', 'label.days': 'يوم', 'label.action': 'الإجراء المقترح',
    'label.wrong': 'خطأ؟ صحّحه:', 'label.corrected': 'تم حفظ التصحيح — شكرًا لك.',
    'action.eat': 'تناولها الآن', 'action.ripen': 'اتركها لتنضج',
    'action.cook': 'اطبخها أو اخلطها', 'action.discard': 'تخلّص منها',
    'history.hint': 'اختر عملية فحص لإعادة فتحها ومتابعة الأسئلة عنها.',
    'feedback.mine': 'ملاحظاتك السابقة',
    'feedback.none': 'لم ترسل شيئًا بعد.',
    'feedback.date': 'التاريخ', 'feedback.correction': 'التصحيح', 'feedback.message': 'الرسالة',
    'label.colourOnly': 'تم تقدير درجة النضج من اللون فقط — لم يُدرَّب النموذج على النضج بعد.',
    'label.fallbackMode': 'الوضع الاحتياطي (أوزان غير مُدرَّبة)',
    'q1': 'كيف أحفظها؟', 'q2': 'كم يومًا تبقّى لها؟',
    'q3': 'ماذا أطبخ بها؟', 'q4': 'هل ما زالت صالحة للأكل؟',
  },
};

let LANG = localStorage.getItem('lang') || 'en';

function t(key) { return (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key; }

function applyLanguage(lang) {
  LANG = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  const chatInput = document.getElementById('chatInput');
  if (chatInput) chatInput.placeholder = t('chat.placeholder');
  const toggle = document.getElementById('langToggle');
  if (toggle) toggle.textContent = lang === 'ar' ? 'English' : 'العربية';
  document.dispatchEvent(new CustomEvent('languagechange', { detail: lang }));
}
