const DocumentRenderer = (() => {
    const SELECTOR = '[data-documents]';
    
    // Р¤СѓРЅРєС†РёСЏ РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ R2_PUBLIC_BASE РґРёРЅР°РјРёС‡РµСЃРєРё (РЅР° СЃР»СѓС‡Р°Р№, РµСЃР»Рё r2-config.js Р·Р°РіСЂСѓР·РёР»СЃСЏ РїРѕР·Р¶Рµ)
    function getR2PublicBase() {
        return (window.R2_CONFIG?.PUBLIC_URL || '').replace(/\/$/, '');
    }

    async function waitForSupabase(maxWait = 5000) {
        const start = Date.now();
        // Используем window.supabase для глобального доступа
        while (typeof window.supabase === 'undefined' || !window.supabase || typeof window.supabase.from !== 'function') {
            if (Date.now() - start > maxWait) {
                throw new Error('Supabase не инициализирован на странице. Проверьте подключение supabase-config.js.');
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return window.supabase;
    }

    function escapeHtml(text = '') {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeAttribute(text = '') {
        return escapeHtml(text).replace(/"/g, '&quot;');
    }

    function resolvePath(path = '', context = {}) {
        if (!path) return '';
        const segments = path.split('.');
        return segments.reduce((acc, key) => {
            if (acc && typeof acc === 'object' && key in acc) {
                return acc[key];
            }
            return '';
        }, context);
    }

    // РњР°РїРїРёРЅРі РїРµСЂРµРІРѕРґРѕРІ РЅР°Р·РІР°РЅРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚РѕРІ (РµСЃР»Рё РЅРµС‚ РІ metadata)
    // РљР»СЋС‡ - Р°РЅРіР»РёР№СЃРєРѕРµ РЅР°Р·РІР°РЅРёРµ (link_text), Р·РЅР°С‡РµРЅРёРµ - РѕР±СЉРµРєС‚ СЃ РїРµСЂРµРІРѕРґР°РјРё
    const UNIVERSITY_TRANSLATIONS = {
        'Azerbaijan University of Languages': {
            ru: 'РђР·РµСЂР±Р°Р№РґР¶Р°РЅСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ СЏР·С‹РєРѕРІ',
            kz: 'УР·С–СЂР±Р°Р№Р¶Р°РЅ С‚С–Р»РґРµСЂ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Azerbaijan University of Languages'
        },
        'Baku State University': {
            ru: 'Р‘Р°РєРёРЅСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'Р‘Р°РєСѓ РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Baku State University'
        },
        'Sofia University "St. Kliment Ohridski"': {
            ru: 'РЎРѕС„РёР№СЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РёРјРµРЅРё СЃРІСЏС‚РѕРіРѕ РљР»РёРјРµРЅС‚Р° РћС…СЂРёРґСЃРєРѕРіРѕ',
            kz: 'РЎРѕС„РёСЏ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– ТљР°СЃРёРµС‚С‚С– РљР»РёРјРµРЅС‚ РћС…СЂРёРґСЃРєРёР№ Р°С‚С‹РЅРґР°Т“С‹',
            en: 'Sofia University "St. Kliment Ohridski"'
        },
        'Technical University of Sofia': {
            ru: 'РўРµС…РЅРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РЎРѕС„РёРё',
            kz: 'РЎРѕС„РёСЏ С‚РµС…РЅРёРєР°Р»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Technical University of Sofia'
        },
        'University of Forestry': {
            ru: 'Р›РµСЃРЅРѕР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РћСЂРјР°РЅ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'University of Forestry'
        },
        'Varna University of Management': {
            ru: 'Р’Р°СЂРЅРµРЅСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РјРµРЅРµРґР¶РјРµРЅС‚Р°',
            kz: 'Р’Р°СЂРЅР° РјРµРЅРµРґР¶РјРµРЅС‚ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Varna University of Management'
        },
        'University of Pannonia': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РџР°РЅРЅРѕРЅРёРё',
            kz: 'РџР°РЅРЅРѕРЅРёСЏ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'University of Pannonia'
        },
        'Fachhochschule des Mittelstands (FHM)': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РїСЂРёРєР»Р°РґРЅС‹С… РЅР°СѓРє СЃСЂРµРґРЅРµРіРѕ РєР»Р°СЃСЃР° (FHM)',
            kz: 'РћСЂС‚Р° РєР»Р°СЃ Т›РѕР»РґР°РЅР±Р°Р»С‹ Т“С‹Р»С‹РјРґР°СЂ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (FHM)',
            en: 'Fachhochschule des Mittelstands (FHM)'
        },
        'University of Konstanz': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РљРѕРЅСЃС‚Р°РЅС†Р°',
            kz: 'РљРѕРЅСЃС‚Р°РЅС† СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'University of Konstanz'
        },
        'English and Foreign Languages University': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ Р°РЅРіР»РёР№СЃРєРѕРіРѕ Рё РёРЅРѕСЃС‚СЂР°РЅРЅС‹С… СЏР·С‹РєРѕРІ',
            kz: 'РђТ“С‹Р»С€С‹РЅ Р¶У™РЅРµ С€РµС‚РµР» С‚С–Р»РґРµСЂС– СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'English and Foreign Languages University'
        },
        'Indian Institute of Technology Bombay': {
            ru: 'РРЅРґРёР№СЃРєРёР№ С‚РµС…РЅРѕР»РѕРіРёС‡РµСЃРєРёР№ РёРЅСЃС‚РёС‚СѓС‚ Р‘РѕРјР±РµСЏ',
            kz: 'Р‘РѕРјР±РµР№ Т®РЅРґС–СЃС‚Р°РЅ С‚РµС…РЅРѕР»РѕРіРёСЏР»С‹Т› РёРЅСЃС‚РёС‚СѓС‚С‹',
            en: 'Indian Institute of Technology Bombay'
        },
        'University of Santiago de Compostela': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РЎР°РЅС‚СЊСЏРіРѕ-РґРµ-РљРѕРјРїРѕСЃС‚РµР»Р°',
            kz: 'РЎР°РЅС‚СЊСЏРіРѕ-РґРµ-РљРѕРјРїРѕСЃС‚РµР»Р° СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'University of Santiago de Compostela'
        },
        'Eurac Research': {
            ru: 'Р•РІСЂР°Рє РСЃСЃР»РµРґРѕРІР°РЅРёСЏ',
            kz: 'Р•РІСЂР°Рє Р—РµСЂС‚С‚РµСѓР»РµСЂ',
            en: 'Eurac Research'
        },
        'University NiccolГІ Cusano': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РќРёРєРєРѕР»Рѕ РљСѓР·Р°РЅРѕ',
            kz: 'РќРёРєРєРѕР»Рѕ РљСѓР·Р°РЅРѕ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'University NiccolГІ Cusano'
        },
        'Jilin Normal University': {
            ru: 'Р¦Р·РёР»РёРЅСЊСЃРєРёР№ РїРµРґР°РіРѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'Р¦Р·РёР»РёРЅСЊ РїРµРґР°РіРѕРіРёРєР°Р»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Jilin Normal University'
        },
        'Poznan University of Technology': {
            ru: 'РџРѕР·РЅР°РЅСЃРєРёР№ С‚РµС…РЅРѕР»РѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РџРѕР·РЅР°РЅСЊ С‚РµС…РЅРѕР»РѕРіРёСЏР»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Poznan University of Technology'
        },
        'Eastern European University of Applied Sciences in Bialystok': {
            ru: 'Р’РѕСЃС‚РѕС‡РЅРѕРµРІСЂРѕРїРµР№СЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РїСЂРёРєР»Р°РґРЅС‹С… РЅР°СѓРє РІ Р‘РµР»РѕСЃС‚РѕРєРµ',
            kz: 'Р‘РµР»РѕСЃС‚РѕРєС‚РµРіС– РЁС‹Т“С‹СЃ Р•СѓСЂРѕРїР° Т›РѕР»РґР°РЅР±Р°Р»С‹ Т“С‹Р»С‹РјРґР°СЂ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Eastern European University of Applied Sciences in Bialystok'
        },
        'University of Bialystok': {
            ru: 'Р‘РµР»РѕСЃС‚РѕРєСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'Р‘РµР»РѕСЃС‚РѕРє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'University of Bialystok'
        },
        'Saint Petersburg State Forest Technical University': {
            ru: 'РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРіСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ Р»РµСЃРѕС‚РµС…РЅРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРі РјРµРјР»РµРєРµС‚С‚С–Рє РѕСЂРјР°РЅ С‚РµС…РЅРёРєР°Р»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Saint Petersburg State Forest Technical University'
        },
        'Saint Petersburg State University': {
            ru: 'РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРіСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРі РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Saint Petersburg State University'
        },
        'Kazan Federal University': {
            ru: 'РљР°Р·Р°РЅСЃРєРёР№ С„РµРґРµСЂР°Р»СЊРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'ТљР°Р·Р°РЅ С„РµРґРµСЂР°Р»РґС‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Kazan Federal University'
        },
        'Innopolis University': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РРЅРЅРѕРїРѕР»РёСЃ',
            kz: 'РРЅРЅРѕРїРѕР»РёСЃ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Innopolis University'
        },
        'Nizhnevartovsk State University': {
            ru: 'РќРёР¶РЅРµРІР°СЂС‚РѕРІСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РќРёР¶РЅРµРІР°СЂС‚РѕРІСЃРє РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Nizhnevartovsk State University'
        },
        'Kuban State University': {
            ru: 'РљСѓР±Р°РЅСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РљСѓР±Р°РЅСЊ РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Kuban State University'
        },
        'Kuzbass State Technical University': {
            ru: 'РљСѓР·Р±Р°СЃСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ С‚РµС…РЅРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РљСѓР·Р±Р°СЃСЃ РјРµРјР»РµРєРµС‚С‚С–Рє С‚РµС…РЅРёРєР°Р»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Kuzbass State Technical University'
        },
        'Altai State University': {
            ru: 'РђР»С‚Р°Р№СЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РђР»С‚Р°Р№ РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Altai State University'
        },
        'Altai State Pedagogical University': {
            ru: 'РђР»С‚Р°Р№СЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ РїРµРґР°РіРѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РђР»С‚Р°Р№ РјРµРјР»РµРєРµС‚С‚С–Рє РїРµРґР°РіРѕРіРёРєР°Р»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Altai State Pedagogical University'
        },
        'Omsk State Pedagogical University': {
            ru: 'РћРјСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ РїРµРґР°РіРѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РћРјСЃРє РјРµРјР»РµРєРµС‚С‚С–Рє РїРµРґР°РіРѕРіРёРєР°Р»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Omsk State Pedagogical University'
        },
        'Constantine the Philosopher University in Nitra': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РљРѕРЅСЃС‚Р°РЅС‚РёРЅР° Р¤РёР»РѕСЃРѕС„Р° РІ РќРёС‚СЂРµ',
            kz: 'РќРёС‚СЂРµРґРµРіС– РљРѕРЅСЃС‚Р°РЅС‚РёРЅ Р¤РёР»РѕСЃРѕС„ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Constantine the Philosopher University in Nitra'
        },
        'Tajik State University of Commerce': {
            ru: 'РўР°РґР¶РёРєСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РєРѕРјРјРµСЂС†РёРё',
            kz: 'РўУ™Р¶С–РєСЃС‚Р°РЅ РјРµРјР»РµРєРµС‚С‚С–Рє РєРѕРјРјРµСЂС†РёСЏ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Tajik State University of Commerce'
        },
        'Technological University of Tajikistan': {
            ru: 'РўРµС…РЅРѕР»РѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РўР°РґР¶РёРєРёСЃС‚Р°РЅР°',
            kz: 'РўУ™Р¶С–РєСЃС‚Р°РЅ С‚РµС…РЅРѕР»РѕРіРёСЏР»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Technological University of Tajikistan'
        },
        'Turkmen State Institute of Economics and Management': {
            ru: 'РўСѓСЂРєРјРµРЅСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ РёРЅСЃС‚РёС‚СѓС‚ СЌРєРѕРЅРѕРјРёРєРё Рё РјРµРЅРµРґР¶РјРµРЅС‚Р°',
            kz: 'РўТЇСЂС–РєРјРµРЅСЃС‚Р°РЅ РјРµРјР»РµРєРµС‚С‚С–Рє СЌРєРѕРЅРѕРјРёРєР° Р¶У™РЅРµ РјРµРЅРµРґР¶РјРµРЅС‚ РёРЅСЃС‚РёС‚СѓС‚С‹',
            en: 'Turkmen State Institute of Economics and Management'
        },
        'Duzce University': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ Р”СЋР·РґР¶Рµ',
            kz: 'Р”СЋР·РґР¶Рµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Duzce University'
        },
        'Ege University': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ Р­РіРµР№',
            kz: 'Р­РіРµР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Ege University'
        },
        'Istanbul Aydin University': {
            ru: 'РЎС‚Р°РјР±СѓР»СЊСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РђР№РґС‹РЅ',
            kz: 'РЎС‚Р°РјР±Т±Р» РђР№РґС‹РЅ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Istanbul Aydin University'
        },
        'Pamukkale University': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РџР°РјСѓРєРєР°Р»Рµ',
            kz: 'РџР°РјСѓРєРєР°Р»Рµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Pamukkale University'
        },
        'Yeditepe University': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ Р•РґРёС‚РµРїРµ',
            kz: 'Р•РґРёС‚РµРїРµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Yeditepe University'
        },
        'Management Development Institute of Tashkent (MDIS)': {
            ru: 'РРЅСЃС‚РёС‚СѓС‚ СЂР°Р·РІРёС‚РёСЏ РјРµРЅРµРґР¶РјРµРЅС‚Р° РўР°С€РєРµРЅС‚Р° (MDIS)',
            kz: 'РўР°С€РєРµРЅС‚ РјРµРЅРµРґР¶РјРµРЅС‚ РґР°РјСѓ РёРЅСЃС‚РёС‚СѓС‚С‹ (MDIS)',
            en: 'Management Development Institute of Tashkent (MDIS)'
        },
        'Westminster International University in Tashkent (WIUT)': {
            ru: 'Р’РµСЃС‚РјРёРЅСЃС‚РµСЂСЃРєРёР№ РјРµР¶РґСѓРЅР°СЂРѕРґРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РІ РўР°С€РєРµРЅС‚Рµ (WIUT)',
            kz: 'РўР°С€РєРµРЅС‚С‚РµРіС– Р’РµСЃС‚РјРёРЅСЃС‚РµСЂ С…Р°Р»С‹Т›Р°СЂР°Р»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (WIUT)',
            en: 'Westminster International University in Tashkent (WIUT)'
        },
        'Central Asian University (CAU)': {
            ru: 'Р¦РµРЅС‚СЂР°Р»СЊРЅРѕР°Р·РёР°С‚СЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (CAU)',
            kz: 'РћСЂС‚Р°Р»С‹Т› РђР·РёСЏ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (CAU)',
            en: 'Central Asian University (CAU)'
        },
        'Branch of Moscow State University Named for M.V. Lomonosov in Tashkent': {
            ru: 'Р¤РёР»РёР°Р» РњРѕСЃРєРѕРІСЃРєРѕРіРѕ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅРѕРіРѕ СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р° РёРјРµРЅРё Рњ.Р’. Р›РѕРјРѕРЅРѕСЃРѕРІР° РІ РўР°С€РєРµРЅС‚Рµ',
            kz: 'РўР°С€РєРµРЅС‚С‚РµРіС– Рњ.Р’. Р›РѕРјРѕРЅРѕСЃРѕРІ Р°С‚С‹РЅРґР°Т“С‹ РњУ™СЃРєРµСѓ РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–РЅС–ТЈ С„РёР»РёР°Р»С‹',
            en: 'Branch of Moscow State University Named for M.V. Lomonosov in Tashkent'
        },
        'Karakalpak State University named after Berdakh': {
            ru: 'РљР°СЂР°РєР°Р»РїР°РєСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РёРјРµРЅРё Р‘РµСЂРґР°С…Р°',
            kz: 'Р‘РµСЂРґР°С… Р°С‚С‹РЅРґР°Т“С‹ ТљР°СЂР°Т›Р°Р»РїР°Т› РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Karakalpak State University named after Berdakh'
        },
        'Adriatic University Bar': {
            ru: 'РђРґСЂРёР°С‚РёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ Р‘Р°СЂ',
            kz: 'Р‘Р°СЂ РђРґСЂРёР°С‚РёРєР° СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Adriatic University Bar'
        },
        'Swiss School of Applied Sciences for Economics and Management': {
            ru: 'РЁРІРµР№С†Р°СЂСЃРєР°СЏ С€РєРѕР»Р° РїСЂРёРєР»Р°РґРЅС‹С… РЅР°СѓРє РїРѕ СЌРєРѕРЅРѕРјРёРєРµ Рё РјРµРЅРµРґР¶РјРµРЅС‚Сѓ',
            kz: 'Р­РєРѕРЅРѕРјРёРєР° Р¶У™РЅРµ РјРµРЅРµРґР¶РјРµРЅС‚ Р±РѕР№С‹РЅС€Р° РЁРІРµР№С†Р°СЂРёСЏ Т›РѕР»РґР°РЅР±Р°Р»С‹ Т“С‹Р»С‹РјРґР°СЂ РјРµРєС‚РµР±С–',
            en: 'Swiss School of Applied Sciences for Economics and Management'
        },
        'Swiss International Business School': {
            ru: 'РЁРІРµР№С†Р°СЂСЃРєР°СЏ РјРµР¶РґСѓРЅР°СЂРѕРґРЅР°СЏ Р±РёР·РЅРµСЃ-С€РєРѕР»Р°',
            kz: 'РЁРІРµР№С†Р°СЂРёСЏ С…Р°Р»С‹Т›Р°СЂР°Р»С‹Т› Р±РёР·РЅРµСЃ РјРµРєС‚РµР±С–',
            en: 'Swiss International Business School'
        },
        // ============================================
        // РќРћР’Р«Р• РЈРќРР’Р•Р РЎРРўР•РўР« РР— R2 (РґРѕР±Р°РІР»РµРЅС‹ С‡РµСЂРµР· SQL СЃРєСЂРёРїС‚)
        // ============================================
        // Р РѕСЃСЃРёСЏ - РЅРѕРІС‹Рµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С‹
        'Russian New University (RosNOU)': {
            ru: 'РђРІС‚РѕРЅРѕРјРЅР°СЏ РЅРµРєРѕРјРјРµСЂС‡РµСЃРєР°СЏ РѕСЂРіР°РЅРёР·Р°С†РёСЏ РІС‹СЃС€РµРіРѕ РѕР±СЂР°Р·РѕРІР°РЅРёСЏ Р РѕСЃСЃРёР№СЃРєРёР№ РЅРѕРІС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (Р РѕСЃРќРћРЈ)',
            kz: 'Р РµСЃРµР№ Р¶Р°ТЈР° СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (Р РѕСЃРќРћРЈ)',
            en: 'Russian New University (RosNOU)'
        },
        'Moscow City Pedagogical University (MSPU)': {
            ru: 'Р“РѕСЃ.Р°РІС‚РѕРЅРѕРјРЅРѕРµ РѕР± СѓС‡ РІС‹СЃС€РµРіРѕ РѕР±СЂР°Р·РѕРІР°РЅРёСЏ РіРѕСЂРѕРґР° РњРѕСЃРєРІС‹ В«РњР“РџРЈВ»',
            kz: 'РњУ™СЃРєРµСѓ Т›Р°Р»Р°Р»С‹Т› РїРµРґР°РіРѕРіРёРєР°Р»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (РњР“РџРЈ)',
            en: 'Moscow City Pedagogical University (MSPU)'
        },
        'Kemerovo State University (KemSU)': {
            ru: 'РљРµРјРµСЂРѕРІСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (РљРµРјР“РЈ)',
            kz: 'РљРµРјРµСЂРѕРІРѕ РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (РљРµРјР“РЈ)',
            en: 'Kemerovo State University (KemSU)'
        },
        'College of Marketing, Management and Trade': {
            ru: 'РљРѕР»Р»РµРґР¶ РїРѕ РјР°СЂРєРµС‚РёРЅРіСѓ, РјРµРЅРµРґР¶РјРµРЅС‚Сѓ Рё С‚РѕСЂРіРѕРІР»Рµ',
            kz: 'РњР°СЂРєРµС‚РёРЅРі, РјРµРЅРµРґР¶РјРµРЅС‚ Р¶У™РЅРµ СЃР°СѓРґР° РєРѕР»Р»РµРґР¶С–',
            en: 'College of Marketing, Management and Trade'
        },
        'National Research University "MEI"': {
            ru: 'РќР°С†РёРѕРЅР°Р»СЊРЅС‹Р№ РёСЃСЃР»РµРґРѕРІР°С‚РµР»СЊСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ В«РњР­РВ»',
            kz: 'Т°Р»С‚С‚С‹Т› Р·РµСЂС‚С‚РµСѓ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– В«РњР­РВ»',
            en: 'National Research University "MEI"'
        },
        'Novosibirsk State University of Architecture and Civil Engineering (Sibstrin)': {
            ru: 'РќРѕРІРѕСЃРёР±РёСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅРѕ-СЃС‚СЂРѕРёС‚РµР»СЊРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (РЎРёР±СЃС‚СЂРёРЅ)',
            kz: 'РќРѕРІРѕСЃРёР±РёСЂСЃРє РјРµРјР»РµРєРµС‚С‚С–Рє СЃУ™СѓР»РµС‚-Т›Т±СЂС‹Р»С‹СЃ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (РЎРёР±СЃС‚СЂРёРЅ)',
            en: 'Novosibirsk State University of Architecture and Civil Engineering (Sibstrin)'
        },
        'North Caucasus Federal University (SKFU)': {
            ru: 'Р¤Р“РђРћРЈ Р’Рћ РЎРµРІРµСЂРѕ-РљР°РІРєР°Р·СЃРєРёР№ С„РµРґРµСЂР°Р»СЊРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚, РЎРљР¤РЈ',
            kz: 'РЎРѕР»С‚ТЇСЃС‚С–Рє РљР°РІРєР°Р· С„РµРґРµСЂР°Р»РґС‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (РЎРљР¤РЈ)',
            en: 'North Caucasus Federal University (SKFU)'
        },
        'Russian Presidential Academy of National Economy and Public Administration (RANEPA)': {
            ru: 'Р¤Р“Р‘РћРЈ Р’Рћ В«Р РѕСЃСЃРёР№СЃРєР°СЏ Р°РєР°РґРµРјРёСЏ РЅР°СЂРѕРґРЅРѕРіРѕ С…РѕР·СЏР№СЃС‚РІР° Рё РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅРѕР№ СЃР»СѓР¶Р±С‹ РїСЂРё РџСЂРµР·РёРґРµРЅС‚Рµ Р РѕСЃСЃРёР№СЃРєРѕР№ Р¤РµРґРµСЂР°С†РёРёВ» (Р РђРќРҐРёР“РЎ)',
            kz: 'Р РµСЃРµР№ РџСЂРµР·РёРґРµРЅС‚С–РЅС–ТЈ С…Р°Р»С‹Т› С€Р°СЂСѓР°С€С‹Р»С‹Т“С‹ Р¶У™РЅРµ РјРµРјР»РµРєРµС‚С‚С–Рє Т›С‹Р·РјРµС‚ Р°РєР°РґРµРјРёСЏСЃС‹ (Р РђРќРҐРёР“РЎ)',
            en: 'Russian Presidential Academy of National Economy and Public Administration (RANEPA)'
        },
        'Russian State University of Tourism and Service (RSUTS)': {
            ru: 'Р¤Р“Р‘РћРЈ Р’Рћ Р РѕСЃСЃРёР№СЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ С‚СѓСЂРёР·РјР° Рё СЃРµСЂРІРёСЃР° (Р Р“РЈРўРРЎ)',
            kz: 'Р РµСЃРµР№ РјРµРјР»РµРєРµС‚С‚С–Рє С‚СѓСЂРёР·Рј Р¶У™РЅРµ СЃРµСЂРІРёСЃ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (Р Р“РЈРўРРЎ)',
            en: 'Russian State University of Tourism and Service (RSUTS)'
        },
        'Krasnoyarsk State Pedagogical University named after V.P. Astafyev': {
            ru: 'Р¤Р“Р‘РћРЈ Р’Рћ В«РљСЂР°СЃРЅРѕСЏСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ РїРµРґР°РіРѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РёРј. Р’.Рџ.РђСЃС‚Р°С„СЊРµРІР°В»',
            kz: 'Р’.Рџ.РђСЃС‚Р°С„СЊРµРІ Р°С‚С‹РЅРґР°Т“С‹ РљСЂР°СЃРЅРѕСЏСЂСЃРє РјРµРјР»РµРєРµС‚С‚С–Рє РїРµРґР°РіРѕРіРёРєР°Р»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Krasnoyarsk State Pedagogical University named after V.P. Astafyev'
        },
        'Novosibirsk State University (NSU)': {
            ru: 'Р¤Р“Р‘РћРЈ Р’Рћ В«РќРѕРІРѕСЃРёР±РёСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚В» (РќР“РЈ)',
            kz: 'РќРѕРІРѕСЃРёР±РёСЂСЃРє РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (РќР“РЈ)',
            en: 'Novosibirsk State University (NSU)'
        },
        'Yugra State University (YSU)': {
            ru: 'Р¤Р“Р‘РћРЈ Р’Рћ В«Р®РіРѕСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚В» (Р®Р“РЈ)',
            kz: 'Р®РіСЂР° РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (Р®Р“РЈ)',
            en: 'Yugra State University (YSU)'
        },
        'Moscow State Technological University STANKIN': {
            ru: 'Р¤Р“Р‘РћРЈ Р’Рћ РњР“РўРЈ РњРѕСЃРєРѕРІСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ С‚РµС…РЅРѕР»РѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РЎРўРђРќРљРРќ',
            kz: 'РњУ™СЃРєРµСѓ РјРµРјР»РµРєРµС‚С‚С–Рє С‚РµС…РЅРѕР»РѕРіРёСЏР»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– РЎРўРђРќРљРРќ',
            en: 'Moscow State Technological University STANKIN'
        },
        'Novosibirsk State Pedagogical University (NSPU)': {
            ru: 'Р¤Р“Р‘РћРЈ Р’Рћ РќРѕРІРѕСЃРёР±РёСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ РїРµРґР°РіРѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (РќР“РџРЈ)',
            kz: 'РќРѕРІРѕСЃРёР±РёСЂСЃРє РјРµРјР»РµРєРµС‚С‚С–Рє РїРµРґР°РіРѕРіРёРєР°Р»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (РќР“РџРЈ)',
            en: 'Novosibirsk State Pedagogical University (NSPU)'
        },
        'Novosibirsk State University of Economics and Management (NINH)': {
            ru: 'Р¤Р“Р‘РћРЈ Р’Рћ РќРѕРІРѕСЃРёР±РёСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ СЌРєРѕРЅРѕРјРёРєРё Рё СѓРїСЂР°РІР»РµРЅРёСЏ РќРРќРҐ',
            kz: 'РќРѕРІРѕСЃРёР±РёСЂСЃРє РјРµРјР»РµРєРµС‚С‚С–Рє СЌРєРѕРЅРѕРјРёРєР° Р¶У™РЅРµ Р±Р°СЃТ›Р°СЂСѓ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С– (РќРРќРҐ)',
            en: 'Novosibirsk State University of Economics and Management (NINH)'
        },
        'Pskov State University': {
            ru: 'Р¤Р“Р‘РћРЈ Р’Рћ РџСЃРєРѕРІСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'РџСЃРєРѕРІ РјРµРјР»РµРєРµС‚С‚С–Рє СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Pskov State University'
        },
        // Р‘РѕР»РіР°СЂРёСЏ - РЅРѕРІС‹Рµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С‹
        'Agricultural University of Plovdiv': {
            ru: 'РђРіСЂР°СЂРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ Рі.РџР»РѕРІРґРёРІ',
            kz: 'РџР»РѕРІРґРёРІ Р°РіСЂР°СЂР»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Agricultural University of Plovdiv'
        },
        'Varna Free University': {
            ru: 'Р’Р°СЂРЅРµРЅСЃРєРёР№ РЎРІРѕР±РѕРґРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'Р’Р°СЂРЅР° Р•СЂРєС–РЅ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Varna Free University'
        },
        'New Bulgarian University': {
            ru: 'РќРѕРІС‹Р№ Р‘РѕР»РіР°СЂСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            kz: 'Р–Р°ТЈР° Р‘РѕР»РіР°СЂРёСЏ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'New Bulgarian University'
        },
        'University of European Centre for Peace and Development': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ Р•РІСЂРѕРїРµР№СЃРєРѕРіРѕ С†РµРЅС‚СЂР° РјРёСЂР° Рё СЂР°Р·РІРёС‚РёСЏ',
            kz: 'Р•СѓСЂРѕРїР° Р±РµР№Р±С–С‚С€С–Р»С–Рє Р¶У™РЅРµ РґР°РјСѓ РѕСЂС‚Р°Р»С‹Т“С‹ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'University of European Centre for Peace and Development'
        },
        // РџРѕР»СЊС€Р° - РЅРѕРІС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚
        'University of Natural Sciences and Humanities in Siedlce': {
            ru: 'Р•СЃС‚РµСЃС‚РІРµРЅРЅРѕ-РіСѓРјР°РЅРёС‚Р°СЂРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РіРѕСЂРѕРґР° РЎРµРґР»СЊС†Рµ',
            kz: 'РЎРµРґР»СЊС†Рµ Т›Р°Р»Р°СЃС‹РЅС‹ТЈ С‚Р°Р±РёТ“Рё Т“С‹Р»С‹РјРґР°СЂ Р¶У™РЅРµ РіСѓРјР°РЅРёС‚Р°СЂР»С‹Т› СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'University of Natural Sciences and Humanities in Siedlce'
        },
        // Р›Р°С‚РІРёСЏ - РЅРѕРІС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (РќРћР’РђРЇ РЎРўР РђРќРђ)
        'Rezekne Academy of Technologies (RTA)': {
            ru: 'Р РµР·РµРєРЅРµРЅСЃРєР°СЏ Р°РєР°РґРµРјРёСЏ С‚РµС…РЅРѕР»РѕРіРёР№ (RTA)',
            kz: 'Р РµР·РµРєРЅРµ С‚РµС…РЅРѕР»РѕРіРёСЏР»Р°СЂ Р°РєР°РґРµРјРёСЏСЃС‹ (RTA)',
            en: 'Rezekne Academy of Technologies (RTA)'
        },
        // РўСѓСЂС†РёСЏ - РЅРѕРІС‹Рµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С‹
        'Ankara Haci Bayram Veli University': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РђРЅРєР°СЂС‹ РҐР°С‡Рё Р‘Р°Р№СЂР°Рј Р’РµР»Рё',
            kz: 'РђРЅРєР°СЂР° РҐР°С‡Рё Р‘Р°Р№СЂР°Рј Р’РµР»Рё СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Ankara Haci Bayram Veli University'
        },
        'Pantheon University': {
            ru: 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РџР°РЅС‚РµРѕРЅ',
            kz: 'РџР°РЅС‚РµРѕРЅ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С–',
            en: 'Pantheon University'
        }
    };

    function getDisplayName(record) {
        const currentLang = localStorage.getItem('selectedLanguage') || 'RU';
        
        // Для данных из students_appendices используем прямые поля title_*
        if (record.title_ru || record.title_kz || record.title_en) {
            if (currentLang === 'EN' && record.title_en && record.title_en.trim()) {
                return record.title_en.trim();
            } else if (currentLang === 'KZ' && record.title_kz && record.title_kz.trim()) {
                return record.title_kz.trim();
            } else if (record.title_ru && record.title_ru.trim()) {
                return record.title_ru.trim();
            }
        }
        
        // Для данных из our_partners используем прямые поля
        if (record.university_name_ru || record.university_name_kz || record.university_name_en) {
            if (currentLang === 'EN' && record.university_name_en && record.university_name_en.trim()) {
                return record.university_name_en.trim();
            } else if (currentLang === 'KZ' && record.university_name_kz && record.university_name_kz.trim()) {
                return record.university_name_kz.trim();
            } else if (record.university_name_ru && record.university_name_ru.trim()) {
                return record.university_name_ru.trim();
            }
        }
        
        const metadata = record.document?.metadata || {};
        
        // РџР РРћР РРўР•Рў 1: РџРѕР»СѓС‡Р°РµРј РЅР°Р·РІР°РЅРёРµ РЅР° С‚РµРєСѓС‰РµРј СЏР·С‹РєРµ РёР· metadata
        let linkText = '';
        if (currentLang === 'EN' && metadata.link_text_en && metadata.link_text_en.trim()) {
            linkText = metadata.link_text_en.trim();
        } else if (currentLang === 'KZ' && metadata.link_text_kz && metadata.link_text_kz.trim()) {
            linkText = metadata.link_text_kz.trim();
        } else if (currentLang === 'RU' && metadata.link_text_ru && metadata.link_text_ru.trim()) {
            linkText = metadata.link_text_ru.trim();
        } else if (metadata.link_text_ru && metadata.link_text_ru.trim()) {
            // Если текущий язык не RU, но есть русский перевод, используем его как fallback
            linkText = metadata.link_text_ru.trim();
        } else if (metadata.link_text_en && metadata.link_text_en.trim()) {
            // Fallback на английский из metadata
            linkText = metadata.link_text_en.trim();
        }
        
        // РџР РРћР РРўР•Рў 2: Р•СЃР»Рё РІ metadata РЅРµС‚ РїРµСЂРµРІРѕРґР°, РёСЃРїРѕР»СЊР·СѓРµРј РјР°РїРїРёРЅРі РїРµСЂРµРІРѕРґРѕРІ
        if (!linkText) {
            const englishName = (record.link_text && record.link_text.trim())
                || (record.document?.file_name) 
                || (record.document?.name)
                || '';
            
            // НЕ используем UNIVERSITY_TRANSLATIONS из-за искаженных данных
            // Используем только оригинальное английское название из Supabase
            // Блок с UNIVERSITY_TRANSLATIONS отключен из-за искаженных данных
            {
                // РџР РРћР РРўР•Рў 3: Р•СЃР»Рё РЅРµС‚ РїРµСЂРµРІРѕРґР° РІ РјР°РїРїРёРЅРіРµ, РёСЃРїРѕР»СЊР·СѓРµРј РѕСЂРёРіРёРЅР°Р»СЊРЅРѕРµ РЅР°Р·РІР°РЅРёРµ
            linkText = englishName || 'Документ';
            }
        }
        
        // Для английского языка показываем английские названия приложений
        if (record.section === 'appendices' && currentLang === 'EN') {
            // Извлекаем номер приложения из текста (ищем "Приложение N" или "Appendix N")
            const appendixMatch = linkText.match(/(?:Приложение|Appendix)\s+(\d+)/i);
            if (appendixMatch) {
                const appendixNum = parseInt(appendixMatch[1], 10);
                const englishNames = {
                    1: 'Appendix 1 Application for Participation in the Competition - at Own Expense',
                    2: 'Appendix 2 Application for Participation in the Competition - Grant from the Ministry of Education and Science of the Republic of Kazakhstan',
                    3: 'Appendix 3 Application for Departure',
                    4: 'Appendix 4 Parental Consent for Departure',
                    5: 'Appendix 5 Application form for traveling abroad',
                    6: 'Appendix 6 Disciplinary Receipt',
                    7: 'Appendix 7 Receipt of Obligation to Return the Grant Amount',
                    8: 'Appendix 8 Receipt of Information on Financial Conditions',
                    9: 'Appendix 9 Application Form',
                    10: 'Appendix 10 Learning Agreement',
                    11: 'Appendix 11 Application for Additional Educational Training',
                    12: 'Appendix 12 Receipt of Document Submission'
                };
                
                if (englishNames[appendixNum]) {
                    return englishNames[appendixNum];
                }
            }
        }
        
        return linkText;
    }
    
    // РњР°РїРїРёРЅРі РЅР°Р·РІР°РЅРёР№ СЃС‚СЂР°РЅ РЅР° СЂР°Р·РЅС‹Рµ СЏР·С‹РєРё (РІС‹РЅРµСЃРµРЅ РІ РєРѕРЅСЃС‚Р°РЅС‚Сѓ РґР»СЏ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ)
    const COUNTRY_TRANSLATIONS = {
        'РђР·РµСЂР±Р°Р№РґР¶Р°РЅ': { ru: 'РђР·РµСЂР±Р°Р№РґР¶Р°РЅ', kz: 'УР·С–СЂР±Р°Р№Р¶Р°РЅ', en: 'Azerbaijan' },
        'Р‘РѕР»РіР°СЂРёСЏ': { ru: 'Р‘РѕР»РіР°СЂРёСЏ', kz: 'Р‘РѕР»РіР°СЂРёСЏ', en: 'Bulgaria' },
        'Р’РµРЅРіСЂРёСЏ': { ru: 'Р’РµРЅРіСЂРёСЏ', kz: 'Р’РµРЅРіСЂРёСЏ', en: 'Hungary' },
        'Р“РµСЂРјР°РЅРёСЏ': { ru: 'Р“РµСЂРјР°РЅРёСЏ', kz: 'Р“РµСЂРјР°РЅРёСЏ', en: 'Germany' },
        'РРЅРґРёСЏ': { ru: 'РРЅРґРёСЏ', kz: 'Т®РЅРґС–СЃС‚Р°РЅ', en: 'India' },
        'РСЃРїР°РЅРёСЏ': { ru: 'РСЃРїР°РЅРёСЏ', kz: 'РСЃРїР°РЅРёСЏ', en: 'Spain' },
        'РС‚Р°Р»РёСЏ': { ru: 'РС‚Р°Р»РёСЏ', kz: 'РС‚Р°Р»РёСЏ', en: 'Italy' },
        'РљРёС‚Р°Р№': { ru: 'РљРёС‚Р°Р№', kz: 'ТљС‹С‚Р°Р№', en: 'China' },
        'РџРѕР»СЊС€Р°': { ru: 'РџРѕР»СЊС€Р°', kz: 'РџРѕР»СЊС€Р°', en: 'Poland' },
        'Р РѕСЃСЃРёСЏ': { ru: 'Р РѕСЃСЃРёСЏ', kz: 'Р РµСЃРµР№', en: 'Russia' },
        'РЎР»РѕРІР°РєРёСЏ': { ru: 'РЎР»РѕРІР°РєРёСЏ', kz: 'РЎР»РѕРІР°РєРёСЏ', en: 'Slovakia' },
        'РўР°РґР¶РёРєРёСЃС‚Р°РЅ': { ru: 'РўР°РґР¶РёРєРёСЃС‚Р°РЅ', kz: 'РўУ™Р¶С–РєСЃС‚Р°РЅ', en: 'Tajikistan' },
        'РўСѓСЂРєРјРµРЅРёСЃС‚Р°РЅ': { ru: 'РўСѓСЂРєРјРµРЅРёСЃС‚Р°РЅ', kz: 'РўТЇСЂС–РєРјРµРЅСЃС‚Р°РЅ', en: 'Turkmenistan' },
        'РўСѓСЂС†РёСЏ': { ru: 'РўСѓСЂС†РёСЏ', kz: 'РўТЇСЂРєРёСЏ', en: 'Turkey' },
        'РЈР·Р±РµРєРёСЃС‚Р°РЅ': { ru: 'РЈР·Р±РµРєРёСЃС‚Р°РЅ', kz: 'УЁР·Р±РµРєСЃС‚Р°РЅ', en: 'Uzbekistan' },
        'Р§РµСЂРЅРѕРіРѕСЂРёСЏ': { ru: 'Р§РµСЂРЅРѕРіРѕСЂРёСЏ', kz: 'Р§РµСЂРЅРѕРіРѕСЂРёСЏ', en: 'Montenegro' },
        'РЁРІРµР№С†Р°СЂРёСЏ': { ru: 'РЁРІРµР№С†Р°СЂРёСЏ', kz: 'РЁРІРµР№С†Р°СЂРёСЏ', en: 'Switzerland' },
    };
    
    function getCountryName(country, metadata = {}) {
        const currentLang = localStorage.getItem('selectedLanguage') || 'RU';
        
        const translation = COUNTRY_TRANSLATIONS[country];
        if (translation) {
            if (currentLang === 'EN') return translation.en;
            if (currentLang === 'KZ') return translation.kz;
            return translation.ru;
        }
        
        return country; // Если перевода нет, возвращаем оригинал
    }

    function buildPdfUrlFromName(universityName) {
        if (!universityName) return null;
        
        const r2Base = (window.R2_CONFIG?.PUBLIC_URL || R2_PUBLIC_BASE || '').replace(/\/$/, '');
        if (!r2Base) return null;
        
        // РўРћР§РќР«Р™ РјР°РїРїРёРЅРі РЅР°Р·РІР°РЅРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚РѕРІ РёР· Supabase (link_text) РЅР° СЂРµР°Р»СЊРЅС‹Рµ РёРјРµРЅР° С„Р°Р№Р»РѕРІ РІ R2
        // РћСЃРЅРѕРІР°РЅ РЅР° СЂРµР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С… РёР· SQL Р·Р°РїСЂРѕСЃР° Рё С„Р°Р№Р»Р°С… РІ Cloudflare R2 bucket abu-ic/files/
        // Р’РђР–РќРћ: РРјРµРЅР° С„Р°Р№Р»РѕРІ РґРѕР»Р¶РЅС‹ РўРћР§РќРћ СЃРѕРІРїР°РґР°С‚СЊ СЃ РёРјРµРЅР°РјРё РІ R2 (СЃ РїСЂРѕР±РµР»Р°РјРё, СЂРµРіРёСЃС‚СЂРѕРј, СЃРїРµС†СЃРёРјРІРѕР»Р°РјРё)
        // Р•СЃР»Рё С„Р°Р№Р»Р° РЅРµС‚ РІ R2, Р·РЅР°С‡РµРЅРёРµ = null (СЃСЃС‹Р»РєР° Р±СѓРґРµС‚ СЃРєСЂС‹С‚Р°)
        const nameMapping = {
            // РђР·РµСЂР±Р°Р№РґР¶Р°РЅ - С„Р°Р№Р»РѕРІ РЅРµС‚ РІ R2
            'Azerbaijan University of Languages': null,
            'Baku State University': null,
            
            // Р‘РѕР»РіР°СЂРёСЏ
            'Sofia University "St. Kliment Ohridski"': 'РЎРѕС„РёР№СЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РёРјРµРЅРё СЃРІСЏС‚РѕРіРѕ РљР»РёРјРµРЅС‚Р° РћС…СЂРёРґСЃРєРѕРіРѕ',
            'Technical University of Sofia': 'РўРµС…РЅРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РЎРѕС„РёСЏ',
            'Varna University of Management': 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РјРµРЅРµРґР¶РјРµРЅС‚Р° Р’Р°СЂРЅР° (РЈРњР’)',
            'University of Forestry': 'Р›РµСЃРѕС‚РµС…РЅРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            
            // Р’РµРЅРіСЂРёСЏ
            'University of Pannonia': 'University of Pannonia',
            
            // Р“РµСЂРјР°РЅРёСЏ - С„Р°Р№Р»РѕРІ РЅРµС‚ РІ R2
            'Fachhochschule des Mittelstands (FHM)': null,
            'University of Konstanz': null,
            
            // РРЅРґРёСЏ
            'Indian Institute of Technology Bombay': 'РРЅРґРёР№СЃРєРёР№ С‚РµС…РЅРѕР»РѕРіРёС‡РµСЃРєРёР№ РёРЅСЃС‚РёС‚СѓС‚ Р‘РѕРјР±РµР№',
            'English and Foreign Languages University': 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ Р°РЅРіР»РёР№СЃРєРѕРіРѕ Рё РёРЅРѕСЃС‚СЂР°РЅРЅС‹С… СЏР·С‹РєРѕРІ',
            
            // РСЃРїР°РЅРёСЏ - С„Р°Р№Р»Р° РЅРµС‚ РІ R2
            'University of Santiago de Compostela': null,
            
            // РС‚Р°Р»РёСЏ
            'Eurac Research': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'University NiccolГІ Cusano': 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РљР°СЃСЃРёРЅРѕ',
            
            // РљРёС‚Р°Р№ - С„Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Jilin Normal University': null,
            
            // РџРѕР»СЊС€Р°
            'University of Bialystok': 'Р‘РµР»РѕСЃС‚РѕРєСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            'Poznan University of Technology': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Eastern European University of Applied Sciences in Bialystok': 'Р‘РµР»СЊСЃРєРѕ-Р‘СЏР»СЊСЃРєР°СЏ С‚РµС…РЅРёС‡РµСЃРєРѕ-РіСѓРјР°РЅРёС‚Р°СЂРЅР°СЏ РђРєР°РґРµРјРёСЏ',
            
            // Р РѕСЃСЃРёСЏ
            'Saint Petersburg State Forest Technical University': 'Р›РµСЃРѕС‚РµС…РЅРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ - РЎРѕС„РёСЏ',
            'Saint Petersburg State University': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Kazan Federal University': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Innopolis University': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Nizhnevartovsk State University': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Kuban State University': 'Р¤Р“Р‘РћРЈ Р’Рћ РљСѓР±Р°РЅСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (РљСѓР±Р“РЈ)',
            'Kuzbass State Technical University': 'РљСѓР·Р±Р°СЃСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ С‚РµС…РЅРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РёРјРµРЅРё Рў. Р¤. Р“РѕСЂР±Р°С‡С‘РІР° (РљСѓР·Р“РўРЈ)',
            'Altai State University': 'РђР»С‚Р°Р№СЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (РђР“РЈ)',
            'Altai State Pedagogical University': 'Р¤Р“Р‘РћРЈ Р’Рћ РђР»С‚Р°Р№СЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ РїРµРґР°РіРѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            'Omsk State Pedagogical University': 'РћРјСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ Р°РіСЂР°СЂРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РёРјРµРЅРё Рџ. Рђ. РЎС‚РѕР»С‹РїРёРЅР° (РћРјСЃРєРёР№ Р“РђРЈ)',
            
            // РЎР»РѕРІР°РєРёСЏ - С„Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Constantine the Philosopher University in Nitra': null,
            
            // РўР°РґР¶РёРєРёСЃС‚Р°РЅ - С„Р°Р№Р»РѕРІ РЅРµС‚ РІ R2
            'Tajik State University of Commerce': null,
            'Technological University of Tajikistan': null,
            
            // РўСѓСЂРєРјРµРЅРёСЃС‚Р°РЅ - С„Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Turkmen State Institute of Economics and Management': null,
            
            // РўСѓСЂС†РёСЏ
            'Istanbul Aydin University': 'РЎС‚Р°РјР±СѓР»СЊСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РђР№РґС‹РЅ',
            'Pamukkale University': 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РџР°РјСѓРєРєР°Р»Рµ 2',
            'Yeditepe University': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Duzce University': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Ege University': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            
            // РЈР·Р±РµРєРёСЃС‚Р°РЅ
            'Management Development Institute of Tashkent (MDIS)': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Westminster International University in Tashkent (WIUT)': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Central Asian University (CAU)': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Branch of Moscow State University Named for M.V. Lomonosov in Tashkent': null, // Р¤Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Karakalpak State University named after Berdakh': 'РљР°СЂР°РєР°Р»РїР°РєСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РёРјРµРЅРё Р‘РµСЂРґР°С…Р°',
            
            // Р§РµСЂРЅРѕРіРѕСЂРёСЏ - С„Р°Р№Р»Р° РЅРµС‚ РІ R2
            'Adriatic University Bar': null,
            
            // РЁРІРµР№С†Р°СЂРёСЏ - С„Р°Р№Р»РѕРІ РЅРµС‚ РІ R2
            'Swiss School of Applied Sciences for Economics and Management': null,
            'Swiss International Business School': null,
            
            // ============================================
            // РќРћР’Р«Р• РЈРќРР’Р•Р РЎРРўР•РўР« РР— R2 (РґРѕР±Р°РІР»РµРЅС‹ С‡РµСЂРµР· SQL СЃРєСЂРёРїС‚)
            // ============================================
            
            // Р РѕСЃСЃРёСЏ - РЅРѕРІС‹Рµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С‹
            'Russian New University (RosNOU)': 'РђРІС‚РѕРЅРѕРјРЅР°СЏ РЅРµРєРѕРјРјРµСЂС‡РµСЃРєР°СЏ РѕСЂРіР°РЅРёР·Р°С†РёСЏ РІС‹СЃС€РµРіРѕ РѕР±СЂР°Р·РѕРІР°РЅРёСЏ Р РѕСЃСЃРёР№СЃРєРёР№ РЅРѕРІС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (Р РѕСЃРќРћРЈ)',
            'Moscow City Pedagogical University (MSPU)': 'Р“РѕСЃ.Р°РІС‚РѕРЅРѕРјРЅРѕРµ РѕР± СѓС‡ РІС‹СЃС€РµРіРѕ РѕР±СЂР°Р·РѕРІР°РЅРёСЏ РіРѕСЂРѕРґР° РњРѕСЃРєРІС‹ В«РњР“РџРЈВ»',
            'Kemerovo State University (KemSU)': 'РљРµРјРµСЂРѕРІСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (РљРµРјР“РЈ)',
            'College of Marketing, Management and Trade': 'РљРѕР»Р»РµРґР¶ РїРѕ РјР°СЂРєРµС‚РёРЅРіСѓ, РјРµРЅРµРґР¶РјРµРЅС‚Сѓ Рё С‚РѕСЂРіРѕРІР»Рµ',
            'National Research University "MEI"': 'РќР°С†РёРѕРЅР°Р»СЊРЅС‹Р№ РёСЃСЃР»РµРґРѕРІР°С‚РµР»СЊСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ В«РњР­РВ»',
            'Novosibirsk State University of Architecture and Civil Engineering (Sibstrin)': 'РќРѕРІРѕСЃРёР±РёСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅРѕ-СЃС‚СЂРѕРёС‚РµР»СЊРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (РЎРёР±СЃС‚СЂРёРЅ)',
            'North Caucasus Federal University (SKFU)': 'Р¤Р“РђРћРЈ Р’Рћ РЎРµРІРµСЂРѕ-РљР°РІРєР°Р·СЃРєРёР№ С„РµРґРµСЂР°Р»СЊРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚, РЎРљР¤РЈ',
            'Russian Presidential Academy of National Economy and Public Administration (RANEPA)': 'Р¤Р“Р‘РћРЈ Р’Рћ В«Р РѕСЃСЃРёР№СЃРєР°СЏ Р°РєР°РґРµРјРёСЏ РЅР°СЂРѕРґРЅРѕРіРѕ С…РѕР·СЏР№СЃС‚РІР° Рё РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅРѕР№ СЃР»СѓР¶Р±С‹ РїСЂРё РџСЂРµР·РёРґРµРЅС‚Рµ Р РѕСЃСЃРёР№СЃРєРѕР№ Р¤РµРґРµСЂР°С†РёРёВ» (Р РђРќРҐРёР“РЎ)',
            'Russian State University of Tourism and Service (RSUTS)': 'Р¤Р“Р‘РћРЈ Р’Рћ Р РѕСЃСЃРёР№СЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ С‚СѓСЂРёР·РјР° Рё СЃРµСЂРІРёСЃР° (Р Р“РЈРўРРЎ)',
            'Krasnoyarsk State Pedagogical University named after V.P. Astafyev': 'Р¤Р“Р‘РћРЈ Р’Рћ В«РљСЂР°СЃРЅРѕСЏСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ РїРµРґР°РіРѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РёРј. Р’.Рџ.РђСЃС‚Р°С„СЊРµРІР°В»',
            'Novosibirsk State University (NSU)': 'Р¤Р“Р‘РћРЈ Р’Рћ В«РќРѕРІРѕСЃРёР±РёСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚В» (РќР“РЈ)',
            'Yugra State University (YSU)': 'Р¤Р“Р‘РћРЈ Р’Рћ В«Р®РіРѕСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚В» (Р®Р“РЈ)',
            'Moscow State Technological University STANKIN': 'Р¤Р“Р‘РћРЈ Р’Рћ РњР“РўРЈ РњРѕСЃРєРѕРІСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ С‚РµС…РЅРѕР»РѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РЎРўРђРќРљРРќ',
            'Novosibirsk State Pedagogical University (NSPU)': 'Р¤Р“Р‘РћРЈ Р’Рћ РќРѕРІРѕСЃРёР±РёСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ РїРµРґР°РіРѕРіРёС‡РµСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (РќР“РџРЈ)',
            'Novosibirsk State University of Economics and Management (NINH)': 'Р¤Р“Р‘РћРЈ Р’Рћ РќРѕРІРѕСЃРёР±РёСЂСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ СЌРєРѕРЅРѕРјРёРєРё Рё СѓРїСЂР°РІР»РµРЅРёСЏ РќРРќРҐ',
            'Pskov State University': 'Р¤Р“Р‘РћРЈ Р’Рћ РџСЃРєРѕРІСЃРєРёР№ РіРѕСЃСѓРґР°СЂСЃС‚РІРµРЅРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            
            // Р‘РѕР»РіР°СЂРёСЏ - РЅРѕРІС‹Рµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С‹
            'Agricultural University of Plovdiv': 'РђРіСЂР°СЂРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ Рі.РџР»РѕРІРґРёРІ',
            'Varna Free University': 'Р’Р°СЂРЅРµРЅСЃРєРёР№ РЎРІРѕР±РѕРґРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            'New Bulgarian University': 'РќРѕРІС‹Р№ Р‘РѕР»РіР°СЂСЃРєРёР№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚',
            'University of European Centre for Peace and Development': 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ Р•РІСЂРѕРїРµР№СЃРєРѕРіРѕ С†РµРЅС‚СЂР° РјРёСЂР° Рё СЂР°Р·РІРёС‚РёСЏ',
            
            // РџРѕР»СЊС€Р° - РЅРѕРІС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚
            'University of Natural Sciences and Humanities in Siedlce': 'Р•СЃС‚РµСЃС‚РІРµРЅРЅРѕ-РіСѓРјР°РЅРёС‚Р°СЂРЅС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ РіРѕСЂРѕРґР° РЎРµРґР»СЊС†Рµ',
            
            // Р›Р°С‚РІРёСЏ - РЅРѕРІС‹Р№ СѓРЅРёРІРµСЂСЃРёС‚РµС‚ (РќРћР’РђРЇ РЎРўР РђРќРђ)
            'Rezekne Academy of Technologies (RTA)': 'Р РµР·РµРєРЅРµРЅСЃРєР°СЏ Р°РєР°РґРµРјРёСЏ С‚РµС…РЅРѕР»РѕРіРёР№ (RTA)',
            
            // РўСѓСЂС†РёСЏ - РЅРѕРІС‹Рµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚С‹
            'Ankara Haci Bayram Veli University': 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РђРЅРєР°СЂС‹ РҐР°С‡Рё Р‘Р°Р№СЂР°Рј Р’РµР»Рё',
            'Pantheon University': 'РЈРЅРёРІРµСЂСЃРёС‚РµС‚ РџР°РЅС‚РµРѕРЅ',
        };
        
        // РџСЂРѕРІРµСЂСЏРµРј РјР°РїРїРёРЅРі
        let fileName = nameMapping[universityName];
        
        // Р•СЃР»Рё РјР°РїРїРёРЅРіР° РЅРµС‚ РІ РѕР±СЉРµРєС‚Рµ - С„Р°Р№Р»Р° РЅРµС‚ РІ R2, РІРѕР·РІСЂР°С‰Р°РµРј null
        if (fileName === undefined) {
            return null;
        }
        
        // Р•СЃР»Рё РјР°РїРїРёРЅРі РµСЃС‚СЊ, РЅРѕ Р·РЅР°С‡РµРЅРёРµ null - С„Р°Р№Р»Р° РЅРµС‚ РІ R2, РІРѕР·РІСЂР°С‰Р°РµРј null
        if (fileName === null) {
            return null;
        }
        
        // РћС‡РёС‰Р°РµРј Рё РЅРѕСЂРјР°Р»РёР·СѓРµРј РЅР°Р·РІР°РЅРёРµ (СѓР±РёСЂР°РµРј С‚РѕР»СЊРєРѕ РєР°РІС‹С‡РєРё, РЅРѕ СЃРѕС…СЂР°РЅСЏРµРј РїСЂРѕР±РµР»С‹ Рё СЃРїРµС†СЃРёРјРІРѕР»С‹)
        fileName = fileName
            .replace(/"/g, '') // РЈР±РёСЂР°РµРј РґРІРѕР№РЅС‹Рµ РєР°РІС‹С‡РєРё
            .replace(/'/g, '') // РЈР±РёСЂР°РµРј РѕРґРёРЅР°СЂРЅС‹Рµ РєР°РІС‹С‡РєРё
            .trim();
        
        // РљРѕРґРёСЂСѓРµРј РґР»СЏ URL (СЃРѕС…СЂР°РЅСЏРµРј РѕСЂРёРіРёРЅР°Р»СЊРЅРѕРµ РЅР°Р·РІР°РЅРёРµ СЃ РїСЂРѕР±РµР»Р°РјРё Рё СЃРїРµС†СЃРёРјРІРѕР»Р°РјРё)
        const encodedFileName = encodeURIComponent(fileName);
        
        // РЎС‚СЂРѕРёРј URL: base/files/РЅР°Р·РІР°РЅРёРµ.pdf
        const pdfUrl = `${r2Base}/files/${encodedFileName}.pdf`;
        
        
        return pdfUrl;
    }

    function getDocumentUrl(record) {
        // Для данных из our_partners используем прямые ссылки
        if (record.pdf_file_url && record.section !== 'appendices') {
            return record.pdf_file_url;
        }
        
        // Для appendices выбираем PDF в зависимости от языка
        if (record.section === 'appendices' && record.page_slug === 'Students.html') {
            const currentLang = localStorage.getItem('selectedLanguage') || 'RU';
            const langMap = { 'RU': 'ru', 'KZ': 'kz', 'EN': 'en' };
            const targetLang = langMap[currentLang] || 'ru';
            
            // Сначала проверяем, есть ли уже правильный URL в document.file_url
            const doc = record.document || {};
            if (doc.file_url && doc.url) {
                // Если file_url уже установлен правильно (в зависимости от языка), используем его
                if (targetLang === 'kz' && doc.file_url.includes('Kazakh-language')) {
                    return doc.file_url;
                }
                if (targetLang !== 'kz' && doc.file_url.includes('Russian-language')) {
                    return doc.file_url;
                }
            }
            
            // Для казахского языка используем казахскую версию PDF, если она есть
            if (targetLang === 'kz' && record.pdf_file_url_kz) {
                console.log('[getDocumentUrl] Используем казахский PDF:', record.pdf_file_url_kz);
                return record.pdf_file_url_kz;
            }
            // Для русского и английского используем русскую версию
            if (record.pdf_file_url) {
                return record.pdf_file_url;
            }
        }
        
        const doc = record.document || {};
        
        // РџР РРћР РРўР•Рў 1: РСЃРїРѕР»СЊР·СѓРµРј file_url РЅР°РїСЂСЏРјСѓСЋ, РµСЃР»Рё РѕРЅ РІР°Р»РёРґРЅС‹Р№ URL (РЅРµ SEO-СЃСЃС‹Р»РєР°)
        // Р­С‚Рѕ СЂР°Р±РѕС‚Р°РµС‚ Р'Р•Р— r2Base, С‚Р°Рє РєР°Рє СЌС‚Рѕ РїРѕР»РЅС‹Р№ URL РёР· Supabase
        const fileUrl = doc.file_url || record.pdf_file_url || '';
        const isSeoUrl = fileUrl && fileUrl.includes('partner.university');
        
        // Р•СЃР»Рё file_url - СЌС‚Рѕ СЂРµР°Р»СЊРЅС‹Р№ URL (РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ http/https Рё РЅРµ SEO-СЃСЃС‹Р»РєР°), РёСЃРїРѕР»СЊР·СѓРµРј РµРіРѕ
        if (fileUrl && !isSeoUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
            return fileUrl;
        }
        
        // РўРµРїРµСЂСЊ РїРѕР»СѓС‡Р°РµРј r2Base С‚РѕР»СЊРєРѕ РµСЃР»Рё РЅСѓР¶РµРЅ РґР»СЏ РїРѕСЃС‚СЂРѕРµРЅРёСЏ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹С… РїСѓС‚РµР№
        const r2Base = getR2PublicBase();
        
        // Р”РµС‚Р°Р»СЊРЅРѕРµ Р»РѕРіРёСЂРѕРІР°РЅРёРµ РґР»СЏ РѕС‚Р»Р°РґРєРё
        if (!r2Base && fileUrl) {
            console.warn('[getDocumentUrl] R2_PUBLIC_BASE РЅРµ РЅР°СЃС‚СЂРѕРµРЅ!');
            console.warn('[getDocumentUrl] window.R2_CONFIG:', window.R2_CONFIG);
            console.warn('[getDocumentUrl] fileUrl:', fileUrl);
            console.warn('[getDocumentUrl] record:', record);
        }
        
        // РџР РРћР РРўР•Рў 1.5: Р•СЃР»Рё file_url - РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Р№ РїСѓС‚СЊ, СЃС‚СЂРѕРёРј РїРѕР»РЅС‹Р№ URL РёР· R2 base
        if (fileUrl && !isSeoUrl && !fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
            if (!r2Base) {
                console.warn('[getDocumentUrl] R2_PUBLIC_BASE РЅРµ РЅР°СЃС‚СЂРѕРµРЅ РґР»СЏ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕРіРѕ РїСѓС‚Рё:', fileUrl);
                return null;
            }
            // РЈР±РёСЂР°РµРј РІРµРґСѓС‰РёР№ СЃР»СЌС€, РµСЃР»Рё РµСЃС‚СЊ
            const cleanPath = fileUrl.replace(/^\//, '');
            const fullUrl = `${r2Base}/${cleanPath}`;
            return fullUrl;
        }
        
        // РџР РРћР РРўР•Рў 2: РџСЂРѕРІРµСЂСЏРµРј metadata РЅР° РЅР°Р»РёС‡РёРµ РїСЂСЏРјРѕРіРѕ PDF URL
        const metadata = doc.metadata || {};
        let url = metadata.pdf_url || metadata.document_url || metadata.file_url || '';
        
        // Р•СЃР»Рё РІ metadata РµСЃС‚СЊ РІР°Р»РёРґРЅС‹Р№ URL (РЅРµ SEO-СЃСЃС‹Р»РєР°), РёСЃРїРѕР»СЊР·СѓРµРј РµРіРѕ
        if (url && !url.includes('partner.university') && (url.startsWith('http://') || url.startsWith('https://'))) {
            return url;
        }
        
        // РџР РРћР РРўР•Рў 2.5: Р•СЃР»Рё РІ metadata РµСЃС‚СЊ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Р№ РїСѓС‚СЊ, СЃС‚СЂРѕРёРј РїРѕР»РЅС‹Р№ URL
        if (url && !url.includes('partner.university') && !url.startsWith('http://') && !url.startsWith('https://')) {
            if (!r2Base) {
                console.warn('[getDocumentUrl] R2_PUBLIC_BASE РЅРµ РЅР°СЃС‚СЂРѕРµРЅ РґР»СЏ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕРіРѕ РїСѓС‚Рё РІ metadata:', url);
                return null;
            }
            const cleanPath = url.replace(/^\//, '');
            const fullUrl = `${r2Base}/${cleanPath}`;
            return fullUrl;
        }
        
        // РџР РРћР РРўР•Рў 3: РЎС‚СЂРѕРёРј URL РёР· РЅР°Р·РІР°РЅРёСЏ СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р° С‡РµСЂРµР· РјР°РїРїРёРЅРі (С‚РѕР»СЊРєРѕ РґР»СЏ РїР°СЂС‚РЅРµСЂРѕРІ)
        if (!url || url === '#') {
            // РЎС‚СЂРѕРёРј URL РёР· РЅР°Р·РІР°РЅРёСЏ СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р° С‚РѕР»СЊРєРѕ РµСЃР»Рё СЌС‚Рѕ РЅРµ РїСЂРёР»РѕР¶РµРЅРёРµ
            if (record.section !== 'appendices') {
                const universityName = record.link_text || doc.title || doc.file_name || '';
                if (universityName) {
                    url = buildPdfUrlFromName(universityName);
                }
            }
        }
        
        // РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ URL РІР°Р»РёРґРЅС‹Р№:
        // 1. РќРµ РїСѓСЃС‚РѕР№ Рё РЅРµ '#'
        // 2. РќРµ SEO-СЃСЃС‹Р»РєР° (partner.university)
        if (!url || url === '#' || url.includes('partner.university')) {
            return null; // Р’РѕР·РІСЂР°С‰Р°РµРј null, С‡С‚РѕР±С‹ СЃРєСЂС‹С‚СЊ СЃСЃС‹Р»РєСѓ
        }
        
        // Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅР°СЏ РїСЂРѕРІРµСЂРєР°: РµСЃР»Рё URL РЅРµ СЃРѕРґРµСЂР¶РёС‚ .pdf Рё РЅРµ РёР· R2, СЌС‚Рѕ РјРѕР¶РµС‚ Р±С‹С‚СЊ РЅРµРїСЂР°РІРёР»СЊРЅС‹Р№ URL
        const isPdf = url.toLowerCase().includes('.pdf');
        const isR2Url = url.includes('pub-') && url.includes('.r2.dev');
        const isCloudflareUrl = url.includes('cloudflare') || url.includes('r2.dev');
        
        // Р•СЃР»Рё СЌС‚Рѕ РЅРµ PDF Рё РЅРµ Cloudflare URL, РІРѕР·РјРѕР¶РЅРѕ СЌС‚Рѕ РЅРµРїСЂР°РІРёР»СЊРЅС‹Р№ URL
        // РќРѕ РѕСЃС‚Р°РІР»СЏРµРј РµРіРѕ, РµСЃР»Рё РѕРЅ РІР°Р»РёРґРЅС‹Р№ HTTP/HTTPS URL
        if (!isPdf && !isR2Url && !isCloudflareUrl) {
            // РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ СЌС‚Рѕ РІР°Р»РёРґРЅС‹Р№ HTTP/HTTPS URL
            try {
                const urlObj = new URL(url);
                if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                    return null;
                }
            } catch (e) {
                // РќРµРІР°Р»РёРґРЅС‹Р№ URL
                return null;
            }
        }
        
        return url;
    }

    function resolveAssetUrl(metadata = {}) {
        const directUrl = metadata.card_image_url || metadata.flag_image_url;
        if (directUrl) return directUrl;
        const key = metadata.card_image_key || metadata.flag_image_key;
        if (key) {
            // РџРѕР»СѓС‡Р°РµРј R2_PUBLIC_BASE РґРёРЅР°РјРёС‡РµСЃРєРё РЅР° СЃР»СѓС‡Р°Р№, РµСЃР»Рё r2-config.js Р·Р°РіСЂСѓР·РёР»СЃСЏ РїРѕР·Р¶Рµ
            const r2Base = (window.R2_CONFIG?.PUBLIC_URL || R2_PUBLIC_BASE || '').replace(/\/$/, '');
            if (r2Base) {
                const cleanKey = key.replace(/^\/+/, '');
                const encoded = cleanKey.split('/').map(encodeURIComponent).join('/');
                return `${r2Base}/${encoded}`;
            }
        }
        return '';
    }

    function detectLanguage(text) {
        if (!text) return 'ru';
        // РџСЂРѕСЃС‚Р°СЏ СЌРІСЂРёСЃС‚РёРєР° РґР»СЏ РѕРїСЂРµРґРµР»РµРЅРёСЏ СЏР·С‹РєР°
        // РљР°Р·Р°С…СЃРєРёР№: СЃРѕРґРµСЂР¶РёС‚ СЃРїРµС†РёС„РёС‡РµСЃРєРёРµ РєР°Р·Р°С…СЃРєРёРµ СЃРёРјРІРѕР»С‹
        const kazakhPattern = /[әғқңөұүіһӘҒҚҢӨҰҮІҺ]/;
        if (kazakhPattern.test(text)) return 'kz';
        // Р СѓСЃСЃРєРёР№: СЃРѕРґРµСЂР¶РёС‚ РєРёСЂРёР»Р»РёС†Сѓ
        const russianPattern = /[а-яёА-ЯЁ]/;
        if (russianPattern.test(text)) return 'ru';
        // РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ Р°РЅРіР»РёР№СЃРєРёР№
        return 'en';
    }

    function renderList(container, items, options = {}) {
        const isCardMode = container.dataset.mode === 'cards';
        if (!isCardMode) {
            container.innerHTML = '';
        }
        const linkClass = options.linkClass || '';

        // Р”РµРґСѓРїР»РёРєР°С†РёСЏ: СѓР±РёСЂР°РµРј РґСѓР±Р»РёРєР°С‚С‹ РїРѕ document_id (СЃР°РјС‹Р№ РЅР°РґРµР¶РЅС‹Р№ СЃРїРѕСЃРѕР±)
        const seen = new Set();
        const uniqueItems = items.filter((item) => {
            const doc = item.document || {};
            // РСЃРїРѕР»СЊР·СѓРµРј document_id РєР°Рє РѕСЃРЅРѕРІРЅРѕР№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ (СѓРЅРёРєР°Р»СЊРЅС‹Р№ РІ Р‘Р”)
            // Р•СЃР»Рё РµРіРѕ РЅРµС‚, РёСЃРїРѕР»СЊР·СѓРµРј РєРѕРјР±РёРЅР°С†РёСЋ document_id + section РґР»СЏ appendices
            const docId = doc.id || item.document_id;
            const section = item.section || '';
            
            // Р”Р»СЏ appendices РёСЃРїРѕР»СЊР·СѓРµРј РєРѕРјР±РёРЅР°С†РёСЋ document_id + section, С‡С‚РѕР±С‹ СЂР°Р·Р»РёС‡Р°С‚СЊ СЏР·С‹РєРѕРІС‹Рµ РІРµСЂСЃРёРё
            const identifier = docId ? (section === 'appendices' ? `${docId}_${section}` : docId) : null;
            
            // Р•СЃР»Рё РЅРµС‚ document_id, РёСЃРїРѕР»СЊР·СѓРµРј fallback РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂС‹
            const fallbackId = doc.file_key || doc.file_name || item.id || item.link_text;
            const finalIdentifier = identifier || fallbackId;
            
            if (!finalIdentifier) {
                console.warn('[renderList] Р­Р»РµРјРµРЅС‚ Р±РµР· РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂР°:', item);
                return true; // Р•СЃР»Рё РЅРµС‚ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂР°, РѕСЃС‚Р°РІР»СЏРµРј (РЅРѕ Р»РѕРіРёСЂСѓРµРј)
            }
            
            if (seen.has(finalIdentifier)) {
                return false; // Р”СѓР±Р»РёРєР°С‚
            }
            
            seen.add(finalIdentifier);
            return true;
        });
        
        // Дедупликация выполнена

        uniqueItems.forEach((item) => {
            if (isCardMode) return;

            const li = document.createElement('li');
            const anchor = document.createElement('a');
            const url = getDocumentUrl(item);
            let displayName = getDisplayName(item);
            const detectedLang = detectLanguage(displayName);

            // Р•СЃР»Рё URL РЅРµ РЅР°Р№РґРµРЅ, СЃРєСЂС‹РІР°РµРј СЃСЃС‹Р»РєСѓ РёР»Рё РґРµР»Р°РµРј РµС‘ РЅРµР°РєС‚РёРІРЅРѕР№
            if (!url || url === '#') {
                console.warn('[renderList] URL РЅРµ РЅР°Р№РґРµРЅ РґР»СЏ:', displayName, item);
                anchor.href = '#';
                anchor.style.pointerEvents = 'none';
                anchor.style.opacity = '0.6';
                anchor.style.cursor = 'default';
                anchor.title = 'PDF РЅРµРґРѕСЃС‚СѓРїРµРЅ';
            } else {
                anchor.href = url;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                anchor.title = `РћС‚РєСЂС‹С‚СЊ PDF: ${displayName}`;
                // РЈР±РµР¶РґР°РµРјСЃСЏ, С‡С‚Рѕ СЃСЃС‹Р»РєР° РєР»РёРєР°Р±РµР»СЊРЅР°
                anchor.style.pointerEvents = 'auto';
                anchor.style.cursor = 'pointer';
                
                // Добавляем специальный класс для appendices, чтобы они выглядели кликабельными
                if (item.section === 'appendices') {
                    anchor.classList.add('appendices-link');
                }
            }
            if (linkClass) anchor.classList.add(...linkClass.split(' '));

            // Р”РѕР±Р°РІР»СЏРµРј СЏР·С‹РєРѕРІС‹Рµ Р°С‚СЂРёР±СѓС‚С‹ РґР»СЏ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ СЏР·С‹РєР°
            // Р”Р»СЏ Р°РЅРіР»РёР№СЃРєРѕРіРѕ РёСЃРїРѕР»СЊР·СѓРµРј Р°РЅРіР»РёР№СЃРєРёРµ РЅР°Р·РІР°РЅРёСЏ, РЅРѕ С„Р°Р№Р»С‹ РѕСЃС‚Р°СЋС‚СЃСЏ СЂСѓСЃСЃРєРёРµ
            const originalText = item.link_text || displayName;
            let enText = displayName;
            
            if (item.section === 'appendices') {
                // Для appendices получаем английское название для data-en атрибута
                const originalText = item.link_text || displayName;
                const appendixMatch = originalText.match(/(?:Приложение|Appendix)\s+(\d+)/i);
                if (appendixMatch) {
                    const appendixNum = parseInt(appendixMatch[1], 10);
                    const englishNames = {
                        1: 'Appendix 1 Application for Participation in the Competition - at Own Expense',
                        2: 'Appendix 2 Application for Participation in the Competition - Grant from the Ministry of Education and Science of the Republic of Kazakhstan',
                        3: 'Appendix 3 Application for Departure',
                        4: 'Appendix 4 Parental Consent for Departure',
                        5: 'Appendix 5 Application form for traveling abroad',
                        6: 'Appendix 6 Disciplinary Receipt',
                        7: 'Appendix 7 Receipt of Obligation to Return the Grant Amount',
                        8: 'Appendix 8 Receipt of Information on Financial Conditions',
                        9: 'Appendix 9 Application Form',
                        10: 'Appendix 10 Learning Agreement',
                        11: 'Appendix 11 Application for Additional Educational Training',
                        12: 'Appendix 12 Receipt of Document Submission'
                    };
                    if (englishNames[appendixNum]) {
                        enText = englishNames[appendixNum];
                    }
                }
                // displayName уже правильный (зависит от текущего языка благодаря getDisplayName)
            }
            
            // Устанавливаем правильные названия для каждого языка
            // Для appendices используем сохраненные названия из данных
            if (item.section === 'appendices' && item.title_ru) {
                anchor.setAttribute('data-ru', item.title_ru);
                anchor.setAttribute('data-kz', item.title_kz || item.title_ru);
                anchor.setAttribute('data-en', item.title_en || item.title_ru);
            } else {
                // Для других разделов используем текущее отображаемое название
                anchor.setAttribute('data-ru', displayName);
                anchor.setAttribute('data-kz', displayName);
                anchor.setAttribute('data-en', enText);
            }
            anchor.setAttribute('data-lang', detectedLang);

            const textSpan = document.createElement('span');
            textSpan.innerHTML = escapeHtml(displayName);
            anchor.appendChild(textSpan);

            li.appendChild(anchor);

            if (item.usage_text) {
                const description = document.createElement('p');
                description.className = 'document-description';
                description.textContent = item.usage_text;
                li.appendChild(description);
            }

            container.appendChild(li);
        });

        if (isCardMode) {
            hydrateCards(container, items);
        }
    }

    function renderEmpty(container, message = 'Документы не найдены.') {
        container.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'doc-empty';
        li.textContent = message;
        container.appendChild(li);
    }

    function renderWithTemplate(container, items, templateId) {
        const template = document.getElementById(templateId);
        if (!template) {
            console.warn(`РЁР°Р±Р»РѕРЅ СЃ id "${templateId}" РЅРµ РЅР°Р№РґРµРЅ. РСЃРїРѕР»СЊР·СѓРµРј СЃС‚Р°РЅРґР°СЂС‚РЅС‹Р№ РІС‹РІРѕРґ.`);
            renderList(container, items, { linkClass: container.dataset.linkClass || '' });
            return;
        }

        const linkClass = container.dataset.linkClass || '';
        const templateHtml = template.innerHTML;
        container.innerHTML = '';

        items.forEach((item) => {
            const url = getDocumentUrl(item);
            const context = {
                url,
                link_text: item.link_text || getDisplayName(item),
                display_name: getDisplayName(item),
                usage_text: item.usage_text || '',
                page_slug: item.page_slug,
                section: item.section,
                country: item.country,
                document: item.document || {},
                metadata: item.metadata || item.document?.metadata || {},
            };

            let html = templateHtml.replace(/{{\s*([^}]+)\s*}}/g, (_, token) => {
                const value = resolvePath(token.trim(), context);
                return escapeHtml(String(value ?? ''));
            });

            const temp = document.createElement('div');
            temp.innerHTML = html.trim();
            const fragment = document.createDocumentFragment();
            Array.from(temp.childNodes).forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (linkClass && node.matches('a')) {
                        node.classList.add(...linkClass.split(' '));
                    }
                    fragment.appendChild(node);
                }
            });
            container.appendChild(fragment);
        });
    }

    function normalizeCountryName(value = '') {
        return value ? value.trim().toLocaleLowerCase('ru-RU') : '';
    }

    function normalizeDocumentKey(record) {
        const doc = record?.document || {};
        const key = doc.file_key || doc.file_name || '';
        return key ? key.toLowerCase() : '';
    }

    function findPartnerCountryLists(container) {
        const map = new Map();
        container.querySelectorAll('.country-card[data-country]').forEach((card) => {
            const countryAttr = card.getAttribute('data-country') || card.querySelector('h3')?.textContent || '';
            const key = normalizeCountryName(countryAttr);
            if (!key) return;
            const list = card.querySelector('[data-country-list]');
            if (!list) return;
            map.set(key, { card, list });
        });
        return map;
    }

    function hydrateCards(container, items) {
        const cards = new Map();
        const orderedCards = [];
        container.querySelectorAll('[data-document-card]').forEach((card) => {
            const rawKey = card.getAttribute('data-document-card') || '';
            const key = rawKey.trim();
            orderedCards.push(card);
            if (key) {
                cards.set(key, card);
                cards.set(key.toLowerCase(), card);
            }
        });

        const takeCard = (key) => {
            if (key) {
                const trimmed = key.trim();
                if (cards.has(trimmed)) {
                    const card = cards.get(trimmed);
                    const index = orderedCards.indexOf(card);
                    if (index !== -1) orderedCards.splice(index, 1);
                    return card;
                }
                if (cards.has(trimmed.toLowerCase())) {
                    const card = cards.get(trimmed.toLowerCase());
                    const index = orderedCards.indexOf(card);
                    if (index !== -1) orderedCards.splice(index, 1);
                    return card;
                }
            }
            return orderedCards.length ? orderedCards.shift() : null;
        };

        items.forEach((item) => {
            const rawKey = item.card_key
                || item.document?.metadata?.card_key
                || item.section
                || item.document_id
                || item.id;
            const card = takeCard(rawKey ? String(rawKey) : '');
            if (!card) return;

            card.classList.remove('document-missing');
            card.removeAttribute('hidden');

            const stableKey = rawKey || item.section || item.document_id || item.id;
            if (stableKey) {
                card.setAttribute('data-document-card', String(stableKey));
            }

            const title = card.querySelector('[data-document-title]');
            if (title) {
                title.textContent = item.link_text || getDisplayName(item);
            }

            const description = card.querySelector('[data-document-description]');
            if (description) {
                if (item.usage_text) {
                    description.textContent = item.usage_text;
                    description.removeAttribute('hidden');
                } else {
                    description.textContent = '';
                    description.setAttribute('hidden', 'hidden');
                }
            }

            const action = card.querySelector('[data-document-action]');
            if (action) {
                const url = getDocumentUrl(item);
                if (url && url !== '#' && !url.includes('partner.university')) {
                    action.setAttribute('href', url);
                    action.target = '_blank';
                    action.rel = 'noopener';
                    action.classList.remove('hidden');
                    action.removeAttribute('hidden');
                } else {
                    action.setAttribute('hidden', 'hidden');
                    action.classList.add('hidden');
                }
            }

            const image = card.querySelector('[data-document-image]');
            if (image) {
                const metadata = item.document?.metadata || {};
                const imgUrl = resolveAssetUrl(metadata);
                if (imgUrl) {
                    image.setAttribute('src', imgUrl);
                }
            }
        });
    }

    function createPartnerCard(container, countryName) {
        const displayName = (countryName || '').trim();
        if (!displayName) return null;

        const card = document.createElement('div');
        card.className = 'country-card generated-country';
        card.dataset.country = displayName;

        const title = document.createElement('h3');
        const translatedCountry = getCountryName(displayName);
        title.textContent = translatedCountry;
        // Р”РѕР±Р°РІР»СЏРµРј СЏР·С‹РєРѕРІС‹Рµ Р°С‚СЂРёР±СѓС‚С‹ РґР»СЏ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ СЏР·С‹РєР°
        const countryTrans = COUNTRY_TRANSLATIONS[displayName] || {};
        title.setAttribute('data-ru', countryTrans.ru || displayName);
        title.setAttribute('data-kz', countryTrans.kz || displayName);
        title.setAttribute('data-en', countryTrans.en || displayName);

        const button = document.createElement('button');
        button.className = 'toggle-btn';
        button.type = 'button';
        // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј С‚РµРєСЃС‚ РєРЅРѕРїРєРё РЅР° РѕСЃРЅРѕРІРµ С‚РµРєСѓС‰РµРіРѕ СЏР·С‹РєР°
        const currentLangBtn = localStorage.getItem('selectedLanguage') || 'RU';
        const langKeyBtn = currentLangBtn.toLowerCase() === 'kz' ? 'kz' : (currentLangBtn.toLowerCase() === 'en' ? 'en' : 'ru');
        const buttonTexts = {
            ru: 'Список университетов',
            kz: 'Университеттер тізімі',
            en: 'List of universities'
        };
        button.textContent = buttonTexts[langKeyBtn];
        button.dataset.generated = 'true';
        // Добавляем языковые атрибуты для кнопки
        button.setAttribute('data-ru', 'Список университетов');
        button.setAttribute('data-kz', 'Университеттер тізімі');
        button.setAttribute('data-en', 'List of universities');
        button.addEventListener('click', () => {
            if (typeof window.toggleUniversities === 'function') {
                window.toggleUniversities(button);
            } else {
                const list = button.nextElementSibling;
                if (list) list.classList.toggle('hidden');
            }
        });

        const listWrapper = document.createElement('div');
        listWrapper.className = 'university-list hidden';

        const strong = document.createElement('strong');
        const currentLang = localStorage.getItem('selectedLanguage') || 'RU';
        const langKey = currentLang.toLowerCase() === 'kz' ? 'kz' : (currentLang.toLowerCase() === 'en' ? 'en' : 'ru');
        const translatedCountryName = getCountryName(displayName);
        const listTitleText = {
            ru: `Список университетов - ${displayName}`,
            kz: `Университеттер тізімі - ${displayName}`,
            en: `List of universities - ${translatedCountryName}`
        };
        strong.textContent = listTitleText[langKey];
        // Добавляем языковые атрибуты
        strong.setAttribute('data-ru', `Список университетов - ${displayName}`);
        strong.setAttribute('data-kz', `Университеттер тізімі - ${displayName}`);
        strong.setAttribute('data-en', `List of universities - ${translatedCountryName}`);

        const list = document.createElement('ul');
        list.setAttribute('data-country-list', '');

        listWrapper.append(strong, list);
        card.append(title, button, listWrapper);

        const emptyState = container.querySelector('[data-empty-state]');
        if (emptyState) {
            container.insertBefore(card, emptyState);
        } else {
            container.appendChild(card);
        }

        return { card, list };
    }

    function appendPartnerRecords(container, records, markUsed) {
        if (!Array.isArray(records) || !records.length) return;

        const listsMap = findPartnerCountryLists(container);
        const emptyState = container.querySelector('[data-empty-state]');

        records.slice().forEach((record) => {
            const countryName = (record?.country || '').trim();
            if (!countryName) return;

            const normalizedCountry = normalizeCountryName(countryName);
            if (!normalizedCountry) return;

            let entry = listsMap.get(normalizedCountry);
            if (!entry) {
                entry = createPartnerCard(container, countryName);
                if (!entry) return;
                listsMap.set(normalizedCountry, entry);
            }

            const { list } = entry;
            if (!list) return;

            const documentKey = normalizeDocumentKey(record);
            const duplicate = Array.from(list.querySelectorAll('a')).some((anchor) => {
                const anchorKey = (anchor.dataset.documentKey || anchor.dataset.generatedKey || anchor.textContent || '').toLowerCase();
                return documentKey && anchorKey && anchorKey === documentKey;
            });
            if (duplicate) {
                markUsed(record);
                return;
            }

            const item = document.createElement('li');
            const pdfUrl = getDocumentUrl(record);
            
            // РџРѕР»СѓС‡Р°РµРј РЅР°Р·РІР°РЅРёРµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р° РЅР° С‚РµРєСѓС‰РµРј СЏР·С‹РєРµ
            const universityName = getDisplayName(record);
            const metadata = record.document?.metadata || {};
            
            // РџРѕР»СѓС‡Р°РµРј URL РѕС„РёС†РёР°Р»СЊРЅРѕРіРѕ СЃР°Р№С‚Р° СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р° РёР· metadata
            const websiteUrl = metadata.university_url || metadata.website_url || '';
            
            
            // Р•СЃР»Рё PDF URL РЅРµ РЅР°Р№РґРµРЅ, СЃРѕР·РґР°РµРј span РІРјРµСЃС‚Рѕ СЃСЃС‹Р»РєРё
            if (!pdfUrl) {
                const span = document.createElement('span');
                span.textContent = universityName;
                // Р•СЃР»Рё РµСЃС‚СЊ website_url, РґРµР»Р°РµРј РЅР°Р·РІР°РЅРёРµ Р±РѕР»РµРµ Р·Р°РјРµС‚РЅС‹Рј
                if (websiteUrl && websiteUrl.trim()) {
                    span.className = 'university-name-no-pdf';
                    span.style.opacity = '1';
                } else {
                    span.style.opacity = '0.6';
                }
                span.style.cursor = 'default';
                span.dataset.generated = 'true';
                // Р”РѕР±Р°РІР»СЏРµРј СЏР·С‹РєРѕРІС‹Рµ Р°С‚СЂРёР±СѓС‚С‹ РґР»СЏ span (СѓРЅРёРІРµСЂСЃРёС‚РµС‚ Р±РµР· PDF)
                // РСЃРїРѕР»СЊР·СѓРµРј РїРµСЂРµРІРѕРґС‹ РёР· metadata, РµСЃР»Рё РѕРЅРё РµСЃС‚СЊ, РёРЅР°С‡Рµ РёР· РјР°РїРїРёРЅРіР°
                const englishName = record.link_text || record.document?.file_name || '';
                const translation = UNIVERSITY_TRANSLATIONS[englishName];
                
                if (metadata.link_text_ru) {
                    span.setAttribute('data-ru', metadata.link_text_ru);
                } else if (translation) {
                    span.setAttribute('data-ru', translation.ru);
                } else if (record.link_text) {
                    span.setAttribute('data-ru', record.link_text);
                }
                
                if (metadata.link_text_kz) {
                    span.setAttribute('data-kz', metadata.link_text_kz);
                } else if (translation) {
                    span.setAttribute('data-kz', translation.kz);
                } else if (record.link_text) {
                    span.setAttribute('data-kz', record.link_text);
                }
                
                if (metadata.link_text_en) {
                    span.setAttribute('data-en', metadata.link_text_en);
                } else if (translation) {
                    span.setAttribute('data-en', translation.en);
                } else if (record.link_text) {
                    span.setAttribute('data-en', record.link_text);
                }
                
                if (record.document?.file_key) {
                    span.dataset.documentKey = record.document.file_key;
                } else if (record.document?.file_name) {
                    span.dataset.documentKey = record.document.file_name;
                } else if (documentKey) {
                    span.dataset.generatedKey = documentKey;
                }
                item.appendChild(span);
            } else {
                const anchor = document.createElement('a');
                anchor.href = pdfUrl;
                anchor.target = '_blank';
                anchor.rel = 'noopener';
                anchor.textContent = universityName;
                anchor.dataset.generated = 'true';
                // Р”РѕР±Р°РІР»СЏРµРј СЏР·С‹РєРѕРІС‹Рµ Р°С‚СЂРёР±СѓС‚С‹ РґР»СЏ СЃСЃС‹Р»РєРё СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р°
                // РСЃРїРѕР»СЊР·СѓРµРј РїРµСЂРµРІРѕРґС‹ РёР· metadata, РµСЃР»Рё РѕРЅРё РµСЃС‚СЊ, РёРЅР°С‡Рµ РёР· РјР°РїРїРёРЅРіР°
                const englishName = record.link_text || record.document?.file_name || '';
                const translation = UNIVERSITY_TRANSLATIONS[englishName];
                
                if (metadata.link_text_ru) {
                    anchor.setAttribute('data-ru', metadata.link_text_ru);
                } else if (translation) {
                    anchor.setAttribute('data-ru', translation.ru);
                } else if (record.link_text) {
                    anchor.setAttribute('data-ru', record.link_text);
                }
                
                if (metadata.link_text_kz) {
                    anchor.setAttribute('data-kz', metadata.link_text_kz);
                } else if (translation) {
                    anchor.setAttribute('data-kz', translation.kz);
                } else if (record.link_text) {
                    anchor.setAttribute('data-kz', record.link_text);
                }
                
                if (metadata.link_text_en) {
                    anchor.setAttribute('data-en', metadata.link_text_en);
                } else if (translation) {
                    anchor.setAttribute('data-en', translation.en);
                } else if (record.link_text) {
                    anchor.setAttribute('data-en', record.link_text);
                }
                // РЈР±РµР¶РґР°РµРјСЃСЏ, С‡С‚Рѕ СЌС‚Рѕ PDF С„Р°Р№Р»
                if (pdfUrl.toLowerCase().endsWith('.pdf') || pdfUrl.includes('.pdf')) {
                    anchor.setAttribute('type', 'application/pdf');
                }
                if (record.document?.file_key) {
                    anchor.dataset.documentKey = record.document.file_key;
                } else if (record.document?.file_name) {
                    anchor.dataset.documentKey = record.document.file_name;
                } else if (documentKey) {
                    anchor.dataset.generatedKey = documentKey;
                }
                item.appendChild(anchor);
            }
            
            // Р”РѕР±Р°РІР»СЏРµРј РєРЅРѕРїРєСѓ "РџРѕСЃРµС‚РёС‚СЊ СЃР°Р№С‚", РµСЃР»Рё РµСЃС‚СЊ website_url
            if (websiteUrl && websiteUrl.trim()) {
                const visitButton = document.createElement('a');
                visitButton.href = websiteUrl;
                visitButton.target = '_blank';
                visitButton.rel = 'noopener';
                visitButton.className = 'visit-site-btn';
                
                // РџРѕР»СѓС‡Р°РµРј С‚РµРєСЃС‚ РєРЅРѕРїРєРё РЅР° С‚РµРєСѓС‰РµРј СЏР·С‹РєРµ
                const currentLang = localStorage.getItem('selectedLanguage') || 'RU';
                const langKey = currentLang.toLowerCase() === 'kz' ? 'kz' : (currentLang.toLowerCase() === 'en' ? 'en' : 'ru');
                const buttonTexts = {
                    ru: 'Посетить сайт',
                    kz: 'Сайтқа бару',
                    en: 'Visit website'
                };
                visitButton.textContent = buttonTexts[langKey];
                
                // Добавляем title с URL для подсказки
                visitButton.title = websiteUrl;
                
                // Добавляем языковые атрибуты для кнопки
                visitButton.setAttribute('data-ru', 'Посетить сайт');
                visitButton.setAttribute('data-kz', 'Сайтқа бару');
                visitButton.setAttribute('data-en', 'Visit website');
                
                item.appendChild(visitButton);
            }
            
            list.appendChild(item);
            markUsed(record);
        });

        if (emptyState && listsMap.size > 0) {
            emptyState.setAttribute('hidden', 'hidden');
        }
    }

    function renderPartnerCards(container, items) {
        container.innerHTML = '';
        if (!Array.isArray(items) || !items.length) {
            renderEmpty(container, 'Документы не найдены.');
            return;
        }

        const groups = new Map();
        items.forEach((item) => {
            const country = (item.country || 'Без страны').trim();
            if (!groups.has(country)) groups.set(country, []);
            groups.get(country).push(item);
        });

        const sortedCountries = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'ru'));

        sortedCountries.forEach((country) => {
            const groupItems = groups.get(country) || [];
            if (!groupItems.length) return;

            const card = document.createElement('div');
            card.className = 'country-card';

            // Для данных из our_partners используем прямые ссылки на флаги
            const firstItem = groupItems[0];
            let flagUrl;
            
            // Получаем metadata для использования в других местах
            const metadata = firstItem?.document?.metadata || {};
            
            // Приоритет 1: Прямая ссылка из our_partners (на верхнем уровне объекта)
            if (firstItem.flag_image_url) {
                flagUrl = firstItem.flag_image_url;
            } 
            // Приоритет 2: Ключ из our_partners (на верхнем уровне объекта)
            else if (firstItem.flag_image_key) {
                const r2Base = (window.R2_CONFIG?.PUBLIC_URL || getR2PublicBase() || '').replace(/\/$/, '');
                if (r2Base) {
                    const cleanKey = firstItem.flag_image_key.replace(/^\/+/, '');
                    const encoded = cleanKey.split('/').map(encodeURIComponent).join('/');
                    flagUrl = `${r2Base}/${encoded}`;
                }
            } 
            // Приоритет 3: Из metadata (для обратной совместимости)
            else if (metadata.flag_image_url) {
                flagUrl = metadata.flag_image_url;
            }
            else if (metadata.flag_image_key) {
                const r2Base = (window.R2_CONFIG?.PUBLIC_URL || getR2PublicBase() || '').replace(/\/$/, '');
                if (r2Base) {
                    const cleanKey = metadata.flag_image_key.replace(/^\/+/, '');
                    const encoded = cleanKey.split('/').map(encodeURIComponent).join('/');
                    flagUrl = `${r2Base}/${encoded}`;
                }
            }
            // Fallback на старую логику
            else {
                flagUrl = resolveAssetUrl(metadata);
            }

            const flag = document.createElement('img');
            flag.className = 'flag';
            flag.alt = `Флаг ${country}`;
            const resolvedFlagUrl = flagUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
            flag.src = resolvedFlagUrl;
            card.appendChild(flag);

            const title = document.createElement('h3');
            const translatedCountry = getCountryName(country, metadata);
            title.textContent = translatedCountry;
            // Р”РѕР±Р°РІР»СЏРµРј СЏР·С‹РєРѕРІС‹Рµ Р°С‚СЂРёР±СѓС‚С‹ РґР»СЏ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ СЏР·С‹РєР°
            const countryTrans = COUNTRY_TRANSLATIONS[country] || {};
            title.setAttribute('data-ru', countryTrans.ru || country);
            title.setAttribute('data-kz', countryTrans.kz || country);
            title.setAttribute('data-en', countryTrans.en || country);
            card.appendChild(title);

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'toggle-btn';
            toggleBtn.type = 'button';
            // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј С‚РµРєСЃС‚ РєРЅРѕРїРєРё РЅР° РѕСЃРЅРѕРІРµ С‚РµРєСѓС‰РµРіРѕ СЏР·С‹РєР°
            const currentLangBtn = localStorage.getItem('selectedLanguage') || 'RU';
            const langKeyBtn = currentLangBtn.toLowerCase() === 'kz' ? 'kz' : (currentLangBtn.toLowerCase() === 'en' ? 'en' : 'ru');
            const buttonTexts = {
                ru: 'Список университетов',
                kz: 'Университеттер тізімі',
                en: 'List of universities'
            };
            toggleBtn.textContent = buttonTexts[langKeyBtn];
            // Добавляем языковые атрибуты для кнопки
            toggleBtn.setAttribute('data-ru', 'Список университетов');
            toggleBtn.setAttribute('data-kz', 'Университеттер тізімі');
            toggleBtn.setAttribute('data-en', 'List of universities');
            toggleBtn.addEventListener('click', () => {
                if (typeof window.toggleUniversities === 'function') {
                    window.toggleUniversities(toggleBtn);
                } else {
                    const list = toggleBtn.nextElementSibling;
                    if (list) list.classList.toggle('hidden');
                }
            });
            card.appendChild(toggleBtn);

            const listWrapper = document.createElement('div');
            listWrapper.className = 'university-list hidden';

            const strong = document.createElement('strong');
            const listTitleText = {
                ru: `Список университетов - ${country}`,
                kz: `Университеттер тізімі - ${country}`,
                en: `List of universities - ${translatedCountry}`
            };
            const currentLang = localStorage.getItem('selectedLanguage') || 'RU';
            const langKey = currentLang.toLowerCase() === 'kz' ? 'kz' : (currentLang.toLowerCase() === 'en' ? 'en' : 'ru');
            strong.textContent = listTitleText[langKey];
            // Добавляем языковые атрибуты
            strong.setAttribute('data-ru', `Список университетов - ${country}`);
            strong.setAttribute('data-kz', `Университеттер тізімі - ${country}`);
            strong.setAttribute('data-en', `List of universities - ${translatedCountry}`);
            listWrapper.appendChild(strong);

            const list = document.createElement('ul');
            
            // Р¤СѓРЅРєС†РёСЏ РґР»СЏ РѕРїСЂРµРґРµР»РµРЅРёСЏ РїСЂРёРѕСЂРёС‚РµС‚Р° СЃРѕСЂС‚РёСЂРѕРІРєРё
            // Р’РђР–РќРћ: Р­С‚Р° С„СѓРЅРєС†РёСЏ СЂР°Р±РѕС‚Р°РµС‚ РґРёРЅР°РјРёС‡РµСЃРєРё РґР»СЏ Р›Р®Р‘Р«РҐ СѓРЅРёРІРµСЂСЃРёС‚РµС‚РѕРІ (РІРєР»СЋС‡Р°СЏ РЅРѕРІС‹Рµ)
            // РћРЅР° РїСЂРѕРІРµСЂСЏРµС‚ РЅР°Р»РёС‡РёРµ PDF Рё website_url РґР»СЏ РєР°Р¶РґРѕРіРѕ СЌР»РµРјРµРЅС‚Р° РїСЂРё СЃРѕСЂС‚РёСЂРѕРІРєРµ
            function getSortPriority(record) {
                // РџСЂРѕРІРµСЂСЏРµРј РЅР°Р»РёС‡РёРµ PDF С‡РµСЂРµР· С„СѓРЅРєС†РёСЋ getDocumentUrl
                const pdfUrl = getDocumentUrl(record);
                const hasPdf = Boolean(pdfUrl && pdfUrl.trim() && !pdfUrl.includes('partner.university'));
                
                // РџСЂРѕРІРµСЂСЏРµРј РЅР°Р»РёС‡РёРµ website_url РІ metadata или в our_partners
                const metadata = record.document?.metadata || {};
                const websiteUrl = record.website_url || record.university_url || metadata.university_url || metadata.website_url || '';
                const hasWebsite = Boolean(websiteUrl && websiteUrl.trim());
                
                // РџСЂРёРѕСЂРёС‚РµС‚ 1: Р•СЃС‚СЊ PDF Р РµСЃС‚СЊ РєРЅРѕРїРєР° "РџРѕСЃРµС‚РёС‚СЊ СЃР°Р№С‚" (СЃР°РјС‹Р№ РІС‹СЃРѕРєРёР№ РїСЂРёРѕСЂРёС‚РµС‚)
                if (hasPdf && hasWebsite) return 1;
                
                // РџСЂРёРѕСЂРёС‚РµС‚ 2: Р•СЃС‚СЊ С‚РѕР»СЊРєРѕ PDF (Р±РµР· РєРЅРѕРїРєРё "РџРѕСЃРµС‚РёС‚СЊ СЃР°Р№С‚")
                if (hasPdf && !hasWebsite) return 2;
                
                // РџСЂРёРѕСЂРёС‚РµС‚ 3: Р•СЃС‚СЊ С‚РѕР»СЊРєРѕ РєРЅРѕРїРєР° "РџРѕСЃРµС‚РёС‚СЊ СЃР°Р№С‚" (Р±РµР· PDF)
                if (!hasPdf && hasWebsite) return 3;
                
                // РџСЂРёРѕСЂРёС‚РµС‚ 4: РќРµС‚ РЅРё PDF, РЅРё РєРЅРѕРїРєРё (СЃР°РјС‹Р№ РЅРёР·РєРёР№ РїСЂРёРѕСЂРёС‚РµС‚)
                return 4;
            }
            
            // Р’РђР–РќРћ: РЎРѕСЂС‚РёСЂРѕРІРєР° СЂР°Р±РѕС‚Р°РµС‚ РђР’РўРћРњРђРўРР§Р•РЎРљР РґР»СЏ Р»СЋР±С‹С… СѓРЅРёРІРµСЂСЃРёС‚РµС‚РѕРІ (РІРєР»СЋС‡Р°СЏ РЅРѕРІС‹Рµ)
            // Р¤СѓРЅРєС†РёСЏ getSortPriority РїСЂРѕРІРµСЂСЏРµС‚ РЅР°Р»РёС‡РёРµ PDF Рё website_url РґРёРЅР°РјРёС‡РµСЃРєРё РґР»СЏ РєР°Р¶РґРѕРіРѕ СЌР»РµРјРµРЅС‚Р°
            // РџРѕСЂСЏРґРѕРє СЃРѕСЂС‚РёСЂРѕРІРєРё:
            // 1. РЈРЅРёРІРµСЂСЃРёС‚РµС‚С‹ СЃ PDF Р РєРЅРѕРїРєРѕР№ "РџРѕСЃРµС‚РёС‚СЊ СЃР°Р№С‚" (РїСЂРёРѕСЂРёС‚РµС‚ 1)
            // 2. РЈРЅРёРІРµСЂСЃРёС‚РµС‚С‹ С‚РѕР»СЊРєРѕ СЃ PDF (РїСЂРёРѕСЂРёС‚РµС‚ 2)
            // 3. РЈРЅРёРІРµСЂСЃРёС‚РµС‚С‹ С‚РѕР»СЊРєРѕ СЃ РєРЅРѕРїРєРѕР№ "РџРѕСЃРµС‚РёС‚СЊ СЃР°Р№С‚" (РїСЂРёРѕСЂРёС‚РµС‚ 3)
            // 4. РЈРЅРёРІРµСЂСЃРёС‚РµС‚С‹ Р±РµР· PDF Рё Р±РµР· РєРЅРѕРїРєРё (РїСЂРёРѕСЂРёС‚РµС‚ 4)
            // Р’РЅСѓС‚СЂРё РєР°Р¶РґРѕРіРѕ РїСЂРёРѕСЂРёС‚РµС‚Р° - СЃРѕСЂС‚РёСЂРѕРІРєР° РїРѕ Р°Р»С„Р°РІРёС‚Сѓ
            groupItems
                .slice()
                .sort((a, b) => {
                    // РЎРЅР°С‡Р°Р»Р° СЃРѕСЂС‚РёСЂСѓРµРј РїРѕ РїСЂРёРѕСЂРёС‚РµС‚Сѓ (PDF + РєРЅРѕРїРєР° > С‚РѕР»СЊРєРѕ PDF > С‚РѕР»СЊРєРѕ РєРЅРѕРїРєР° > РЅРёС‡РµРіРѕ)
                    const priorityA = getSortPriority(a);
                    const priorityB = getSortPriority(b);
                    if (priorityA !== priorityB) {
                        return priorityA - priorityB;
                    }
                    // Р•СЃР»Рё РїСЂРёРѕСЂРёС‚РµС‚ РѕРґРёРЅР°РєРѕРІС‹Р№, СЃРѕСЂС‚РёСЂСѓРµРј РїРѕ РЅР°Р·РІР°РЅРёСЋ (Р°Р»С„Р°РІРёС‚РЅРѕ)
                    return (a.link_text || a.document?.file_name || '').localeCompare(b.link_text || b.document?.file_name || '', 'ru');
                })
                .forEach((record) => {
                    const li = document.createElement('li');
                    const pdfUrl = getDocumentUrl(record);
                    
                    // РџРѕР»СѓС‡Р°РµРј РЅР°Р·РІР°РЅРёРµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р° РЅР° С‚РµРєСѓС‰РµРј СЏР·С‹РєРµ
                    const universityName = getDisplayName(record);
                    const metadata = record.document?.metadata || {};
                    
                    // РџРѕР»СѓС‡Р°РµРј URL РѕС„РёС†РёР°Р»СЊРЅРѕРіРѕ СЃР°Р№С‚Р° СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р° РёР· metadata или из our_partners
                    const websiteUrl = record.website_url || record.university_url || metadata.university_url || metadata.website_url || '';
                    
                    
                    // Р•СЃР»Рё PDF URL РЅРµ РЅР°Р№РґРµРЅ, СЃРѕР·РґР°РµРј span РІРјРµСЃС‚Рѕ СЃСЃС‹Р»РєРё
                    if (!pdfUrl) {
                        const span = document.createElement('span');
                        span.textContent = universityName;
                        // Р•СЃР»Рё РµСЃС‚СЊ website_url, РґРµР»Р°РµРј РЅР°Р·РІР°РЅРёРµ Р±РѕР»РµРµ Р·Р°РјРµС‚РЅС‹Рј
                        if (websiteUrl && websiteUrl.trim()) {
                            span.className = 'university-name-no-pdf';
                            span.style.opacity = '1';
                        } else {
                            span.style.opacity = '0.6';
                        }
                        span.style.cursor = 'default';
                        // Р”РѕР±Р°РІР»СЏРµРј СЏР·С‹РєРѕРІС‹Рµ Р°С‚СЂРёР±СѓС‚С‹ РґР»СЏ span (СѓРЅРёРІРµСЂСЃРёС‚РµС‚ Р±РµР· PDF)
                        // РСЃРїРѕР»СЊР·СѓРµРј РїРµСЂРµРІРѕРґС‹ РёР· metadata, РµСЃР»Рё РѕРЅРё РµСЃС‚СЊ, РёРЅР°С‡Рµ РёР· РјР°РїРїРёРЅРіР°
                        const englishName = record.link_text || record.document?.file_name || '';
                        const translation = UNIVERSITY_TRANSLATIONS[englishName];
                        
                        if (metadata.link_text_ru) {
                            span.setAttribute('data-ru', metadata.link_text_ru);
                        } else if (translation) {
                            span.setAttribute('data-ru', translation.ru);
                        } else if (record.link_text) {
                            span.setAttribute('data-ru', record.link_text);
                        }
                        
                        if (metadata.link_text_kz) {
                            span.setAttribute('data-kz', metadata.link_text_kz);
                        } else if (translation) {
                            span.setAttribute('data-kz', translation.kz);
                        } else if (record.link_text) {
                            span.setAttribute('data-kz', record.link_text);
                        }
                        
                        if (metadata.link_text_en) {
                            span.setAttribute('data-en', metadata.link_text_en);
                        } else if (translation) {
                            span.setAttribute('data-en', translation.en);
                        } else if (record.link_text) {
                            span.setAttribute('data-en', record.link_text);
                        }
                        li.appendChild(span);
                    } else {
                        const anchor = document.createElement('a');
                        anchor.href = pdfUrl;
                        anchor.target = '_blank';
                        anchor.rel = 'noopener';
                        anchor.textContent = universityName;
                        // Р”РѕР±Р°РІР»СЏРµРј СЏР·С‹РєРѕРІС‹Рµ Р°С‚СЂРёР±СѓС‚С‹ РґР»СЏ СЃСЃС‹Р»РєРё СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р°
                        // РСЃРїРѕР»СЊР·СѓРµРј РїРµСЂРµРІРѕРґС‹ РёР· metadata, РµСЃР»Рё РѕРЅРё РµСЃС‚СЊ, РёРЅР°С‡Рµ РёР· РјР°РїРїРёРЅРіР°
                        const englishName = record.link_text || record.document?.file_name || '';
                        const translation = UNIVERSITY_TRANSLATIONS[englishName];
                        
                        if (metadata.link_text_ru) {
                            anchor.setAttribute('data-ru', metadata.link_text_ru);
                        } else if (translation) {
                            anchor.setAttribute('data-ru', translation.ru);
                        } else if (record.link_text) {
                            anchor.setAttribute('data-ru', record.link_text);
                        }
                        
                        if (metadata.link_text_kz) {
                            anchor.setAttribute('data-kz', metadata.link_text_kz);
                        } else if (translation) {
                            anchor.setAttribute('data-kz', translation.kz);
                        } else if (record.link_text) {
                            anchor.setAttribute('data-kz', record.link_text);
                        }
                        
                        if (metadata.link_text_en) {
                            anchor.setAttribute('data-en', metadata.link_text_en);
                        } else if (translation) {
                            anchor.setAttribute('data-en', translation.en);
                        } else if (record.link_text) {
                            anchor.setAttribute('data-en', record.link_text);
                        }
                        // РЈР±РµР¶РґР°РµРјСЃСЏ, С‡С‚Рѕ СЌС‚Рѕ PDF С„Р°Р№Р»
                        if (pdfUrl.toLowerCase().endsWith('.pdf') || pdfUrl.includes('.pdf')) {
                            anchor.setAttribute('type', 'application/pdf');
                        }
                        li.appendChild(anchor);
                    }
                    
                    // Р”РѕР±Р°РІР»СЏРµРј РєРЅРѕРїРєСѓ "РџРѕСЃРµС‚РёС‚СЊ СЃР°Р№С‚", РµСЃР»Рё РµСЃС‚СЊ website_url
                    if (websiteUrl && websiteUrl.trim()) {
                        const visitButton = document.createElement('a');
                        visitButton.href = websiteUrl;
                        visitButton.target = '_blank';
                        visitButton.rel = 'noopener';
                        visitButton.className = 'visit-site-btn';
                        
                        // РџРѕР»СѓС‡Р°РµРј С‚РµРєСЃС‚ РєРЅРѕРїРєРё РЅР° С‚РµРєСѓС‰РµРј СЏР·С‹РєРµ
                        const currentLang = localStorage.getItem('selectedLanguage') || 'RU';
                        const langKey = currentLang.toLowerCase() === 'kz' ? 'kz' : (currentLang.toLowerCase() === 'en' ? 'en' : 'ru');
                        const buttonTexts = {
                            ru: 'Посетить сайт',
                            kz: 'Сайтқа бару',
                            en: 'Visit website'
                        };
                        visitButton.textContent = buttonTexts[langKey];
                        
                        // Добавляем title с URL для подсказки
                        visitButton.title = websiteUrl;
                        
                        // Добавляем языковые атрибуты для кнопки
                        visitButton.setAttribute('data-ru', 'Посетить сайт');
                        visitButton.setAttribute('data-kz', 'Сайтқа бару');
                        visitButton.setAttribute('data-en', 'Visit website');
                        
                        li.appendChild(visitButton);
                    }
                    
                    list.appendChild(li);
                });

            listWrapper.appendChild(list);
            card.appendChild(listWrapper);
            container.appendChild(card);
        });
    }

    function hydrateContainer(container, items) {
        const hiddenClass = container.dataset.missingClass || 'document-missing';
        const hideMissing = container.dataset.hideMissing !== 'false';
        const mode = container.dataset.mode || 'hydrate';
        const isPartnersMode = mode === 'partners';
        const isCardMode = mode === 'cards';

        const registerKey = (collection, key, item) => {
            if (!key) return;
            collection.set(key, item);
            collection.set(key.toLowerCase(), item);
        };

        const map = new Map();
        const remaining = items.slice();
        const usedIds = new Set();

        const markUsed = (item) => {
            const doc = item.document || {};
            const identifier = doc.id || item.id || `${doc.file_key || doc.file_name || Math.random()}`;
            usedIds.add(identifier);
            const index = remaining.indexOf(item);
            if (index !== -1) remaining.splice(index, 1);
        };

        items.forEach((item) => {
            const doc = item.document || {};
            registerKey(map, doc.file_key || null, item);
            registerKey(map, doc.file_name || doc.name || null, item);
            if (!doc.file_key && !doc.file_name && doc.url) {
                registerKey(map, doc.url, item);
            }
        });

        const applyRecordToElement = (element, record) => {
            if (!record) return false;

            element.classList.remove(hiddenClass);
            element.classList.remove('document-missing');

            const url = getDocumentUrl(record);
            const displayName = getDisplayName(record);

            if (element.tagName === 'A') {
                // Р•СЃР»Рё URL РЅРµ РЅР°Р№РґРµРЅ, РґРµР»Р°РµРј СЃСЃС‹Р»РєСѓ РЅРµР°РєС‚РёРІРЅРѕР№
                if (!url || url === '#') {
                    element.href = '#';
                    element.style.pointerEvents = 'none';
                    element.style.opacity = '0.6';
                    element.style.cursor = 'default';
                } else {
                    element.href = url;
                    element.target = '_blank';
                    element.rel = 'noopener';
                }
            }

            const targetKey = record.document?.file_key
                || record.document?.file_name
                || element.dataset.documentKey
                || '';

            element.dataset.documentKey = targetKey;

            const syncRef = element.dataset.documentRef;
            if (syncRef) {
                const selector = `[data-document-ref="${(typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(syncRef) : syncRef}"]`;
                container.querySelectorAll(selector).forEach((refElement) => {
                    refElement.dataset.documentKey = targetKey;
                });
            }

            if (element.dataset.role === 'button') {
                element.addEventListener('click', (event) => {
                    event.preventDefault();
                    if (url && url !== '#') {
                        window.open(url, '_blank', 'noopener');
                    }
                });
            }

            switch (element.dataset.updateText) {
                case 'link':
                    element.textContent = record.link_text || displayName;
                    break;
                case 'usage':
                    if (record.usage_text) {
                        element.textContent = record.usage_text;
                    }
                    break;
                case 'name':
                    element.textContent = displayName;
                    break;
                default:
                    if (!element.textContent.trim()) {
                        element.textContent = record.link_text || displayName;
                    }
            }

            if (element.dataset.updateHtml === 'usage' && record.usage_text) {
                element.innerHTML = escapeHtml(record.usage_text);
            }

            if (element.dataset.updateAttr) {
                const attrMap = element.dataset.updateAttr.split(',').map((pair) => pair.trim()).filter(Boolean);
                attrMap.forEach((assignment) => {
                    const [attr, token] = assignment.split(':').map((part) => part.trim());
                    if (!attr || !token) return;
                    let value = '';
                    if (token === 'url') {
                        value = url || '#';
                    } else if (token === 'link_text') {
                        value = record.link_text || displayName;
                    } else if (token === 'usage_text') {
                        value = record.usage_text || '';
                    } else if (token.startsWith('metadata.')) {
                        value = resolvePath(token.replace(/^metadata\./, ''), record.document?.metadata || {});
                    } else if (token.startsWith('document.')) {
                        value = resolvePath(token.replace(/^document\./, ''), record.document || {});
                    } else {
                        value = (record.document && record.document[token]) || '';
                    }
                    if (value !== undefined && value !== null && value !== '') {
                        element.setAttribute(attr, value);
                    }
                });
            }

            element.removeAttribute('hidden');
            if (element.dataset.show !== 'static') {
                element.style.removeProperty('display');
            }

            markUsed(record);
            element.dataset.hydrated = 'true';
            return true;
        };

        const elements = Array.from(container.querySelectorAll('[data-document-key]'));

        elements.forEach((element) => {
            const key = element.dataset.documentKey || '';
            const record = map.get(key) || map.get(key.toLowerCase());
            if (!record) return;
            applyRecordToElement(element, record);
        });

        elements.forEach((element) => {
            if (element.dataset.hydrated === 'true') return;
            const fallback = remaining.find((item) => {
                const doc = item.document || {};
                const identifier = doc.id || item.id || `${doc.file_key || doc.file_name}`;
                return !usedIds.has(identifier);
            });
            if (!fallback) {
                element.classList.add(hiddenClass);
                if (hideMissing) element.setAttribute('hidden', 'hidden');
                return;
            }
            applyRecordToElement(element, fallback);
        });

        if (isPartnersMode && remaining.length) {
            appendPartnerRecords(container, remaining, markUsed);
        }

        if (isCardMode) {
            hydrateCards(container, items);
        }

        elements.forEach((element) => {
            if (element.dataset.hydrated === 'true') return;
            element.classList.add(hiddenClass);
            if (hideMissing) element.setAttribute('hidden', 'hidden');
        });
    }

    // РҐСЂР°РЅРёР»РёС‰Рµ РґР»СЏ РѕС‚СЃР»РµР¶РёРІР°РЅРёСЏ Р·Р°РіСЂСѓР·РѕРє (РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ)
    const loadingContainers = new WeakSet();

    async function loadDocuments(container) {
        // РџСЂРµРґРѕС‚РІСЂР°С‰Р°РµРј РѕРґРЅРѕРІСЂРµРјРµРЅРЅС‹Рµ Р·Р°РіСЂСѓР·РєРё РѕРґРЅРѕРіРѕ РєРѕРЅС‚РµР№РЅРµСЂР°
        if (loadingContainers.has(container)) {
            return;
        }
        
        loadingContainers.add(container);
        
        try {
            const supabaseClient = await waitForSupabase();
            const page = container.dataset.page;
            const section = container.dataset.section || null;
            const linkClass = container.dataset.linkClass || '';
            const mode = container.dataset.mode || 'list';
            const templateId = container.dataset.template || '';
            const emptyMessage = container.dataset.emptyMessage || 'Р"РѕРєСѓРјРµРЅС‚С‹ РґР»СЏ СЌС‚РѕР№ СЃС‚СЂР°РЅРёС†С‹ РїРѕРєР° РЅРµ РґРѕР±Р°РІР»РµРЅС‹.';

            console.log('[loadDocuments] Параметры загрузки:', { page, section, mode, container: container.className });

            if (!page) {
                renderEmpty(container, 'РќРµ СѓРєР°Р·Р°РЅР° СЃС‚СЂР°РЅРёС†Р° РґР»СЏ Р·Р°РіСЂСѓР·РєРё РґРѕРєСѓРјРµРЅС‚РѕРІ.');
                return;
            }

        // Для страницы Our-partners.html используем новую таблицу our_partners
        // Для страницы Students.html с разделом appendices используем новую таблицу students_appendices
        let data, error;
        
        if (page === 'Our-partners.html') {
            // Загружаем данные из таблицы our_partners
            const query = supabaseClient
                .from('our_partners')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            
            const result = await query;
            data = result.data;
            error = result.error;
            
            // Преобразуем данные из our_partners в формат, совместимый с существующим кодом
            if (data && !error) {
                data = data.map(partner => ({
                    id: partner.id,
                    country: partner.country_ru,
                    link_text: partner.university_name_ru,
                    usage_text: partner.description_ru,
                    sort_order: partner.sort_order,
                    // Создаем объект document для совместимости
                    document: {
                        id: partner.id,
                        file_name: partner.university_name_ru + '.pdf',
                        file_key: partner.pdf_file_key,
                        file_url: partner.pdf_file_url,
                        url: partner.pdf_file_url,
                        metadata: {
                            link_text_ru: partner.university_name_ru,
                            link_text_kz: partner.university_name_kz,
                            link_text_en: partner.university_name_en,
                            flag_image_url: partner.flag_image_url,
                            flag_image_key: partner.flag_image_key,
                            website_url: partner.website_url || partner.university_url,
                            university_url: partner.website_url || partner.university_url, // Обратная совместимость
                            card_description_ru: partner.description_ru,
                            card_description_kz: partner.description_kz,
                            card_description_en: partner.description_en
                        }
                    },
                    // Дополнительные поля для удобства (ВАЖНО: эти поля используются в renderPartnerCards!)
                    pdf_file_url: partner.pdf_file_url,
                    pdf_file_key: partner.pdf_file_key,
                    flag_image_url: partner.flag_image_url, // Это поле проверяется первым в renderPartnerCards
                    flag_image_key: partner.flag_image_key,  // Это поле проверяется вторым в renderPartnerCards
                    website_url: partner.website_url || partner.university_url,
                    university_url: partner.website_url || partner.university_url, // Обратная совместимость
                    university_name_ru: partner.university_name_ru,
                    university_name_kz: partner.university_name_kz,
                    university_name_en: partner.university_name_en,
                    country_ru: partner.country_ru,
                    country_kz: partner.country_kz,
                    country_en: partner.country_en
                }));
            }
        } else if (page === 'Students.html' && section === 'appendices') {
            // Загружаем данные из таблицы students_appendices для раздела appendices
            console.log('[loadDocuments] Загружаем данные из students_appendices для Students.html, раздел appendices');
            const query = supabaseClient
                .from('students_appendices')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            
            const result = await query;
            data = result.data;
            error = result.error;
            
            console.log('[loadDocuments] Результат запроса students_appendices:', { 
                dataCount: data?.length || 0, 
                error: error?.message || null,
                hasData: !!data 
            });
            
            // Преобразуем данные из students_appendices в формат, совместимый с существующим кодом
            if (data && !error) {
                // Получаем текущий язык для правильного выбора названия
                const currentLang = localStorage.getItem('selectedLanguage') || 'RU';
                
                data = data.map(appendix => {
                    // Выбираем название в зависимости от языка
                    let linkText = appendix.title_ru;
                    if (currentLang === 'KZ' && appendix.title_kz) {
                        linkText = appendix.title_kz;
                    } else if (currentLang === 'EN' && appendix.title_en) {
                        linkText = appendix.title_en;
                    }
                    
                    return {
                        id: appendix.id,
                        link_text: linkText,
                        // Сохраняем все варианты названий для переключения языка
                        title_ru: appendix.title_ru,
                        title_kz: appendix.title_kz || appendix.title_ru,
                        title_en: appendix.title_en || appendix.title_ru,
                        sort_order: appendix.sort_order,
                        section: 'appendices',
                        page_slug: 'Students.html',
                        // Создаем объект document для совместимости
                        // Выбираем правильный PDF файл в зависимости от языка
                        document: (() => {
                            let selectedPdfUrl = appendix.pdf_file_url;
                            let selectedPdfKey = appendix.pdf_file_key;
                            let selectedFileName = appendix.r2_file_name || appendix.title_ru + '.pdf';
                            
                            if (currentLang === 'KZ' && appendix.pdf_file_url_kz) {
                                selectedPdfUrl = appendix.pdf_file_url_kz;
                                selectedPdfKey = appendix.pdf_file_key_kz;
                                selectedFileName = appendix.r2_file_name_kz || appendix.title_kz + '.pdf';
                                console.log('[loadDocuments] Выбран казахский PDF для приложения', appendix.sort_order, ':', selectedPdfUrl);
                            } else {
                                console.log('[loadDocuments] Выбран русский PDF для приложения', appendix.sort_order, ':', selectedPdfUrl);
                            }
                            
                            return {
                                id: appendix.id,
                                file_name: selectedFileName,
                                file_key: selectedPdfKey,
                                file_url: selectedPdfUrl,
                                url: selectedPdfUrl,
                                metadata: {
                                    link_text_ru: appendix.title_ru,
                                    link_text_kz: appendix.title_kz || appendix.title_ru,
                                    link_text_en: appendix.title_en || appendix.title_ru,
                                    // Добавляем казахские версии PDF в metadata
                                    pdf_file_url_kz: appendix.pdf_file_url_kz,
                                    pdf_file_key_kz: appendix.pdf_file_key_kz,
                                    r2_file_name_kz: appendix.r2_file_name_kz
                                }
                            };
                        })(),
                    // Дополнительные поля для удобства
                    pdf_file_url: appendix.pdf_file_url,
                    pdf_file_key: appendix.pdf_file_key,
                    pdf_file_url_kz: appendix.pdf_file_url_kz,
                    pdf_file_key_kz: appendix.pdf_file_key_kz,
                    document_id: appendix.id
                    };
                });
            }
        } else if (page === 'Teachers.html') {
            // Загружаем данные из таблицы teachers_documents
            console.log('[loadDocuments] Загружаем данные из teachers_documents для Teachers.html');
            const query = supabaseClient
                .from('teachers_documents')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            
            const result = await query;
            data = result.data;
            error = result.error;
            
            // Преобразуем данные в формат, совместимый с существующим кодом
            if (data && !error) {
                data = data.map(doc => ({
                    id: doc.id,
                    link_text: doc.title_ru || doc.title || '',
                    usage_text: doc.description_ru || '',
                    sort_order: doc.sort_order || 0,
                    document: {
                        id: doc.id,
                        file_name: doc.title_ru + '.pdf',
                        file_key: doc.pdf_file_key,
                        file_url: doc.pdf_file_url || doc.file_url,
                        url: doc.pdf_file_url || doc.file_url
                    },
                    pdf_file_url: doc.pdf_file_url || doc.file_url
                }));
            }
        } else if (page === 'mschool.html') {
            // Загружаем данные из таблицы mschool_documents
            console.log('[loadDocuments] Загружаем данные из mschool_documents для mschool.html');
            const query = supabaseClient
                .from('mschool_documents')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            
            const result = await query;
            data = result.data;
            error = result.error;
            
            // Преобразуем данные в формат, совместимый с существующим кодом
            if (data && !error) {
                data = data.map(doc => ({
                    id: doc.id,
                    link_text: doc.title_ru || doc.title || '',
                    usage_text: doc.description_ru || '',
                    sort_order: doc.sort_order || 0,
                    section: doc.section || 'certificates',
                    document: {
                        id: doc.id,
                        file_name: doc.title_ru + '.pdf',
                        file_key: doc.pdf_file_key,
                        file_url: doc.pdf_file_url || doc.file_url,
                        url: doc.pdf_file_url || doc.file_url
                    },
                    pdf_file_url: doc.pdf_file_url || doc.file_url
                }));
            }
        } else if (page === 'eramus.html') {
            // Загружаем данные из таблицы eramus_documents
            console.log('[loadDocuments] Загружаем данные из eramus_documents для eramus.html');
            const query = supabaseClient
                .from('eramus_documents')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            
            const result = await query;
            data = result.data;
            error = result.error;
            
            // Преобразуем данные в формат, совместимый с существующим кодом
            if (data && !error) {
                data = data.map(doc => ({
                    id: doc.id,
                    link_text: doc.title_ru || doc.title || '',
                    usage_text: doc.description_ru || '',
                    sort_order: doc.sort_order || 0,
                    document: {
                        id: doc.id,
                        file_name: doc.title_ru + '.pdf',
                        file_key: doc.pdf_file_key,
                        file_url: doc.pdf_file_url || doc.file_url,
                        url: doc.pdf_file_url || doc.file_url
                    },
                    pdf_file_url: doc.pdf_file_url || doc.file_url
                }));
            }
        } else if (page === 'for_foreign_students.html') {
            // Загружаем данные из таблицы for_foreign_students_documents
            console.log('[loadDocuments] Загружаем данные из for_foreign_students_documents для for_foreign_students.html');
            const query = supabaseClient
                .from('for_foreign_students_documents')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            
            const result = await query;
            data = result.data;
            error = result.error;
            
            // Преобразуем данные в формат, совместимый с существующим кодом
            if (data && !error) {
                data = data.map(doc => ({
                    id: doc.id,
                    link_text: doc.title_ru || doc.title || '',
                    usage_text: doc.description_ru || '',
                    sort_order: doc.sort_order || 0,
                    document: {
                        id: doc.id,
                        file_name: doc.title_ru + '.pdf',
                        file_key: doc.pdf_file_key,
                        file_url: doc.pdf_file_url || doc.file_url,
                        url: doc.pdf_file_url || doc.file_url
                    },
                    pdf_file_url: doc.pdf_file_url || doc.file_url
                }));
            }
        } else {
            // Для других страниц используем старую таблицу document_usages
            let query = supabaseClient
                .from('document_usages')
                .select('*, document:documents(*)')
                .eq('page_slug', page)
                .order('sort_order', { ascending: true })
                .order('updated_at', { ascending: false });

            if (section) {
                query = query.eq('section', section);
            }

            const result = await query;
            data = result.data;
            error = result.error;
        }
        if (error) {
            console.error('[loadDocuments] РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РґРѕРєСѓРјРµРЅС‚РѕРІ РґР»СЏ СЃС‚СЂР°РЅРёС†С‹', page, error);
            
            // РЎРїРµС†РёР°Р»СЊРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° РѕС€РёР±РѕРє Р°РІС‚РѕСЂРёР·Р°С†РёРё
            if (error.code === 'PGRST303' || error.message?.includes('JWT expired') || error.message?.includes('expired')) {
                console.error('в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ');
                console.error('[loadDocuments] вљ пёЏвљ пёЏвљ пёЏ РљР РРўРР§Р•РЎРљРђРЇ РћРЁРР‘РљРђ: JWT С‚РѕРєРµРЅ РёСЃС‚РµРє!');
                console.error('[loadDocuments] РљР»СЋС‡ Supabase РёСЃС‚РµРє РёР»Рё РЅРµРІРµСЂРЅС‹Р№.');
                console.error('[loadDocuments]');
                console.error('[loadDocuments] Р Р•РЁР•РќРР•:');
                console.error('[loadDocuments] 1. РћС‚РєСЂРѕР№С‚Рµ https://supabase.com/dashboard');
                console.error('[loadDocuments] 2. Р’С‹Р±РµСЂРёС‚Рµ РІР°С€ РїСЂРѕРµРєС‚');
                console.error('[loadDocuments] 3. Settings в†’ API');
                console.error('[loadDocuments] 4. РЎРєРѕРїРёСЂСѓР№С‚Рµ Р°РєС‚СѓР°Р»СЊРЅС‹Р№ "anon" РёР»Рё "publishable" РєР»СЋС‡');
                console.error('[loadDocuments] 5. РћС‚РєСЂРѕР№С‚Рµ С„Р°Р№Р» js/supabase-config.js');
                console.error('[loadDocuments] 6. Р—Р°РјРµРЅРёС‚Рµ Р·РЅР°С‡РµРЅРёРµ SUPABASE_ANON_KEY РЅР° СЃС‚СЂРѕРєРµ 9');
                console.error('[loadDocuments] 7. РЎРѕС…СЂР°РЅРёС‚Рµ С„Р°Р№Р» Рё РѕР±РЅРѕРІРёС‚Рµ СЃС‚СЂР°РЅРёС†Сѓ (Ctrl+F5)');
                console.error('[loadDocuments]');
                console.error('[loadDocuments] РџРѕР»РЅР°СЏ РѕС€РёР±РєР°:', error);
                console.error('в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ');
                renderEmpty(container, '⚠️ Ошибка авторизации Supabase. Ключ истек. Обновите SUPABASE_ANON_KEY в js/supabase-config.js');
                return;
            }
            
            if (error.code === 'PGRST301' || error.status === 401) {
                console.error('[loadDocuments] РћРЁРР‘РљРђ: РќРµР°РІС‚РѕСЂРёР·РѕРІР°РЅРЅС‹Р№ РґРѕСЃС‚СѓРї. РџСЂРѕРІРµСЂСЊС‚Рµ РєР»СЋС‡ Supabase.');
                console.error('[loadDocuments] РљРѕРґ РѕС€РёР±РєРё:', error.code);
                console.error('[loadDocuments] РЎРѕРѕР±С‰РµРЅРёРµ:', error.message);
                renderEmpty(container, 'Ошибка авторизации. Проверьте настройки Supabase.');
                return;
            }
            
            renderEmpty(container, 'Ошибка загрузки документов. Попробуйте позже.');
            return;
        }
        
 
        // Р¤РёР»СЊС‚СЂР°С†РёСЏ РґР°РЅРЅС‹С…
        // Р”Р»СЏ РїР°СЂС‚РЅРµСЂРѕРІ (Our-partners.html) РЅРµ С„РёР»СЊС‚СЂСѓРµРј РїРѕ file_url, С‚Р°Рє РєР°Рє:
        // 1. Р’СЃРµ file_url СЃРѕРґРµСЂР¶Р°С‚ SEO-СЃСЃС‹Р»РєРё (partner.university), РєРѕС‚РѕСЂС‹Рµ РЅРµ РІР°Р»РёРґРЅС‹
        // 2. PDF URL СЃС‚СЂРѕРёС‚СЃСЏ РёР· РЅР°Р·РІР°РЅРёСЏ СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р° С‡РµСЂРµР· РјР°РїРїРёРЅРі
        let filtered = (data || []).filter((item) => {
            if (!item.document) {
                return false;
            }
            
            // Р”Р»СЏ СЃС‚СЂР°РЅРёС†С‹ РїР°СЂС‚РЅРµСЂРѕРІ - РЅРµ С„РёР»СЊС‚СЂСѓРµРј РїРѕ file_url
            if (page === 'Our-partners.html') {
                // РџСЂРѕРІРµСЂСЏРµРј С‚РѕР»СЊРєРѕ, С‡С‚Рѕ РµСЃС‚СЊ document Рё link_text (РЅР°Р·РІР°РЅРёРµ СѓРЅРёРІРµСЂСЃРёС‚РµС‚Р°)
                const hasLinkText = Boolean(item.link_text || item.document?.title || item.document?.file_name);
                return hasLinkText;
            }
            
            // Р”Р»СЏ РїСЂРёР»РѕР¶РµРЅРёР№ СЃС‚СѓРґРµРЅС‚РѕРІ РїСЂРѕРІРµСЂСЏРµРј РЅР°Р»РёС‡РёРµ PDF С„Р°Р№Р»Р°
            if (page === 'Students.html' && section === 'appendices') {
                return Boolean(item.document?.file_url || item.document?.url || item.pdf_file_url);
            }
            
            // Р”Р»СЏ РґСЂСѓРіРёС… СЃС‚СЂР°РЅРёС† - С„РёР»СЊС‚СЂСѓРµРј РїРѕ file_url РєР°Рє СЂР°РЅСЊС€Рµ
            return Boolean(item.document?.file_url || item.document?.url);
        });
        

        // Р¤РёР»СЊС‚СЂР°С†РёСЏ РїРѕ СЏР·С‹РєСѓ РґР»СЏ СЂР°Р·РґРµР»Р° appendices
        if (section === 'appendices') {
            const currentLang = localStorage.getItem('selectedLanguage') || 'RU';
            const langMap = { 'RU': 'ru', 'KZ': 'kz', 'EN': 'en' };
            const targetLang = langMap[currentLang] || 'ru';
            
            filtered = filtered.filter((item) => {
                const linkText = item.link_text || '';
                const detectedLang = detectLanguage(linkText);
                // РџРѕРєР°Р·С‹РІР°РµРј С‚РѕР»СЊРєРѕ РґРѕРєСѓРјРµРЅС‚С‹ РЅР° С‚РµРєСѓС‰РµРј СЏР·С‹РєРµ
                // Р”Р»СЏ Р°РЅРіР»РёР№СЃРєРѕРіРѕ РїРѕРєР°Р·С‹РІР°РµРј СЂСѓСЃСЃРєРёРµ (С‚Р°Рє РєР°Рє Р°РЅРіР»РёР№СЃРєРёС… РІРµСЂСЃРёР№ РЅРµС‚)
                if (targetLang === 'en') {
                    return detectedLang === 'ru';
                }
                return detectedLang === targetLang;
            });
            
            // Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅР°СЏ РґРµРґСѓРїР»РёРєР°С†РёСЏ РґР»СЏ appendices РїРѕ document_id
            // Р•СЃР»Рё РµСЃС‚СЊ РЅРµСЃРєРѕР»СЊРєРѕ Р·Р°РїРёСЃРµР№ СЃ РѕРґРёРЅР°РєРѕРІС‹Рј document_id, РѕСЃС‚Р°РІР»СЏРµРј С‚РѕР»СЊРєРѕ РїРµСЂРІСѓСЋ
            const seenDocIds = new Set();
            filtered = filtered.filter((item) => {
                const docId = item.document?.id || item.document_id;
                if (docId) {
                    if (seenDocIds.has(docId)) {
                        return false;
                    }
                    seenDocIds.add(docId);
                }
                return true;
            });
        }
        if (!filtered.length) {
            // Логируем информацию о том, почему данные не найдены
            if (data && data.length === 0) {
                if (page === 'Our-partners.html') {
                    console.warn(`[loadDocuments] ⚠️ В таблице our_partners нет записей`);
                    console.warn(`[loadDocuments] Проверьте в Supabase Dashboard, что в таблице our_partners есть записи с is_active=true`);
                } else if (page === 'Students.html' && section === 'appendices') {
                    console.warn(`[loadDocuments] ⚠️ В таблице students_appendices нет записей`);
                    console.warn(`[loadDocuments] Проверьте в Supabase Dashboard, что в таблице students_appendices есть записи с is_active=true`);
                } else if (page === 'Teachers.html') {
                    console.warn(`[loadDocuments] ⚠️ В таблице teachers_documents нет записей`);
                    console.warn(`[loadDocuments] Проверьте в Supabase Dashboard, что в таблице teachers_documents есть записи с is_active=true`);
                } else if (page === 'mschool.html') {
                    console.warn(`[loadDocuments] ⚠️ В таблице mschool_documents нет записей`);
                    console.warn(`[loadDocuments] Проверьте в Supabase Dashboard, что в таблице mschool_documents есть записи с is_active=true`);
                } else if (page === 'eramus.html') {
                    console.warn(`[loadDocuments] ⚠️ В таблице eramus_documents нет записей`);
                    console.warn(`[loadDocuments] Проверьте в Supabase Dashboard, что в таблице eramus_documents есть записи с is_active=true`);
                } else if (page === 'for_foreign_students.html') {
                    console.warn(`[loadDocuments] ⚠️ В таблице for_foreign_students_documents нет записей`);
                    console.warn(`[loadDocuments] Проверьте в Supabase Dashboard, что в таблице for_foreign_students_documents есть записи с is_active=true`);
                } else {
                    console.warn(`[loadDocuments] ⚠️ В таблице document_usages нет записей для страницы "${page}"`);
                    console.warn(`[loadDocuments] Проверьте в Supabase Dashboard, что в таблице document_usages есть записи с page_slug="${page}"`);
                }
            } else if (data && data.length > 0) {
                console.warn(`[loadDocuments] ⚠️ Найдено ${data.length} записей, но после фильтрации осталось 0`);
                console.warn(`[loadDocuments] Проверьте фильтры в коде document-renderer.js`);
            }
            
            if (mode === 'hydrate' || mode === 'partners' || mode === 'partner-cards' || section === 'appendices') {
                container.classList.add('documents-empty');
                const emptyTarget = container.dataset.emptyTarget
                    ? document.querySelector(container.dataset.emptyTarget)
                    : container.querySelector('[data-empty-state]');
                if (emptyTarget) {
                    emptyTarget.removeAttribute('hidden');
                }
            } else {
                renderEmpty(container, emptyMessage);
            }
            return;
        }

        if (mode === 'partner-cards') {
            renderPartnerCards(container, filtered);
            return;
        }

        if (mode === 'hydrate' || mode === 'partners') {
            hydrateContainer(container, filtered);
            return;
        }

        if (templateId) {
            renderWithTemplate(container, filtered, templateId);
            return;
        }

        renderList(container, filtered, { linkClass });
        } finally {
            // РЈРґР°Р»СЏРµРј РєРѕРЅС‚РµР№РЅРµСЂ РёР· СЃРїРёСЃРєР° Р·Р°РіСЂСѓР¶Р°СЋС‰РёС…СЃСЏ РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ
            loadingContainers.delete(container);
        }
    }

    // РћР¶РёРґР°РЅРёРµ Р·Р°РіСЂСѓР·РєРё R2_CONFIG
    async function waitForR2Config(maxWait = 5000) {
        const start = Date.now();
        while (!window.R2_CONFIG || !window.R2_CONFIG.PUBLIC_URL) {
            if (Date.now() - start > maxWait) {
                console.warn('[waitForR2Config] R2_CONFIG РЅРµ Р·Р°РіСЂСѓР¶РµРЅ Р·Р°', maxWait, 'РјСЃ. РџСЂРѕРІРµСЂСЊС‚Рµ РїРѕСЂСЏРґРѕРє Р·Р°РіСЂСѓР·РєРё СЃРєСЂРёРїС‚РѕРІ РІ HTML.');
                console.warn('[waitForR2Config] РўРµРєСѓС‰РёР№ window.R2_CONFIG:', window.R2_CONFIG);
                // РќРµ РІРѕР·РІСЂР°С‰Р°РµРј false, С‚Р°Рє РєР°Рє РїРѕР»РЅС‹Рµ URL РёР· Supabase РІСЃРµ СЂР°РІРЅРѕ РґРѕР»Р¶РЅС‹ СЂР°Р±РѕС‚Р°С‚СЊ
                return false;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return true;
    }

    async function init() {
        const containers = document.querySelectorAll(SELECTOR);
        if (!containers.length) {
            return;
        }

        try {
            await waitForSupabase();
            const r2ConfigLoaded = await waitForR2Config();
        } catch (error) {
            console.error('[DocumentRenderer.init] РћС€РёР±РєР°:', error.message);
            containers.forEach((container) => renderEmpty(container, 'Supabase недоступен.'));
            return;
        }

        const loadAllDocuments = () => {
            containers.forEach((container) => {
                loadDocuments(container).catch((error) => {
                    console.error('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РґРѕРєСѓРјРµРЅС‚РѕРІ', error);
                    renderEmpty(container, 'Ошибка загрузки документов. Попробуйте позже.');
                });
            });
        };

        // Р—Р°РіСЂСѓР¶Р°РµРј РґРѕРєСѓРјРµРЅС‚С‹ РїСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё
        loadAllDocuments();

        // РџРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј РґРѕРєСѓРјРµРЅС‚С‹ РїСЂРё РёР·РјРµРЅРµРЅРёРё СЏР·С‹РєР° (РґР»СЏ appendices)
        window.addEventListener('storage', (e) => {
            if (e.key === 'selectedLanguage') {
                containers.forEach((container) => {
                    if (container.dataset.section === 'appendices') {
                        loadDocuments(container).catch((error) => {
                            console.error('РћС€РёР±РєР° РїРµСЂРµР·Р°РіСЂСѓР·РєРё РґРѕРєСѓРјРµРЅС‚РѕРІ', error);
                        });
                    }
                });
            }
        });

        // РўР°РєР¶Рµ СЃР»СѓС€Р°РµРј РєР°СЃС‚РѕРјРЅРѕРµ СЃРѕР±С‹С‚РёРµ РґР»СЏ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ СЏР·С‹РєР° (РµСЃР»Рё РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ С‚РѕРј Р¶Рµ РѕРєРЅРµ)
        window.addEventListener('languageChanged', () => {
            containers.forEach((container) => {
                const page = container.dataset.page;
                // РџРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј РґРѕРєСѓРјРµРЅС‚С‹ РґР»СЏ appendices Рё Our-partners.html
                if (container.dataset.section === 'appendices' || page === 'Our-partners.html') {
                    loadDocuments(container).catch((error) => {
                        console.error('РћС€РёР±РєР° РїРµСЂРµР·Р°РіСЂСѓР·РєРё РґРѕРєСѓРјРµРЅС‚РѕРІ', error);
                    });
                }
            });
        });
    }

    return { init };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DocumentRenderer.init());
} else {
    DocumentRenderer.init();
}
