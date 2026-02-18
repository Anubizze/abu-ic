// Загрузчик данных футера для всех страниц
class FooterLoader {
    constructor() {
        this.footerData = null;
        this.currentLanguage = localStorage.getItem('selectedLanguage') || 'RU';
    }

    async loadFooterData() {
        try {
            // Проверяем инициализацию Supabase
            if (typeof supabase === 'undefined' || !supabase) {
                console.warn('Supabase не инициализирован, данные футера не будут загружены');
                return;
            }

            // Загружаем данные футера (берем последнюю запись)
            const { data, error } = await supabase
                .from('footer_data')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('Ошибка загрузки данных футера:', error);
                return;
            }

            this.footerData = data;
            if (this.footerData) {
                this.renderFooter();
            }
        } catch (error) {
            console.error('Ошибка при загрузке данных футера:', error);
        }
    }

    getCurrentLanguage() {
        const lang = localStorage.getItem('selectedLanguage') || 'RU';
        return lang.toLowerCase();
    }

    getFooterText(field) {
        if (!this.footerData) return '';
        
        const lang = this.getCurrentLanguage();
        const langField = `${field}_${lang}`;
        
        // Пробуем получить текст на текущем языке
        if (this.footerData[langField]) {
            return this.footerData[langField];
        }
        
        // Если нет, используем русский как fallback
        return this.footerData[`${field}_ru`] || '';
    }

    renderFooter() {
        if (!this.footerData) return;

        // Обновляем адрес
        const addressElements = document.querySelectorAll('.address');
        addressElements.forEach(el => {
            const addressText = this.getFooterText('address');
            if (addressText) {
                el.textContent = addressText;
                // Добавляем data-атрибуты для многоязычности
                el.setAttribute('data-ru', this.footerData.address_ru || '');
                el.setAttribute('data-en', this.footerData.address_en || this.footerData.address_ru || '');
                el.setAttribute('data-kz', this.footerData.address_kz || this.footerData.address_ru || '');
            }
        });

        // Обновляем телефон
        const phoneElements = document.querySelectorAll('.footer__phone');
        phoneElements.forEach(el => {
            if (this.footerData.phone) {
                el.textContent = this.footerData.phone;
            }
        });

        // Обновляем email
        const emailElements = document.querySelectorAll('.footer__email');
        emailElements.forEach(el => {
            if (this.footerData.email) {
                el.textContent = this.footerData.email;
                // Обновляем href для mailto ссылок
                if (el.tagName === 'A' || el.closest('a')) {
                    const link = el.tagName === 'A' ? el : el.closest('a');
                    if (link) {
                        link.href = `mailto:${this.footerData.email}`;
                    }
                }
            }
        });

        // Обновляем расписание (рабочие часы + обеденный перерыв)
        const scheduleElements = document.querySelectorAll('.schedule');
        scheduleElements.forEach(el => {
            const workingHours = this.getFooterText('working_hours');
            const lunchBreak = this.getFooterText('lunch_break');
            
            if (workingHours || lunchBreak) {
                let scheduleText = '';
                if (workingHours) {
                    scheduleText = workingHours;
                }
                if (lunchBreak) {
                    scheduleText += scheduleText ? ' <br> ' + lunchBreak : lunchBreak;
                }
                el.innerHTML = scheduleText;
                
                // Добавляем data-атрибуты для многоязычности
                const workingHoursRu = this.footerData.working_hours_ru || '';
                const workingHoursEn = this.footerData.working_hours_en || workingHoursRu;
                const workingHoursKz = this.footerData.working_hours_kz || workingHoursRu;
                const lunchBreakRu = this.footerData.lunch_break_ru || '';
                const lunchBreakEn = this.footerData.lunch_break_en || lunchBreakRu;
                const lunchBreakKz = this.footerData.lunch_break_kz || lunchBreakRu;
                
                el.setAttribute('data-ru', (workingHoursRu + (lunchBreakRu ? ' <br> ' + lunchBreakRu : '')).trim());
                el.setAttribute('data-en', (workingHoursEn + (lunchBreakEn ? ' <br> ' + lunchBreakEn : '')).trim());
                el.setAttribute('data-kz', (workingHoursKz + (lunchBreakKz ? ' <br> ' + lunchBreakKz : '')).trim());
            }
        });

        // Обновляем язык после загрузки
        this.updateLanguage();
    }

    updateLanguage() {
        const lang = this.getCurrentLanguage();

        // Обновляем все элементы с data-атрибутами
        document.querySelectorAll('footer [data-ru][data-en][data-kz], .address[data-ru], .schedule[data-ru]').forEach(element => {
            const attr = `data-${lang}`;
            const text = element.getAttribute(attr);
            if (text) {
                element.innerHTML = text;
            }
        });
    }
}

// Инициализация при загрузке страницы
let footerLoader;

document.addEventListener('DOMContentLoaded', async () => {
    // Ждем инициализации Supabase
    let attempts = 0;
    while (typeof supabase === 'undefined' && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (typeof supabase === 'undefined') {
        console.warn('Supabase не инициализирован, данные футера не будут загружены');
        return;
    }

    footerLoader = new FooterLoader();
    await footerLoader.loadFooterData();
    
    // Слушаем изменения языка
    window.addEventListener('languageChanged', () => {
        if (footerLoader) {
            footerLoader.currentLanguage = localStorage.getItem('selectedLanguage') || 'RU';
            footerLoader.updateLanguage();
        }
    });

    window.addEventListener('storage', (e) => {
        if (e.key === 'selectedLanguage' && footerLoader) {
            footerLoader.currentLanguage = e.newValue || 'RU';
            footerLoader.updateLanguage();
        }
    });
    
    // Экспортируем для глобального доступа
    window.footerLoader = footerLoader;
});

